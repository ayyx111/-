"""
数据库连接模块
- 使用 aiomysql 维护 MySQL 异步连接池
- 使用 redis.asyncio 维护 Redis 连接(用于缓存)
- 连接失败时服务仍可启动,接口会优雅降级(返回空数据)
"""
import logging

import aiomysql
import redis.asyncio as aioredis

from .config import settings

logger = logging.getLogger("ai-service.database")

# 全局连接对象(在 lifespan 中初始化)
mysql_pool: "aiomysql.Pool | None" = None
redis_client: "aioredis.Redis | None" = None


async def init_db() -> None:
    """初始化 MySQL 连接池与 Redis 连接"""
    global mysql_pool, redis_client

    # 初始化 MySQL 连接池
    try:
        mysql_pool = await aiomysql.create_pool(
            host=settings.DB_HOST,
            port=settings.DB_PORT,
            user=settings.DB_USER,
            password=settings.DB_PASSWORD,
            db=settings.DB_NAME,
            charset="utf8mb4",
            autocommit=True,
            minsize=1,
            maxsize=10,
        )
        logger.info("MySQL 连接池创建成功: %s@%s:%s/%s",
                    settings.DB_USER, settings.DB_HOST, settings.DB_PORT, settings.DB_NAME)
    except Exception as e:  # 连接失败不阻断启动
        logger.error("MySQL 连接失败: %s", e)
        mysql_pool = None

    # 初始化 Redis 连接
    try:
        redis_client = aioredis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            password=settings.REDIS_PASSWORD or None,
            decode_responses=True,
        )
        await redis_client.ping()
        logger.info("Redis 连接成功: %s:%s", settings.REDIS_HOST, settings.REDIS_PORT)
    except Exception as e:
        logger.error("Redis 连接失败: %s", e)
        redis_client = None


async def close_db() -> None:
    """关闭数据库连接"""
    global mysql_pool, redis_client
    if mysql_pool is not None:
        mysql_pool.close()
        await mysql_pool.wait_closed()
        mysql_pool = None
    if redis_client is not None:
        await redis_client.aclose()
        redis_client = None


async def fetch(sql: str, args: tuple | None = None) -> dict | None:
    """查询单条记录,返回字典;连接不可用时返回 None"""
    if mysql_pool is None:
        return None
    async with mysql_pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(sql, args)
            return await cur.fetchone()


async def fetchall(sql: str, args: tuple | None = None) -> list:
    """查询多条记录,返回字典列表;连接不可用时返回空列表"""
    if mysql_pool is None:
        return []
    async with mysql_pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(sql, args)
            return await cur.fetchall()


async def cache_get(key: str):
    """读取 Redis 缓存,不可用时返回 None"""
    if redis_client is None:
        return None
    try:
        return await redis_client.get(key)
    except Exception as e:
        logger.warning("Redis 读取失败: %s", e)
        return None


async def cache_set(key: str, value: str, ttl: int = 300) -> None:
    """写入 Redis 缓存,不可用时静默跳过"""
    if redis_client is None:
        return
    try:
        await redis_client.set(key, value, ex=ttl)
    except Exception as e:
        logger.warning("Redis 写入失败: %s", e)
