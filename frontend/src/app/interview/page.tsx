"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  CameraOff,
  Eye,
  FileText,
  Mic,
  MicOff,
  Play,
  Send,
  Square,
  StopCircle,
  Radio,
  Volume2,
  VolumeX,
} from "lucide-react";

import { AiInterviewerCard } from "@/components/AiInterviewerCard";
import { AudioLevelMeter } from "@/components/AudioLevelMeter";
import { WebcamStream } from "@/components/WebcamStream";
import { useMediaRecorder } from "@/hooks/useMediaRecorder";
import { useWebSocket } from "@/hooks/useWebSocket";
import { buildInterviewWsUrl, createSession, endSession } from "@/lib/api";
import type {
  AiStatus,
  CVFrameMetrics,
  DifficultyLevel,
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
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("medium");
  const [customContext, setCustomContext] = useState("");
  const [showContextBox, setShowContextBox] = useState(false);

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
  const [infoBanner, setInfoBanner] = useState<string | null>(null);

  // Media controls
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [aiVoiceEnabled, setAiVoiceEnabled] = useState(true);
  const [showOverlay, setShowOverlay] = useState(true);
  const [elapsedSec, setElapsedSec] = useState(0);

  const sessionStartRef = useRef<number>(0);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

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

  const stopAiVoice = useCallback(() => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.currentTime = 0;
      activeAudioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  // Play AI audio (MP3 base64 from Edge-TTS/OpenAI TTS, or browser SpeechSynthesis fallback)
  const playAiVoice = useCallback(
    (text: string, audioBase64?: string | null) => {
      stopAiVoice();
      if (!aiVoiceEnabled) return;

      if (audioBase64) {
        try {
          const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
          activeAudioRef.current = audio;
          audio.onended = () => {
            if (activeAudioRef.current === audio) {
              activeAudioRef.current = null;
            }
          };
          audio.play().catch(() => {});
          return;
        } catch {
          // fallback below
        }
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = language === "vi" ? "vi-VN" : "en-US";
        utter.rate = 1.0;
        window.speechSynthesis.speak(utter);
      }
    },
    [language, aiVoiceEnabled, stopAiVoice]
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

      if (type === "session_sync" && Array.isArray(msg.transcripts)) {
        setTranscripts(msg.transcripts as TranscriptItem[]);
        if (typeof msg.current_question === "string") {
          setCurrentQuestion(msg.current_question);
        }
        setInfoBanner("Đã khôi phục kết nối phiên luyện tập.");
        return;
      }

      if (type === "ai_response" && typeof msg.text === "string") {
        const text = msg.text;
        const ts = Number(msg.timestamp_sec || 0);
        setInfoBanner(null);
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
        setInfoBanner(null);
        setTranscripts((prev) => [...prev, { ...d, speaker: "user" }]);
        return;
      }

      if (type === "session_completed" && typeof msg.session_id === "string") {
        stopAiVoice();
        router.push(`/dashboard/${msg.session_id}`);
        return;
      }

      if (type === "info" && typeof msg.message === "string") {
        setInfoBanner(msg.message);
        return;
      }

      if (type === "error" && typeof msg.message === "string") {
        setErrorBanner(msg.message);
      }
    },
    [playAiVoice, stopAiVoice, router]
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
    setInfoBanner(null);
    setIsStarting(true);
    try {
      const created = await createSession({
        topic,
        mode,
        language,
        difficulty,
        custom_context: customContext.trim() || undefined,
      });
      setSessionId(created.id);
      setTranscripts([]);
      setElapsedSec(0);
      setWsUrl(buildInterviewWsUrl(created.id));
    } catch (err) {
      setErrorBanner(
        err instanceof Error
          ? `Không thể khởi tạo phiên luyện tập: ${err.message}`
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
    stopAiVoice();

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

  // Cleanup WS & AI audio on unmount
  useEffect(() => {
    return () => {
      stopAiVoice();
      disconnect();
    };
  }, [disconnect, stopAiVoice]);

  const formatTimer = (sec: number) =>
    `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Top Control Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={topic}
            disabled={Boolean(sessionId)}
            onChange={(e) => setTopic(e.target.value as InterviewTopic)}
            className="rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none disabled:opacity-50"
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
            className="rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none disabled:opacity-50"
          >
            <option value="interview">Mô phỏng Phỏng vấn</option>
            <option value="presentation">Luyện Thuyết trình</option>
          </select>

          <select
            value={language}
            disabled={Boolean(sessionId)}
            onChange={(e) => setLanguage(e.target.value as LanguageCode)}
            className="rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none disabled:opacity-50"
          >
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>

          <select
            value={difficulty}
            disabled={Boolean(sessionId)}
            onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
            className="rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none disabled:opacity-50"
          >
            <option value="easy">Cấp độ: Thân thiện (Fresher)</option>
            <option value="medium">Cấp độ: Chuyên nghiệp (Mid)</option>
            <option value="hard">Cấp độ: Phản biện gắt (Senior)</option>
          </select>

          {!sessionId && (
            <button
              type="button"
              onClick={() => setShowContextBox((v) => !v)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                showContextBox || customContext.trim()
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              {customContext.trim() ? "Đã nhập CV / JD" : "+ Nhập CV / JD"}
            </button>
          )}

          {sessionId && (
            <span className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 font-mono text-sm font-semibold text-indigo-700">
              <Radio className="h-3.5 w-3.5 animate-pulse text-rose-500" />
              {formatTimer(elapsedSec)}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleCamera}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition ${
              cameraEnabled
                ? "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
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
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition ${
              micEnabled
                ? "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
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
            onClick={() => {
              const next = !aiVoiceEnabled;
              setAiVoiceEnabled(next);
              if (!next) stopAiVoice();
            }}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition ${
              aiVoiceEnabled
                ? "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
            }`}
          >
            {aiVoiceEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
            Loa AI
          </button>

          <button
            type="button"
            onClick={() => setShowOverlay((v) => !v)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition ${
              showOverlay
                ? "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                : "border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200"
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
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:opacity-60"
            >
              <Play className="h-4 w-4" />
              {isStarting ? "Đang kết nối..." : "Bắt đầu phiên"}
            </button>
          ) : (
            <button
              type="button"
              disabled={isEnding}
              onClick={handleEndSession}
              className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-rose-600/20 transition hover:bg-rose-700 disabled:opacity-60"
            >
              <StopCircle className="h-4 w-4" />
              {isEnding ? "Đang chấm điểm..." : "Kết thúc & Xem báo cáo"}
            </button>
          )}
        </div>
      </div>

      {/* Optional CV / JD / Presentation Outline Box */}
      {!sessionId && showContextBox && (
        <div className="mb-5 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 shadow-sm">
          <label className="mb-1.5 block text-xs font-semibold text-indigo-700">
            Dán tóm tắt CV, mô tả công việc (JD) hoặc đề cương thuyết trình để AI cá nhân hóa câu hỏi:
          </label>
          <textarea
            rows={3}
            value={customContext}
            onChange={(e) => setCustomContext(e.target.value)}
            placeholder="Ví dụ: Sinh viên năm 4 CNTT, ứng tuyển Backend Developer (Python, FastAPI, PostgreSQL, Redis). Đã làm đồ án hệ thống gợi ý phim..."
            className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
          />
        </div>
      )}

      {/* Error / Warning / Info Banners */}
      {(errorBanner || micError) && (
        <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorBanner || micError}
        </div>
      )}

      {infoBanner && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>{infoBanner}</span>
          <button
            type="button"
            onClick={() => setInfoBanner(null)}
            className="text-xs font-semibold text-amber-700 hover:text-amber-900"
          >
            Đóng
          </button>
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
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Trả lời câu hỏi
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Nhấn nút ghi âm để nói câu trả lời của bạn. Khi nói xong, nhấn Dừng để AI phân tích WPM, từ đệm và đặt câu hỏi tiếp theo.
            </p>

            <div className="mt-4 flex flex-col gap-3">
              <AudioLevelMeter stream={stream} enabled={micEnabled} />

              {wsStatus === "connected" && cvMetrics?.face_detected && (
                <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-center text-[11px]">
                  <div>
                    <span className="block text-slate-500">Pitch</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {cvMetrics.head_pose.pitch}°
                    </span>
                  </div>
                  <div>
                    <span className="block text-slate-500">Yaw</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {cvMetrics.head_pose.yaw}°
                    </span>
                  </div>
                  <div>
                    <span className="block text-slate-500">Roll</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {cvMetrics.head_pose.roll}°
                    </span>
                  </div>
                </div>
              )}
              {!isRecording ? (
                <button
                  type="button"
                  disabled={wsStatus !== "connected" || !micEnabled || isEnding}
                  onClick={() => {
                    stopAiVoice();
                    setInfoBanner(null);
                    startRecording(stream);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Mic className="h-5 w-5" />
                  Bắt đầu trả lời (Ghi âm)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="flex w-full animate-pulse items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3.5 text-sm font-semibold text-white shadow-md shadow-rose-600/25 transition hover:bg-rose-700"
                >
                  <Square className="h-4 w-4 fill-current" />
                  Dừng & Gửi câu trả lời
                </button>
              )}

              {isRecording && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                  <span className="font-semibold">Đang nghe: </span>
                  {liveCaption || "Hãy nói rõ ràng vào micro..."}
                </div>
              )}
            </div>
          </div>

          {/* Fallback text input */}
          <form onSubmit={handleSendManualText} className="mt-5 border-t border-slate-200 pt-4">
            <label className="mb-1.5 block text-xs font-medium text-slate-500">
              Hoặc nhập câu trả lời bằng văn bản
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualText}
                disabled={wsStatus !== "connected" || isEnding}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="Nhập câu trả lời của bạn..."
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 disabled:bg-slate-50 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={wsStatus !== "connected" || !manualText.trim() || isEnding}
                className="rounded-xl bg-indigo-600 px-3.5 py-2 text-white transition hover:bg-indigo-700 disabled:opacity-45"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>

        {/* Live Transcript Panel */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Phụ đề trực tiếp (Live Transcript)
            </h2>
            <span className="text-xs text-slate-500">
              Kết nối:{" "}
              <strong
                className={
                  wsStatus === "connected"
                    ? "text-emerald-600"
                    : wsStatus === "reconnecting" || wsStatus === "connecting"
                    ? "text-amber-600"
                    : wsStatus === "error"
                    ? "text-rose-600"
                    : "text-slate-500"
                }
              >
                {wsStatus === "connected"
                  ? "Ổn định"
                  : wsStatus === "reconnecting"
                  ? "Đang kết nối lại..."
                  : wsStatus === "connecting"
                  ? "Đang kết nối..."
                  : wsStatus === "error"
                  ? "Mất kết nối"
                  : "Chưa kết nối"}
              </strong>
            </span>
          </div>

          <div className="h-64 space-y-3 overflow-y-auto pr-1">
            {transcripts.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                Hội thoại giữa bạn và AI Interviewer sẽ hiển thị theo thời gian thực tại đây.
              </div>
            ) : (
              transcripts.map((t, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col rounded-xl px-4 py-2.5 text-sm ${
                    t.speaker === "ai"
                      ? "border border-indigo-200/80 bg-indigo-50/70 text-slate-800"
                      : "border border-slate-200 bg-slate-50 text-slate-800"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900">
                      {t.speaker === "ai" ? "AI Interviewer" : "Bạn"}
                    </span>
                    {t.speaker === "user" && (
                      <span className="text-slate-500">
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
