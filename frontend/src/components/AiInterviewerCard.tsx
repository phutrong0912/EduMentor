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
    badgeClass: "border border-slate-200 bg-slate-100 text-slate-600",
    ringClass: "border-slate-200",
  },
  listening: {
    label: "AI Đang lắng nghe",
    badgeClass: "border border-emerald-200 bg-emerald-50 text-emerald-700",
    ringClass: "border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.2)]",
  },
  thinking: {
    label: "AI Đang suy nghĩ...",
    badgeClass: "border border-amber-200 bg-amber-50 text-amber-700",
    ringClass: "border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.2)]",
  },
  speaking: {
    label: "AI Đang nói",
    badgeClass: "border border-indigo-200 bg-indigo-50 text-indigo-700",
    ringClass: "border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.25)]",
  },
  evaluating: {
    label: "Đang tổng hợp báo cáo AI...",
    badgeClass: "border border-violet-200 bg-violet-50 text-violet-700",
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
    <div className="flex aspect-video w-full flex-col justify-between rounded-2xl border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/40 to-violet-50/60 p-6 shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
            AI Interviewer
          </p>
          <p className="text-sm text-slate-600">Chủ đề: {topic}</p>
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
          className={`relative flex h-24 w-24 items-center justify-center rounded-full border-2 bg-white shadow-sm transition-all duration-300 ${meta.ringClass}`}
        >
          <Bot className="h-11 w-11 text-indigo-600" />
          {status === "speaking" && (
            <span className="absolute inset-0 animate-ping rounded-full border border-indigo-400/50" />
          )}
        </div>

        {/* Audio Waveform Bars */}
        <div className="flex h-7 items-center gap-1.5">
          {[0.4, 0.85, 0.6, 1.0, 0.7, 0.9, 0.5, 0.75, 0.45].map((h, i) => (
            <span
              key={i}
              className={`w-1.5 rounded-full transition-all duration-200 ${
                status === "speaking"
                  ? "animate-pulse bg-indigo-500"
                  : status === "listening"
                  ? "bg-emerald-500"
                  : "bg-slate-300"
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
      <div className="rounded-xl border border-slate-200 bg-white/95 p-3.5 shadow-sm">
        <p className="line-clamp-3 text-sm leading-relaxed text-slate-700">
          {currentQuestion ||
            "Nhấn 'Bắt đầu phiên' để AI Interviewer đặt câu hỏi mở đầu cho bạn."}
        </p>
      </div>
    </div>
  );
}
