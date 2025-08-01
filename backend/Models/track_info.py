from sqlalchemy import Column, String

from DataBase.session import Base


class TrackInfo(Base):
    __tablename__ = "track_info"

    artist = Column(String, nullable=False)
    title = Column(String, primary_key=True)
    cover_url = Column(String, nullable=False)
    mp3_url = Column(String, nullable=False)