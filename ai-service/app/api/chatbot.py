"""
智能客服 API 路由
POST /api/chatbot
"""
import logging

from fastapi import APIRouter

from ..models import ChatbotRequest
from ..services import chatbot_service

logger = logging.getLogger("ai-service.api.chatbot")

router = APIRouter(tags=["智能客服"])


@router.post("/api/chatbot")
async def chatbot(req: ChatbotRequest):
    """
    智能客服接口
    - 基于 FAQ 知识库匹配回答(注册、发布、购买、校园认证、交易安全、退款、举报、审核等)
    - 匹配不到时返回通用回复并标记需人工客服
    """
    try:
        data = await chatbot_service.chat(req.message, req.context)
        return {"code": 200, "message": "success", "data": data}
    except Exception as e:
        logger.exception("客服接口异常: %s", e)
        return {
            "code": 500,
            "message": f"客服服务异常: {e}",
            "data": {"reply": "服务暂时不可用,请稍后再试或联系人工客服。", "needHuman": True},
        }
