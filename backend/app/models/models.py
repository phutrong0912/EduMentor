import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def generate_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="student")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    sessions: Mapped[List["InterviewSession"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    topic: Mapped[str] = mapped_column(String(100), nullable=False, default="IT Backend")
    mode: Mapped[str] = mapped_column(String(50), nullable=False, default="interview")  # interview | presentation
    language: Mapped[str] = mapped_column(String(10), nullable=False, default="vi")  # vi | en
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")  # active | processing | completed

    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[float] = mapped_column(Float, default=0.0)

    # Aggregated Scores (0-100)
    overall_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    content_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    tone_pace_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    posture_expression_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    eye_contact_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Aggregated Telemetry
    avg_eye_contact_rate: Mapped[float] = mapped_column(Float, default=0.0)
    avg_wpm: Mapped[float] = mapped_column(Float, default=0.0)
    total_filler_words: Mapped[int] = mapped_column(Integer, default=0)
    avg_head_stability: Mapped[float] = mapped_column(Float, default=0.0)
    avg_confidence: Mapped[float] = mapped_column(Float, default=0.0)

    # LLM Evaluation JSON (strengths, weaknesses, improvement_plan, sample_answers)
    evaluation_report: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    user: Mapped[Optional["User"]] = relationship(back_populates="sessions")
    metrics: Mapped[List["SessionMetrics"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="SessionMetrics.timestamp_sec"
    )
    transcripts: Mapped[List["TranscriptItem"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="TranscriptItem.timestamp_sec"
    )


class SessionMetrics(Base):
    __tablename__ = "session_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    timestamp_sec: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    face_detected: Mapped[bool] = mapped_column(default=True)
    eye_contact: Mapped[bool] = mapped_column(default=False)
    eye_contact_score: Mapped[float] = mapped_column(Float, default=0.0)

    pitch: Mapped[float] = mapped_column(Float, default=0.0)
    yaw: Mapped[float] = mapped_column(Float, default=0.0)
    roll: Mapped[float] = mapped_column(Float, default=0.0)
    head_stability: Mapped[float] = mapped_column(Float, default=100.0)

    expression: Mapped[str] = mapped_column(String(50), default="neutral")
    confidence_score: Mapped[float] = mapped_column(Float, default=50.0)
    alert: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    session: Mapped["InterviewSession"] = relationship(back_populates="metrics")


class TranscriptItem(Base):
    __tablename__ = "transcript_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    speaker: Mapped[str] = mapped_column(String(20), nullable=False)  # "user" | "ai"
    text: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp_sec: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    duration_sec: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    word_count: Mapped[int] = mapped_column(Integer, default=0)
    wpm: Mapped[float] = mapped_column(Float, default=0.0)
    pace_status: Mapped[str] = mapped_column(String(20), default="normal")  # slow | normal | fast
    filler_words: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)  # list of detected filler words
    filler_count: Mapped[int] = mapped_column(Integer, default=0)

    session: Mapped["InterviewSession"] = relationship(back_populates="transcripts")
