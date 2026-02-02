"use client";

/**
 * Node execution status indicator.
 */

import { cn } from "@/lib/utils";
import { CheckIcon, AlertIcon, LoaderIcon } from "./icons";
import type { NodeExecutionStatus } from "@/types";

interface NodeStatusProps {
  status?: NodeExecutionStatus;
  className?: string;
}

export function NodeStatus({ status, className }: NodeStatusProps) {
  if (!status || status === "pending") {
    return null;
  }

  const statusConfig: Record<
    NodeExecutionStatus,
    { icon: React.ReactNode; color: string; label: string }
  > = {
    pending: { icon: null, color: "", label: "Pending" },
    queued: {
      icon: <div className="h-2 w-2 rounded-full bg-yellow-500" />,
      color: "bg-yellow-500/10 text-yellow-600",
      label: "Queued",
    },
    running: {
      icon: <LoaderIcon className="h-3 w-3" />,
      color: "bg-blue-500/10 text-blue-600",
      label: "Running",
    },
    completed: {
      icon: <CheckIcon className="h-3 w-3" />,
      color: "bg-green-500/10 text-green-600",
      label: "Completed",
    },
    failed: {
      icon: <AlertIcon className="h-3 w-3" />,
      color: "bg-red-500/10 text-red-600",
      label: "Failed",
    },
    skipped: {
      icon: <div className="h-2 w-2 rounded-full bg-gray-400" />,
      color: "bg-gray-500/10 text-gray-600",
      label: "Skipped",
    },
  };

  const config = statusConfig[status];
  if (!config.icon) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        config.color,
        className,
      )}
      title={config.label}
    >
      {config.icon}
      <span>{config.label}</span>
    </div>
  );
}
