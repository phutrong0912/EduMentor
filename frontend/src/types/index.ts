export type InterviewTopic =
  | "IT Backend"
  | "IT Frontend"
  | "Kinh tế"
  | "Thuyết trình tự do";

export type InterviewMode = "interview" | "presentation";
export type LanguageCode = "vi" | "en";
export type DifficultyLevel = "easy" | "medium" | "hard";
export type AiStatus = "idle" | "listening" | "thinking" | "speaking" | "evaluating";

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export interface HeadPose {
  pitch: number;
  yaw: number;
  roll: number;
}

export interface LandmarksBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CVFrameMetrics {
  timestamp_sec: number;
  face_detected: boolean;
  eye_contact: boolean;
  eye_contact_score: number;
  head_pose: HeadPose;
  head_stability: number;
  expression: string;
  confidence_score: number;
  alert: string | null;
  landmarks_box?: LandmarksBox | null;
}

export interface TranscriptItem {
  id?: number;
  speaker: "user" | "ai";
  text: string;
  timestamp_sec: number;
  duration_sec: number;
  word_count: number;
  wpm: number;
  pace_status: "slow" | "normal" | "fast";
  filler_words: string[] | null;
  filler_count: number;
}

export interface SessionSummary {
  id: string;
  topic: string;
  mode: InterviewMode;
  language: LanguageCode;
  difficulty?: DifficultyLevel;
  custom_context?: string | null;
  status: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  overall_score: number | null;
  content_score: number | null;
  tone_pace_score: number | null;
  posture_expression_score: number | null;
  eye_contact_score: number | null;
  avg_eye_contact_rate: number;
  avg_wpm: number;
  total_filler_words: number;
}

export interface CriteriaScores {
  content: number;
  tone_pace: number;
  posture_expression: number;
  eye_contact: number;
}

export interface SampleImprovement {
  original_excerpt: string;
  improved_suggestion: string;
  reason: string;
}

export interface EvaluationReport {
  overall_score: number;
  scores: CriteriaScores;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  actionable_feedback: string[];
  sample_improvements: SampleImprovement[];
}

export interface TimelinePoint {
  minute: number;
  label: string;
  eye_contact_rate: number;
  wpm: number;
  confidence: number;
}

export interface SessionReportResponse {
  session: SessionSummary;
  evaluation: EvaluationReport | null;
  timeline: TimelinePoint[];
  transcripts: TranscriptItem[];
  filler_breakdown: Record<string, number>;
}
