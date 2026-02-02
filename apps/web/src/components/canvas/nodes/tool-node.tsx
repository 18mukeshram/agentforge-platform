"use client";

import { memo } from "react";
import { EnhancedBaseNode } from "./enhanced-base-node";
import { ToolIcon } from "./icons";
import type { WorkflowNodeProps } from "../types";

export const ToolNode = memo(function ToolNode(props: WorkflowNodeProps) {
  const { data } = props;

  const toolId = (data.config.parameters as Record<string, unknown>)
    ?.toolId as string;
  const subtitle = toolId ? `Tool: ${toolId}` : "Configure tool";

  return (
    <EnhancedBaseNode
      {...props}
      icon={<ToolIcon className="h-4 w-4" />}
      color="bg-amber-600"
      subtitle={subtitle}
    />
  );
});
