"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type WSStatus =
  | "disconnected"
  | "connecting"
  | "reconnecting"
  | "connected"
  | "error";

interface UseWebSocketOptions {
  url: string | null;
  onMessage?: (data: Record<string, unknown>) => void;
  onClose?: () => void;
  maxRetries?: number;
}

// Terminal server close codes (auth / ownership / not found) that should not auto-retry
const NON_RETRYABLE_CLOSE_CODES = new Set([1000, 4001, 4003, 4004]);

export function useWebSocket({
  url,
  onMessage,
  onClose,
  maxRetries = 5,
}: UseWebSocketOptions) {
  const [status, setStatus] = useState<WSStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const manualCloseRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);
  const onMessageRef = useRef(onMessage);
  const onCloseRef = useRef(onClose);

  onMessageRef.current = onMessage;
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!url) {
      setStatus("disconnected");
      return;
    }

    manualCloseRef.current = false;
    retryCountRef.current = 0;

    let pingInterval: number | null = null;
    let isDisposed = false;

    const connect = () => {
      if (isDisposed || manualCloseRef.current) return;

      setStatus(retryCountRef.current > 0 ? "reconnecting" : "connecting");
      const ws = new WebSocket(url);
      wsRef.current = ws;

      pingInterval = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 20000);

      ws.onopen = () => {
        retryCountRef.current = 0;
        setStatus("connected");
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          onMessageRef.current?.(parsed);
        } catch {
          // ignore non-JSON frames
        }
      };

      ws.onerror = () => {
        setStatus("error");
      };

      ws.onclose = (ev) => {
        if (pingInterval !== null) {
          window.clearInterval(pingInterval);
          pingInterval = null;
        }
        wsRef.current = null;

        if (
          isDisposed ||
          manualCloseRef.current ||
          NON_RETRYABLE_CLOSE_CODES.has(ev.code)
        ) {
          setStatus("disconnected");
          onCloseRef.current?.();
          return;
        }

        if (retryCountRef.current < maxRetries) {
          const attempt = retryCountRef.current;
          retryCountRef.current += 1;
          const delayMs = Math.min(8000, 1000 * Math.pow(2, attempt));
          setStatus("reconnecting");
          retryTimerRef.current = window.setTimeout(connect, delayMs);
        } else {
          setStatus("error");
          onCloseRef.current?.();
        }
      };
    };

    connect();

    return () => {
      isDisposed = true;
      manualCloseRef.current = true;
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (pingInterval !== null) {
        window.clearInterval(pingInterval);
      }
      wsRef.current?.close(1000, "Component unmount");
      wsRef.current = null;
    };
  }, [url, maxRetries]);

  const sendJson = useCallback((payload: Record<string, unknown>): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(payload));
    return true;
  }, []);

  const disconnect = useCallback(() => {
    manualCloseRef.current = true;
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    wsRef.current?.close(1000, "Manual disconnect");
    wsRef.current = null;
  }, []);

  return { status, sendJson, disconnect };
}
