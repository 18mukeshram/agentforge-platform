"use client";

import { memo } from "react";
import { BaseNode } from "../base-node";
import type { WorkflowNodeProps } from "../types";

function AgentIcon({ className }: { className?: string }) {
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
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  );
}

export const AgentNode = memo(function AgentNode(props: WorkflowNodeProps) {
  return (
    <BaseNode
      {...props}
      icon={<AgentIcon className="h-4 w-4" />}
      color="bg-violet-600"
    />
  );
});
