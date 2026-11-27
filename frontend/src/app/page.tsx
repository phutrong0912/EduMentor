"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Camera,
  Mic,
  Sparkles,
  Clock,
} from "lucide-react";
import { listSessions } from "@/lib/api";
import type { SessionSummary } from "@/types";

export default function HomePage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  useEffect(() => {
    const load = () => {
      listSessions(6)
        .then(setSessions)
        .catch(() => {
          setSessions([]);
        });
    };
    load();
    window.addEventListener("edumentor-auth-change", load);
    return () => window.removeEventListener("edumentor-auth-change", load);
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/70 to-violet-50/80 px-6 py-14 text-center shadow-sm sm:px-12">
        <div className="mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white/85 px-3.5 py-1 text-xs font-medium text-indigo-700 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Multimodal AI Pipeline · Computer Vision + STT + LLM
          </span>

          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Luyện Phỏng Vấn & Thuyết Trình Chuẩn Chuyên Gia Với{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              EduMentor AI
            </span>
          </h1>

          <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
            Mô phỏng phòng phỏng vấn thực tế qua Webcam và Microphone. Hệ thống phân tích ánh mắt (Iris Tracking), tư thế đầu (Head Pose), tốc độ nói (WPM), từ đệm và chấm điểm 4 tiêu chí theo thời gian thực.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/interview"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700"
            >
              Vào phòng luyện tập ngay
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
            >
              Khám phá công nghệ
            </a>
          </div>
        </div>
      </section>

      {/* 3 Core Multimodal Pillars */}
      <section id="features" className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition hover:shadow-md">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Camera className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">
            Computer Vision Engine
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            MediaPipe Face Mesh (Iris landmarks 468–477) và OpenCV{" "}
            <code className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-xs text-emerald-700">solvePnP</code> theo dõi tỷ lệ giao tiếp mắt, góc nghiêng đầu (Pitch/Yaw/Roll) và biểu cảm khuôn mặt ở 5–10 FPS.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition hover:shadow-md">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Mic className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">
            Speech & NLP Analytics
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Chuyển giọng nói tiếng Việt / tiếng Anh sang văn bản, tự động tính tốc độ nói WPM (chuẩn 120–150 WPM) và highlight các từ đệm như <em>&ldquo;à&rdquo;, &ldquo;ừm&rdquo;, &ldquo;kiểu như&rdquo;</em>.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition hover:shadow-md">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <BrainCircuit className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">
            LLM Interviewer & Dashboard
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            AI phản biện linh hoạt kết hợp giọng nói TTS, sau đó tổng hợp báo cáo Radar 4 chiều, biểu đồ Timeline và gợi ý trả lời theo cấu trúc STAR.
          </p>
        </div>
      </section>

      {/* Recent Sessions History */}
      <section className="mt-14">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Lịch sử phiên luyện tập gần đây
            </h2>
            <p className="text-sm text-slate-500">
              Nhấn vào bất kỳ phiên nào để mở trang Analytics Dashboard chi tiết
            </p>
          </div>
          <Link
            href="/interview"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            + Tạo phiên mới
          </Link>
        </div>

        {sessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-10 text-center">
            <BarChart3 className="mx-auto h-10 w-10 text-slate-400" />
            <p className="mt-3 text-sm text-slate-500">
              Chưa có phiên luyện tập nào. Hãy bắt đầu buổi phỏng vấn đầu tiên của bạn!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sessions.map((s) => (
              <Link
                key={s.id}
                href={`/dashboard/${s.id}`}
                className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                    {s.topic}
                  </span>
                  <span className="text-lg font-bold text-slate-900">
                    {s.overall_score !== null
                      ? `${Math.round(s.overall_score)}/100`
                      : "Đang xử lý"}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(s.started_at).toLocaleDateString("vi-VN")}
                  </span>
                  <span>
                    Eye: {Math.round(s.avg_eye_contact_rate)}% ·{" "}
                    {Math.round(s.avg_wpm)} WPM
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
