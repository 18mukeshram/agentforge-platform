"use client";

/**
 * Execution details page.
 * Shows execution summary, event timeline, and per-node status.
 * Includes failure diagnostics and execution replay functionality.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useExecution, useExecutionLogs } from "@/hooks";
import { resumeExecution } from "@/lib/api/executions";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Execution, NodeExecutionState, ExecutionStatus, NodeExecutionStatus } from "@/types";

interface ExecutionDetailsPageProps {
  params: { id: string };
}

// Speed options for replay
const REPLAY_SPEEDS = [
  { label: "0.5x", value: 2000 },
  { label: "1x", value: 1000 },
  { label: "2x", value: 500 },
  { label: "4x", value: 250 },
];

export default function ExecutionDetailsPage({ params }: ExecutionDetailsPageProps) {
  const router = useRouter();
  const { data: execution, isLoading, error } = useExecution(params.id);
  const { data: logsData } = useExecutionLogs(params.id);
  
  // Selected node for highlighting
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  // Replay state
  const [isReplaying, setIsReplaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [replayIndex, setReplayIndex] = useState(-1);
  const [replaySpeedIndex, setReplaySpeedIndex] = useState(1); // Default 1x
  const [replayNodeStates, setReplayNodeStates] = useState<Map<string, NodeExecutionStatus>>(new Map());
  
  // Resume state (Phase 12.4)
  const [isResuming, setIsResuming] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  
  const replayTimerRef = useRef<NodeJS.Timeout | null>(null);

  const logs = logsData?.items || [];

  // Clear replay timer on unmount
  useEffect(() => {
    return () => {
      if (replayTimerRef.current) {
        clearTimeout(replayTimerRef.current);
      }
    };
  }, []);

  // Replay animation effect
  useEffect(() => {
    if (!isReplaying || isPaused || replayIndex >= logs.length - 1) {
      return;
    }

    const speed = REPLAY_SPEEDS[replaySpeedIndex].value;
    
    replayTimerRef.current = setTimeout(() => {
      setReplayIndex((prev) => {
        const nextIndex = prev + 1;
        if (nextIndex < logs.length) {
          // Update node state based on log entry
          const log = logs[nextIndex];
          if (log) {
            setReplayNodeStates((prev) => {
              const next = new Map(prev);
              // Infer status from log level/message
              if (log.level === "error") {
                next.set(log.nodeId, "failed");
              } else if (log.message?.toLowerCase().includes("completed")) {
                next.set(log.nodeId, "completed");
              } else if (log.message?.toLowerCase().includes("started") || log.message?.toLowerCase().includes("running")) {
                next.set(log.nodeId, "running");
              }
              return next;
            });
            setSelectedNodeId(log.nodeId);
          }
        }
        if (nextIndex >= logs.length - 1) {
          setIsReplaying(false);
        }
        return nextIndex;
      });
    }, speed);

    return () => {
      if (replayTimerRef.current) {
        clearTimeout(replayTimerRef.current);
      }
    };
  }, [isReplaying, isPaused, replayIndex, replaySpeedIndex, logs]);

  const handleStartReplay = useCallback(() => {
    setReplayIndex(-1);
    setReplayNodeStates(new Map());
    setSelectedNodeId(null);
    setIsPaused(false);
    setIsReplaying(true);
    // Trigger first step
    setTimeout(() => setReplayIndex(0), 100);
  }, []);

  const handleStopReplay = useCallback(() => {
    setIsReplaying(false);
    setIsPaused(false);
    setReplayIndex(-1);
    setReplayNodeStates(new Map());
  }, []);

  const handleTogglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  const handleSpeedChange = useCallback(() => {
    setReplaySpeedIndex((prev) => (prev + 1) % REPLAY_SPEEDS.length);
  }, []);

  // Resume handler (Phase 12.4)
  const handleResume = useCallback(async (nodeId: string) => {
    if (!execution || isResuming) return;
    
    setIsResuming(true);
    setResumeError(null);
    
    try {
      const response = await resumeExecution(execution.id, { nodeId });
      // Navigate to new execution
      router.push(`/executions/${response.executionId}`);
    } catch (err) {
      setResumeError(err instanceof Error ? err.message : "Failed to resume execution");
      setIsResuming(false);
    }
  }, [execution, isResuming, router]);

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

  // Find failed nodes for diagnostics
  const failedNodes = execution.nodeStates.filter((n) => n.status === "failed");
  const selectedNode = selectedNodeId 
    ? execution.nodeStates.find((n) => n.nodeId === selectedNodeId) 
    : null;

  // Compute display node states (use replay states if replaying)
  const displayNodeStates = isReplaying
    ? execution.nodeStates.map((node) => ({
        ...node,
        status: replayNodeStates.get(node.nodeId) || "pending" as NodeExecutionStatus,
      }))
    : execution.nodeStates;

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
        <div className="flex items-center gap-2">
          <ExecutionStatusBadge status={execution.status} />
        </div>
      </div>

      {/* Summary Cards */}
      <ExecutionSummaryCards execution={execution} />

      {/* Replay Controls */}
      <ReplayControlsBar
        isReplaying={isReplaying}
        isPaused={isPaused}
        replayIndex={replayIndex}
        totalEvents={logs.length}
        speedLabel={REPLAY_SPEEDS[replaySpeedIndex].label}
        onStart={handleStartReplay}
        onStop={handleStopReplay}
        onTogglePause={handleTogglePause}
        onSpeedChange={handleSpeedChange}
        hasFailed={execution.status === "failed"}
        failedNodeId={failedNodes[0]?.nodeId}
        selectedNodeId={selectedNodeId}
        onResume={handleResume}
        isResuming={isResuming}
        resumeError={resumeError}
      />

      {/* Error Alert for Failed Executions */}
      {execution.status === "failed" && failedNodes.length > 0 && !isReplaying && (
        <FailureAlertBanner 
          failedNodes={failedNodes} 
          onNodeClick={setSelectedNodeId}
        />
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Node Status */}
        <div className="lg:col-span-1">
          <NodeStatusList 
            nodes={displayNodeStates} 
            selectedNodeId={selectedNodeId}
            onNodeSelect={setSelectedNodeId}
            isReplaying={isReplaying}
          />
        </div>

        {/* Event Timeline or Error Details */}
        <div className="lg:col-span-2">
          {selectedNode && selectedNode.status === "failed" && !isReplaying ? (
            <ErrorDetailsPanel 
              node={selectedNode} 
              onClose={() => setSelectedNodeId(null)}
            />
          ) : (
            <ExecutionEventTimeline 
              logs={logs} 
              selectedNodeId={selectedNodeId}
              onNodeClick={setSelectedNodeId}
              highlightIndex={isReplaying ? replayIndex : undefined}
            />
          )}
        </div>
      </div>

      {/* Outputs */}
      {execution.outputs && Object.keys(execution.outputs).length > 0 && (
        <ExecutionOutputs outputs={execution.outputs} />
      )}
    </div>
  );
}

