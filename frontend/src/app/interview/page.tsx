"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  CameraOff,
  Eye,
  Mic,
  MicOff,
  Play,
  Send,
  Square,
  StopCircle,
  Radio,
} from "lucide-react";

import { AiInterviewerCard } from "@/components/AiInterviewerCard";
import { WebcamStream } from "@/components/WebcamStream";
import { useMediaRecorder } from "@/hooks/useMediaRecorder";
import { useWebSocket } from "@/hooks/useWebSocket";
import { createSession, endSession, WS_BASE_URL } from "@/lib/api";
import type {
  AiStatus,
  CVFrameMetrics,
  InterviewMode,
  InterviewTopic,
  LanguageCode,
  TranscriptItem,
} from "@/types";

const TOPICS: InterviewTopic[] = [
  "IT Backend",
  "IT Frontend",
  "Kinh tế",
  "Thuyết trình tự do",
];

export default function InterviewRoomPage() {
  const router = useRouter();

  // Session config
  const [topic, setTopic] = useState<InterviewTopic>("IT Backend");
  const [mode, setMode] = useState<InterviewMode>("interview");
  const [language, setLanguage] = useState<LanguageCode>("vi");

  // Live session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [cvMetrics, setCvMetrics] = useState<CVFrameMetrics | null>(null);
  const [manualText, setManualText] = useState("");
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Media controls
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [showOverlay, setShowOverlay] = useState(true);
  const [elapsedSec, setElapsedSec] = useState(0);

  const sessionStartRef = useRef<number>(0);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll live transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  // Session timer
  useEffect(() => {
    if (!sessionId) return;
    sessionStartRef.current = performance.now();
    const timer = window.setInterval(() => {
      setElapsedSec(Math.floor((performance.now() - sessionStartRef.current) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sessionId]);

  // Initialize Webcam + Mic preview on mount
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    async function initMedia() {
      try {
        activeStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 360, facingMode: "user" },
          audio: true,
        });
        setStream(activeStream);
      } catch {
        setErrorBanner(
          "Không thể mở Webcam/Microphone. Bạn vẫn có thể luyện tập bằng khung nhập văn bản bên dưới."
        );
      }
    }
    initMedia();

    return () => {
      activeStream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Play AI audio (MP3 base64 from Edge-TTS/OpenAI TTS, or browser SpeechSynthesis fallback)
  const playAiVoice = useCallback(
    (text: string, audioBase64?: string | null) => {
      if (audioBase64) {
        try {
          const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
          audio.play().catch(() => {});
          return;
        } catch {
          // fallback below
        }
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = language === "vi" ? "vi-VN" : "en-US";
        utter.rate = 1.0;
        window.speechSynthesis.speak(utter);
      }
    },
    [language]
  );

  // Handle incoming WebSocket events
  const handleWsMessage = useCallback(
    (msg: Record<string, unknown>) => {
      const type = msg.type as string;

      if (type === "cv_metrics" && msg.data) {
        setCvMetrics(msg.data as CVFrameMetrics);
        return;
      }

      if (type === "ai_status" && typeof msg.status === "string") {
        setAiStatus(msg.status as AiStatus);
        return;
      }

      if (type === "ai_response" && typeof msg.text === "string") {
        const text = msg.text;
        const ts = Number(msg.timestamp_sec || 0);
        setCurrentQuestion(text);
        setTranscripts((prev) => [
          ...prev,
          {
            speaker: "ai",
            text,
            timestamp_sec: ts,
            duration_sec: 0,
            word_count: text.split(/\s+/).length,
            wpm: 0,
            pace_status: "normal",
            filler_words: [],
            filler_count: 0,
          },
        ]);
        playAiVoice(text, (msg.audio_base64 as string | null) ?? null);
        return;
      }

      if (type === "user_transcript_analyzed" && msg.data) {
        const d = msg.data as TranscriptItem;
        setTranscripts((prev) => [...prev, { ...d, speaker: "user" }]);
        return;
      }

      if (type === "session_completed" && typeof msg.session_id === "string") {
        router.push(`/dashboard/${msg.session_id}`);
        return;
      }

      if (type === "error" && typeof msg.message === "string") {
        setErrorBanner(msg.message);
      }
    },
    [playAiVoice, router]
  );

  const { status: wsStatus, sendJson, disconnect } = useWebSocket({
    url: wsUrl,
    onMessage: handleWsMessage,
  });

  // Voice recording hook
  const { isRecording, liveCaption, micError, startRecording, stopRecording } =
    useMediaRecorder({
      language,
      onAnswerRecorded: ({
        audioBase64,
        mimeType,
        durationSec,
        browserTranscript,
      }) => {
        const elapsed =
          sessionStartRef.current > 0
            ? (performance.now() - sessionStartRef.current) / 1000
            : 0;

        sendJson({
          type: "audio_chunk",
          audio: audioBase64,
          mime_type: mimeType,
          duration_sec: durationSec,
          timestamp_sec: Number(elapsed.toFixed(2)),
          fallback_text: browserTranscript,
        });
      },
    });

  // Frame streaming callback (5 FPS)
  const handleFrameCapture = useCallback(
    (base64Frame: string) => {
      if (wsStatus !== "connected") return;
      const elapsed =
        sessionStartRef.current > 0
          ? (performance.now() - sessionStartRef.current) / 1000
          : 0;
      sendJson({
        type: "video_frame",
        frame: base64Frame,
        timestamp_sec: Number(elapsed.toFixed(2)),
      });
    },
    [wsStatus, sendJson]
  );

  // Start a new interview session
  const handleStartSession = async () => {
    setErrorBanner(null);
    setIsStarting(true);
    try {
      const created = await createSession({ topic, mode, language });
      setSessionId(created.id);
      setTranscripts([]);
      setElapsedSec(0);
      setWsUrl(`${WS_BASE_URL}/ws/interview/${created.id}`);
    } catch (err) {
      setErrorBanner(
        err instanceof Error
          ? `Không thể kết nối Backend API (${err.message}). Hãy kiểm tra server FastAPI đang chạy ở cổng 8000.`
          : "Không thể khởi tạo phiên phỏng vấn."
      );
    } finally {
      setIsStarting(false);
    }
  };

  // End session & trigger LLM evaluation
  const handleEndSession = async () => {
    if (!sessionId || isEnding) return;
    setIsEnding(true);
    setAiStatus("evaluating");
    stopRecording();

    const sent = sendJson({ type: "end_session" });
    if (!sent) {
      try {
        await endSession(sessionId);
        router.push(`/dashboard/${sessionId}`);
      } catch {
        setErrorBanner("Lỗi khi kết thúc phiên. Vui lòng thử lại.");
        setIsEnding(false);
      }
    }
  };

  // Toggle mic track
  const toggleMic = () => {
    const next = !micEnabled;
    setMicEnabled(next);
    stream?.getAudioTracks().forEach((t) => {
      t.enabled = next;
    });
    if (!next && isRecording) {
      stopRecording();
    }
  };

  // Toggle camera track
  const toggleCamera = () => {
    const next = !cameraEnabled;
    setCameraEnabled(next);
    stream?.getVideoTracks().forEach((t) => {
      t.enabled = next;
    });
  };

  // Send typed answer (great for demo or noisy environments)
  const handleSendManualText = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = manualText.trim();
    if (!cleaned || wsStatus !== "connected") return;

    const elapsed =
      sessionStartRef.current > 0
        ? (performance.now() - sessionStartRef.current) / 1000
        : 0;
    const words = cleaned.split(/\s+/).length;
    const estimatedDuration = Math.max(2.0, words / 2.3);

    sendJson({
      type: "user_transcript",
      text: cleaned,
      duration_sec: Number(estimatedDuration.toFixed(1)),
      timestamp_sec: Number(elapsed.toFixed(2)),
    });
    setManualText("");
  };

  // Cleanup WS on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const formatTimer = (sec: number) =>
    `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Top Control Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={topic}
            disabled={Boolean(sessionId)}
            onChange={(e) => setTopic(e.target.value as InterviewTopic)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50"
          >
            {TOPICS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <select
            value={mode}
            disabled={Boolean(sessionId)}
            onChange={(e) => setMode(e.target.value as InterviewMode)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50"
          >
            <option value="interview">Mô phỏng Phỏng vấn</option>
            <option value="presentation">Luyện Thuyết trình</option>
          </select>

          <select
            value={language}
            disabled={Boolean(sessionId)}
            onChange={(e) => setLanguage(e.target.value as LanguageCode)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50"
          >
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>

          {sessionId && (
            <span className="flex items-center gap-1.5 rounded-xl bg-slate-950 px-3 py-2 font-mono text-sm text-indigo-300">
              <Radio className="h-3.5 w-3.5 animate-pulse text-rose-500" />
              {formatTimer(elapsedSec)}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleCamSafe(toggleCamera)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
              cameraEnabled
                ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                : "bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
            }`}
          >
            {cameraEnabled ? (
              <Camera className="h-4 w-4" />
            ) : (
              <CameraOff className="h-4 w-4" />
            )}
            Cam
          </button>

          <button
            type="button"
            onClick={toggleMic}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
              micEnabled
                ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                : "bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
            }`}
          >
            {micEnabled ? (
              <Mic className="h-4 w-4" />
            ) : (
              <MicOff className="h-4 w-4" />
            )}
            Mic
          </button>

          <button
            type="button"
            onClick={() => setShowOverlay((v) => !v)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
              showOverlay
                ? "bg-indigo-500/20 text-indigo-300"
                : "bg-slate-800 text-slate-400"
            }`}
          >
            <Eye className="h-4 w-4" />
            Overlay
          </button>

          {!sessionId ? (
            <button
              type="button"
              disabled={isStarting}
              onClick={handleStartSession}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500 disabled:opacity-60"
            >
              <Play className="h-4 w-4" />
              {isStarting ? "Đang kết nối..." : "Bắt đầu phiên"}
            </button>
          ) : (
            <button
              type="button"
              disabled={isEnding}
              onClick={handleEndSession}
              className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-rose-600/25 transition hover:bg-rose-500 disabled:opacity-60"
            >
              <StopCircle className="h-4 w-4" />
              {isEnding ? "Đang chấm điểm..." : "Kết thúc & Xem báo cáo"}
            </button>
          )}
        </div>
      </div>

      {/* Error / Warning Banner */}
      {(errorBanner || micError) && (
        <div className="mb-5 rounded-xl border border-rose-500/40 bg-rose-950/50 px-4 py-3 text-sm text-rose-200">
          {errorBanner || micError}
        </div>
      )}

      {/* Split Screen: Webcam + AI Interviewer */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <WebcamStream
          stream={stream}
          cameraEnabled={cameraEnabled}
          showOverlay={showOverlay}
          isActive={wsStatus === "connected"}
          metrics={cvMetrics}
          onFrameCapture={handleFrameCapture}
          fps={5}
        />

        <AiInterviewerCard
          status={aiStatus}
          currentQuestion={currentQuestion}
          topic={topic}
        />
      </div>

      {/* Voice Answer Bar + Live Transcript */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Voice & Text Input Controls */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div>
            <h2 className="text-base font-semibold text-white">
              Trả lời câu hỏi
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Nhấn nút ghi âm để nói câu trả lời của bạn. Khi nói xong, nhấn Dừng để AI phân tích WPM, từ đệm và đặt câu hỏi tiếp theo.
            </p>

            <div className="mt-5 flex flex-col gap-3">
              {!isRecording ? (
                <button
                  type="button"
                  disabled={wsStatus !== "connected" || !micEnabled || isEnding}
                  onClick={() => startRecording(stream)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Mic className="h-5 w-5" />
                  Bắt đầu trả lời (Ghi âm)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="flex w-full animate-pulse items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-rose-600/25 transition hover:bg-rose-500"
                >
                  <Square className="h-4 w-4 fill-current" />
                  Dừng & Gửi câu trả lời
                </button>
              )}

              {isRecording && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-3 text-xs text-emerald-200">
                  <span className="font-semibold">Đang nghe: </span>
                  {liveCaption || "Hãy nói rõ ràng vào micro..."}
                </div>
              )}
            </div>
          </div>

          {/* Fallback text input */}
          <form onSubmit={handleSendManualText} className="mt-5 border-t border-slate-800 pt-4">
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Hoặc nhập câu trả lời trực tiếp (Demo / Không có Mic)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualText}
                disabled={wsStatus !== "connected" || isEnding}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="Nhập câu trả lời của bạn..."
                className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={wsStatus !== "connected" || !manualText.trim() || isEnding}
                className="rounded-xl bg-indigo-600 px-3.5 py-2 text-white transition hover:bg-indigo-500 disabled:opacity-45"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>

        {/* Live Transcript Panel */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">
              Phụ đề trực tiếp (Live Transcript)
            </h2>
            <span className="text-xs text-slate-400">
              WS:{" "}
              <strong
                className={
                  wsStatus === "connected" ? "text-emerald-400" : "text-slate-400"
                }
              >
                {wsStatus}
              </strong>
            </span>
          </div>

          <div className="h-64 space-y-3 overflow-y-auto pr-1">
            {transcripts.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Hội thoại giữa bạn và AI Interviewer sẽ hiển thị theo thời gian thực tại đây.
              </div>
            ) : (
              transcripts.map((t, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col rounded-xl px-4 py-2.5 text-sm ${
                    t.speaker === "ai"
                      ? "border border-indigo-500/20 bg-indigo-950/30 text-indigo-100"
                      : "border border-slate-700/70 bg-slate-950/80 text-slate-100"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-semibold">
                      {t.speaker === "ai" ? "AI Interviewer" : "Bạn"}
                    </span>
                    {t.speaker === "user" && (
                      <span className="text-slate-400">
                        {Math.round(t.wpm)} WPM · {t.filler_count} từ đệm
                      </span>
                    )}
                  </div>
                  <p className="leading-relaxed">{t.text}</p>
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

function toggleCamSafe(fn: () => void) {
  return () => fn();
}
