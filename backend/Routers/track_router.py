from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
import asyncio

from DataBase.session import get_session
from Schemas.track import TrackInfoResponse
from Services.service import TrackService

router = APIRouter()

@router.get("/track-info", response_model=TrackInfoResponse)
async def get_track_info(request: Request, db: AsyncSession = Depends(get_session)):
    redis = request.app.state.redis
    service = TrackService(redis, db)
    return await service.get_current_track_info()


@router.get("/track-updates")
async def track_updates(request: Request):
    redis = request.app.state.redis
    if not redis:
        raise HTTPException(status_code=500, detail="Redis not initialized")

    async def event_stream():
        pubsub = redis.pubsub()
        await pubsub.subscribe("track_updates")

        try:
            while True:
                message = await pubsub.get_message(ignore_subscribe_messages=True)
                if message and message['channel'] == 'track_updates':
                    yield f"data: {message['data']}\n\n"

                current_track = await redis.get("last_track")
                if hasattr(event_stream, 'last_track') and event_stream.last_track != current_track:
                    yield f"data: {current_track}\n\n"

                event_stream.last_track = current_track
                await asyncio.sleep(0.5)
        finally:
            await pubsub.unsubscribe("track_updates")

    return StreamingResponse(event_stream(), media_type="text/event-stream")
