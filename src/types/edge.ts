// src/types/edge.ts

import type { NodeId } from "./node";

/**
 * Unique identifier for an edge within a workflow.
 */
export type EdgeId = string & { readonly __brand: "EdgeId" };

/**
 * Identifies a specific port on a node.
 * Nodes may have multiple inputs/outputs.
 */
export type PortId = string & { readonly __brand: "PortId" };

/**
 * A directed edge connecting two nodes in the workflow DAG.
 *
 * Invariants enforced elsewhere:
 * - source and target must reference existing nodes
 * - no duplicate (source, sourcePort, target, targetPort) tuples
 * - must not create a cycle
 */
export interface Edge {
  readonly id: EdgeId;
  readonly source: NodeId;
  readonly sourcePort: PortId;
  readonly target: NodeId;
  readonly targetPort: PortId;
}
