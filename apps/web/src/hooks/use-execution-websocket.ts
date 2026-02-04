"use client";

/**
 * WebSocket hook for execution events.
 * Subscribes to real-time execution updates and streams them to the execution store.
 */

import { useEffect, useRef, useCallback } from "react";
import { useExecutionStore } from "@/stores";
import { API_CONFIG, API_ENDPOINTS } from "@/lib/api";
import type { ExecutionEvent, ClientMessage } from "@/types";

interface UseExecutionWebSocketOptions {
  executionId: string | null;
  token?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
}

export function useExecutionWebSocket({
  executionId,
  token,
  onConnect,
  onDisconnect,
  onError,
}: UseExecutionWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    handleEvent,
    setConnected,
    setConnectionError,
    completeExecution,
  } = useExecutionStore();

  // Send message to WebSocket
  const sendMessage = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  // Subscribe to execution
  const subscribe = useCallback((id: string) => {
    sendMessage({ action: "subscribe", executionId: id });
  }, [sendMessage]);

  // Unsubscribe from execution
  const unsubscribe = useCallback((id: string) => {
    sendMessage({ action: "unsubscribe", executionId: id });
  }, [sendMessage]);

  // Connect to WebSocket
  useEffect(() => {
    if (!executionId) {
      // No execution to subscribe to
      return;
    }

    // Build WebSocket URL with token
    const wsUrl = new URL(API_ENDPOINTS.wsExecutions, API_CONFIG.wsUrl);
    if (token) {
      wsUrl.searchParams.set("token", token);
    }

    const ws = new WebSocket(wsUrl.toString());
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setConnectionError(null);
      onConnect?.();

      // Subscribe to the execution
      subscribe(executionId);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ExecutionEvent;

        // Handle the event via execution store
        handleEvent(data);

        // Check for terminal events
        if (
          data.event === "EXECUTION_COMPLETED" ||
          data.event === "EXECUTION_FAILED" ||
          data.event === "EXECUTION_CANCELLED"
        ) {
          // Execution is complete, we can close the connection
          // The store will already update the status via handleEvent
        }
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    };

    ws.onerror = () => {
      const errorMsg = "WebSocket connection error";
      setConnectionError(errorMsg);
      onError?.(errorMsg);
    };

    ws.onclose = () => {
      setConnected(false);
      onDisconnect?.();
      wsRef.current = null;
    };

    // Cleanup
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (ws.readyState === WebSocket.OPEN) {
        unsubscribe(executionId);
        ws.close();
      } else if (ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [
    executionId,
    token,
    handleEvent,
    setConnected,
    setConnectionError,
    subscribe,
    unsubscribe,
    onConnect,
    onDisconnect,
    onError,
  ]);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    subscribe,
    unsubscribe,
  };
}
