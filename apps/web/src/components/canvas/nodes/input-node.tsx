"use client";

import { memo } from "react";
import { Handle, Position } from "reactflow";
import { cn } from "@/lib/utils";
import type { WorkflowNodeProps } from "../types";

function InputIcon({ className }: { className?: string }) {
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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </svg>
  );
}

export const InputNode = memo(function InputNode({
  data,
  selected,
}: WorkflowNodeProps) {
  return (
    <div
      className={cn(
        "relative rounded-lg border-2 bg-card shadow-sm transition-all",
        "min-w-[180px] max-w-[240px]",
        selected ? "border-primary ring-2 ring-primary/20" : "border-border",
      )}
    >
      {/* No input handle for input nodes */}

      {/* Node Content */}
      <div className="node-drag-handle cursor-grab active:cursor-grabbing">
        {/* Header */}
        <div className="flex items-center gap-2 rounded-t-md bg-emerald-600 px-3 py-2">
          <div className="flex h-6 w-6 items-center justify-center rounded text-white">
            <InputIcon className="h-4 w-4" />
          </div>
          <span className="text-xs font-medium uppercase tracking-wide text-white/90">
            Input
          </span>
        </div>

        {/* Body */}
        <div className="px-3 py-2">
          <p className="text-sm font-medium text-card-foreground truncate">
            {data.label}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Workflow entry point
          </p>
        </div>
      </div>

      {/* Output Handle Only */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-primary !border-background"
        id="output"
      />
    </div>
  );
});
