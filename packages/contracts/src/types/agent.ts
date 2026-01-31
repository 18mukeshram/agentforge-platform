// src/types/agent.ts

/**
 * Unique identifier for an agent definition.
 */
export type AgentId = string & { readonly __brand: "AgentId" };

/**
 * Primitive types supported for agent inputs/outputs.
 */
export type DataType = "string" | "number" | "boolean" | "object" | "array";

/**
 * Schema for a single input or output port.
 */
export interface PortSchema {
  readonly name: string;
  readonly type: DataType;
  readonly required: boolean;
  readonly description: string;
}

/**
 * Definition of an agent's input requirements.
 */
export interface AgentInputSchema {
  readonly ports: readonly PortSchema[];
}

/**
 * Definition of an agent's output structure.
 */
export interface AgentOutputSchema {
  readonly ports: readonly PortSchema[];
}

/**
 * Agent category for organization and filtering.
 */
export type AgentCategory =
  | "llm" // Language model invocation
  | "retrieval" // RAG, vector search
  | "transform" // Data transformation
  | "integration" // External API calls
  | "logic"; // Branching, conditionals

/**
 * Complete definition of an agent available in the system.
 *
 * This is a template/blueprint, not an instance.
 * Nodes reference agents by AgentId.
 */
export interface AgentDefinition {
  readonly id: AgentId;
  readonly name: string;
  readonly description: string;
  readonly category: AgentCategory;

  /** Schema for inputs this agent accepts */
  readonly inputSchema: AgentInputSchema;

  /** Schema for outputs this agent produces */
  readonly outputSchema: AgentOutputSchema;

  /** Default configuration values */
  readonly defaultConfig: Record<string, unknown>;

  /** Whether this agent's output can be cached */
  readonly cacheable: boolean;

  /** Default retry policy */
  readonly retryPolicy: RetryPolicy;
}

/**
 * Retry behavior for agent execution.
 */
export interface RetryPolicy {
  readonly maxRetries: number;
  readonly backoffMs: number;
  readonly backoffMultiplier: number;
}
