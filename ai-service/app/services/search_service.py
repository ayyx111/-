"""
智能搜索服务
1. 关键词分词(简单中文分词:按标点/空格拆分)
2. 同义词扩展(优先用 LLM 动态扩展,LLM 不可用降级为静态词典)
3. 数据库 LIKE 查询匹配
4. 相关度排序(标题完全匹配 > 标题包含 > 描述包含)
5. 无结果时推荐相似商品
"""
import json
import logging
import re

from ..database import fetchall, fetch
from .recommend_service import _format_product, _cover_subquery, ON_SALE
from .llm_client import llm_client, LLMError

logger = logging.getLogger("ai-service.search")

# 同义词词典(关键词 -> [扩展词])
SYNONYM_DICT = {
    "高数": ["高等数学", "高等数学教材", "微积分", "数学分析"],
    "线代": ["线性代数", "线性代数教材"],
    "概率论": ["概率统计", "数理统计"],
    "耳机": ["耳麦", "头戴式耳机", "蓝牙耳机", "入耳式耳机"],
    "耳麦": ["耳机", "头戴式耳机"],
    "电脑": ["笔记本", "台式机", "笔记本电脑", "laptop"],
    "笔记本": ["电脑", "笔记本电脑"],
    "手机": ["智能手机", "移动电话"],
    "平板": ["平板电脑", "ipad"],
    "键盘": ["机械键盘", "薄膜键盘"],
    "鼠标": ["电脑鼠标", "无线鼠标"],
    "充电器": ["电源适配器", "快充"],
    "教材": ["课本", "教科书"],
    "课本": ["教材", "教科书"],
    "自行车": ["单车", "bike"],
    "单车": ["自行车"],
    "球鞋": ["运动鞋", "篮球鞋"],
    "裙子": ["连衣裙", "半身裙"],
    "外套": ["夹克", "上衣"],
    "台灯": ["护眼灯", "学习灯"],
    "计算器": ["科学计算器", "卡西欧"],
    "考研": ["考研资料", "考研真题"],
    "四六级": ["英语四级", "英语六级", "CET4", "CET6"],
}

# 热搜词 Redis Key
HOT_SEARCH_KEY = "ai:search:hot"


def tokenize(text: str) -> list:
    """简单中文分词:按标点/空格切分,保留有意义的词"""
    if not text:
        return []
    text = text.strip()
    # 按空白与常见标点分割
    parts = re.split(r"[\s,，。、;；:：!！?？/\\\-—()()【】\[\]]+", text)
    tokens = [p for p in parts if p]
    # 若分割后为空(纯中文无分隔),按单字 + 双字组合兜底
    if not tokens:
        cleaned = re.sub(r"[\s\W_]+", "", text, flags=re.UNICODE)
        tokens = [cleaned] if cleaned else list(text)
    return tokens


def expand_synonyms(tokens: list) -> list:
    """
    同义词扩展,返回去重后的扩展词列表(不包含原词)
    优先用 LLM 动态扩展(更全面、可识别新词),LLM 不可用时降级为静态词典
    """
    if not tokens:
        return []

    # 先用静态词典扩展(保证基础功能)
    expanded = []
    seen = set(tokens)
    for token in tokens:
        for syn in SYNONYM_DICT.get(token, []):
            if syn not in seen:
                expanded.append(syn)
                seen.add(syn)

    # 尝试用 LLM 扩展(补充静态词典未覆盖的同义词)
    if llm_client.available:
        try:
            llm_syns = _llm_expand_synonyms(tokens)
            for syn in llm_syns:
                if syn and syn not in seen:
                    expanded.append(syn)
                    seen.add(syn)
        except LLMError as e:
            logger.warning(f"LLM 同义词扩展失败,降级为纯静态词典: {e}")

    return expanded


