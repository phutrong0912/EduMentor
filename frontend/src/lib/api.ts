import type {
  DifficultyLevel,
  InterviewMode,
  LanguageCode,
  SessionReportResponse,
  SessionSummary,
  TokenResponse,
} from "@/types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const WS_BASE_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  API_BASE_URL.replace(/^http/, "ws");

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function createSession(payload: {
  topic: string;
  mode: InterviewMode;
  language: LanguageCode;
  difficulty?: DifficultyLevel;
  custom_context?: string;
  user_id?: string;
}): Promise<SessionSummary> {
  return fetchJson<SessionSummary>("/api/sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createDemoSession(): Promise<SessionSummary> {
  return fetchJson<SessionSummary>("/api/sessions/demo", {
    method: "POST",
  });
}

export async function deleteSession(sessionId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
}

export async function registerUser(payload: {
  email: string;
  full_name: string;
  password: string;
}): Promise<TokenResponse> {
  return fetchJson<TokenResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loginUser(payload: {
  email: string;
  password: string;
}): Promise<TokenResponse> {
  return fetchJson<TokenResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listSessions(limit = 12): Promise<SessionSummary[]> {
  return fetchJson<SessionSummary[]>(`/api/sessions?limit=${limit}`);
}

export async function endSession(sessionId: string): Promise<SessionSummary> {
  return fetchJson<SessionSummary>(`/api/sessions/${sessionId}/end`, {
    method: "POST",
  });
}

export async function getSessionReport(
  sessionId: string
): Promise<SessionReportResponse> {
  return fetchJson<SessionReportResponse>(`/api/reports/${sessionId}`);
}

export async function reEvaluateSession(
  sessionId: string
): Promise<SessionReportResponse> {
  return fetchJson<SessionReportResponse>(
    `/api/reports/${sessionId}/re-evaluate`,
    { method: "POST" }
  );
}
