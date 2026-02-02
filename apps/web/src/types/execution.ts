/**
 * Execution domain types.
 * Mirrors backend: agentforge_api/models/execution.py
 */

/**
 * Branded type for Execution ID.
 */
export type ExecutionId = string & { readonly __brand: "ExecutionId" };

/**
 * Overall execution status.
 */
export type ExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * Execution status for a single node.
 */
export type NodeExecutionStatus =
  | "pending"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

/**
 * Runtime state of a single node during execution.
 */
export interface NodeExecutionState {
  readonly nodeId: string;
  readonly status: NodeExecutionStatus;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly retryCount: number;
  readonly error: string | null;
  readonly output: unknown | null;
}

/**
 * A single execution run of a workflow.
 */
export interface Execution {
  readonly id: string;
  readonly workflowId: string;
  readonly status: ExecutionStatus;
  readonly workflowVersion: number;
  readonly triggeredBy: string;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly nodeStates: NodeExecutionState[];
  readonly inputs: Record<string, unknown>;
  readonly outputs: Record<string, unknown> | null;
}

/**
 * Execution summary for list views.
 */
export interface ExecutionSummary {
  readonly id: string;
  readonly workflowId: string;
  readonly status: ExecutionStatus;
  readonly createdAt: string;
  readonly completedAt: string | null;
}

/**
 * Helper to create a typed ExecutionId.
 */
export function toExecutionId(id: string): ExecutionId {
  return id as ExecutionId;
}
