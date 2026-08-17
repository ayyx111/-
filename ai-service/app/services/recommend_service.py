"""
智能推荐服务
提供三种推荐策略:
1. 个性化推荐(登录用户):基于浏览历史 + 收藏的协同过滤(基于内容的简化版)
2. 热门推荐(未登录用户):基于近期浏览量/收藏量的热度排序
3. 相似商品推荐:基于商品分类 + 标题关键词相似度
"""
import json
import logging
import re
from collections import Counter

from ..database import fetch, fetchall, cache_get, cache_set
from ..config import settings

logger = logging.getLogger("ai-service.recommend")

# 商品状态:1=在售
ON_SALE = 1


def _format_product(row: dict, score: float = 0.0) -> dict:
    """格式化商品行,统一输出字段(cover_image -> coverImage)"""
    return {
        "id": row.get("id"),
        "title": row.get("title", ""),
        "price": float(row.get("price") or 0),
        "coverImage": row.get("cover_image"),
        "score": round(float(score), 3),
    }


def _cover_subquery() -> str:
    """商品封面图子查询(取排序最靠前的一张)"""
    return (
        "(SELECT pi.image_url FROM product_images pi "
        "WHERE pi.product_id = p.id ORDER BY pi.sort_order ASC LIMIT 1) AS cover_image"
    )


def _extract_keywords(text: str) -> set:
    """从标题中提取关键词集合(字符 + 二元组),用于相似度计算"""
    if not text:
        return set()
    # 去除标点和空白
    cleaned = re.sub(r"[\s\W_]+", "", text, flags=re.UNICODE)
    tokens = set(cleaned)
    # 二元组
    for i in range(len(cleaned) - 1):
        tokens.add(cleaned[i:i + 2])
    return tokens


async def hot_recommend(limit: int = 10) -> list:
    """
    热门推荐(未登录用户)
    按热度评分排序:热度 = 浏览量 + 收藏量 * 3
    """
    # 优先读 Redis 缓存
    cache_key = f"ai:recommend:hot:{limit}"
    cached = await cache_get(cache_key)
    if cached:
        try:
            return json.loads(cached)
        except Exception:
            pass

    sql = f"""
        SELECT p.id, p.title, p.price, p.view_count, p.favorite_count, {_cover_subquery()}
        FROM products p
        WHERE p.status = %s
        ORDER BY (p.view_count + p.favorite_count * 3) DESC, p.created_at DESC
        LIMIT %s
    """
    rows = await fetchall(sql, (ON_SALE, limit))

    # 计算归一化热度评分(0~1)
    max_hot = max((r.get("view_count", 0) + r.get("favorite_count", 0) * 3 for r in rows), default=1) or 1
    result = []
    for r in rows:
        hot = r.get("view_count", 0) + r.get("favorite_count", 0) * 3
        score = 0.5 + 0.5 * (hot / max_hot)  # 热门商品基础分 0.5 起
        result.append(_format_product(r, min(score, 1.0)))

    # 写入缓存
    await cache_set(cache_key, json.dumps(result, ensure_ascii=False), settings.HOT_CACHE_TTL)
    return result


async def personal_recommend(user_id: int, limit: int = 10) -> list:
    """
    个性化推荐(登录用户)
    1. 获取用户浏览历史和收藏记录
    2. 统计用户偏好的分类(收藏权重更高)
    3. 从偏好分类中推荐用户未浏览的商品
    4. 按相关度评分排序(分类偏好 + 商品热度)
    """
    # 1. 浏览历史(含分类)
    browsed = await fetchall(
        "SELECT product_id, category_id FROM user_browse_history WHERE user_id = %s",
        (user_id,),
    )
    # 2. 收藏记录的商品分类
    favorites = await fetchall(
        "SELECT p.category_id FROM favorites f JOIN products p ON f.product_id = p.id WHERE f.user_id = %s",
        (user_id,),
    )

    # 统计分类偏好(收藏权重=2,浏览权重=1)
    cat_counter: Counter = Counter()
    for row in browsed:
        if row.get("category_id"):
            cat_counter[row["category_id"]] += 1
    for row in favorites:
        if row.get("category_id"):
            cat_counter[row["category_id"]] += 2

    # 无历史记录则退化为热门推荐
    if not cat_counter:
        logger.info("用户 %s 无浏览/收藏记录,退化为热门推荐", user_id)
        return await hot_recommend(limit)

    # 取偏好最高的前 5 个分类
    preferred_cats = [c for c, _ in cat_counter.most_common(5)]
    browsed_ids = [r["product_id"] for r in browsed if r.get("product_id")]

    # 3. 查询偏好分类下的在售商品
    cat_ph = ",".join(["%s"] * len(preferred_cats))
    sql = f"""
        SELECT p.id, p.title, p.price, p.category_id, p.view_count, p.favorite_count, {_cover_subquery()}
        FROM products p
        WHERE p.status = %s AND p.category_id IN ({cat_ph})
    """
    args: list = [ON_SALE] + list(preferred_cats)
    # 排除已浏览过的商品
    if browsed_ids:
        ex_ph = ",".join(["%s"] * len(browsed_ids))
        sql += f" AND p.id NOT IN ({ex_ph})"
        args += browsed_ids
    sql += " LIMIT %s"
    args.append(limit * 5)  # 多取一些用于打分排序

    rows = await fetchall(sql, tuple(args))

    # 4. 相关度评分
    max_hot = max((r.get("view_count", 0) + r.get("favorite_count", 0) * 3 for r in rows), default=1) or 1
    scored = []
    for r in rows:
        score = 0.0
        # 分类偏好权重 0.4
        score += min(cat_counter.get(r.get("category_id"), 0) / 10.0, 1.0) * 0.4
        # 热度权重 0.4
        hot = r.get("view_count", 0) + r.get("favorite_count", 0) * 3
        score += (hot / max_hot) * 0.4
        # 基础分 0.2
        score += 0.2
        scored.append(_format_product(r, min(score, 1.0)))

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:limit]


async def similar_recommend(product_id: int, limit: int = 10) -> list:
    """
    相似商品推荐
    1. 获取目标商品的分类和关键词
    2. 查询同分类商品
    3. 计算标题关键词相似度
    4. 返回相似度最高的商品
    """
    # 1. 获取目标商品
    target = await fetch(
        "SELECT id, category_id, title FROM products WHERE id = %s",
        (product_id,),
    )
    if not target:
        return []

    target_kws = _extract_keywords(target.get("title", ""))
    category_id = target.get("category_id")

    # 2. 查询同分类的在售商品(排除自身)
    sql = f"""
        SELECT p.id, p.title, p.price, p.view_count, p.favorite_count, {_cover_subquery()}
        FROM products p
        WHERE p.status = %s AND p.category_id = %s AND p.id <> %s
        LIMIT %s
    """
    rows = await fetchall(sql, (ON_SALE, category_id, product_id, limit * 5))

    # 3. 计算相似度
    scored = []
    for r in rows:
        kws = _extract_keywords(r.get("title", ""))
        if not target_kws or not kws:
            sim = 0.0
        else:
            # Jaccard 相似度
            intersection = len(target_kws & kws)
            union = len(target_kws | kws)
            sim = intersection / union if union else 0.0
        # 相似度为主,热度为辅
        hot = r.get("view_count", 0) + r.get("favorite_count", 0) * 3
        score = sim * 0.8 + min(hot / 100.0, 1.0) * 0.2
        scored.append(_format_product(r, score))

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:limit]
