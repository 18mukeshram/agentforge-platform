"use client";

/**
 * Base node component used by all node types.
 */

import { memo } from "react";
import { Handle, Position } from "reactflow";
import { cn } from "@/lib/utils";
import type { WorkflowNodeProps } from "./types";

interface BaseNodeProps extends WorkflowNodeProps {
  icon: React.ReactNode;
  color: string;
}

export const BaseNode = memo(function BaseNode({
  data,
  selected,
  icon,
  color,
}: BaseNodeProps) {
  const statusColors: Record<string, string> = {
    pending: "border-muted",
    queued: "border-yellow-500",
    running: "border-blue-500 animate-pulse",
    completed: "border-green-500",
    failed: "border-red-500",
    skipped: "border-gray-400",
  };

  const statusBorder = data.executionStatus
    ? statusColors[data.executionStatus]
    : "";

  return (
    <div
      className={cn(
        "relative rounded-lg border-2 bg-card shadow-sm transition-all",
        "min-w-[180px] max-w-[240px]",
        selected ? "border-primary ring-2 ring-primary/20" : "border-border",
        statusBorder,
        !data.isValid && data.validationErrors?.length
          ? "border-destructive"
          : "",
      )}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-primary !border-background"
        id="input"
      />

      {/* Node Content */}
      <div className="node-drag-handle cursor-grab active:cursor-grabbing">
        {/* Header */}
        <div
          className={cn(
            "flex items-center gap-2 rounded-t-md px-3 py-2",
            color,
          )}
        >
          <div className="flex h-6 w-6 items-center justify-center rounded text-white">
            {icon}
          </div>
          <span className="text-xs font-medium uppercase tracking-wide text-white/90">
            {data.type}
          </span>
        </div>

        {/* Body */}
        <div className="px-3 py-2">
          <p className="text-sm font-medium text-card-foreground truncate">
            {data.label}
          </p>
          {data.config.agentId && (
            <p className="text-xs text-muted-foreground truncate mt-1">
              {data.config.agentId}
            </p>
          )}
        </div>

        {/* Validation Errors */}
        {data.validationErrors && data.validationErrors.length > 0 && (
          <div className="border-t border-destructive/20 bg-destructive/5 px-3 py-1.5">
            <p className="text-xs text-destructive truncate">
              {data.validationErrors[0]}
            </p>
          </div>
        )}
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-primary !border-background"
        id="output"
      />
    </div>
  );
});
