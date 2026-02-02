/**
 * Edge-specific types for React Flow integration.
 */

import type { EdgeProps } from "reactflow";

/**
 * Custom edge data structure.
 */
export interface WorkflowEdgeData {
  label?: string;
  isValid?: boolean;
  executionStatus?: "pending" | "active" | "completed" | "failed";
}

/**
 * Props for custom edge components.
 */
export type WorkflowEdgeProps = EdgeProps<WorkflowEdgeData>;

/**
 * Connection validation result.
 */
export interface ConnectionValidation {
  valid: boolean;
  reason?: string;
}

/**
 * Edge style configurations.
 */
export const EDGE_STYLES = {
  default: {
    stroke: "hsl(var(--border))",
    strokeWidth: 2,
  },
  selected: {
    stroke: "hsl(var(--primary))",
    strokeWidth: 2,
  },
  hover: {
    stroke: "hsl(var(--primary))",
    strokeWidth: 2,
  },
  invalid: {
    stroke: "hsl(var(--destructive))",
    strokeWidth: 2,
    strokeDasharray: "5,5",
  },
  active: {
    stroke: "hsl(var(--primary))",
    strokeWidth: 2,
    animation: "flow 1s linear infinite",
  },
  completed: {
    stroke: "hsl(142, 76%, 36%)", // green-600
    strokeWidth: 2,
  },
  failed: {
    stroke: "hsl(var(--destructive))",
    strokeWidth: 2,
  },
} as const;
