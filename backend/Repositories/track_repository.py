from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from Models.track_info import TrackInfo


class TrackRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_track(self, track_data):
        track = TrackInfo(**track_data)
        self.session.add(track)
        await self.session.commit()
        await self.session.refresh(track)
        return track

    async def get_track_by_title(self, title: str):
        result = await self.session.execute(
            select(TrackInfo).where(TrackInfo.title == title))
        return result.scalars().first()

    async def delete_track(self, title: str):
        await self.session.execute(
            delete(TrackInfo).where(TrackInfo.title == title))
        await self.session.commit()

    async def get_all_tracks(self):
        result = await self.session.execute(select(TrackInfo))
        return result.scalars().all()