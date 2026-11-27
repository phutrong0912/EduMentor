"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LanguageCode } from "@/types";

interface SpeechRecognitionEventLike {
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

interface UseMediaRecorderOptions {
  language: LanguageCode;
  onAnswerRecorded: (payload: {
    audioBase64: string;
    mimeType: string;
    durationSec: number;
    browserTranscript: string;
  }) => void;
}

/**
 * Records user's spoken answer via MediaRecorder (for server Whisper STT)
 * AND runs parallel browser Web Speech API recognition for instant live captions & offline fallback.
 */
export function useMediaRecorder({
  language,
  onAnswerRecorded,
}: UseMediaRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [liveCaption, setLiveCaption] = useState("");
  const [micError, setMicError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const ownedStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef<string>("");
  const onAnswerRef = useRef(onAnswerRecorded);

  onAnswerRef.current = onAnswerRecorded;

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    if (ownedStreamRef.current) {
      ownedStreamRef.current.getTracks().forEach((t) => t.stop());
      ownedStreamRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(
    async (existingStream?: MediaStream | null) => {
      setMicError(null);
      setLiveCaption("");
      transcriptRef.current = "";
      chunksRef.current = [];

      try {
        let audioStream: MediaStream;
        if (existingStream) {
          audioStream = new MediaStream(existingStream.getAudioTracks());
          ownedStreamRef.current = null;
        } else {
          audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          ownedStreamRef.current = audioStream;
        }

        if (audioStream.getAudioTracks().length === 0) {
          setMicError("Không tìm thấy micro đang hoạt động.");
          return;
        }

        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";

        const recorder = new MediaRecorder(audioStream, { mimeType });
        mediaRecorderRef.current = recorder;
        startTimeRef.current = performance.now();

        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) {
            chunksRef.current.push(ev.data);
          }
        };

        recorder.onstop = () => {
          const durationSec = Math.max(
            0.5,
            (performance.now() - startTimeRef.current) / 1000
          );
          const blob = new Blob(chunksRef.current, { type: mimeType });
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = typeof reader.result === "string" ? reader.result : "";
            const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
            onAnswerRef.current({
              audioBase64: base64,
              mimeType,
              durationSec: Number(durationSec.toFixed(2)),
              browserTranscript: transcriptRef.current.trim(),
            });
          };
          reader.readAsDataURL(blob);
        };

        recorder.start(500);
        setIsRecording(true);

        // Optional Web Speech API for live captions & fallback when server STT is mock
        const w = window as unknown as {
          SpeechRecognition?: new () => SpeechRecognitionLike;
          webkitSpeechRecognition?: new () => SpeechRecognitionLike;
        };
        const SpeechRec = w.SpeechRecognition || w.webkitSpeechRecognition;
        if (SpeechRec) {
          const recognition = new SpeechRec();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = language === "vi" ? "vi-VN" : "en-US";
          recognition.onresult = (event) => {
            let full = "";
            for (let i = 0; i < event.results.length; i++) {
              full += event.results[i][0].transcript + " ";
            }
            transcriptRef.current = full.trim();
            setLiveCaption(full.trim());
          };
          recognition.onerror = () => {
            // Non-fatal: MediaRecorder still captures audio
          };
          try {
            recognition.start();
            recognitionRef.current = recognition;
          } catch {
            // ignore if browser blocks concurrent recognition
          }
        }
      } catch (err) {
        setMicError(
          err instanceof Error
            ? `Không thể truy cập micro: ${err.message}`
            : "Không thể truy cập micro."
        );
      }
    },
    [language]
  );

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  return {
    isRecording,
    liveCaption,
    micError,
    startRecording,
    stopRecording,
  };
}
