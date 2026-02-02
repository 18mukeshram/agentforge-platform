/**
 * Edge domain types.
 * Mirrors backend: agentforge_api/models/edge.py
 */

/**
 * Branded type for Edge ID.
 */
export type EdgeId = string & { readonly __brand: "EdgeId" };

/**
 * Branded type for Port ID.
 */
export type PortId = string & { readonly __brand: "PortId" };

/**
 * A directed edge connecting two nodes in the workflow DAG.
 */
export interface WorkflowEdge {
  readonly id: string;
  readonly source: string;
  readonly sourcePort: string;
  readonly target: string;
  readonly targetPort: string;
}

/**
 * Helper to create a typed EdgeId.
 */
export function toEdgeId(id: string): EdgeId {
  return id as EdgeId;
}

/**
 * Helper to create a typed PortId.
 */
export function toPortId(id: string): PortId {
  return id as PortId;
}

/**
 * Default port names.
 */
export const DEFAULT_INPUT_PORT = "input";
export const DEFAULT_OUTPUT_PORT = "output";
