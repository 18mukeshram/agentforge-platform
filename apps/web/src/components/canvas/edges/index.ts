/**
 * Edge component exports.
 */

import { WorkflowEdge } from "./workflow-edge";
import type { EdgeTypes } from "reactflow";

/**
 * Edge types for React Flow registration.
 */
export const edgeTypes: EdgeTypes = {
  workflow: WorkflowEdge,
};

export { WorkflowEdge } from "./workflow-edge";
export { ConnectionLine } from "./connection-line";
export * from "./types";
export * from "./validation";
