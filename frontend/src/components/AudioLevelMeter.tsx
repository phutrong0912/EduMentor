"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

interface AudioLevelMeterProps {
  stream: MediaStream | null;
  enabled: boolean;
}

/**
 * Real-time microphone VU meter using Web Audio API AnalyserNode.
 * Gives immediate visual feedback if the microphone is muted or picking up audio.
 */
export function AudioLevelMeter({ stream, enabled }: AudioLevelMeterProps) {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!stream || !enabled || stream.getAudioTracks().length === 0) {
      setLevel(0);
      return;
    }

    let rafId = 0;
    let ctx: AudioContext | null = null;

    try {
      ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        const pct = Math.min(100, Math.round(rms * 320));
        setLevel(pct);
        rafId = window.requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setLevel(0);
    }

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      ctx?.close().catch(() => {});
    };
  }, [stream, enabled]);

  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      {enabled ? (
        <Volume2 className="h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <VolumeX className="h-4 w-4 shrink-0 text-rose-500" />
      )}
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full transition-all duration-75 ${
            level > 70
              ? "bg-amber-500"
              : level > 15
              ? "bg-emerald-500"
              : "bg-slate-400"
          }`}
          style={{ width: `${enabled ? Math.max(4, level) : 0}%` }}
        />
      </div>
      <span className="w-16 text-right text-[11px] font-medium text-slate-600">
        {enabled ? (level > 10 ? "Đang thu" : "Im lặng") : "Tắt Mic"}
      </span>
    </div>
  );
}
