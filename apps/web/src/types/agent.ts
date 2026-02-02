/**
 * Agent domain types.
 * Mirrors backend: agentforge_api/models/agent.py
 */

/**
 * Branded type for Agent ID.
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
  readonly ports: PortSchema[];
}

/**
 * Definition of an agent's output structure.
 */
export interface AgentOutputSchema {
  readonly ports: PortSchema[];
}

/**
 * Agent category for organization.
 */
export type AgentCategory =
  | "llm"
  | "retrieval"
  | "transform"
  | "integration"
  | "logic";

/**
 * Retry behavior for agent execution.
 */
export interface RetryPolicy {
  readonly maxRetries: number;
  readonly backoffMs: number;
  readonly backoffMultiplier: number;
}

/**
 * Complete definition of an agent.
 */
export interface AgentDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: AgentCategory;
  readonly inputSchema: AgentInputSchema;
  readonly outputSchema: AgentOutputSchema;
  readonly defaultConfig: Record<string, unknown>;
  readonly cacheable: boolean;
  readonly retryPolicy: RetryPolicy;
}

/**
 * Helper to create a typed AgentId.
 */
export function toAgentId(id: string): AgentId {
  return id as AgentId;
}
