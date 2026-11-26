from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.models import InterviewSession
from app.schemas.schemas import SessionCreate, SessionSummary
from app.services.report_service import finalize_session_report

router = APIRouter(prefix="/api/sessions", tags=["Sessions"])


@router.post("", response_model=SessionSummary, status_code=status.HTTP_201_CREATED)
async def create_session(
    payload: SessionCreate, db: AsyncSession = Depends(get_db)
) -> SessionSummary:
    session = InterviewSession(
        user_id=payload.user_id,
        topic=payload.topic,
        mode=payload.mode,
        language=payload.language,
        status="active",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return SessionSummary.model_validate(session)


@router.get("", response_model=List[SessionSummary])
async def list_sessions(
    limit: int = 20, db: AsyncSession = Depends(get_db)
) -> List[SessionSummary]:
    result = await db.execute(
        select(InterviewSession)
        .order_by(desc(InterviewSession.started_at))
        .limit(min(limit, 100))
    )
    sessions = result.scalars().all()
    return [SessionSummary.model_validate(s) for s in sessions]


@router.get("/{session_id}", response_model=SessionSummary)
async def get_session(
    session_id: str, db: AsyncSession = Depends(get_db)
) -> SessionSummary:
    result = await db.execute(
        select(InterviewSession).where(InterviewSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên phỏng vấn.")
    return SessionSummary.model_validate(session)


@router.post("/{session_id}/end", response_model=SessionSummary)
async def end_session(
    session_id: str, db: AsyncSession = Depends(get_db)
) -> SessionSummary:
    result = await db.execute(
        select(InterviewSession).where(InterviewSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên phỏng vấn.")

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
    session_id: str, db: AsyncSession = Depends(get_db)
) -> None:
    result = await db.execute(
        select(InterviewSession).where(InterviewSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên phỏng vấn.")
    await db.delete(session)
    await db.commit()