// Replay Controls Bar
function ReplayControlsBar({
  isReplaying,
  isPaused,
  replayIndex,
  totalEvents,
  speedLabel,
  onStart,
  onStop,
  onTogglePause,
  onSpeedChange,
  hasFailed,
  failedNodeId,
  selectedNodeId,
  onResume,
  isResuming,
  resumeError,
}: {
  isReplaying: boolean;
  isPaused: boolean;
  replayIndex: number;
  totalEvents: number;
  speedLabel: string;
  onStart: () => void;
  onStop: () => void;
  onTogglePause: () => void;
  onSpeedChange: () => void;
  hasFailed: boolean;
  failedNodeId?: string;
  selectedNodeId?: string | null;
  onResume?: (nodeId: string) => void;
  isResuming?: boolean;
  resumeError?: string | null;
}) {
  const progress = totalEvents > 0 ? Math.max(0, (replayIndex + 1) / totalEvents) * 100 : 0;

  // Use selected failed node or first failed node
  const resumeNodeId = selectedNodeId || failedNodeId;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
        {/* Replay Controls */}
        <div className="flex items-center gap-2">
          {!isReplaying ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" onClick={onStart} disabled={totalEvents === 0}>
                  <ReplayIcon className="mr-2 h-4 w-4" />
                  Replay Execution
                </Button>
              </TooltipTrigger>
              <TooltipContent>Replay execution events step by step</TooltipContent>
            </Tooltip>
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="outline" onClick={onTogglePause}>
                    {isPaused ? (
                      <PlayIcon className="h-4 w-4" />
                    ) : (
                      <PauseIcon className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isPaused ? "Resume" : "Pause"}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="outline" onClick={onStop}>
                    <StopIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Stop replay</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" onClick={onSpeedChange}>
                    <SpeedIcon className="mr-1 h-4 w-4" />
                    {speedLabel}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Change playback speed</TooltipContent>
              </Tooltip>
            </>
          )}
        </div>

        {/* Progress Bar */}
        {isReplaying && (
          <div className="flex flex-1 items-center gap-3">
            <div className="h-2 flex-1 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-sm text-muted-foreground">
              {replayIndex + 1} / {totalEvents}
            </span>
          </div>
        )}

        {/* Spacer */}
        {!isReplaying && <div className="flex-1" />}

        {/* Resume Error */}
        {resumeError && (
          <span className="text-sm text-red-500">{resumeError}</span>
        )}

        {/* Resume Button (enabled!) */}
        {hasFailed && !isReplaying && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                size="sm" 
                variant="outline"
                disabled={!resumeNodeId || isResuming}
                onClick={() => resumeNodeId && onResume?.(resumeNodeId)}
                className={cn(
                  isResuming && "animate-pulse"
                )}
              >
                <RefreshIcon className={cn("mr-2 h-4 w-4", isResuming && "animate-spin")} />
                {isResuming ? "Resuming..." : `Resume from ${resumeNodeId?.slice(0, 8)}...`}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {selectedNodeId 
                ? `Resume execution from selected node: ${selectedNodeId}`
                : `Resume execution from failed node: ${failedNodeId}`
              }
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

// Failure Alert Banner
function FailureAlertBanner({
  failedNodes,
  onNodeClick,
}: {
  failedNodes: NodeExecutionState[];
  onNodeClick: (nodeId: string) => void;
}) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangleIcon className="mt-0.5 h-5 w-5 text-red-500" />
        <div className="flex-1">
          <h4 className="font-semibold text-red-800">Execution Failed</h4>
          <p className="mt-1 text-sm text-red-700">
            {failedNodes.length} node{failedNodes.length > 1 ? "s" : ""} failed during execution.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {failedNodes.map((node) => (
              <button
                key={node.nodeId}
                className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200"
                onClick={() => onNodeClick(node.nodeId)}
              >
                <XCircleIcon className="h-3 w-3" />
                {node.nodeId.slice(0, 12)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Error Details Panel
function ErrorDetailsPanel({
  node,
  onClose,
}: {
  node: NodeExecutionState;
  onClose: () => void;
}) {
  const errorInfo = parseError(node.error);

  return (
    <div className="rounded-lg border border-red-200 bg-card">
      <div className="flex items-center justify-between border-b border-red-200 bg-red-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <XCircleIcon className="h-5 w-5 text-red-500" />
          <h3 className="font-semibold text-red-800">Error Details</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Back to Timeline
        </Button>
      </div>
      
      <div className="space-y-4 p-4">
        <div className="rounded-lg bg-muted/50 p-3">
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Node ID</span>
              <span className="font-mono font-medium">{node.nodeId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <NodeStatusBadge status={node.status} />
            </div>
            {node.retryCount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Retry Count</span>
                <span className="font-medium">{node.retryCount}</span>
              </div>
            )}
            {node.startedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Started At</span>
                <span className="font-mono text-xs">{new Date(node.startedAt).toLocaleString()}</span>
              </div>
            )}
            {node.completedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Failed At</span>
                <span className="font-mono text-xs">{new Date(node.completedAt).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-semibold text-red-800">Error Message</h4>
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {errorInfo.message || "Unknown error"}
          </div>
        </div>

        {errorInfo.type && (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Error Type</h4>
            <code className="rounded bg-muted px-2 py-1 text-sm">{errorInfo.type}</code>
          </div>
        )}

        {errorInfo.stack && (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Stack Trace</h4>
            <ScrollArea className="h-40">
              <pre className="rounded-lg bg-gray-900 p-3 text-xs text-gray-100">
                {errorInfo.stack}
              </pre>
            </ScrollArea>
          </div>
        )}

        {errorInfo.raw && (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Raw Error Data</h4>
            <ScrollArea className="h-32">
              <pre className="rounded-lg bg-muted p-3 text-xs">
                {JSON.stringify(errorInfo.raw, null, 2) || ""}
              </pre>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}

function parseError(error: string | null): {
  message: string | null;
  type: string | null;
  stack: string | null;
  raw: Record<string, unknown> | null;
} {
  if (!error) {
    return { message: null, type: null, stack: null, raw: null };
  }

  try {
    const parsed = JSON.parse(error);
    return {
      message: parsed.message || parsed.error || error,
      type: parsed.type || parsed.name || null,
      stack: parsed.stack || parsed.traceback || null,
      raw: parsed,
    };
  } catch {
    const stackMatch = error.match(/^(.+?)\n((?:\s+at .+\n?)+)/m);
    if (stackMatch) {
      return {
        message: stackMatch[1],
        type: null,
        stack: stackMatch[2],
        raw: null,
      };
    }

    return { message: error, type: null, stack: null, raw: null };
  }
}

// Execution Summary Cards
function ExecutionSummaryCards({ execution }: { execution: Execution }) {
  const duration = calculateDuration(execution.createdAt, execution.completedAt);
  const failedCount = execution.nodeStates.filter((n) => n.status === "failed").length;

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
        value={failedCount > 0 ? `${failedCount} failed / ${execution.nodeStates.length}` : `${execution.nodeStates.length} total`}
        icon={<NodesIcon className="h-4 w-4 text-muted-foreground" />}
        highlight={failedCount > 0 ? "error" : undefined}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  highlight?: "error" | "warning";
}) {
  return (
    <div className={cn(
      "rounded-lg border bg-card p-4",
      highlight === "error" && "border-red-200 bg-red-50",
      highlight === "warning" && "border-yellow-200 bg-yellow-50"
    )}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={cn(
        "mt-1 text-lg font-semibold capitalize",
        highlight === "error" && "text-red-700"
      )}>{value}</p>
    </div>
  );
}

// Node Status List
function NodeStatusList({ 
  nodes,
  selectedNodeId,
  onNodeSelect,
  isReplaying,
}: { 
  nodes: NodeExecutionState[];
  selectedNodeId: string | null;
  onNodeSelect: (nodeId: string) => void;
  isReplaying?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="font-semibold">Node Status</h3>
        {isReplaying && (
          <span className="text-xs text-primary animate-pulse">● Replaying</span>
        )}
      </div>
      <ScrollArea className="h-80">
        <div className="space-y-2 p-4">
          {nodes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No nodes</p>
          ) : (
            nodes.map((node) => (
              <button
                key={node.nodeId}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border p-3 text-left transition-all",
                  "hover:bg-muted/50",
                  node.status === "failed" && "border-red-200 bg-red-50 hover:bg-red-100",
                  node.status === "running" && "border-blue-200 bg-blue-50 animate-pulse",
                  selectedNodeId === node.nodeId && "ring-2 ring-primary"
                )}
                onClick={() => onNodeSelect(node.nodeId)}
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
              </button>
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
  selectedNodeId,
  onNodeClick,
  highlightIndex,
}: {
  logs: { timestamp: string; nodeId: string; level: string; message: string }[];
  selectedNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
  highlightIndex?: number;
}) {
  const highlightRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll to highlighted item during replay
  useEffect(() => {
    if (highlightIndex !== undefined && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightIndex]);

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="font-semibold">Event Timeline</h3>
        {highlightIndex !== undefined && (
          <span className="text-xs text-primary animate-pulse">● Live</span>
        )}
      </div>
      <ScrollArea className="h-80">
        <div className="space-y-1 p-4">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events recorded</p>
          ) : (
            logs.map((log, index) => (
              <button
                key={index}
                ref={index === highlightIndex ? highlightRef : undefined}
                className={cn(
                  "w-full rounded px-3 py-2 text-left font-mono text-xs transition-all",
                  log.level === "error" && "bg-destructive/10 text-destructive hover:bg-destructive/20",
                  log.level === "warn" && "bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20",
                  log.level === "info" && "bg-muted hover:bg-muted/80",
                  selectedNodeId === log.nodeId && "ring-2 ring-primary",
                  index === highlightIndex && "ring-2 ring-blue-500 bg-blue-100 animate-pulse"
                )}
                onClick={() => onNodeClick(log.nodeId)}
              >
                <span className="text-muted-foreground">
                  [{new Date(log.timestamp).toLocaleTimeString()}]
                </span>{" "}
                <span className="font-medium">{log.nodeId}:</span>{" "}
                {log.message}
              </button>
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

  if (durationMs < 1000) return `${durationMs}ms`;
  if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
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

function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function ReplayIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <polygon points="10 8 16 12 10 16 10 8" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="14" y="4" width="4" height="16" rx="1" />
      <rect x="6" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function SpeedIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 17H5" />
      <path d="M19 12H5" />
      <path d="M19 7H5" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}
