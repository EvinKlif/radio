# from fastapi import FastAPI, Depends, HTTPException, Request
# from fastapi.responses import StreamingResponse
# from redis import asyncio as aioredis
# from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
# from sqlalchemy import select
# import asyncio
# from pydantic import BaseModel
# import os
#
# from starlette.middleware.cors import CORSMiddleware
#
# from DataBase.session import get_session, engine
# from Models.track_info import TrackInfo
# from Routers import tracks
#
# REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
#
#
# class TrackInfoResponse(BaseModel):
#     artist: str
#     title: str
#     cover_url: str
#
#
# app = FastAPI()
#
# app.include_router(tracks.router)
#
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["http://localhost:5173"],  # Укажите ваш фронтенд-адрес
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )
#
# # Инициализация Redis при старте
# @app.on_event("startup")
# async def startup():
#     try:
#         app.state.redis = await aioredis.from_url(REDIS_URL, decode_responses=True)
#         app.state.async_session = async_sessionmaker(engine, expire_on_commit=False)
#         print("Redis and DB initialized successfully")
#     except Exception as e:
#         print(f"Initialization error: {e}")
#         raise
#
#
# @app.get("/track-updates")
# async def track_updates(request: Request):
#     """SSE endpoint для отслеживания изменений last_track в Redis"""
#     if not hasattr(request.app.state, 'redis'):
#         raise HTTPException(status_code=500, detail="Redis not initialized")
#
#     async def event_stream():
#         redis = request.app.state.redis
#         pubsub = redis.pubsub()
#         await pubsub.subscribe("track_updates")
#
#         try:
#             while True:
#                 message = await pubsub.get_message(ignore_subscribe_messages=True)
#                 if message and message['channel'] == 'track_updates':
#                     track_name = message['data']
#                     yield f"data: {track_name}\n\n"
#
#                 current_track = await redis.get("last_track")
#                 if hasattr(event_stream, 'last_track') and event_stream.last_track != current_track:
#                     yield f"data: {current_track}\n\n"
#
#                 event_stream.last_track = current_track
#                 await asyncio.sleep(0.5)
#         finally:
#             await pubsub.unsubscribe("track_updates")
#
#     return StreamingResponse(event_stream(), media_type="text/event-stream")
#
#
# @app.get("/track-info/", response_model=TrackInfoResponse)
# async def get_track_info(request: Request, db: AsyncSession = Depends(get_session)):
#     if not hasattr(request.app.state, 'redis'):
#         raise HTTPException(status_code=500, detail="Redis not initialized")
#
#     track_name = await request.app.state.redis.get("last_track")
#     if not track_name:
#         raise HTTPException(status_code=404, detail="No track in Redis")
#
#     clean_name = track_name.replace('.mp3', '').strip()
#     result = await db.execute(select(TrackInfo).where(TrackInfo.title == clean_name))
#     track = result.scalars().first()
#
#     if not track:
#         raise HTTPException(
#             status_code=404,
#             detail=f"Track '{clean_name}' not found in database"
#         )
#
#     return TrackInfoResponse(
#         artist=track.artist,
#         title=track.title,
#         cover_url=track.cover_url
#     )
#
#
# @app.on_event("shutdown")
# async def shutdown():
#     if hasattr(app.state, 'redis'):
#         await app.state.redis.close()
#     if hasattr(app.state, 'engine'):
#         await app.state.engine.dispose()
#
#
# @app.on_event("startup")
# async def startup():
#     app.state.redis = await aioredis.from_url(REDIS_URL, decode_responses=True)


from fastapi import FastAPI
from redis import asyncio as aioredis
from sqlalchemy.ext.asyncio import async_sessionmaker
from starlette.middleware.cors import CORSMiddleware
import os

from DataBase.session import engine
from Routers import track_router, tracks

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

app = FastAPI()

app = FastAPI(title="Radio", version="1.0.0", docs_url="/setdocs", redoc_url=None, openapi_url="/setdocs-json")


app.include_router(track_router.router)
app.include_router(tracks.router)

app.root_path = "/api"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    app.state.redis = await aioredis.from_url(REDIS_URL, decode_responses=True)
    app.state.async_session = async_sessionmaker(engine, expire_on_commit=False)
    print("Redis and DB initialized successfully")

@app.on_event("shutdown")
async def shutdown():
    if hasattr(app.state, 'redis'):
        await app.state.redis.close()
    if hasattr(app.state, 'engine'):
        await app.state.engine.dispose()
