"use client";

/**
 * Execution history list component.
 * Displays past executions for a workflow with status, timestamp, and duration.
 */

import { useExecutions } from "@/hooks";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ExecutionStatus } from "@/types";

interface ExecutionHistoryListProps {
  workflowId: string;
  onSelectExecution?: (executionId: string) => void;
  selectedExecutionId?: string;
  className?: string;
}

export function ExecutionHistoryList({
  workflowId,
  onSelectExecution,
  selectedExecutionId,
  className,
}: ExecutionHistoryListProps) {
  const { data, isLoading, error } = useExecutions({ workflowId });

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <LoaderIcon className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("py-8 text-center text-sm text-destructive", className)}>
        Failed to load executions
      </div>
    );
  }

  if (!data?.items || data.items.length === 0) {
    return (
      <div className={cn("py-8 text-center text-sm text-muted-foreground", className)}>
        No executions yet
      </div>
    );
  }

  return (
    <ScrollArea className={cn("h-full", className)}>
      <div className="space-y-2 p-2">
        {data.items.map((execution) => {
          const duration = calculateDuration(
            execution.createdAt,
            execution.completedAt
          );

          return (
            <button
              key={execution.id}
              className={cn(
                "w-full rounded-lg border p-3 text-left transition-colors",
                "hover:bg-muted/50",
                selectedExecutionId === execution.id
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card"
              )}
              onClick={() => onSelectExecution?.(execution.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <StatusIcon status={execution.status as ExecutionStatus} />
                  <span className="font-mono text-xs text-muted-foreground">
                    {execution.id.slice(0, 8)}...
                  </span>
                </div>
                <StatusBadge status={execution.status as ExecutionStatus} />
              </div>

              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatTimestamp(execution.createdAt)}</span>
                {duration && <span>{duration}</span>}
              </div>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}

// Status icon based on execution status
function StatusIcon({ status }: { status: ExecutionStatus }) {
  switch (status) {
    case "completed":
      return <CheckIcon className="h-4 w-4 text-green-500" />;
    case "failed":
      return <XIcon className="h-4 w-4 text-red-500" />;
    case "running":
      return <LoaderIcon className="h-4 w-4 animate-spin text-blue-500" />;
    case "pending":
      return <ClockIcon className="h-4 w-4 text-yellow-500" />;
    case "cancelled":
      return <StopIcon className="h-4 w-4 text-gray-500" />;
    default:
      return <CircleIcon className="h-4 w-4 text-gray-400" />;
  }
}

// Status badge with colored background
function StatusBadge({ status }: { status: ExecutionStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium",
        status === "completed" && "bg-green-100 text-green-700",
        status === "running" && "bg-blue-100 text-blue-700",
        status === "failed" && "bg-red-100 text-red-700",
        status === "pending" && "bg-yellow-100 text-yellow-700",
        status === "cancelled" && "bg-gray-100 text-gray-600"
      )}
    >
      {status}
    </span>
  );
}

// Calculate duration between two timestamps
function calculateDuration(
  startTime: string,
  endTime: string | null
): string | null {
  if (!endTime) return null;

  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const durationMs = end - start;

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  } else if (durationMs < 60000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

// Format timestamp for display
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  // If less than 24 hours ago, show relative time
  if (diffMs < 86400000) {
    if (diffMs < 60000) {
      return "Just now";
    } else if (diffMs < 3600000) {
      const minutes = Math.floor(diffMs / 60000);
      return `${minutes}m ago`;
    } else {
      const hours = Math.floor(diffMs / 3600000);
      return `${hours}h ago`;
    }
  }

  // Otherwise, show date and time
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Icon components
function LoaderIcon({ className }: { className?: string }) {
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
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

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
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <rect x="9" y="9" width="6" height="6" />
    </svg>
  );
}

function CircleIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}
