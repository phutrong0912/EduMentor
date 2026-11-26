from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, reports, sessions
from app.api.websockets import router as ws_router
from app.core.config import settings
from app.core.database import init_db
from app.services.cv_engine import cv_engine


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_db()
    yield
    cv_engine.close()


app = FastAPI(
    title=settings.APP_NAME,
    description="Multimodal AI Interview & Presentation Coach (CV + STT + LLM)",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(sessions.router)
app.include_router(reports.router)
app.include_router(ws_router)


@app.get("/health", tags=["Health"])
async def health_check() -> dict:
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "llm_provider": settings.active_llm_provider,
        "stt_provider": settings.active_stt_provider,
        "tts_provider": settings.TTS_PROVIDER,
    }
