"""
智能推荐 API 路由
GET /api/recommend
"""
import logging

from fastapi import APIRouter, Query

from ..services import recommend_service

logger = logging.getLogger("ai-service.api.recommend")

router = APIRouter(tags=["智能推荐"])


@router.get("/api/recommend")
async def recommend(
    userId: int | None = Query(default=None, description="用户ID(可选,登录用户传入)"),
    type: str = Query(default="home", description="推荐类型:home(首页)/similar(相似商品)"),
    productId: int | None = Query(default=None, description="相似推荐时传入的目标商品ID"),
    limit: int = Query(default=10, ge=1, le=50, description="返回数量,默认10"),
):
    """
    智能推荐接口
    - 登录用户(type=home,传 userId):基于浏览历史 + 收藏的个性化推荐
    - 未登录用户(type=home,不传 userId):基于热度的热门商品推荐
    - 相似推荐(type=similar,传 productId):基于分类 + 关键词的相似商品
    """
    try:
        if type == "similar":
            if not productId:
                return {"code": 400, "message": "相似推荐需传入 productId", "data": []}
            data = await recommend_service.similar_recommend(productId, limit)
        elif userId:
            data = await recommend_service.personal_recommend(userId, limit)
        else:
            data = await recommend_service.hot_recommend(limit)
        return {"code": 200, "message": "success", "data": data}
    except Exception as e:
        logger.exception("推荐接口异常: %s", e)
        return {"code": 500, "message": f"推荐服务异常: {e}", "data": []}
