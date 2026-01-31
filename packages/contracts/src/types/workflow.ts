// src/types/workflow.ts

import type { Node, NodeId } from "./node";
import type { Edge, EdgeId } from "./edge";

/**
 * Unique identifier for a workflow.
 */
export type WorkflowId = string & { readonly __brand: "WorkflowId" };

/**
 * Lifecycle status of a workflow definition.
 */
export type WorkflowStatus = "draft" | "valid" | "invalid" | "archived";

/**
 * Workflow metadata, separate from graph structure.
 */
export interface WorkflowMeta {
  readonly name: string;
  readonly description: string;
  readonly createdAt: string; // ISO 8601
  readonly updatedAt: string; // ISO 8601
  readonly ownerId: string; // User or tenant ID
  readonly version: number; // Optimistic concurrency control
}

/**
 * A complete workflow definition.
 *
 * The nodes and edges form a DAG.
 * Invariants (enforced by DAG Validator):
 * - Acyclic
 * - All edge references resolve to existing nodes
 * - At least one entry node (zero incoming edges)
 * - No orphan nodes
 */
export interface Workflow {
  readonly id: WorkflowId;
  readonly status: WorkflowStatus;
  readonly meta: WorkflowMeta;

  /** All nodes in the workflow, keyed by NodeId for O(1) lookup */
  readonly nodes: ReadonlyMap<NodeId, Node>;

  /** All edges in the workflow, keyed by EdgeId */
  readonly edges: ReadonlyMap<EdgeId, Edge>;
}
