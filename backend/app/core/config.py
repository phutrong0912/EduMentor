from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "EduMentor AI"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./edumentor.db"

    # Redis & Celery
    REDIS_URL: str = "redis://localhost:6379/0"
    USE_CELERY: bool = False

    # LLM
    LLM_PROVIDER: str = "auto"  # auto | openai | gemini | mock
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"

    # STT
    STT_PROVIDER: str = "auto"  # auto | openai | faster-whisper | mock
    WHISPER_MODEL_SIZE: str = "base"

    # TTS
    TTS_PROVIDER: str = "edge-tts"  # edge-tts | openai | none
    TTS_VOICE_VI: str = "vi-VN-HoaiMyNeural"
    TTS_VOICE_EN: str = "en-US-JennyNeural"

    # Security & CORS
    SECRET_KEY: str = "edumentor-dev-secret-key"
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def active_llm_provider(self) -> str:
        if self.LLM_PROVIDER != "auto":
            return self.LLM_PROVIDER
        if self.GEMINI_API_KEY:
            return "gemini"
        if self.OPENAI_API_KEY:
            return "openai"
        return "mock"

    @property
    def active_stt_provider(self) -> str:
        if self.STT_PROVIDER != "auto":
            return self.STT_PROVIDER
        if self.OPENAI_API_KEY:
            return "openai"
        return "mock"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
