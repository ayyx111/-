"""
内容审核服务(双层审核)
第一层:规则词表快速检测违禁/敏感词(秒级,零成本)
第二层:规则无命中时调用 GLM-4-Flash 进行语义级审核(识别隐晦违规)
LLM 不可用时降级为纯规则审核,不影响业务。
"""
import json
import logging
from app.services.llm_client import llm_client, LLMError

logger = logging.getLogger("ai-service.review")

# 违禁词列表(直接拒绝):违法、危险、平台禁止交易品类
BANNED_WORDS = [
    # 假冒伪劣
    "假冒", "假货", "高仿", "精仿", "A货", "a货", "1:1", "1比1", "山寨", "造假",
    # 危险物品
    "枪支", "气枪", "枪械", "刀具", "管制刀具", "匕首", "弩", "弓箭", "弹弓",
    "爆炸物", "炸药", "雷管", "烟花", "爆竹", "弹药", "子弹",
    # 毒品药品
    "毒品", "大麻", "冰毒", "摇头丸", "药品", "处方药", "麻醉药", "兴奋剂",
    # 违法违规
    "赃物", "偷来", "盗窃", "走私", "假钞", "假币", "伪造", "刻章", "办证",
    # 信息/隐私
    "身份证", "银行卡", "信用卡", "手机号", "个人信息", "学生信息", "学信网",
    # 学术不端
    "代写", "代考", "替考", "作弊", "作弊器", "考试答案", "论文代写", "枪手",
    # 不良信息
    "色情", "裸聊", "性服务", "赌博", "博彩", "彩票", "刷单", "刷信誉",
    # 保护动植物
    "象牙", "犀牛角", "保护动物", "野生动物",
    # 其他
    "烟草", "香烟", "电子烟", "酒", "白酒", "管制器具",
]

# 敏感词列表(标记可疑,提示修改):引导脱离平台交易等风险行为
SENSITIVE_WORDS = [
    "私下交易", "线下转账", "微信转账", "支付宝转账", "绕过平台", "脱离平台",
    "加微信", "加QQ", "加qq", "加v", "加V", "扫码付款", "二维码付款",
    "定金", "预付款", "先付款", "包邮出",  # 包邮出本身不违规,但常搭配风险,标记可疑
]

# 价格异常阈值
PRICE_TOO_LOW = 0  # 价格 <= 0 视为异常
PRICE_TOO_HIGH = 100000  # 价格 > 10万 视为可疑


# ============ LLM 审核相关 ============

LLM_REVIEW_SYSTEM_PROMPT = """你是「校园版咸鱼」二手交易平台的内容审核员。
你的任务是判断一个商品发布内容是否合规。

【平台规则】
禁止发布:假冒伪劣、危险物品(刀具/枪支/爆炸物)、毒品药品、赃物/走私、
        个人隐私信息、代写代考等学术不端、色情赌博、保护动植物、烟酒等。
限制发布:引导脱离平台交易(加微信/线下转账/扫码付款)、过高定价、虚假宣传等。

【输出格式】
必须严格输出 JSON,不要包含任何额外文字或代码块标记:
{"result": "pass" | "suspicious" | "reject", "reason": "简要说明原因(15字内)"}

判定标准:
- pass: 正常的二手商品,无明显违规
- suspicious: 有潜在风险或打擦边球,建议人工复审
- reject: 明确违规,应直接拒绝
"""


def _parse_llm_review_reply(reply: str) -> dict | None:
    """解析 LLM 返回的 JSON,容错处理"""
    try:
        # 去除可能的 markdown 代码块标记
        cleaned = reply.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        # 找到第一个 { 和最后一个 }
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start >= 0 and end > start:
            cleaned = cleaned[start:end + 1]
        data = json.loads(cleaned)
        result = data.get("result", "pass")
        reason = data.get("reason", "")
        if result not in ("pass", "suspicious", "reject"):
            result = "pass"
        return {"result": result, "reason": reason}
    except Exception as e:
        logger.warning(f"解析 LLM 审核回复失败: {e},原始回复: {reply[:200]}")
        return None


def _llm_review(title: str, description: str, price: float | None) -> dict | None:
    """调用 LLM 进行语义级审核,失败返回 None"""
    if not llm_client.available:
        return None
    try:
        user_msg = (
            f"标题:{title}\n"
            f"描述:{description}\n"
            f"价格:{price if price is not None else '未填'} 元\n"
            f"请审核上述商品内容,严格按 JSON 格式输出审核结果。"
        )
        reply = llm_client.chat(
            system_prompt=LLM_REVIEW_SYSTEM_PROMPT,
            user_message=user_msg,
            temperature=0.1,  # 审核场景需要确定性
        )
        return _parse_llm_review_reply(reply)
    except LLMError as e:
        logger.warning(f"LLM 审核调用失败: {e}")
        return None


async def review(title: str, description: str, price: float | None = None) -> dict:
    """
    内容审核主流程(双层)
    第一层:规则词表检测违禁词/敏感词/价格异常(快,零成本)
    第二层:规则无命中时调用 LLM 进行语义级审核(识别隐晦违规)
    LLM 不可用时降级为纯规则审核
    返回: { result, reason, source: 'rule' | 'llm' }
    """
    text = f"{title or ''} {description or ''}"

    # ===== 第一层:规则词表快速检测 =====

    # 1. 违禁词检测(直接拒绝)
    for word in BANNED_WORDS:
        if word in text:
            return {
                "result": "reject",
                "reason": f"内容包含违禁词「{word}」,违反平台规定,禁止发布",
                "source": "rule",
            }

    # 2. 敏感词检测(标记可疑)
    for word in SENSITIVE_WORDS:
        if word in text:
            return {
                "result": "suspicious",
                "reason": f"内容包含敏感词「{word}」,存在交易风险,建议修改后再发布",
                "source": "rule",
            }

    # 3. 价格异常检测
    if price is not None:
        if price <= PRICE_TOO_LOW:
            return {
                "result": "reject",
                "reason": "价格异常:售价必须大于 0 元",
                "source": "rule",
            }
        if price > PRICE_TOO_HIGH:
            return {
                "result": "suspicious",
                "reason": f"价格异常:售价 {price} 元过高,请确认价格是否填写正确",
                "source": "rule",
            }

    # 4. 内容过短检测(可疑)
    if not title or len(title.strip()) < 2:
        return {
            "result": "suspicious",
            "reason": "商品标题过短,建议填写更完整的标题便于买家搜索",
            "source": "rule",
        }

    # ===== 第二层:LLM 语义级审核 =====
    # 规则无命中,但可能存在隐晦违规(如"作业代做"、"陪练"、"刷信誉"等)
    llm_result = _llm_review(title, description, price)
    if llm_result:
        if llm_result["result"] != "pass":
            return {
                "result": llm_result["result"],
                "reason": f"[AI 语义审核]{llm_result['reason']}",
                "source": "llm",
            }
        # LLM 也通过,合并返回
        return {
            "result": "pass",
            "reason": f"[AI 语义审核]内容合规,{llm_result['reason']}",
            "source": "llm",
        }

    # LLM 不可用,纯规则审核通过
    return {"result": "pass", "reason": "内容审核通过", "source": "rule"}
