// validation/semantic.ts

import type {
  Workflow,
  NodeId,
  AgentDefinition,
  AgentId,
  DataType,
  PortId,
} from "../types";
import type { ValidationResult, ValidationError } from "./types";
import { validResult, invalidResult } from "./types";
import { buildReverseAdjacencyList } from "./graph";

/**
 * Registry for looking up agent definitions.
 * Passed in to avoid tight coupling to storage.
 */
export type AgentRegistry = ReadonlyMap<AgentId, AgentDefinition>;

/**
 * M1: Source output type must match target input type.
 */
export function validateTypeCompatibility(
  workflow: Workflow,
  registry: AgentRegistry,
): ValidationResult {
  const errors: ValidationError[] = [];

  for (const [edgeId, edge] of workflow.edges) {
    const sourceNode = workflow.nodes.get(edge.source);
    const targetNode = workflow.nodes.get(edge.target);

    // Skip if nodes don't exist (caught by structural validation)
    if (!sourceNode || !targetNode) continue;

    // Get agent definitions
    const sourceAgentId = sourceNode.config.agentId as AgentId | undefined;
    const targetAgentId = targetNode.config.agentId as AgentId | undefined;

    // Skip non-agent nodes (input/output nodes have dynamic types)
    if (!sourceAgentId || !targetAgentId) continue;

    const sourceAgent = registry.get(sourceAgentId);
    const targetAgent = registry.get(targetAgentId);

    if (!sourceAgent || !targetAgent) {
      errors.push({
        code: "TYPE_MISMATCH",
        message: `Unknown agent definition referenced`,
        nodeIds: [edge.source, edge.target],
        edgeIds: [edgeId],
      });
      continue;
    }

    // Find port schemas
    const sourcePort = sourceAgent.outputSchema.ports.find(
      (p) => p.name === edge.sourcePort,
    );
    const targetPort = targetAgent.inputSchema.ports.find(
      (p) => p.name === edge.targetPort,
    );

    if (!sourcePort) {
      errors.push({
        code: "TYPE_MISMATCH",
        message: `Source node has no output port: ${edge.sourcePort}`,
        nodeIds: [edge.source],
        edgeIds: [edgeId],
      });
      continue;
    }

    if (!targetPort) {
      errors.push({
        code: "TYPE_MISMATCH",
        message: `Target node has no input port: ${edge.targetPort}`,
        nodeIds: [edge.target],
        edgeIds: [edgeId],
      });
      continue;
    }

    // Check type compatibility
    if (!areTypesCompatible(sourcePort.type, targetPort.type)) {
      errors.push({
        code: "TYPE_MISMATCH",
        message: `Type mismatch: ${sourcePort.type} -> ${targetPort.type}`,
        nodeIds: [edge.source, edge.target],
        edgeIds: [edgeId],
      });
    }
  }

  return errors.length === 0 ? validResult() : invalidResult(errors);
}

/**
 * Check if source type can flow to target type.
 * Currently strict equality; can be extended for coercion rules.
 */
function areTypesCompatible(source: DataType, target: DataType): boolean {
  // Strict equality for now
  if (source === target) return true;

  // Future: could add coercion rules
  // e.g., number -> string, object -> array (if array of objects)

  return false;
}

/**
 * M2: All required inputs of a node must have incoming edges.
 */
export function validateRequiredInputs(
  workflow: Workflow,
  registry: AgentRegistry,
): ValidationResult {
  const errors: ValidationError[] = [];
  const revAdj = buildReverseAdjacencyList(workflow);

  for (const [nodeId, node] of workflow.nodes) {
    // Skip non-agent nodes
    const agentId = node.config.agentId as AgentId | undefined;
    if (!agentId) continue;

    const agent = registry.get(agentId);
    if (!agent) continue; // Caught elsewhere

    // Get incoming edges for this node
    const incomingEdgeIds = revAdj.get(nodeId) ?? [];
    const connectedPorts = new Set<string>();

    for (const edgeId of incomingEdgeIds) {
      const edge = workflow.edges.get(edgeId)!;
      connectedPorts.add(edge.targetPort as string);
    }

    // Check each required input port
    const missingPorts: string[] = [];
    for (const port of agent.inputSchema.ports) {
      if (port.required && !connectedPorts.has(port.name)) {
        missingPorts.push(port.name);
      }
    }

    if (missingPorts.length > 0) {
      errors.push({
        code: "MISSING_REQUIRED_INPUT",
        message: `Missing required inputs: ${missingPorts.join(", ")}`,
        nodeIds: [nodeId],
      });
    }
  }

  return errors.length === 0 ? validResult() : invalidResult(errors);
}
