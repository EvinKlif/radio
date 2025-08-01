from pydantic import BaseModel
from typing import Optional
from fastapi import UploadFile

class TrackCreate(BaseModel):
    artist: str
    title: str
    cover_file: Optional[UploadFile] = None  # Файл обложки
    cover_url: Optional[str] = None  # URL обложки (альтернатива файлу)

class TrackResponse(BaseModel):
    artist: str
    title: str
    cover_url: str
    mp3_url: str