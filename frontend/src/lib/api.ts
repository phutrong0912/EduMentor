import type {
  InterviewMode,
  LanguageCode,
  SessionReportResponse,
  SessionSummary,
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
}): Promise<SessionSummary> {
  return fetchJson<SessionSummary>("/api/sessions", {
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
