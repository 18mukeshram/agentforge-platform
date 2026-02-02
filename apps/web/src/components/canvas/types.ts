/**
 * Canvas-specific types for React Flow integration.
 */

import type { Node, Edge, NodeProps } from "reactflow";
import type { NodeType, NodeConfig } from "@/types";

/**
 * Custom node data structure.
 */
export interface WorkflowNodeData {
  label: string;
  type: NodeType;
  config: NodeConfig;
  isValid?: boolean;
  validationErrors?: string[];
  executionStatus?:
    | "pending"
    | "queued"
    | "running"
    | "completed"
    | "failed"
    | "skipped";
}

/**
 * Custom node type for React Flow.
 */
export type WorkflowCanvasNode = Node<WorkflowNodeData>;

/**
 * Custom edge type for React Flow.
 */
export type WorkflowCanvasEdge = Edge;

/**
 * Props for custom node components.
 */
export type WorkflowNodeProps = NodeProps<WorkflowNodeData>;

/**
 * Node type identifiers for React Flow registration.
 */
export const NODE_TYPE_KEYS = {
  agent: "agent",
  tool: "tool",
  input: "input",
  output: "output",
} as const;

/**
 * Default node dimensions.
 */
export const NODE_DIMENSIONS = {
  width: 200,
  height: 80,
} as const;

/**
 * Handle positions for ports.
 */
export const HANDLE_POSITIONS = {
  input: "left",
  output: "right",
} as const;
