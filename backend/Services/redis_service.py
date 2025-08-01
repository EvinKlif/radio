from redis import asyncio as aioredis
import os

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

async def init_redis(app):
    """Инициализация Redis соединения"""
    try:
        app.state.redis = await aioredis.from_url(REDIS_URL, decode_responses=True)
        print("Redis initialized successfully")
    except Exception as e:
        print(f"Redis initialization error: {e}")
        raise

async def close_redis(app):
    """Закрытие Redis соединения"""
    if hasattr(app.state, 'redis'):
        await app.state.redis.close()