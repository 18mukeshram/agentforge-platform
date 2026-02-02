/**
 * Node type exports and registration.
 */

import { AgentNode } from "./agent-node";
import { ToolNode } from "./tool-node";
import { InputNode } from "./input-node";
import { OutputNode } from "./output-node";
import type { NodeTypes } from "reactflow";

/**
 * Node types for React Flow registration.
 */
export const nodeTypes: NodeTypes = {
  agent: AgentNode,
  tool: ToolNode,
  input: InputNode,
  output: OutputNode,
};

// Components
export { AgentNode, ToolNode, InputNode, OutputNode };
export { EnhancedBaseNode } from "./enhanced-base-node";
export { NodeContextMenu } from "./node-context-menu";
export { NodeStatus } from "./node-status";
export { NodeConfigPopover } from "./node-config-popover";

// Icons
export * from "./icons";

// Types and utilities
export * from "./types";
