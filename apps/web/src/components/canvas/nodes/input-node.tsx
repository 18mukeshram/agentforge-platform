"use client";

import { memo } from "react";
import { EnhancedBaseNode } from "./enhanced-base-node";
import { InputIcon } from "./icons";
import type { WorkflowNodeProps } from "../types";

export const InputNode = memo(function InputNode(props: WorkflowNodeProps) {
  return (
    <EnhancedBaseNode
      {...props}
      icon={<InputIcon className="h-4 w-4" />}
      color="bg-emerald-600"
      subtitle="Workflow entry point"
      showInputHandle={false}
    />
  );
});
