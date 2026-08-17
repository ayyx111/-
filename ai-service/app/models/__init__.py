"""
请求/响应数据模型(基于 Pydantic)
"""
from typing import List, Optional

from pydantic import BaseModel, Field


class ChatbotRequest(BaseModel):
    """智能客服请求体"""
    message: str = Field(..., description="用户问题")
    context: Optional[List[dict]] = Field(default=[], description="上下文历史")


class ReviewRequest(BaseModel):
    """内容审核请求体"""
    title: str = Field(..., description="商品标题")
    description: str = Field(..., description="商品描述")
    price: Optional[float] = Field(default=None, description="售价(可选,用于价格异常检测)")


class ProductItem(BaseModel):
    """推荐/搜索返回的商品结构"""
    id: int
    title: str
    price: float
    coverImage: Optional[str] = None
    score: float = 0.0
