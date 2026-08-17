"""
内容审核 API 路由
POST /api/review
"""
import logging

from fastapi import APIRouter

from ..models import ReviewRequest
from ..services import review_service

logger = logging.getLogger("ai-service.api.review")

router = APIRouter(tags=["内容审核"])


@router.post("/api/review")
async def review(req: ReviewRequest):
    """
    商品内容审核接口
    - 检测标题与描述中的违禁词/敏感词
    - 检测价格异常(0元或过高)
    - 返回: pass(通过)/ suspicious(可疑)/ reject(拒绝)
    """
    try:
        data = await review_service.review(req.title, req.description, req.price)
        return {"code": 200, "message": "success", "data": data}
    except Exception as e:
        logger.exception("审核接口异常: %s", e)
        return {
            "code": 500,
            "message": f"审核服务异常: {e}",
            "data": {"result": "suspicious", "reason": "审核服务暂时不可用,请稍后重试"},
        }
