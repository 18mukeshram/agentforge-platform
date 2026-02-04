"use client";

/**
 * Execution details page.
 * Shows execution summary, event timeline, and per-node status.
 */

import { useRouter } from "next/navigation";
import { useExecution, useExecutionLogs } from "@/hooks";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Execution, NodeExecutionState, ExecutionStatus, NodeExecutionStatus } from "@/types";

interface ExecutionDetailsPageProps {
  params: { id: string };
}

export default function ExecutionDetailsPage({ params }: ExecutionDetailsPageProps) {
  const router = useRouter();
  const { data: execution, isLoading, error } = useExecution(params.id);
  const { data: logsData } = useExecutionLogs(params.id);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoaderIcon className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !execution) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Execution not found</p>
        <Button variant="outline" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeftIcon className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Execution Details
            </h1>
            <p className="font-mono text-sm text-muted-foreground">
              {execution.id}
            </p>
          </div>
        </div>
        <ExecutionStatusBadge status={execution.status} />
      </div>

      {/* Summary Cards */}
      <ExecutionSummaryCards execution={execution} />

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Node Status */}
        <div className="lg:col-span-1">
          <NodeStatusList nodes={execution.nodeStates} />
        </div>

        {/* Event Timeline */}
        <div className="lg:col-span-2">
          <ExecutionEventTimeline logs={logsData?.items || []} />
        </div>
      </div>

      {/* Outputs */}
      {execution.outputs && Object.keys(execution.outputs).length > 0 && (
        <ExecutionOutputs outputs={execution.outputs} />
      )}
    </div>
  );
}

// Execution Summary Cards
function ExecutionSummaryCards({ execution }: { execution: Execution }) {
  const duration = calculateDuration(execution.createdAt, execution.completedAt);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard
        label="Status"
        value={execution.status}
        icon={<StatusIcon status={execution.status} />}
      />
      <SummaryCard
        label="Started"
        value={formatTimestamp(execution.createdAt)}
        icon={<ClockIcon className="h-4 w-4 text-muted-foreground" />}
      />
      <SummaryCard
        label="Duration"
        value={duration || "In progress"}
        icon={<TimerIcon className="h-4 w-4 text-muted-foreground" />}
      />
      <SummaryCard
        label="Nodes"
        value={`${execution.nodeStates.length} total`}
        icon={<NodesIcon className="h-4 w-4 text-muted-foreground" />}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-lg font-semibold capitalize">{value}</p>
    </div>
  );
}

// Node Status List
function NodeStatusList({ nodes }: { nodes: NodeExecutionState[] }) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h3 className="font-semibold">Node Status</h3>
      </div>
      <ScrollArea className="h-80">
        <div className="space-y-2 p-4">
          {nodes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No nodes</p>
          ) : (
            nodes.map((node) => (
              <div
                key={node.nodeId}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-2">
                  <NodeStatusIcon status={node.status} />
                  <span className="font-mono text-sm">{node.nodeId.slice(0, 12)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {node.retryCount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      retry {node.retryCount}
                    </span>
                  )}
                  <NodeStatusBadge status={node.status} />
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// Execution Event Timeline
function ExecutionEventTimeline({
  logs,
}: {
  logs: { timestamp: string; nodeId: string; level: string; message: string }[];
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h3 className="font-semibold">Event Timeline</h3>
      </div>
      <ScrollArea className="h-80">
        <div className="space-y-1 p-4">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events recorded</p>
          ) : (
            logs.map((log, index) => (
              <div
                key={index}
                className={cn(
                  "rounded px-3 py-2 font-mono text-xs",
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
    </div>
  );
}

// Execution Outputs
function ExecutionOutputs({ outputs }: { outputs: Record<string, unknown> }) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h3 className="font-semibold">Outputs</h3>
      </div>
      <div className="p-4">
        <pre className="max-h-60 overflow-auto rounded bg-muted p-4 text-xs">
          {JSON.stringify(outputs, null, 2)}
        </pre>
      </div>
    </div>
  );
}

// Status Components
function ExecutionStatusBadge({ status }: { status: ExecutionStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium",
        status === "completed" && "bg-green-100 text-green-800",
        status === "running" && "bg-blue-100 text-blue-800",
        status === "failed" && "bg-red-100 text-red-800",
        status === "pending" && "bg-yellow-100 text-yellow-800",
        status === "cancelled" && "bg-gray-100 text-gray-800"
      )}
    >
      {status}
    </span>
  );
}

function NodeStatusBadge({ status }: { status: NodeExecutionStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium",
        status === "completed" && "bg-green-100 text-green-700",
        status === "running" && "bg-blue-100 text-blue-700",
        status === "failed" && "bg-red-100 text-red-700",
        status === "pending" && "bg-gray-100 text-gray-600",
        status === "queued" && "bg-yellow-100 text-yellow-700",
        status === "skipped" && "bg-gray-100 text-gray-500"
      )}
    >
      {status}
    </span>
  );
}

function StatusIcon({ status }: { status: ExecutionStatus }) {
  switch (status) {
    case "completed":
      return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
    case "failed":
      return <XCircleIcon className="h-4 w-4 text-red-500" />;
    case "running":
      return <LoaderIcon className="h-4 w-4 animate-spin text-blue-500" />;
    case "pending":
      return <ClockIcon className="h-4 w-4 text-yellow-500" />;
    case "cancelled":
      return <StopCircleIcon className="h-4 w-4 text-gray-500" />;
    default:
      return <CircleIcon className="h-4 w-4 text-gray-400" />;
  }
}

function NodeStatusIcon({ status }: { status: NodeExecutionStatus }) {
  switch (status) {
    case "completed":
      return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
    case "failed":
      return <XCircleIcon className="h-4 w-4 text-red-500" />;
    case "running":
      return <LoaderIcon className="h-4 w-4 animate-spin text-blue-500" />;
    case "pending":
      return <CircleIcon className="h-4 w-4 text-gray-400" />;
    case "queued":
      return <ClockIcon className="h-4 w-4 text-yellow-500" />;
    case "skipped":
      return <MinusCircleIcon className="h-4 w-4 text-gray-400" />;
    default:
      return <CircleIcon className="h-4 w-4 text-gray-400" />;
  }
}

// Utility Functions
function calculateDuration(startTime: string, endTime: string | null): string | null {
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

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

// Icon Components
function LoaderIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function TimerIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="10" x2="14" y1="2" y2="2" />
      <line x1="12" x2="15" y1="14" y2="11" />
      <circle cx="12" cy="14" r="8" />
    </svg>
  );
}

function NodesIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="6" height="6" x="3" y="3" rx="1" />
      <rect width="6" height="6" x="15" y="3" rx="1" />
      <rect width="6" height="6" x="9" y="15" rx="1" />
      <path d="M6 9v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9" />
      <path d="M12 13v2" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}

function StopCircleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <rect width="6" height="6" x="9" y="9" />
    </svg>
  );
}

function MinusCircleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8" />
    </svg>
  );
}

function CircleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}
