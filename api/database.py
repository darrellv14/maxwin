from sqlalchemy import (
    create_engine, Column, Integer, String, Float, DateTime, Text
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os
from dotenv import load_dotenv
from pathlib import Path

# Load .env from root directory
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

# Database URL
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
else:
    # Fallback for build/test environments without DB
    engine = None
    SessionLocal = None

Base = declarative_base()


class AnalysisHistory(Base):
    __tablename__ = "analysis_history"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String, index=True)
    date_created = Column(DateTime, default=datetime.utcnow)
    signal = Column(String)
    entry_price = Column(Float)
    tp1 = Column(Float)
    tp2 = Column(Float)
    stop_loss = Column(Float)
    reasoning = Column(Text)
    # ACTIVE, TP1_HIT, TP2_HIT, SL_HIT
    status = Column(String, default="ACTIVE")
    highest_price = Column(Float, default=0.0)
    lowest_price = Column(Float, default=0.0)


def init_db():
    if engine:
        Base.metadata.create_all(bind=engine)


def get_db():
    if SessionLocal is None:
        raise Exception("Database not configured")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
