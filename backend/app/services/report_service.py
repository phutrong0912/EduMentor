"""
Session Report Aggregation & Finalization Service.
Aggregates CV metrics, Speech metrics, Timeline per minute, and calls LLM Evaluator.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, List

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.models.models import InterviewSession, SessionMetrics, TranscriptItem
from app.schemas.schemas import (
    EvaluationReport,
    SessionReportResponse,
    SessionSummary,
    TimelinePoint,
    TranscriptItemResponse,
)
from app.services.llm_agent import llm_agent
from app.services.stt_engine import summarize_filler_breakdown


def build_timeline(
    metrics: List[SessionMetrics], transcripts: List[TranscriptItem]
) -> List[TimelinePoint]:
    """Group Eye Contact, Confidence, and WPM into 1-minute buckets."""
    metric_buckets: Dict[int, List[SessionMetrics]] = defaultdict(list)
    wpm_buckets: Dict[int, List[float]] = defaultdict(list)

    max_minute = 0
    for m in metrics:
        minute = int(m.timestamp_sec // 60)
        metric_buckets[minute].append(m)
        max_minute = max(max_minute, minute)

    for t in transcripts:
        if t.speaker == "user" and t.wpm > 0:
            minute = int(t.timestamp_sec // 60)
            wpm_buckets[minute].append(t.wpm)
            max_minute = max(max_minute, minute)

    timeline: List[TimelinePoint] = []
    for minute in range(max_minute + 1):
        m_list = metric_buckets.get(minute, [])
        w_list = wpm_buckets.get(minute, [])

        if m_list:
            eye_rate = sum(100.0 if m.eye_contact else 0.0 for m in m_list) / len(m_list)
            conf = sum(m.confidence_score for m in m_list) / len(m_list)
        else:
            eye_rate = 0.0
            conf = 0.0

        avg_wpm = sum(w_list) / len(w_list) if w_list else 0.0

        timeline.append(
            TimelinePoint(
                minute=minute + 1,
                label=f"Phút {minute + 1}",
                eye_contact_rate=round(eye_rate, 1),
                wpm=round(avg_wpm, 1),
                confidence=round(conf, 1),
            )
        )
    return timeline


async def finalize_session_report(session_id: str) -> dict:
    """Aggregate all telemetry for a session, run LLM evaluation, and persist to DB."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(InterviewSession)
            .options(
                selectinload(InterviewSession.metrics),
                selectinload(InterviewSession.transcripts),
            )
            .where(InterviewSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        if session is None:
            return {"error": "Session not found"}

        metrics = list(session.metrics)
        transcripts = list(session.transcripts)
        user_transcripts = [t for t in transcripts if t.speaker == "user"]

        # Aggregate CV metrics
        valid_metrics = [m for m in metrics if m.face_detected]
        if valid_metrics:
            avg_eye_contact = (
                sum(100.0 if m.eye_contact else 0.0 for m in valid_metrics)
                / len(valid_metrics)
            )
            avg_head_stability = (
                sum(m.head_stability for m in valid_metrics) / len(valid_metrics)
            )
            avg_confidence = (
                sum(m.confidence_score for m in valid_metrics) / len(valid_metrics)
            )
        else:
            avg_eye_contact = 70.0
            avg_head_stability = 75.0
            avg_confidence = 72.0

        # Aggregate Speech metrics
        total_words = sum(t.word_count for t in user_transcripts)
        total_speaking_sec = sum(t.duration_sec for t in user_transcripts)
        avg_wpm = (
            round(total_words / (total_speaking_sec / 60.0), 1)
            if total_speaking_sec > 0.5
            else 0.0
        )
        total_fillers = sum(t.filler_count for t in user_transcripts)

        cv_summary = {
            "frames_analyzed": len(metrics),
            "face_detected_frames": len(valid_metrics),
            "avg_eye_contact_rate": round(avg_eye_contact, 1),
            "avg_head_stability": round(avg_head_stability, 1),
            "avg_confidence": round(avg_confidence, 1),
        }
        speech_summary = {
            "user_turns": len(user_transcripts),
            "total_words": total_words,
            "avg_wpm": avg_wpm,
            "total_filler_words": total_fillers,
        }

        transcript_dicts = [
            {
                "speaker": t.speaker,
                "text": t.text,
                "wpm": t.wpm,
                "word_count": t.word_count,
                "filler_count": t.filler_count,
                "filler_words": t.filler_words or [],
            }
            for t in transcripts
        ]

        evaluation: EvaluationReport = await llm_agent.evaluate_session(
            topic=session.topic,
            mode=session.mode,
            language=session.language,
            transcripts=transcript_dicts,
            cv_summary=cv_summary,
            speech_summary=speech_summary,
        )

        now = datetime.now(timezone.utc)
        started = session.started_at
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        duration_sec = max(
            session.duration_seconds,
            (now - started).total_seconds(),
        )

        session.status = "completed"
        session.ended_at = now
        session.duration_seconds = round(duration_sec, 1)
        session.avg_eye_contact_rate = round(avg_eye_contact, 1)
        session.avg_head_stability = round(avg_head_stability, 1)
        session.avg_confidence = round(avg_confidence, 1)
        session.avg_wpm = avg_wpm
        session.total_filler_words = total_fillers

        session.overall_score = evaluation.overall_score
        session.content_score = evaluation.scores.content
        session.tone_pace_score = evaluation.scores.tone_pace
        session.posture_expression_score = evaluation.scores.posture_expression
        session.eye_contact_score = evaluation.scores.eye_contact
        session.evaluation_report = evaluation.model_dump()

        await db.commit()
        return {"session_id": session_id, "status": "completed"}


def build_report_response(session: InterviewSession) -> SessionReportResponse:
    evaluation = (
        EvaluationReport.model_validate(session.evaluation_report)
        if session.evaluation_report
        else None
    )
    timeline = build_timeline(list(session.metrics), list(session.transcripts))
    filler_breakdown = summarize_filler_breakdown(
        [t.filler_words for t in session.transcripts if t.speaker == "user"]
    )
    return SessionReportResponse(
        session=SessionSummary.model_validate(session),
        evaluation=evaluation,
        timeline=timeline,
        transcripts=[
            TranscriptItemResponse.model_validate(t) for t in session.transcripts
        ],
        filler_breakdown=filler_breakdown,
    )
