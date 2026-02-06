"use client";

/**
 * Execution logs panel component.
 * Displays real-time execution logs from WebSocket.
 */

import { useEffect, useRef } from "react";
import { useExecutionStore, useUiStore } from "@/stores";
import { useExecutionWebSocket } from "@/hooks";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ExecutionLogsPanelProps {
  className?: string;
}

export function ExecutionLogsPanel({ className }: ExecutionLogsPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    activeExecution,
    isExecuting,
    isConnected,
    logs,
    nodeStates,
  } = useExecutionStore();

  const { executionPanelOpen, toggleExecutionPanel } = useUiStore();

  // Connect to WebSocket when there's an active execution
  useExecutionWebSocket({
    executionId: activeExecution?.id ?? null,
  });

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (!executionPanelOpen) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute bottom-4 right-4 z-10 w-96",
        "rounded-lg border bg-background/95 shadow-lg backdrop-blur",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Execution Logs</h3>
          {isExecuting && (
            <span className="flex h-2 w-2">
              <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isConnected && (
            <span className="text-xs text-muted-foreground">Connected</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={toggleExecutionPanel}
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Execution Info */}
      {activeExecution && activeExecution.id && (
        <div className="border-b bg-muted/30 px-3 py-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              ID: {activeExecution.id.slice(0, 8)}...
            </span>
            <StatusBadge status={activeExecution.status} />
          </div>
        </div>
      )}

      {/* Logs */}
      <ScrollArea className="h-60" ref={scrollRef}>
        <div className="space-y-1 p-2">
          {logs.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {activeExecution
                ? "Waiting for logs..."
                : "No active execution"}
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className={cn(
                  "rounded px-2 py-1 font-mono text-xs",
                  log.level === "error" && "bg-destructive/10 text-destructive",
                  log.level === "warn" && "bg-yellow-500/10 text-yellow-600",
                  log.level === "info" && "bg-muted"
                )}
              >
                <span className="text-muted-foreground">
                  [{new Date(log.timestamp).toLocaleTimeString()}]
                </span>{" "}
                <span className="font-medium">{log.nodeId}:</span>{" "}
                {log.message}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Node States Summary */}
      {nodeStates.size > 0 && (
        <div className="border-t px-3 py-2">
          <div className="flex flex-wrap gap-1">
            {Array.from(nodeStates.entries()).map(([nodeId, state]) => (
              <span
                key={nodeId}
                className={cn(
                  "inline-flex items-center rounded px-1.5 py-0.5 text-xs",
                  state.status === "completed" && "bg-green-100 text-green-700",
                  state.status === "running" && "bg-blue-100 text-blue-700",
                  state.status === "failed" && "bg-red-100 text-red-700",
                  state.status === "pending" && "bg-gray-100 text-gray-600",
                  state.status === "queued" && "bg-yellow-100 text-yellow-700",
                  state.status === "skipped" && "bg-gray-100 text-gray-500"
                )}
              >
                {nodeId.slice(0, 8)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium",
        status === "completed" && "bg-green-100 text-green-700",
        status === "running" && "bg-blue-100 text-blue-700",
        status === "failed" && "bg-red-100 text-red-700",
        status === "pending" && "bg-gray-100 text-gray-600",
        status === "cancelled" && "bg-gray-100 text-gray-500"
      )}
    >
      {status}
    </span>
  );
}

// X icon
function XIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
