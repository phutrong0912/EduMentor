from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "edumentor_worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
)


@celery_app.task(name="edumentor.generate_session_report")
def generate_session_report_task(session_id: str) -> dict:
    """Async Celery worker task to finalize and evaluate an interview session."""
    import asyncio
    from app.services.report_service import finalize_session_report

    return asyncio.run(finalize_session_report(session_id))
