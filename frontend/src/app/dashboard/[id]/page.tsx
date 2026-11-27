"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Gauge,
  MessageSquareWarning,
  Printer,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { RadarScoreChart } from "@/components/RadarScoreChart";
import { TimelineChart } from "@/components/TimelineChart";
import { TranscriptViewer } from "@/components/TranscriptViewer";
import { getSessionReport, reEvaluateSession } from "@/lib/api";
import type { SessionReportResponse } from "@/types";

export default function DashboardReportPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params?.id;

  const [report, setReport] = useState<SessionReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [reEvaluating, setReEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getSessionReport(sessionId);
        if (!cancelled) setReport(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Không thể tải báo cáo phiên phỏng vấn."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const handleReEvaluate = async () => {
    if (!sessionId || reEvaluating) return;
    setReEvaluating(true);
    try {
      const updated = await reEvaluateSession(sessionId);
      setReport(updated);
    } catch {
      setError("Không thể đánh giá lại lúc này.");
    } finally {
      setReEvaluating(false);
    }
  };

  const handleExportMarkdown = () => {
    if (!report) return;
    const { session: s, evaluation: ev, transcripts: tr } = report;
    const lines = [
      `# Báo cáo EduMentor AI — ${s.topic}`,
      `- **Chế độ:** ${s.mode === "interview" ? "Phỏng vấn" : "Thuyết trình"}`,
      `- **Ngôn ngữ:** ${s.language === "vi" ? "Tiếng Việt" : "English"}`,
      `- **Tổng điểm:** ${Math.round(ev?.overall_score ?? s.overall_score ?? 0)}/100`,
      `- **Eye Contact TB:** ${Math.round(s.avg_eye_contact_rate)}%`,
      `- **Tốc độ nói TB:** ${Math.round(s.avg_wpm)} WPM`,
      `- **Tổng từ đệm:** ${s.total_filler_words}`,
      "",
      "## Điểm 4 tiêu chí",
      `- Nội dung: ${Math.round(ev?.scores.content ?? s.content_score ?? 0)}/100`,
      `- Ngữ điệu & Tốc độ: ${Math.round(ev?.scores.tone_pace ?? s.tone_pace_score ?? 0)}/100`,
      `- Tác phong & Biểu cảm: ${Math.round(ev?.scores.posture_expression ?? s.posture_expression_score ?? 0)}/100`,
      `- Tương tác mắt: ${Math.round(ev?.scores.eye_contact ?? s.eye_contact_score ?? 0)}/100`,
      "",
      "## Nhận xét tổng quan",
      ev?.summary || "",
      "",
      "## Điểm mạnh",
      ...(ev?.strengths || []).map((x) => `- ${x}`),
      "",
      "## Điểm cần khắc phục",
      ...(ev?.weaknesses || []).map((x) => `- ${x}`),
      "",
      "## Lộ trình cải thiện",
      ...(ev?.actionable_feedback || []).map((x, i) => `${i + 1}. ${x}`),
      "",
      "## Transcript",
      ...tr.map(
        (t) =>
          `- **${t.speaker === "user" ? "Ứng viên" : "AI"}** (${Math.round(t.wpm)} WPM, ${t.filler_count} từ đệm): ${t.text}`
      ),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `edumentor-report-${s.id.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center px-4">
        <div className="text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-indigo-600" />
          <p className="mt-3 text-sm text-slate-500">
            Đang tải báo cáo phân tích đa phương thức...
          </p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-rose-600">{error || "Không tìm thấy báo cáo."}</p>
        <Link
          href="/"
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại Trang chủ
        </Link>
      </div>
    );
  }

  const { session, evaluation, timeline, transcripts, filler_breakdown } = report;
  const scores = evaluation?.scores ?? {
    content: session.content_score ?? 0,
    tone_pace: session.tone_pace_score ?? 0,
    posture_expression: session.posture_expression_score ?? 0,
    eye_contact: session.eye_contact_score ?? 0,
  };

  const overallScore = Math.round(evaluation?.overall_score ?? session.overall_score ?? 0);
  const fillerEntries = Object.entries(filler_breakdown);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-indigo-600"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Quay lại lịch sử phiên
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Báo cáo phân tích — {session.topic}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Chế độ: {session.mode === "interview" ? "Phỏng vấn" : "Thuyết trình"} ·
            Ngôn ngữ: {session.language === "vi" ? "Tiếng Việt" : "English"} ·
            Thời lượng: {Math.max(1, Math.round(session.duration_seconds / 60))} phút
          </p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportMarkdown}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Xuất .MD
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" />
            In / PDF
          </button>
          <button
            type="button"
            disabled={reEvaluating}
            onClick={handleReEvaluate}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${reEvaluating ? "animate-spin" : ""}`} />
            Chấm lại
          </button>
          <Link
            href="/interview"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700"
          >
            Luyện phiên mới
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-indigo-700">
            <span>TỔNG ĐIỂM AI</span>
            <Award className="h-4 w-4" />
          </div>
          <p className="mt-2 text-4xl font-extrabold text-indigo-700">
            {overallScore}
            <span className="text-lg font-normal text-slate-400">/100</span>
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-600">
            <span>EYE CONTACT TB</span>
            <Eye className="h-4 w-4" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {session.avg_eye_contact_rate > 0 || scores.eye_contact > 0
              ? `${Math.round(session.avg_eye_contact_rate)}%`
              : "Chưa đo"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {session.avg_eye_contact_rate > 0 || scores.eye_contact > 0
              ? "Ngưỡng tốt: ≥ 70%"
              : "Camera chưa bật trong phiên"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-600">
            <span>TỐC ĐỘ NÓI (WPM)</span>
            <Gauge className="h-4 w-4" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {Math.round(session.avg_wpm)}{" "}
            <span className="text-sm font-normal text-slate-500">WPM</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">Ngưỡng chuẩn: 120 – 150 WPM</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-rose-600">
            <span>TỔNG TỪ ĐỆM</span>
            <MessageSquareWarning className="h-4 w-4" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {session.total_filler_words}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {fillerEntries.length > 0
              ? `Hay dùng: "${fillerEntries[0][0]}" (${fillerEntries[0][1]}x)`
              : "Rất tốt! Không phát hiện từ đệm"}
          </p>
        </div>
      </div>

      {/* Charts Row: Radar + Timeline */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-lg font-semibold text-slate-900">
            Biểu đồ Radar 4 chiều
          </h2>
          <p className="mb-4 text-xs text-slate-500">
            Nội dung · Ngữ điệu & Tốc độ · Tác phong & Biểu cảm · Tương tác mắt
          </p>
          <RadarScoreChart scores={scores} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Biến thiên theo thời gian (Timeline)
              </h2>
              <p className="text-xs text-slate-500">
                Eye Contact (%) và Tốc độ nói (WPM) qua từng phút
              </p>
            </div>
            <Clock className="h-5 w-5 text-slate-400" />
          </div>
          <TimelineChart timeline={timeline} />
        </div>
      </div>

      {/* Actionable AI Feedback */}
      {evaluation && (
        <div className="mb-8 space-y-6">
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-indigo-600">
              <Sparkles className="h-5 w-5" />
              <h2 className="text-lg font-semibold text-slate-900">
                Nhận xét tổng quan từ AI Mentor
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-slate-700">
              {evaluation.summary}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Strengths */}
            <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Điểm mạnh
              </h3>
              <ul className="space-y-2.5 text-sm text-slate-700">
                {evaluation.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Weaknesses */}
            <div className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-rose-700">
                <MessageSquareWarning className="h-4 w-4" />
                Điểm cần khắc phục
              </h3>
              <ul className="space-y-2.5 text-sm text-slate-700">
                {evaluation.weaknesses.map((w, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Actionable Feedback */}
            <div className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-indigo-700">
                <TrendingUp className="h-4 w-4" />
                Lộ trình cải thiện
              </h3>
              <ul className="space-y-2.5 text-sm text-slate-700">
                {evaluation.actionable_feedback.map((a, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-mono text-xs font-semibold text-indigo-600">
                      0{i + 1}.
                    </span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Sample STAR Answer Improvements */}
          {evaluation.sample_improvements?.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-base font-semibold text-slate-900">
                Gợi ý nâng cấp câu trả lời (STAR Method)
              </h3>
              <div className="space-y-4">
                {evaluation.sample_improvements.map((imp, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4 md:grid-cols-2"
                  >
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">
                        Câu trả lời gốc
                      </p>
                      <p className="mt-1.5 text-sm italic text-slate-600">
                        &ldquo;{imp.original_excerpt}&rdquo;
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-emerald-700">
                        Gợi ý hay hơn
                      </p>
                      <p className="mt-1.5 text-sm text-emerald-900">
                        {imp.improved_suggestion}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        Lý do: {imp.reason}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transcript Review */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Chi tiết Transcript & Highlight lỗi
            </h2>
            <p className="text-xs text-slate-500">
              Xem lại từng câu trả lời kèm chỉ số WPM và vị trí các từ đệm
            </p>
          </div>
          {fillerEntries.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {fillerEntries.slice(0, 6).map(([word, count]) => (
                <span
                  key={word}
                  className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-700"
                >
                  &ldquo;{word}&rdquo; × {count}
                </span>
              ))}
            </div>
          )}
        </div>

        <TranscriptViewer transcripts={transcripts} />
      </div>
    </div>
  );
}
