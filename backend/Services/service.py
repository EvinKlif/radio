from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis

from Repositories.track_repository import TrackRepository
from Schemas.track import TrackInfoResponse


class TrackService:
    def __init__(self, redis: Redis, session: AsyncSession):
        self.redis = redis
        self.repo = TrackRepository(session)

    async def get_current_track_info(self) -> TrackInfoResponse:
        track_name = await self.redis.get("last_track")
        if not track_name:
            raise HTTPException(status_code=404, detail="No track in Redis")

        clean_name = track_name.replace('.mp3', '').strip()
        track = await self.repo.get_track_by_title(clean_name)

        if not track:
            raise HTTPException(
                status_code=404,
                detail=f"Track '{clean_name}' not found in database"
            )

        return TrackInfoResponse(
            artist=track.artist,
            title=track.title,
            cover_url=track.cover_url
        )
