/**
 * Node type exports and registration.
 */

import { AgentNode } from "./agent-node";
import { ToolNode } from "./tool-node";
import { InputNode } from "./input-node";
import { OutputNode } from "./output-node";
import type { NodeTypes } from "reactflow";

/**
 * Node types for React Flow registration.
 */
export const nodeTypes: NodeTypes = {
  agent: AgentNode,
  tool: ToolNode,
  input: InputNode,
  output: OutputNode,
};

export { AgentNode, ToolNode, InputNode, OutputNode };
