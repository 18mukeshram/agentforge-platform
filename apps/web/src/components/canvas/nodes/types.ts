/**
 * Node configuration types for different node types.
 */

import type { NodeType } from "@/types";

/**
 * Agent node configuration.
 */
export interface AgentNodeConfig {
  agentId: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

/**
 * Tool node configuration.
 */
export interface ToolNodeConfig {
  toolId: string;
  timeout?: number;
  retryOnError?: boolean;
}

/**
 * Input node configuration.
 */
export interface InputNodeConfig {
  inputType: "text" | "json" | "file";
  schema?: Record<string, unknown>;
  defaultValue?: unknown;
}

/**
 * Output node configuration.
 */
export interface OutputNodeConfig {
  outputType: "text" | "json" | "file";
  format?: string;
}

/**
 * Get default configuration for a node type.
 */
export function getDefaultNodeConfig(type: NodeType): Record<string, unknown> {
  switch (type) {
    case "agent":
      return {
        agentId: "",
        temperature: 0.7,
        maxTokens: 1024,
      };
    case "tool":
      return {
        toolId: "",
        timeout: 30000,
        retryOnError: true,
      };
    case "input":
      return {
        inputType: "text",
      };
    case "output":
      return {
        outputType: "text",
      };
    default:
      return {};
  }
}

/**
 * Get default label for a node type.
 */
export function getDefaultNodeLabel(type: NodeType): string {
  switch (type) {
    case "agent":
      return "New Agent";
    case "tool":
      return "New Tool";
    case "input":
      return "Input";
    case "output":
      return "Output";
    default:
      return "New Node";
  }
}

/**
 * Node type metadata for UI display.
 */
export const NODE_TYPE_META: Record<
  NodeType,
  {
    label: string;
    description: string;
    color: string;
    icon: string;
  }
> = {
  agent: {
    label: "Agent",
    description: "Execute an AI agent",
    color: "bg-violet-600",
    icon: "agent",
  },
  tool: {
    label: "Tool",
    description: "Run a deterministic tool",
    color: "bg-amber-600",
    icon: "tool",
  },
  input: {
    label: "Input",
    description: "Workflow entry point",
    color: "bg-emerald-600",
    icon: "input",
  },
  output: {
    label: "Output",
    description: "Workflow exit point",
    color: "bg-rose-600",
    icon: "output",
  },
};