def _llm_expand_synonyms(tokens: list) -> list:
    """调用 LLM 扩展同义词,返回 JSON 字符串列表"""
    system_prompt = (
        "你是二手交易平台搜索助手。任务:为给定的搜索关键词生成同义词/近义词/常见全称,\n"
        "用于扩展商品搜索召回。要求:\n"
        "1. 每个词不超过 8 个汉字;\n"
        "2. 只输出常见的、可能出现在商品标题中的词;\n"
        "3. 不重复原词;\n"
        "4. 严格输出 JSON 数组,不要包含任何额外文字。示例:[\"高等数学\",\"微积分\"]"
    )
    user_msg = f"关键词:{','.join(tokens)}\n请输出同义词 JSON 数组。"
    reply = llm_client.chat(system_prompt, user_msg, temperature=0.5)
    try:
        cleaned = reply.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        start = cleaned.find("[")
        end = cleaned.rfind("]")
        if start >= 0 and end > start:
            cleaned = cleaned[start:end + 1]
        result = json.loads(cleaned)
        if isinstance(result, list):
            return [str(x) for x in result if x][:8]  # 最多取 8 个,避免过多
    except Exception as e:
        logger.warning(f"解析 LLM 同义词扩展回复失败: {e},原始: {reply[:200]}")
    return []


async def search(keyword: str, page: int = 1, page_size: int = 20) -> dict:
    """
    智能搜索主流程
    返回: { list, expandedKeywords, suggestion, pagination }
    """
    keyword = (keyword or "").strip()
    if not keyword:
        return {
            "list": [],
            "expandedKeywords": [],
            "suggestion": "",
            "pagination": {"page": page, "pageSize": page_size, "total": 0, "totalPages": 0},
        }

    # 1. 分词
    tokens = tokenize(keyword)
    # 2. 同义词扩展
    expanded = expand_synonyms(tokens)
    # 全部检索词(原词 + 扩展词)
    all_terms = list(dict.fromkeys(tokens + expanded))

    # 3. 构建 LIKE 查询
    where_clauses = []
    args = []
    for term in all_terms:
        where_clauses.append("(p.title LIKE %s OR p.description LIKE %s)")
        args.extend([f"%{term}%", f"%{term}%"])
    where_sql = " OR ".join(where_clauses)

    # 统计总数
    count_sql = f"SELECT COUNT(*) AS total FROM products p WHERE p.status = %s AND ({where_sql})"
    count_row = await fetch(count_sql, (ON_SALE,) + tuple(args))
    total = count_row.get("total", 0) if count_row else 0

    # 分页查询
    offset = (page - 1) * page_size
    list_sql = f"""
        SELECT p.id, p.title, p.price, p.description, p.view_count, p.favorite_count, {_cover_subquery()}
        FROM products p
        WHERE p.status = %s AND ({where_sql})
        LIMIT %s OFFSET %s
    """
    rows = await fetchall(list_sql, (ON_SALE,) + tuple(args) + (page_size, offset))

    # 4. 相关度排序
    scored = []
    for r in rows:
        title = r.get("title", "") or ""
        desc = r.get("description", "") or ""
        score = 0
        for term in all_terms:
            if term in title:
                score += 3 if title == term else 2  # 标题完全匹配 > 标题包含
            elif term in desc:
                score += 1  # 描述包含
        r["_score"] = score
        scored.append(r)
    # 按相关度降序,再按热度降序
    scored.sort(key=lambda x: (x["_score"],
                               x.get("view_count", 0) + x.get("favorite_count", 0) * 3),
                reverse=True)

    result_list = [_format_product(r, r["_score"]) for r in scored]

    # 5. 无结果时推荐相似商品
    suggestion = ""
    if total == 0:
        # 用第一个词在标题中模糊匹配,推荐相关商品
        fallback_term = tokens[0] if tokens else keyword
        fb_sql = f"""
            SELECT p.id, p.title, p.price, p.view_count, p.favorite_count, {_cover_subquery()}
            FROM products p
            WHERE p.status = %s AND p.title LIKE %s
            LIMIT %s
        """
        fb_rows = await fetchall(fb_sql, (ON_SALE, f"%{fallback_term}%", page_size))
        result_list = [_format_product(r, 0.0) for r in fb_rows]
        if expanded:
            suggestion = f"未找到「{keyword}」相关商品,已为您推荐相近商品;您还可以试试:{'、'.join(expanded[:3])}"
        else:
            suggestion = f"未找到「{keyword}」相关商品,已为您推荐相近商品"

    return {
        "list": result_list,
        "expandedKeywords": expanded,
        "suggestion": suggestion,
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "total": total,
            "totalPages": (total + page_size - 1) // page_size if page_size > 0 else 0,
        },
    }
