"""
应用配置模块
通过环境变量读取配置,未设置时使用默认值,便于本地开发与Docker部署。
启动时优先加载 .env 文件(若存在),便于本地开发。
"""
import os
from pathlib import Path

from dotenv import load_dotenv

# 加载 ai-service/.env(若存在),必须在读取 os.getenv 之前完成
_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
if _ENV_PATH.exists():
    load_dotenv(_ENV_PATH, override=False)


class Settings:
    # MySQL 数据库配置
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: int = int(os.getenv("DB_PORT", "3306"))
    DB_USER: str = os.getenv("DB_USER", "root")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "root")
    DB_NAME: str = os.getenv("DB_NAME", "campus_fish")

    # Redis 配置
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_DB: int = int(os.getenv("REDIS_DB", "0"))
    REDIS_PASSWORD: str = os.getenv("REDIS_PASSWORD", "")

    # 服务端口
    APP_PORT: int = int(os.getenv("APP_PORT", "8000"))

    # 热门商品缓存时间(秒)
    HOT_CACHE_TTL: int = int(os.getenv("HOT_CACHE_TTL", "300"))

    # ============ LLM 大模型配置(智谱 GLM-4-Flash) ============
    LLM_API_KEY: str = os.getenv("LLM_API_KEY", "")
    LLM_BASE_URL: str = os.getenv("LLM_BASE_URL", "https://open.bigmodel.cn/api/paas/v4")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "glm-4-flash")
    LLM_TEMPERATURE: float = float(os.getenv("LLM_TEMPERATURE", "0.3"))
    LLM_TIMEOUT: int = int(os.getenv("LLM_TIMEOUT", "15"))


settings = Settings()
