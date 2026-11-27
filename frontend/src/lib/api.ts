import type {
  AuthUser,
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

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("edumentor_token");
  } catch {
    return null;
  }
}

export function clearAuthSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("edumentor_token");
    localStorage.removeItem("edumentor_user");
    window.dispatchEvent(new Event("edumentor-auth-change"));
  } catch {
    // ignore storage errors
  }
}

export function buildInterviewWsUrl(sessionId: string): string {
  const token = getAuthToken();
  const base = `${WS_BASE_URL}/ws/interview/${sessionId}`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

function buildAuthHeaders(extra?: HeadersInit): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (extra) {
    if (extra instanceof Headers) {
      extra.forEach((v, k) => {
        headers[k] = v;
      });
    } else if (Array.isArray(extra)) {
      extra.forEach(([k, v]) => {
        headers[k] = v;
      });
    } else {
      Object.assign(headers, extra);
    }
  }
  return headers;
}

async function extractErrorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  if (text) {
    try {
      const parsed = JSON.parse(text) as { detail?: unknown };
      if (typeof parsed.detail === "string" && parsed.detail.trim()) {
        return parsed.detail;
      }
    } catch {
      // fall through to plain text
    }
    return text;
  }
  return res.statusText || `Lỗi máy chủ (${res.status})`;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const hadToken = Boolean(getAuthToken());
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: buildAuthHeaders(init?.headers),
  });

  if (!res.ok) {
    if (res.status === 401 && hadToken && !path.startsWith("/api/auth/login")) {
      clearAuthSession();
    }
    const detail = await extractErrorMessage(res);
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

export async function createSession(payload: {
  topic: string;
  mode: InterviewMode;
  language: LanguageCode;
  difficulty?: DifficultyLevel;
  custom_context?: string;
}): Promise<SessionSummary> {
  return fetchJson<SessionSummary>("/api/sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteSession(sessionId: string): Promise<void> {
  const hadToken = Boolean(getAuthToken());
  const res = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}`, {
    method: "DELETE",
    headers: buildAuthHeaders(),
  });
  if (!res.ok) {
    if (res.status === 401 && hadToken) {
      clearAuthSession();
    }
    const detail = await extractErrorMessage(res);
    throw new Error(detail);
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

export async function getCurrentUser(): Promise<AuthUser> {
  return fetchJson<AuthUser>("/api/auth/me");
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
