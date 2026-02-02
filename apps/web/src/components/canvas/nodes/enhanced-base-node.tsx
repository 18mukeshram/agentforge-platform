"use client";

/**
 * Enhanced base node component with context menu and status.
 */

import { memo, useState } from "react";
import { Handle, Position } from "reactflow";
import { cn } from "@/lib/utils";
import { NodeContextMenu } from "./node-context-menu";
import { NodeStatus } from "./node-status";
import type { WorkflowNodeProps } from "../types";

interface EnhancedBaseNodeProps extends WorkflowNodeProps {
  icon: React.ReactNode;
  color: string;
  showInputHandle?: boolean;
  showOutputHandle?: boolean;
  subtitle?: string;
}

export const EnhancedBaseNode = memo(function EnhancedBaseNode({
  id,
  data,
  selected,
  icon,
  color,
  showInputHandle = true,
  showOutputHandle = true,
  subtitle,
}: EnhancedBaseNodeProps) {
  const [isHovered, setIsHovered] = useState(false);

  const hasErrors = data.validationErrors && data.validationErrors.length > 0;

  return (
    <NodeContextMenu nodeId={id}>
      <div
        className={cn(
          "relative rounded-lg border-2 bg-card shadow-sm transition-all duration-200",
          "min-w-[200px] max-w-[260px]",
          selected
            ? "border-primary ring-2 ring-primary/20 shadow-md"
            : "border-border",
          hasErrors && !selected && "border-destructive/50",
          isHovered && !selected && "border-primary/50 shadow-md",
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Input Handle */}
        {showInputHandle && (
          <Handle
            type="target"
            position={Position.Left}
            className={cn(
              "!h-3 !w-3 !border-2 !border-background transition-all",
              selected || isHovered ? "!bg-primary" : "!bg-muted-foreground",
            )}
            id="input"
          />
        )}

        {/* Node Content */}
        <div className="node-drag-handle cursor-grab active:cursor-grabbing">
          {/* Header */}
          <div
            className={cn(
              "flex items-center justify-between gap-2 rounded-t-md px-3 py-2",
              color,
            )}
          >
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded text-white">
                {icon}
              </div>
              <span className="text-xs font-medium uppercase tracking-wide text-white/90">
                {data.type}
              </span>
            </div>
            {data.executionStatus && (
              <NodeStatus status={data.executionStatus} />
            )}
          </div>

          {/* Body */}
          <div className="space-y-1 px-3 py-2">
            <p className="text-sm font-medium text-card-foreground truncate">
              {data.label}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate">
                {subtitle}
              </p>
            )}
            {data.config.agentId && (
              <p className="text-xs text-muted-foreground truncate">
                ID: {data.config.agentId}
              </p>
            )}
          </div>

          {/* Validation Errors */}
          {hasErrors && (
            <div className="border-t border-destructive/20 bg-destructive/5 px-3 py-1.5">
              <p className="text-xs text-destructive truncate">
                {data.validationErrors![0]}
              </p>
              {data.validationErrors!.length > 1 && (
                <p className="text-xs text-destructive/70">
                  +{data.validationErrors!.length - 1} more
                </p>
              )}
            </div>
          )}

          {/* Execution Status Footer */}
          {data.executionStatus === "running" && (
            <div className="border-t bg-blue-500/5 px-3 py-1.5">
              <div className="flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-blue-100">
                  <div className="h-full w-1/2 animate-pulse rounded-full bg-blue-500" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Output Handle */}
        {showOutputHandle && (
          <Handle
            type="source"
            position={Position.Right}
            className={cn(
              "!h-3 !w-3 !border-2 !border-background transition-all",
              selected || isHovered ? "!bg-primary" : "!bg-muted-foreground",
            )}
            id="output"
          />
        )}
      </div>
    </NodeContextMenu>
  );
});
