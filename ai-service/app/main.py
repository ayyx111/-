"""
FastAPI 应用入口
启动命令: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from .database import init_db, close_db
from .api import recommend, search, chatbot, review

# 日志配置
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ai-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期:启动时初始化数据库,关闭时释放连接"""
    logger.info("AI 服务启动中...")
    await init_db()
    yield
    logger.info("AI 服务关闭中...")
    await close_db()


app = FastAPI(
    title="校园版咸鱼 AI 服务",
    description="校园二手交易平台 AI 服务:智能推荐 / 智能搜索 / 智能客服 / 内容审核",
    version="1.0.0",
    lifespan=lifespan,
)

# 注册路由
app.include_router(recommend.router)
app.include_router(search.router)
app.include_router(chatbot.router)
app.include_router(review.router)


@app.get("/", tags=["默认"])
async def root():
    """根路径,服务状态探活"""
    return {
        "service": "校园版咸鱼 AI 服务",
        "status": "running",
        "docs": "/docs",
        "endpoints": [
            "GET /api/recommend",
            "GET /api/search",
            "POST /api/chatbot",
            "POST /api/review",
        ],
    }


@app.get("/health", tags=["默认"])
async def health():
    """健康检查"""
    return {"status": "ok"}
