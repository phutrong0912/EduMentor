"""
Real-time WebSocket Streaming Handler for EduMentor AI.
Orchestrates concurrent Video Frame -> CV Engine and Audio/Speech -> STT -> LLM -> TTS pipelines.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Dict, List

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.models.models import InterviewSession, SessionMetrics, TranscriptItem
from app.services.cv_engine import cv_engine
from app.services.llm_agent import llm_agent
from app.services.report_service import finalize_session_report
from app.services.stt_engine import analyze_speech_text, stt_engine
from app.services.tts_engine import tts_engine

logger = logging.getLogger(__name__)
router = APIRouter()


async def _safe_send(websocket: WebSocket, payload: dict) -> bool:
    try:
        await websocket.send_json(payload)
        return True
    except Exception:
        return False


@router.websocket("/ws/interview/{session_id}")
async def interview_websocket(websocket: WebSocket, session_id: str) -> None:
    await websocket.accept()

    # Load session & existing history
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(InterviewSession)
            .options(selectinload(InterviewSession.transcripts))
            .where(InterviewSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        if session is None:
            await _safe_send(
                websocket, {"type": "error", "message": "Phiên phỏng vấn không tồn tại."}
            )
            await websocket.close(code=4004)
            return

        topic = session.topic
        mode = session.mode
        language = session.language
        history: List[Dict[str, str]] = [
            {"speaker": t.speaker, "text": t.text} for t in session.transcripts
        ]

    session_start = time.monotonic()

    # Send opening question if conversation hasn't started yet
    if not history:
        opening_text = llm_agent.get_opening_question(topic, mode, language)
        await _safe_send(websocket, {"type": "ai_status", "status": "speaking"})
        audio_b64 = await tts_engine.synthesize_base64(opening_text, language)

        async with AsyncSessionLocal() as db:
            ai_item = TranscriptItem(
                session_id=session_id,
                speaker="ai",
                text=opening_text,
                timestamp_sec=0.0,
                duration_sec=0.0,
                word_count=len(opening_text.split()),
                wpm=0.0,
                pace_status="normal",
                filler_words=[],
                filler_count=0,
            )
            db.add(ai_item)
            await db.commit()
            await db.refresh(ai_item)

        history.append({"speaker": "ai", "text": opening_text})
        await _safe_send(
            websocket,
            {
                "type": "ai_response",
                "text": opening_text,
                "audio_base64": audio_b64,
                "timestamp_sec": 0.0,
            },
        )
        await _safe_send(websocket, {"type": "ai_status", "status": "listening"})

    last_db_metric_save = 0.0

    try:
        while True:
            try:
                message = await websocket.receive_json()
            except ValueError:
                await _safe_send(
                    websocket, {"type": "error", "message": "Invalid JSON payload"}
                )
                continue

            msg_type = message.get("type")
            elapsed = float(message.get("timestamp_sec") or (time.monotonic() - session_start))

            if msg_type == "ping":
                await _safe_send(websocket, {"type": "pong"})
                continue

            if msg_type == "video_frame":
                frame_b64 = message.get("frame", "")
                # Run CPU-bound OpenCV/MediaPipe analysis off the event loop
                metrics = await asyncio.to_thread(
                    cv_engine.analyze_frame, frame_b64, elapsed
                )
                await _safe_send(
                    websocket,
                    {"type": "cv_metrics", "data": metrics.model_dump()},
                )

                # Persist metrics at ~1 Hz to keep DB lightweight while preserving timeline accuracy
                now_mono = time.monotonic()
                if now_mono - last_db_metric_save >= 0.9:
                    last_db_metric_save = now_mono
                    async with AsyncSessionLocal() as db:
                        db.add(
                            SessionMetrics(
                                session_id=session_id,
                                timestamp_sec=round(elapsed, 2),
                                face_detected=metrics.face_detected,
                                eye_contact=metrics.eye_contact,
                                eye_contact_score=metrics.eye_contact_score,
                                pitch=metrics.head_pose.pitch,
                                yaw=metrics.head_pose.yaw,
                                roll=metrics.head_pose.roll,
                                head_stability=metrics.head_stability,
                                expression=metrics.expression,
                                confidence_score=metrics.confidence_score,
                                alert=metrics.alert,
                            )
                        )
                        await db.commit()
                continue

            if msg_type in ("audio_chunk", "user_transcript"):
                duration_sec = float(message.get("duration_sec") or 0.0)
                transcript_text = (message.get("text") or "").strip()

                if msg_type == "audio_chunk" and not transcript_text:
                    audio_b64 = message.get("audio", "")
                    mime_type = message.get("mime_type", "audio/webm")
                    transcript_text = await stt_engine.transcribe_audio(
                        audio_b64, language=language, mime_type=mime_type
                    )
                    if not transcript_text:
                        transcript_text = (message.get("fallback_text") or "").strip()

                if not transcript_text:
                    await _safe_send(
                        websocket,
                        {
                            "type": "info",
                            "message": "Chưa nhận diện được giọng nói rõ ràng. Hãy thử nói lại nhé.",
                        },
                    )
                    continue

                # 1. Analyze WPM & Filler Words
                speech = analyze_speech_text(transcript_text, duration_sec)

                # 2. Persist user transcript
                async with AsyncSessionLocal() as db:
                    user_item = TranscriptItem(
                        session_id=session_id,
                        speaker="user",
                        text=speech.text,
                        timestamp_sec=round(elapsed, 2),
                        duration_sec=speech.duration_sec,
                        word_count=speech.word_count,
                        wpm=speech.wpm,
                        pace_status=speech.pace_status,
                        filler_words=speech.filler_words,
                        filler_count=speech.filler_count,
                    )
                    db.add(user_item)
                    await db.commit()

                history.append({"speaker": "user", "text": speech.text})

                await _safe_send(
                    websocket,
                    {
                        "type": "user_transcript_analyzed",
                        "data": {
                            **speech.model_dump(),
                            "timestamp_sec": round(elapsed, 2),
                        },
                    },
                )

                # 3. Generate AI follow-up question
                await _safe_send(websocket, {"type": "ai_status", "status": "thinking"})
                ai_reply = await llm_agent.generate_next_question(
                    topic=topic, mode=mode, language=language, history=history
                )

                # 4. Synthesize AI voice
                await _safe_send(websocket, {"type": "ai_status", "status": "speaking"})
                ai_audio_b64 = await tts_engine.synthesize_base64(ai_reply, language)

                ai_ts = round(time.monotonic() - session_start, 2)
                async with AsyncSessionLocal() as db:
                    db.add(
                        TranscriptItem(
                            session_id=session_id,
                            speaker="ai",
                            text=ai_reply,
                            timestamp_sec=ai_ts,
                            duration_sec=0.0,
                            word_count=len(ai_reply.split()),
                            wpm=0.0,
                            pace_status="normal",
                            filler_words=[],
                            filler_count=0,
                        )
                    )
                    await db.commit()

                history.append({"speaker": "ai", "text": ai_reply})

                await _safe_send(
                    websocket,
                    {
                        "type": "ai_response",
                        "text": ai_reply,
                        "audio_base64": ai_audio_b64,
                        "timestamp_sec": ai_ts,
                    },
                )
                await _safe_send(websocket, {"type": "ai_status", "status": "listening"})
                continue

            if msg_type == "end_session":
                await _safe_send(websocket, {"type": "ai_status", "status": "evaluating"})
                await finalize_session_report(session_id)
                await _safe_send(
                    websocket,
                    {"type": "session_completed", "session_id": session_id},
                )
                break

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for session %s", session_id)
    except Exception as exc:
        logger.exception("WebSocket error for session %s: %s", session_id, exc)
        await _safe_send(websocket, {"type": "error", "message": "Lỗi kết nối máy chủ."})
