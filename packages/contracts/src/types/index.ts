// types/index.ts

/**
 * AgentForge Core Domain Types
 *
 * This barrel export provides a single entry point for all
 * shared type definitions used across frontend and backend.
 */

// Node types
export type { NodeId, NodeType, NodePosition, NodeConfig, Node } from "./node";

// Edge types
export type { EdgeId, PortId, Edge } from "./edge";

// Workflow types
export type {
  WorkflowId,
  WorkflowStatus,
  WorkflowMeta,
  Workflow,
} from "./workflow";

// Execution types
export type {
  ExecutionId,
  ExecutionStatus,
  NodeExecutionStatus,
  NodeExecutionState,
  Execution,
} from "./execution";

// Agent types
export type {
  AgentId,
  DataType,
  PortSchema,
  AgentInputSchema,
  AgentOutputSchema,
  AgentCategory,
  AgentDefinition,
  RetryPolicy,
} from "./agent";
