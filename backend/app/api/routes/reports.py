from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import ensure_session_access, get_current_user
from app.models.models import InterviewSession, User
from app.schemas.schemas import SessionReportResponse
from app.services.report_service import build_report_response, finalize_session_report

router = APIRouter(prefix="/api/reports", tags=["Reports"])


@router.get("/{session_id}", response_model=SessionReportResponse)
async def get_session_report(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SessionReportResponse:
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
        raise HTTPException(status_code=404, detail="Không tìm thấy báo cáo phiên này.")
    ensure_session_access(session, current_user)

    # Auto-finalize if user navigates directly to report before evaluation ran
    if session.evaluation_report is None and session.status != "processing":
        await finalize_session_report(session_id)
        result = await db.execute(
            select(InterviewSession)
            .options(
                selectinload(InterviewSession.metrics),
                selectinload(InterviewSession.transcripts),
            )
            .where(InterviewSession.id == session_id)
        )
        session = result.scalar_one()

    return build_report_response(session)


@router.post("/{session_id}/re-evaluate", response_model=SessionReportResponse)
async def re_evaluate_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SessionReportResponse:
    result = await db.execute(
        select(InterviewSession).where(InterviewSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên phỏng vấn.")
    ensure_session_access(session, current_user)

    await finalize_session_report(session_id)

    refreshed = await db.execute(
        select(InterviewSession)
        .options(
            selectinload(InterviewSession.metrics),
            selectinload(InterviewSession.transcripts),
        )
        .where(InterviewSession.id == session_id)
    )
    return build_report_response(refreshed.scalar_one())
