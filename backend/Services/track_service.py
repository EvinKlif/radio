from fastapi import UploadFile, HTTPException

import os

from Repositories.minio_repository import MinioRepository
from Repositories.track_repository import TrackRepository
from Schemas.track_schema import TrackResponse



class TrackService:
    def __init__(self, track_repo: TrackRepository):
        self.minio_repo = MinioRepository()
        self.track_repo = track_repo

    async def get_track_info(self, title: str) -> TrackResponse:
        track = await self.track_repo.get_track_by_title(title)
        if not track:
            raise HTTPException(status_code=404, detail="Track not found")

        # Конвертируем Track в TrackResponse
        track_response = TrackResponse(
            artist=track.artist,
            title=track.title,
            cover_url=track.cover_url,
            mp3_url=track.mp3_url
        )

        # Возвращаем как TrackInfoResponse
        return TrackResponse.from_track_response(track_response)

    async def create_track(
            self,
            mp3_file: UploadFile,
            artist: str,
            title: str,
            cover_file: UploadFile = None,
            cover_url: str = None
    ):
        # Сохраняем точное имя файла MP3
        mp3_filename = mp3_file.filename

        # Загружаем MP3 в MinIO (в бакет media)
        await self.minio_repo.upload_mp3(mp3_file.file, mp3_filename)

        # Обрабатываем обложку
        final_cover_url = cover_url
        if cover_file:
            cover_filename = cover_file.filename
            # Загружаем обложку в MinIO (в бакет image)
            await self.minio_repo.upload_image(cover_file.file, cover_filename)
            # Сохраняем только имя файла без префикса
            final_cover_url = cover_filename

        # Создаем запись в базе данных
        track_data = {
            "artist": artist,
            "title": title,
            "cover_url": final_cover_url,  # Только имя файла или внешний URL
            "mp3_url": mp3_filename  # Только имя файла без префикса
        }

        track = await self.track_repo.create_track(track_data)
        return track

    async def delete_track(self, title: str):
        track = await self.track_repo.get_track_by_title(title)
        if not track:
            raise HTTPException(status_code=404, detail="Track not found")

        # Удаляем файлы из MinIO (добавляем префиксы при удалении)
        await self.minio_repo.delete_file(f"media/{track.mp3_url}")
        if track.cover_url and not track.cover_url.startswith(('http://', 'https://')):
            await self.minio_repo.delete_file(f"image/{track.cover_url}")

        await self.track_repo.delete_track(title)
        return {"status": "success", "deleted_title": title}

    async def get_all_tracks(self):
        return await self.track_repo.get_all_tracks()