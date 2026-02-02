"use client";

import { memo } from "react";
import { BaseNode } from "../base-node";
import type { WorkflowNodeProps } from "../types";

function ToolIcon({ className }: { className?: string }) {
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
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

export const ToolNode = memo(function ToolNode(props: WorkflowNodeProps) {
  return (
    <BaseNode
      {...props}
      icon={<ToolIcon className="h-4 w-4" />}
      color="bg-amber-600"
    />
  );
});
