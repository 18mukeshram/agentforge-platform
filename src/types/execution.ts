// src/types/execution.ts

import type { WorkflowId } from "./workflow";
import type { NodeId } from "./node";

/**
 * Unique identifier for an execution run.
 */
export type ExecutionId = string & { readonly __brand: "ExecutionId" };

/**
 * Overall execution status for the entire workflow run.
 */
export type ExecutionStatus =
  | "pending" // Created, not yet started
  | "running" // At least one node is executing
  | "completed" // All nodes finished successfully
  | "failed" // At least one node failed (after retries)
  | "cancelled"; // User-initiated cancellation

/**
 * Execution status for a single node.
 */
export type NodeExecutionStatus =
  | "pending" // Waiting for dependencies
  | "queued" // Dependencies met, in queue
  | "running" // Currently executing
  | "completed" // Finished successfully
  | "failed" // Failed after all retries
  | "skipped"; // Skipped due to upstream failure

/**
 * Runtime state of a single node during execution.
 */
export interface NodeExecutionState {
  readonly nodeId: NodeId;
  readonly status: NodeExecutionStatus;

  /** When this node started executing (null if not started) */
  readonly startedAt: string | null;

  /** When this node finished (null if not finished) */
  readonly completedAt: string | null;

  /** Number of retry attempts made (0 = first attempt) */
  readonly retryCount: number;

  /** Error message if failed (null otherwise) */
  readonly error: string | null;

  /** Output data if completed (null otherwise) */
  readonly output: unknown | null;
}

/**
 * A single execution run of a workflow.
 */
export interface Execution {
  readonly id: ExecutionId;
  readonly workflowId: WorkflowId;
  readonly status: ExecutionStatus;

  /** Snapshot of workflow version at execution time */
  readonly workflowVersion: number;

  /** User who triggered the execution */
  readonly triggeredBy: string;

  /** Execution timing */
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;

  /** Per-node execution state, keyed by NodeId */
  readonly nodeStates: ReadonlyMap<NodeId, NodeExecutionState>;

  /** Inputs provided at execution start */
  readonly inputs: Record<string, unknown>;
}
