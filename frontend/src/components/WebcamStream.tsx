"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, CameraOff, Eye, ScanFace } from "lucide-react";
import type { CVFrameMetrics } from "@/types";

interface WebcamStreamProps {
  stream: MediaStream | null;
  cameraEnabled: boolean;
  showOverlay: boolean;
  isActive: boolean;
  metrics: CVFrameMetrics | null;
  onFrameCapture: (base64Frame: string) => void;
  fps?: number;
}

export function WebcamStream({
  stream,
  cameraEnabled,
  showOverlay,
  isActive,
  metrics,
  onFrameCapture,
  fps = 5,
}: WebcamStreamProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onFrameRef = useRef(onFrameCapture);
  onFrameRef.current = onFrameCapture;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (stream && cameraEnabled) {
      video.srcObject = stream;
      video.play().catch(() => {});
    } else {
      video.srcObject = null;
    }
  }, [stream, cameraEnabled]);

  useEffect(() => {
    if (!isActive || !cameraEnabled || !stream) return;

    const intervalMs = Math.max(150, Math.round(1000 / fps));
    const timer = window.setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      const targetWidth = 480;
      const ratio = video.videoHeight / Math.max(video.videoWidth, 1);
      canvas.width = targetWidth;
      canvas.height = Math.round(targetWidth * ratio) || 270;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.65);
      onFrameRef.current(dataUrl);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [isActive, cameraEnabled, stream, fps]);

  const box = metrics?.landmarks_box;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-md">
      <video
        ref={videoRef}
        muted
        playsInline
        className={`h-full w-full -scale-x-100 object-cover transition-opacity ${
          cameraEnabled && stream ? "opacity-100" : "opacity-0"
        }`}
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera off placeholder */}
      {(!cameraEnabled || !stream) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm">
            <CameraOff className="h-8 w-8 text-slate-400" />
          </div>
          <p className="text-sm font-medium">
            {cameraEnabled
              ? "Đang chờ cấp quyền Webcam..."
              : "Camera đang tắt"}
          </p>
        </div>
      )}

      {/* Optional Face Mesh Bounding Box Overlay (mirrored to match video) */}
      {showOverlay && cameraEnabled && metrics?.face_detected && box && (
        <div
          className={`pointer-events-none absolute rounded-xl border-2 transition-all duration-150 ${
            metrics.eye_contact
              ? "border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
              : "border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
          }`}
          style={{
            left: `${(1 - box.x - box.width) * 100}%`,
            top: `${box.y * 100}%`,
            width: `${box.width * 100}%`,
            height: `${box.height * 100}%`,
          }}
        >
          <span className="absolute -top-6 left-0 rounded bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 shadow-sm">
            {metrics.expression === "confident_smile"
              ? "Tự tin"
              : metrics.expression === "speaking"
              ? "Đang nói"
              : metrics.expression === "tense"
              ? "Hơi căng thẳng"
              : "Tập trung"}
          </span>
        </div>
      )}

      {/* Top HUD Badges */}
      <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm backdrop-blur">
          <span
            className={`h-2 w-2 rounded-full ${
              isActive ? "animate-pulse bg-rose-500" : "bg-slate-400"
            }`}
          />
          {isActive ? "LIVE CV 5 FPS" : "Sẵn sàng"}
        </span>

        {isActive && metrics && (
          <>
            <span
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold shadow-sm backdrop-blur ${
                metrics.eye_contact
                  ? "bg-emerald-50/95 text-emerald-700"
                  : "bg-amber-50/95 text-amber-700"
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              Eye Contact: {Math.round(metrics.eye_contact_score)}%
            </span>

            <span className="flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm backdrop-blur">
              <ScanFace className="h-3.5 w-3.5 text-indigo-600" />
              Tư thế: {Math.round(metrics.head_stability)}%
            </span>
          </>
        )}
      </div>

      {/* Real-time non-intrusive warning toast */}
      {isActive && metrics?.alert && (
        <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50/95 px-3.5 py-2 text-xs font-medium text-amber-900 shadow-sm backdrop-blur">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>{metrics.alert}</span>
        </div>
      )}
    </div>
  );
}
