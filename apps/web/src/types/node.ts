/**
 * Node domain types.
 * Mirrors backend: agentforge_api/models/node.py
 */

/**
 * Branded type for Node ID.
 */
export type NodeId = string & { readonly __brand: "NodeId" };

/**
 * The category of node, determining its execution behavior.
 */
export type NodeType = "agent" | "tool" | "input" | "output";

/**
 * Visual position on the canvas.
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
export interface WorkflowNode {
  readonly id: string;
  readonly type: NodeType;
  readonly label: string;
  readonly position: NodePosition;
  readonly config: NodeConfig;
}

/**
 * Helper to create a typed NodeId.
 */
export function toNodeId(id: string): NodeId {
  return id as NodeId;
}
