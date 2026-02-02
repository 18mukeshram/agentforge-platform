"use client";

import { memo } from "react";
import { EnhancedBaseNode } from "./enhanced-base-node";
import { OutputIcon } from "./icons";
import type { WorkflowNodeProps } from "../types";

export const OutputNode = memo(function OutputNode(props: WorkflowNodeProps) {
  return (
    <EnhancedBaseNode
      {...props}
      icon={<OutputIcon className="h-4 w-4" />}
      color="bg-rose-600"
      subtitle="Workflow exit point"
      showOutputHandle={false}
    />
  );
});
