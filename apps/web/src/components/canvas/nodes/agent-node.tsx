"use client";

import { memo } from "react";
import { EnhancedBaseNode } from "./enhanced-base-node";
import { AgentIcon } from "./icons";
import type { WorkflowNodeProps } from "../types";

export const AgentNode = memo(function AgentNode(props: WorkflowNodeProps) {
  const { data } = props;

  // Build subtitle from config
  const subtitle = data.config.agentId
    ? `Model: ${(data.config.parameters as Record<string, unknown>)?.model || "default"}`
    : "Configure agent";

  return (
    <EnhancedBaseNode
      {...props}
      icon={<AgentIcon className="h-4 w-4" />}
      color="bg-violet-600"
      subtitle={subtitle}
    />
  );
});
