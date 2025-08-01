from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from DataBase.session import get_session
from Repositories.track_repository import TrackRepository
from Schemas.track import TrackSchema
from Schemas.track_schema import TrackResponse
from Services.track_service import TrackService

router = APIRouter(prefix="/tracks", tags=["tracks"])


@router.post("/", response_model=TrackResponse)
async def create_track(
        mp3_file: UploadFile = File(...),
        artist: str = Form(...),
        title: str = Form(...),
        cover_file: UploadFile = File(None),  # Опциональная загрузка файла
        cover_url: str = Form(None),  # Опциональный URL
        session: AsyncSession = Depends(get_session)
):
    # Проверка формата MP3
    if not mp3_file.filename.endswith('.mp3'):
        raise HTTPException(400, detail="Only MP3 files are allowed")

    # Проверка формата изображения (если есть файл)
    if cover_file and not any(
            cover_file.filename.endswith(ext)
            for ext in ['.jpg', '.jpeg', '.png']
    ):
        raise HTTPException(400, detail="Only JPG/PNG images are allowed")

    track_repo = TrackRepository(session)
    track_service = TrackService(track_repo)

    track = await track_service.create_track(
        mp3_file=mp3_file,
        artist=artist,
        title=title,
        cover_file=cover_file,
        cover_url=cover_url
    )

    return TrackResponse(
        artist=track.artist,
        title=track.title,
        cover_url=track.cover_url,
        mp3_url=track.mp3_url
    )


@router.delete("/{title}")
async def delete_track(title: str, session: AsyncSession = Depends(get_session)):
    track_repo = TrackRepository(session)
    track_service = TrackService(track_repo)
    return await track_service.delete_track(title)


@router.get("/all", response_model=list[TrackSchema])
async def get_all_tracks(session: AsyncSession = Depends(get_session)):
    track_repository = TrackRepository(session)
    track_service = TrackService(track_repository)
    return await track_service.get_all_tracks()

