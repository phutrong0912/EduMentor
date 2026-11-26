"""
Text-to-Speech (TTS) Engine for EduMentor AI.
Generates base64 MP3 audio for the AI Interviewer using Edge-TTS (free neural voices)
or OpenAI TTS, with graceful fallback if offline.
"""

from __future__ import annotations

import base64
import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class TTSEngine:
    async def synthesize_base64(
        self, text: str, language: str = "vi"
    ) -> Optional[str]:
        """Convert interviewer text to a base64-encoded MP3 audio string."""
        cleaned = (text or "").strip()
        if not cleaned or settings.TTS_PROVIDER == "none":
            return None

        if settings.TTS_PROVIDER == "openai" and settings.OPENAI_API_KEY:
            return await self._synthesize_openai(cleaned)

        if settings.TTS_PROVIDER == "edge-tts":
            return await self._synthesize_edge_tts(cleaned, language)

        return None

    async def _synthesize_edge_tts(self, text: str, language: str) -> Optional[str]:
        try:
            import edge_tts

            voice = settings.TTS_VOICE_VI if language == "vi" else settings.TTS_VOICE_EN
            communicate = edge_tts.Communicate(text, voice)
            audio_chunks = bytearray()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_chunks.extend(chunk["data"])

            if not audio_chunks:
                return None
            return base64.b64encode(bytes(audio_chunks)).decode("ascii")
        except Exception as exc:
            logger.warning("Edge-TTS failed (client will use browser SpeechSynthesis): %s", exc)
            return None

    async def _synthesize_openai(self, text: str) -> Optional[str]:
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            resp = await client.audio.speech.create(
                model="tts-1",
                voice="alloy",
                input=text,
                response_format="mp3",
            )
            return base64.b64encode(resp.content).decode("ascii")
        except Exception as exc:
            logger.warning("OpenAI TTS failed: %s", exc)
            return None


tts_engine = TTSEngine()
