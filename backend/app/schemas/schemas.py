from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ---------- Auth / User ----------
class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    password: str = Field(..., min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    full_name: str
    role: str
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ---------- Computer Vision ----------
class HeadPose(BaseModel):
    pitch: float = 0.0
    yaw: float = 0.0
    roll: float = 0.0


class CVFrameMetrics(BaseModel):
    timestamp_sec: float = 0.0
    face_detected: bool = False
    eye_contact: bool = False
    eye_contact_score: float = 0.0
    head_pose: HeadPose = Field(default_factory=HeadPose)
    head_stability: float = 0.0
    expression: str = "neutral"
    confidence_score: float = 0.0
    alert: Optional[str] = None
    landmarks_box: Optional[Dict[str, float]] = None  # normalized {x, y, width, height}


# ---------- Speech & Transcript ----------
class SpeechAnalysisResult(BaseModel):
    text: str
    word_count: int = 0
    duration_sec: float = 0.0
    wpm: float = 0.0
    pace_status: str = "normal"  # slow | normal | fast
    filler_words: List[str] = Field(default_factory=list)
    filler_count: int = 0


class TranscriptItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    speaker: str
    text: str
    timestamp_sec: float
    duration_sec: float
    word_count: int
    wpm: float
    pace_status: str
    filler_words: Optional[List[str]] = None
    filler_count: int


# ---------- LLM Evaluation ----------
class CriteriaScores(BaseModel):
    content: float = Field(..., ge=0, le=100)
    tone_pace: float = Field(..., ge=0, le=100)
    posture_expression: float = Field(..., ge=0, le=100)
    eye_contact: float = Field(..., ge=0, le=100)


class SampleImprovement(BaseModel):
    original_excerpt: str
    improved_suggestion: str
    reason: str


class EvaluationReport(BaseModel):
    overall_score: float = Field(..., ge=0, le=100)
    scores: CriteriaScores
    summary: str
    strengths: List[str]
    weaknesses: List[str]
    actionable_feedback: List[str]
    sample_improvements: List[SampleImprovement] = Field(default_factory=list)


# ---------- Sessions ----------
class SessionCreate(BaseModel):
    topic: str = Field(default="IT Backend", max_length=100)
    mode: str = Field(default="interview", pattern="^(interview|presentation)$")
    language: str = Field(default="vi", pattern="^(vi|en)$")
    user_id: Optional[str] = None


class SessionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    topic: str
    mode: str
    language: str
    status: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_seconds: float
    overall_score: Optional[float] = None
    content_score: Optional[float] = None
    tone_pace_score: Optional[float] = None
    posture_expression_score: Optional[float] = None
    eye_contact_score: Optional[float] = None
    avg_eye_contact_rate: float
    avg_wpm: float
    total_filler_words: int


class TimelinePoint(BaseModel):
    minute: int
    label: str
    eye_contact_rate: float
    wpm: float
    confidence: float


class SessionReportResponse(BaseModel):
    session: SessionSummary
    evaluation: Optional[EvaluationReport] = None
    timeline: List[TimelinePoint] = Field(default_factory=list)
    transcripts: List[TranscriptItemResponse] = Field(default_factory=list)
    filler_breakdown: Dict[str, int] = Field(default_factory=dict)
