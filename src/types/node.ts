// src/types/node.ts

/**
 * Unique identifier for a node within a workflow.
 * Format: nanoid or uuid, opaque to business logic.
 */
export type NodeId = string & { readonly __brand: "NodeId" };

export type NodeType =
  | "agent" // Executes an AI agent
  | "tool" // Executes a deterministic tool/function
  | "input" // Workflow entry point (user-provided data)
  | "output"; // Workflow exit point (final result)

/**
 * Visual position on the canvas. Not relevant to execution.
 */
export interface NodePosition {
  readonly x: number;
  readonly y: number;
}

/**
 * Node-specific configuration. Varies by node type.
 */
export interface NodeConfig {
  readonly agentId?: string;
  readonly toolId?: string;
  readonly parameters?: Record<string, unknown>;
}

/**
 * A single node in the workflow DAG.
 */
export interface Node {
  readonly id: NodeId;
  readonly type: NodeType;
  readonly label: string;
  readonly position: NodePosition;
  readonly config: NodeConfig;
}
