"""
智能搜索 API 路由
GET /api/search
"""
import logging

from fastapi import APIRouter, Query

from ..services import search_service

logger = logging.getLogger("ai-service.api.search")

router = APIRouter(tags=["智能搜索"])


@router.get("/api/search")
async def search(
    keyword: str = Query(..., description="搜索关键词"),
    page: int = Query(default=1, ge=1, description="页码,从1开始"),
    pageSize: int = Query(default=20, ge=1, le=100, description="每页数量,默认20"),
):
    """
    智能搜索接口
    - 关键词分词、同义词扩展(如"高数" → 高等数学、微积分)
    - 数据库匹配 + 相关度排序(标题完全匹配 > 标题包含 > 描述包含)
    - 无结果时推荐相近商品
    """
    try:
        data = await search_service.search(keyword, page, pageSize)
        return {"code": 200, "message": "success", "data": data}
    except Exception as e:
        logger.exception("搜索接口异常: %s", e)
        return {
            "code": 500,
            "message": f"搜索服务异常: {e}",
            "data": {
                "list": [],
                "expandedKeywords": [],
                "suggestion": "",
                "pagination": {"page": page, "pageSize": pageSize, "total": 0, "totalPages": 0},
            },
        }
