"use client";

import React from "react";
import { Bot, User, AlertCircle, Gauge } from "lucide-react";
import type { TranscriptItem } from "@/types";

interface TranscriptViewerProps {
  transcripts: TranscriptItem[];
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderHighlightedText(text: string, fillers: string[] | null) {
  if (!fillers || fillers.length === 0) {
    return text;
  }

  const uniqueFillers = Array.from(new Set(fillers.map((f) => f.trim()).filter(Boolean)))
    .sort((a, b) => b.length - a.length);

  if (uniqueFillers.length === 0) return text;

  const pattern = new RegExp(
    `(${uniqueFillers.map(escapeRegExp).join("|")})`,
    "gi"
  );
  const parts = text.split(pattern);

  return parts.map((part, idx) => {
    const isFiller = uniqueFillers.some(
      (f) => f.toLowerCase() === part.toLowerCase()
    );
    if (isFiller) {
      return (
        <mark
          key={idx}
          className="mx-0.5 rounded bg-rose-500/25 px-1.5 py-0.5 font-semibold text-rose-300 ring-1 ring-rose-500/40"
          title="Từ đệm (Filler word)"
        >
          {part}
        </mark>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function TranscriptViewer({ transcripts }: TranscriptViewerProps) {
  if (!transcripts.length) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center text-sm text-slate-400">
        Chưa có nội dung hội thoại nào được ghi nhận trong phiên này.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-rose-500/40 ring-1 ring-rose-500/60" />
          Highlight đỏ: Từ đệm (Filler words)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-amber-500/30 ring-1 ring-amber-500/60" />
          Viền vàng: Tốc độ nói quá nhanh (&gt;160 WPM) hoặc quá chậm (&lt;110 WPM)
        </span>
      </div>

      <div className="space-y-3">
        {transcripts.map((item, idx) => {
          const isUser = item.speaker === "user";
          const paceWarning = isUser && item.pace_status !== "normal" && item.wpm > 0;

          return (
            <div
              key={item.id ?? idx}
              className={`rounded-xl border p-4 transition ${
                isUser
                  ? paceWarning
                    ? "border-amber-500/50 bg-amber-500/5"
                    : "border-slate-800 bg-slate-900/80"
                  : "border-indigo-500/25 bg-indigo-950/25"
              }`}
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                      isUser
                        ? "bg-slate-800 text-slate-200"
                        : "bg-indigo-600/30 text-indigo-300"
                    }`}
                  >
                    {isUser ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>
                  <span className="text-sm font-semibold text-white">
                    {isUser ? "Bạn (Ứng viên)" : "AI Interviewer"}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatTime(item.timestamp_sec)}
                  </span>
                </div>

                {isUser && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        item.pace_status === "normal"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      <Gauge className="h-3 w-3" />
                      {Math.round(item.wpm)} WPM
                      {item.pace_status === "fast"
                        ? " (Nhanh)"
                        : item.pace_status === "slow"
                        ? " (Chậm)"
                        : " (Chuẩn)"}
                    </span>

                    {item.filler_count > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2.5 py-0.5 text-xs font-medium text-rose-300">
                        <AlertCircle className="h-3 w-3" />
                        {item.filler_count} từ đệm
                      </span>
                    )}
                  </div>
                )}
              </div>

              <p className="text-sm leading-relaxed text-slate-200">
                {isUser
                  ? renderHighlightedText(item.text, item.filler_words)
                  : item.text}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
