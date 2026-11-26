"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type WSStatus = "disconnected" | "connecting" | "connected" | "error";

interface UseWebSocketOptions {
  url: string | null;
  onMessage?: (data: Record<string, unknown>) => void;
  onClose?: () => void;
}

export function useWebSocket({ url, onMessage, onClose }: UseWebSocketOptions) {
  const [status, setStatus] = useState<WSStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  const onCloseRef = useRef(onClose);

  onMessageRef.current = onMessage;
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!url) {
      setStatus("disconnected");
      return;
    }

    setStatus("connecting");
    const ws = new WebSocket(url);
    wsRef.current = ws;

    const pingInterval = window.setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 20000);

    ws.onopen = () => {
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

    ws.onclose = () => {
      setStatus("disconnected");
      window.clearInterval(pingInterval);
      onCloseRef.current?.();
    };

    return () => {
      window.clearInterval(pingInterval);
      ws.close();
      wsRef.current = null;
    };
  }, [url]);

  const sendJson = useCallback((payload: Record<string, unknown>): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(payload));
    return true;
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  return { status, sendJson, disconnect };
}
