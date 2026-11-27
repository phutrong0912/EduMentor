from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import ensure_session_access, get_optional_current_user
from app.models.models import InterviewSession, SessionMetrics, TranscriptItem, User
from app.schemas.schemas import SessionCreate, SessionSummary
from app.services.report_service import finalize_session_report
from app.services.stt_engine import analyze_speech_text

router = APIRouter(prefix="/api/sessions", tags=["Sessions"])


@router.post("", response_model=SessionSummary, status_code=status.HTTP_201_CREATED)
async def create_session(
    payload: SessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
) -> SessionSummary:
    # Always derive ownership from verified JWT, never trust client-supplied user_id
    session = InterviewSession(
        user_id=current_user.id if current_user else None,
        topic=payload.topic.strip(),
        mode=payload.mode,
        language=payload.language,
        difficulty=payload.difficulty,
        custom_context=payload.custom_context.strip() if payload.custom_context else None,
        status="active",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return SessionSummary.model_validate(session)


@router.post("/demo", response_model=SessionSummary, status_code=status.HTTP_201_CREATED)
async def create_demo_session(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
) -> SessionSummary:
    """Seed a sample completed interview session (development/DEBUG mode only)."""
    if not settings.DEBUG:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tính năng tạo dữ liệu mẫu chỉ khả dụng trong môi trường phát triển.",
        )
    now = datetime.now(timezone.utc)
    session = InterviewSession(
        user_id=current_user.id if current_user else None,
        topic="IT Backend",
        mode="interview",
        language="vi",
        difficulty="medium",
        custom_context="Vị trí Backend Engineer (Python FastAPI, PostgreSQL, Redis, Docker)",
        status="active",
        started_at=now - timedelta(minutes=3, seconds=20),
        duration_seconds=200.0,
    )
    db.add(session)
    await db.flush()

    # Seed 3 minutes of realistic CV telemetry
    sample_cv = [
        (10, True, True, 88.0, -3.0, 4.0, 1.5, 90.0, "confident_smile", 86.0),
        (35, True, True, 82.0, -5.0, 6.0, 2.0, 86.0, "speaking", 82.0),
        (75, True, False, 54.0, -14.0, 18.0, 4.0, 68.0, "neutral", 64.0),
        (105, True, True, 79.0, -4.0, 7.0, 2.5, 84.0, "speaking", 80.0),
        (140, True, True, 91.0, -2.0, 3.0, 1.0, 93.0, "confident_smile", 90.0),
        (175, True, True, 85.0, -4.0, 5.0, 1.8, 88.0, "speaking", 85.0),
    ]
    for ts, fd, ec, ecs, p, y, r, hs, expr, conf in sample_cv:
        db.add(
            SessionMetrics(
                session_id=session.id,
                timestamp_sec=float(ts),
                face_detected=fd,
                eye_contact=ec,
                eye_contact_score=ecs,
                pitch=p,
                yaw=y,
                roll=r,
                head_stability=hs,
                expression=expr,
                confidence_score=conf,
            )
        )

    # Seed realistic Q&A conversation with filler words and pace variation
    turns = [
        ("ai", "Chào bạn! Bạn hãy giới thiệu ngắn gọn về bản thân và dự án Backend tâm đắc nhất nhé?", 0.0, 0.0),
        (
            "user",
            "À, chào anh chị, cơ bản là em là sinh viên năm cuối ngành Công nghệ Thông tin. Trong dự án gần nhất, ừm em xây dựng hệ thống EduMentor AI dùng FastAPI và WebSocket để xử lý video và âm thanh thời gian thực.",
            12.0,
            21.0,
        ),
        ("ai", "Trong dự án đó, bạn đã xử lý bài toán hiệu năng và tránh nghẽn luồng bất đồng bộ như thế nào?", 45.0, 0.0),
        (
            "user",
            "Dạ em tách các tác vụ xử lý ảnh MediaPipe nặng sang thread pool bằng asyncio.to_thread, đồng thời dùng Celery với Redis để tổng hợp báo cáo sau phiên nên tốc độ phản hồi API vẫn rất mượt và ổn định.",
            68.0,
            14.0,
        ),
        ("ai", "Rất tốt! Nếu hệ thống tăng gấp 10 lần người dùng đồng thời, bạn sẽ mở rộng kiến trúc ra sao?", 120.0, 0.0),
        (
            "user",
            "Thì kiểu như em sẽ triển khai horizontal scaling cho FastAPI phía sau Nginx load balancer, dùng Redis Pub/Sub cho WebSocket và tối ưu connection pool cho PostgreSQL.",
            138.0,
            13.5,
        ),
    ]

    for speaker, text, ts, dur in turns:
        if speaker == "user":
            analysis = analyze_speech_text(text, dur)
            db.add(
                TranscriptItem(
                    session_id=session.id,
                    speaker="user",
                    text=analysis.text,
                    timestamp_sec=ts,
                    duration_sec=analysis.duration_sec,
                    word_count=analysis.word_count,
                    wpm=analysis.wpm,
                    pace_status=analysis.pace_status,
                    filler_words=analysis.filler_words,
                    filler_count=analysis.filler_count,
                )
            )
        else:
            db.add(
                TranscriptItem(
                    session_id=session.id,
                    speaker="ai",
                    text=text,
                    timestamp_sec=ts,
                    duration_sec=0.0,
                    word_count=len(text.split()),
                    wpm=0.0,
                    pace_status="normal",
                    filler_words=[],
                    filler_count=0,
                )
            )

    await db.commit()
    await finalize_session_report(session.id)
    await db.refresh(session)
    return SessionSummary.model_validate(session)


@router.get("", response_model=List[SessionSummary])
async def list_sessions(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
) -> List[SessionSummary]:
    query = select(InterviewSession)
    if current_user is not None:
        query = query.where(InterviewSession.user_id == current_user.id)
    else:
        # Guests only see anonymous sessions; never leak registered users' sessions
        query = query.where(InterviewSession.user_id.is_(None))

    result = await db.execute(
        query.order_by(desc(InterviewSession.started_at)).limit(min(limit, 100))
    )
    sessions = result.scalars().all()
    return [SessionSummary.model_validate(s) for s in sessions]


@router.get("/{session_id}", response_model=SessionSummary)
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
) -> SessionSummary:
    result = await db.execute(
        select(InterviewSession).where(InterviewSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên phỏng vấn.")
    ensure_session_access(session, current_user)
    return SessionSummary.model_validate(session)


@router.post("/{session_id}/end", response_model=SessionSummary)
async def end_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
) -> SessionSummary:
    result = await db.execute(
        select(InterviewSession).where(InterviewSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên phỏng vấn.")
    ensure_session_access(session, current_user)

    if settings.USE_CELERY:
        from app.core.celery_app import generate_session_report_task

        session.status = "processing"
        await db.commit()
        generate_session_report_task.delay(session_id)
    else:
        await finalize_session_report(session_id)

    await db.refresh(session)
    return SessionSummary.model_validate(session)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
) -> None:
    result = await db.execute(
        select(InterviewSession).where(InterviewSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên phỏng vấn.")
    ensure_session_access(session, current_user)
    await db.delete(session)
    await db.commit()
