"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Clock,
  Eye,
  Gauge,
  MessageSquareWarning,
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

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center px-4">
        <div className="text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-indigo-400" />
          <p className="mt-3 text-sm text-slate-400">
            Đang tải báo cáo phân tích đa phương thức...
          </p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-rose-400">{error || "Không tìm thấy báo cáo."}</p>
        <Link
          href="/"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700"
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
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Quay lại lịch sử phiên
          </Link>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            Báo cáo phân tích — {session.topic}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Chế độ: {session.mode === "interview" ? "Phỏng vấn" : "Thuyết trình"} ·
            Ngôn ngữ: {session.language === "vi" ? "Tiếng Việt" : "English"} ·
            Thời lượng: {Math.max(1, Math.round(session.duration_seconds / 60))} phút
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={reEvaluating}
            onClick={handleReEvaluate}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${reEvaluating ? "animate-spin" : ""}`} />
            Chấm điểm lại
          </button>
          <Link
            href="/interview"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            Luyện phiên mới
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/60 to-slate-900 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-indigo-300">
            <span>TỔNG ĐIỂM AI</span>
            <Award className="h-4 w-4" />
          </div>
          <p className="mt-2 text-4xl font-extrabold text-white">
            {overallScore}
            <span className="text-lg font-normal text-slate-400">/100</span>
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-emerald-300">
            <span>EYE CONTACT TB</span>
            <Eye className="h-4 w-4" />
          </div>
          <p className="mt-2 text-3xl font-bold text-white">
            {Math.round(session.avg_eye_contact_rate)}%
          </p>
          <p className="mt-1 text-xs text-slate-400">Ngưỡng tốt: &ge; 70%</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-amber-300">
            <span>TỐC ĐỘ NÓI (WPM)</span>
            <Gauge className="h-4 w-4" />
          </div>
          <p className="mt-2 text-3xl font-bold text-white">
            {Math.round(session.avg_wpm)}{" "}
            <span className="text-sm font-normal text-slate-400">WPM</span>
          </p>
          <p className="mt-1 text-xs text-slate-400">Ngưỡng chuẩn: 120 – 150 WPM</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-rose-300">
            <span>TỔNG TỪ ĐỆM</span>
            <MessageSquareWarning className="h-4 w-4" />
          </div>
          <p className="mt-2 text-3xl font-bold text-white">
            {session.total_filler_words}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {fillerEntries.length > 0
              ? `Hay dùng: "${fillerEntries[0][0]}" (${fillerEntries[0][1]}x)`
              : "Rất tốt! Không phát hiện từ đệm"}
          </p>
        </div>
      </div>

      {/* Charts Row: Radar + Timeline */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="mb-1 text-lg font-semibold text-white">
            Biểu đồ Radar 4 chiều
          </h2>
          <p className="mb-4 text-xs text-slate-400">
            Nội dung · Ngữ điệu & Tốc độ · Tác phong & Biểu cảm · Tương tác mắt
          </p>
          <RadarScoreChart scores={scores} />
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Biến thiên theo thời gian (Timeline)
              </h2>
              <p className="text-xs text-slate-400">
                Eye Contact (%) và Tốc độ nói (WPM) qua từng phút
              </p>
            </div>
            <Clock className="h-5 w-5 text-slate-500" />
          </div>
          <TimelineChart timeline={timeline} />
        </div>
      </div>

      {/* Actionable AI Feedback */}
      {evaluation && (
        <div className="mb-8 space-y-6">
          <div className="rounded-2xl border border-indigo-500/30 bg-slate-900/80 p-6">
            <div className="mb-2 flex items-center gap-2 text-indigo-300">
              <Sparkles className="h-5 w-5" />
              <h2 className="text-lg font-semibold text-white">
                Nhận xét tổng quan từ AI Mentor
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-slate-200">
              {evaluation.summary}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Strengths */}
            <div className="rounded-2xl border border-emerald-500/25 bg-slate-900/70 p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                Điểm mạnh
              </h3>
              <ul className="space-y-2.5 text-sm text-slate-300">
                {evaluation.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Weaknesses */}
            <div className="rounded-2xl border border-rose-500/25 bg-slate-900/70 p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-rose-300">
                <MessageSquareWarning className="h-4 w-4" />
                Điểm cần khắc phục
              </h3>
              <ul className="space-y-2.5 text-sm text-slate-300">
                {evaluation.weaknesses.map((w, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Actionable Feedback */}
            <div className="rounded-2xl border border-indigo-500/25 bg-slate-900/70 p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-indigo-300">
                <TrendingUp className="h-4 w-4" />
                Lộ trình cải thiện
              </h3>
              <ul className="space-y-2.5 text-sm text-slate-300">
                {evaluation.actionable_feedback.map((a, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-mono text-xs text-indigo-400">
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
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h3 className="mb-4 text-base font-semibold text-white">
                Gợi ý nâng cấp câu trả lời (STAR Method)
              </h3>
              <div className="space-y-4">
                {evaluation.sample_improvements.map((imp, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 gap-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4 md:grid-cols-2"
                  >
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-400">
                        Câu trả lời gốc
                      </p>
                      <p className="mt-1.5 text-sm italic text-slate-300">
                        &ldquo;{imp.original_excerpt}&rdquo;
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-emerald-400">
                        Gợi ý hay hơn
                      </p>
                      <p className="mt-1.5 text-sm text-emerald-100">
                        {imp.improved_suggestion}
                      </p>
                      <p className="mt-2 text-xs text-slate-400">
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
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Chi tiết Transcript & Highlight lỗi
            </h2>
            <p className="text-xs text-slate-400">
              Xem lại từng câu trả lời kèm chỉ số WPM và vị trí các từ đệm
            </p>
          </div>
          {fillerEntries.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {fillerEntries.slice(0, 6).map(([word, count]) => (
                <span
                  key={word}
                  className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs text-rose-300"
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
