/**
 * Workflow domain types.
 * Mirrors backend: agentforge_api/models/workflow.py
 */

import type { WorkflowNode } from "./node";
import type { WorkflowEdge } from "./edge";

/**
 * Branded type for Workflow ID.
 */
export type WorkflowId = string & { readonly __brand: "WorkflowId" };

/**
 * Lifecycle status of a workflow definition.
 */
export type WorkflowStatus = "draft" | "valid" | "invalid" | "archived";

/**
 * Workflow metadata.
 */
export interface WorkflowMeta {
  readonly name: string;
  readonly description: string;
  readonly createdAt: string; // ISO 8601
  readonly updatedAt: string; // ISO 8601
  readonly ownerId: string;
  readonly version: number;
}

/**
 * A complete workflow definition.
 */
export interface Workflow {
  readonly id: string;
  readonly status: WorkflowStatus;
  readonly meta: WorkflowMeta;
  readonly nodes: WorkflowNode[];
  readonly edges: WorkflowEdge[];
}

/**
 * Workflow summary for list views.
 */
export interface WorkflowSummary {
  readonly id: string;
  readonly name: string;
  readonly status: WorkflowStatus;
  readonly updatedAt: string;
  readonly nodeCount: number;
}

/**
 * Helper to create a typed WorkflowId.
 */
export function toWorkflowId(id: string): WorkflowId {
  return id as WorkflowId;
}
