"""
Speech-to-Text (STT) & Speech Analytics Engine for EduMentor AI.
Supports:
- OpenAI Whisper API / Faster-Whisper local / Direct transcript fallback
- Speaking Rate (WPM - Words Per Minute) with standard 120-150 WPM benchmark
- Vietnamese & English Filler Words Detection using Regex + NLP tokenization
"""

from __future__ import annotations

import base64
import io
import logging
import re
from typing import Dict, List, Optional, Tuple

from app.core.config import settings
from app.schemas.schemas import SpeechAnalysisResult

logger = logging.getLogger(__name__)

# Standard WPM thresholds from specification
WPM_SLOW_THRESHOLD = 110.0
WPM_FAST_THRESHOLD = 160.0

# Multi-word & single-word filler patterns (Vietnamese & English)
VIETNAMESE_FILLERS = [
    r"cơ bản là",
    r"kiểu như là",
    r"kiểu như",
    r"nói chung là",
    r"thật ra thì",
    r"thực ra thì",
    r"ý em là",
    r"ý tôi là",
    r"thì là",
    r"ờm",
    r"ừm",
    r"à",
    r"ờ",
    r"thì",
    r"là",
]

ENGLISH_FILLERS = [
    r"you know",
    r"i mean",
    r"kind of",
    r"sort of",
    r"basically",
    r"actually",
    r"literally",
    r"um+",
    r"uh+",
    r"er+",
    r"like",
]

# Compile single combined pattern with Unicode word boundaries
_ALL_FILLERS = sorted(
    VIETNAMESE_FILLERS + ENGLISH_FILLERS, key=len, reverse=True
)
FILLER_REGEX = re.compile(
    r"(?<!\w)(" + "|".join(_ALL_FILLERS) + r")(?!\w)",
    flags=re.IGNORECASE | re.UNICODE,
)


def count_words(text: str) -> int:
    tokens = re.findall(r"[\w'-]+", text, flags=re.UNICODE)
    return len(tokens)


def detect_filler_words(text: str) -> List[str]:
    """Detect Vietnamese and English filler words in transcript text."""
    if not text or not text.strip():
        return []

    matches: List[str] = []
    for m in FILLER_REGEX.finditer(text):
        word = m.group(1).strip().lower()
        # Avoid false-positive for standalone Vietnamese "là" in normal copula usage
        # unless repeated or preceded by pause punctuation / filler
        if word == "là":
            start = m.start()
            prefix = text[max(0, start - 10) : start].lower()
            if not re.search(r"(,|;|—|\.\.\.|thì|à|ừm|ờm|như|bản)\s*$", prefix):
                continue
        matches.append(word)
    return matches


def compute_wpm(word_count: int, duration_sec: float) -> Tuple[float, str]:
    """Calculate Words Per Minute and classify pace (slow / normal / fast)."""
    if word_count <= 0 or duration_sec <= 0.2:
        return 0.0, "normal"

    minutes = duration_sec / 60.0
    wpm = round(word_count / minutes, 1)

    if wpm < WPM_SLOW_THRESHOLD:
        pace_status = "slow"
    elif wpm > WPM_FAST_THRESHOLD:
        pace_status = "fast"
    else:
        pace_status = "normal"

    return wpm, pace_status


def analyze_speech_text(text: str, duration_sec: float) -> SpeechAnalysisResult:
    """Run full WPM and filler-word analysis on a transcribed utterance."""
    cleaned = text.strip()
    words = count_words(cleaned)
    # Estimate reasonable duration if client didn't send one
    effective_duration = duration_sec if duration_sec > 0.5 else max(1.0, words / 2.2)
    wpm, pace_status = compute_wpm(words, effective_duration)
    fillers = detect_filler_words(cleaned)

    return SpeechAnalysisResult(
        text=cleaned,
        word_count=words,
        duration_sec=round(effective_duration, 2),
        wpm=wpm,
        pace_status=pace_status,
        filler_words=fillers,
        filler_count=len(fillers),
    )


def summarize_filler_breakdown(filler_lists: List[Optional[List[str]]]) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for flist in filler_lists:
        if not flist:
            continue
        for w in flist:
            key = w.lower()
            counts[key] = counts.get(key, 0) + 1
    return dict(sorted(counts.items(), key=lambda kv: kv[1], reverse=True))


class STTEngine:
    """Async Speech-to-Text engine supporting OpenAI Whisper API & Faster-Whisper."""

    def __init__(self) -> None:
        self._faster_whisper_model = None

    async def transcribe_audio(
        self,
        audio_data: bytes | str,
        language: str = "vi",
        mime_type: str = "audio/webm",
    ) -> str:
        """Transcribe audio bytes or base64 string into text."""
        if isinstance(audio_data, str):
            if "," in audio_data:
                audio_data = audio_data.split(",", 1)[1]
            try:
                audio_bytes = base64.b64decode(audio_data)
            except Exception:
                return ""
        else:
            audio_bytes = audio_data

        if not audio_bytes or len(audio_bytes) < 500:
            return ""

        provider = settings.active_stt_provider

        if provider == "openai" and settings.OPENAI_API_KEY:
            return await self._transcribe_openai(audio_bytes, language, mime_type)

        if provider == "faster-whisper":
            return await self._transcribe_faster_whisper(audio_bytes, language)

        # Mock / Browser-STT fallback: returns empty string so frontend Web Speech API
        # transcript (if sent) takes precedence without fabricating false speech.
        logger.debug("STT provider is '%s'; skipping server-side Whisper.", provider)
        return ""

    async def _transcribe_openai(
        self, audio_bytes: bytes, language: str, mime_type: str
    ) -> str:
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            ext = "webm" if "webm" in mime_type else "wav"
            file_obj = io.BytesIO(audio_bytes)
            file_obj.name = f"chunk.{ext}"

            resp = await client.audio.transcriptions.create(
                model="whisper-1",
                file=file_obj,
                language=language,
            )
            return (resp.text or "").strip()
        except Exception as exc:
            logger.error("OpenAI Whisper STT error: %s", exc)
            return ""

    async def _transcribe_faster_whisper(
        self, audio_bytes: bytes, language: str
    ) -> str:
        try:
            import asyncio
            import tempfile

            if self._faster_whisper_model is None:
                from faster_whisper import WhisperModel  # type: ignore

                self._faster_whisper_model = WhisperModel(
                    settings.WHISPER_MODEL_SIZE, device="cpu", compute_type="int8"
                )

            def _run() -> str:
                with tempfile.NamedTemporaryFile(suffix=".webm") as tmp:
                    tmp.write(audio_bytes)
                    tmp.flush()
                    segments, _ = self._faster_whisper_model.transcribe(
                        tmp.name, language=language
                    )
                    return " ".join(seg.text.strip() for seg in segments).strip()

            return await asyncio.to_thread(_run)
        except Exception as exc:
            logger.error("Faster-Whisper STT error: %s", exc)
            return ""


stt_engine = STTEngine()
