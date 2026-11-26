"use client";

import { Bot, Loader2, Mic, Volume2 } from "lucide-react";
import type { AiStatus } from "@/types";

interface AiInterviewerCardProps {
  status: AiStatus;
  currentQuestion: string;
  topic: string;
}

const STATUS_META: Record<
  AiStatus,
  { label: string; badgeClass: string; ringClass: string }
> = {
  idle: {
    label: "Sẵn sàng bắt đầu",
    badgeClass: "bg-slate-800 text-slate-300",
    ringClass: "border-slate-700",
  },
  listening: {
    label: "AI Đang lắng nghe",
    badgeClass: "bg-emerald-500/20 text-emerald-300",
    ringClass: "border-emerald-500/60 shadow-[0_0_30px_rgba(16,185,129,0.2)]",
  },
  thinking: {
    label: "AI Đang suy nghĩ...",
    badgeClass: "bg-amber-500/20 text-amber-300",
    ringClass: "border-amber-500/60 shadow-[0_0_30px_rgba(245,158,11,0.2)]",
  },
  speaking: {
    label: "AI Đang nói",
    badgeClass: "bg-indigo-500/25 text-indigo-200",
    ringClass: "border-indigo-400 shadow-[0_0_35px_rgba(99,102,241,0.35)]",
  },
  evaluating: {
    label: "Đang tổng hợp báo cáo AI...",
    badgeClass: "bg-violet-500/25 text-violet-200",
    ringClass: "border-violet-400",
  },
};

export function AiInterviewerCard({
  status,
  currentQuestion,
  topic,
}: AiInterviewerCardProps) {
  const meta = STATUS_META[status];

  return (
    <div className="flex aspect-video w-full flex-col justify-between rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/60 p-6 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
            AI Interviewer
          </p>
          <p className="text-sm text-slate-400">Chủ đề: {topic}</p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${meta.badgeClass}`}
        >
          {status === "thinking" || status === "evaluating" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : status === "speaking" ? (
            <Volume2 className="h-3.5 w-3.5" />
          ) : (
            <Mic className="h-3.5 w-3.5" />
          )}
          {meta.label}
        </span>
      </div>

      {/* Center Avatar & Animated Waveform */}
      <div className="flex flex-col items-center justify-center gap-4 py-2">
        <div
          className={`relative flex h-24 w-24 items-center justify-center rounded-full border-2 bg-slate-950/90 transition-all duration-300 ${meta.ringClass}`}
        >
          <Bot className="h-11 w-11 text-indigo-400" />
          {status === "speaking" && (
            <span className="absolute inset-0 animate-ping rounded-full border border-indigo-400/40" />
          )}
        </div>

        {/* Audio Waveform Bars */}
        <div className="flex h-7 items-center gap-1.5">
          {[0.4, 0.85, 0.6, 1.0, 0.7, 0.9, 0.5, 0.75, 0.45].map((h, i) => (
            <span
              key={i}
              className={`w-1.5 rounded-full transition-all duration-200 ${
                status === "speaking"
                  ? "animate-pulse bg-indigo-400"
                  : status === "listening"
                  ? "bg-emerald-500/60"
                  : "bg-slate-700"
              }`}
              style={{
                height:
                  status === "speaking"
                    ? `${Math.round(h * 26)}px`
                    : status === "listening"
                    ? "8px"
                    : "4px",
                animationDelay: `${i * 90}ms`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Current AI Question Bubble */}
      <div className="rounded-xl border border-slate-800/90 bg-slate-950/70 p-3.5">
        <p className="line-clamp-3 text-sm leading-relaxed text-slate-200">
          {currentQuestion ||
            "Nhấn 'Bắt đầu phiên' để AI Interviewer đặt câu hỏi mở đầu cho bạn."}
        </p>
      </div>
    </div>
  );
}
