from pydantic import BaseModel

class TrackInfoResponse(BaseModel):
    artist: str
    title: str
    cover_url: str

class TrackSchema(BaseModel):
    artist: str
    title: str
    cover_url: str
    mp3_url: str

    class Config:
        from_attributes = True  # Ранее known as orm_mode