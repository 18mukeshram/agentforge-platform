// validation/structural.ts

import type { Workflow, NodeId, EdgeId } from "../types";
import type { ValidationResult, ValidationError } from "./types";
import { validResult, invalidResult } from "./types";
import {
  findEntryNodes,
  findExitNodes,
  buildAdjacencyList,
  buildReverseAdjacencyList,
} from "./graph";

/**
 * S2: Every edge must reference existing nodes.
 */
export function validateEdgeReferences(workflow: Workflow): ValidationResult {
  const errors: ValidationError[] = [];

  for (const [edgeId, edge] of workflow.edges) {
    if (!workflow.nodes.has(edge.source)) {
      errors.push({
        code: "INVALID_EDGE_REFERENCE",
        message: `Edge references non-existent source node: ${edge.source}`,
        edgeIds: [edgeId],
        nodeIds: [edge.source],
      });
    }
    if (!workflow.nodes.has(edge.target)) {
      errors.push({
        code: "INVALID_EDGE_REFERENCE",
        message: `Edge references non-existent target node: ${edge.target}`,
        edgeIds: [edgeId],
        nodeIds: [edge.target],
      });
    }
  }

  return errors.length === 0 ? validResult() : invalidResult(errors);
}

/**
 * S3: No duplicate edges between same (source, sourcePort, target, targetPort).
 */
export function validateNoDuplicateEdges(workflow: Workflow): ValidationResult {
  const seen = new Map<string, EdgeId>();
  const errors: ValidationError[] = [];

  for (const [edgeId, edge] of workflow.edges) {
    const key = `${edge.source}:${edge.sourcePort}->${edge.target}:${edge.targetPort}`;
    const existing = seen.get(key);

    if (existing) {
      errors.push({
        code: "DUPLICATE_EDGE",
        message: `Duplicate edge between same ports`,
        edgeIds: [existing, edgeId],
      });
    } else {
      seen.set(key, edgeId);
    }
  }

  return errors.length === 0 ? validResult() : invalidResult(errors);
}

/**
 * S4: Workflow must have at least one entry node.
 */
export function validateHasEntryNode(workflow: Workflow): ValidationResult {
  if (workflow.nodes.size === 0) {
    return invalidResult([
      {
        code: "NO_ENTRY_NODE",
        message: "Workflow has no nodes",
      },
    ]);
  }

  const entries = findEntryNodes(workflow);

  if (entries.length === 0) {
    return invalidResult([
      {
        code: "NO_ENTRY_NODE",
        message: "Workflow has no entry nodes (all nodes have incoming edges)",
      },
    ]);
  }

  return validResult();
}

/**
 * S5: No orphan nodes (every node must be reachable from entry OR reach exit).
 */
export function validateNoOrphans(workflow: Workflow): ValidationResult {
  const entries = findEntryNodes(workflow);
  const exits = findExitNodes(workflow);
  const adj = buildAdjacencyList(workflow);
  const revAdj = buildReverseAdjacencyList(workflow);

  // BFS forward from entries
  const reachableFromEntry = new Set<NodeId>();
  const forwardQueue = [...entries];

  while (forwardQueue.length > 0) {
    const nodeId = forwardQueue.shift()!;
    if (reachableFromEntry.has(nodeId)) continue;
    reachableFromEntry.add(nodeId);

    const outgoing = adj.get(nodeId) ?? [];
    for (const edgeId of outgoing) {
      const edge = workflow.edges.get(edgeId)!;
      forwardQueue.push(edge.target);
    }
  }

  // BFS backward from exits
  const reachesExit = new Set<NodeId>();
  const backwardQueue = [...exits];

  while (backwardQueue.length > 0) {
    const nodeId = backwardQueue.shift()!;
    if (reachesExit.has(nodeId)) continue;
    reachesExit.add(nodeId);

    const incoming = revAdj.get(nodeId) ?? [];
    for (const edgeId of incoming) {
      const edge = workflow.edges.get(edgeId)!;
      backwardQueue.push(edge.source);
    }
  }

  // Find orphans: nodes not in either set
  const orphans: NodeId[] = [];
  for (const nodeId of workflow.nodes.keys()) {
    if (!reachableFromEntry.has(nodeId) && !reachesExit.has(nodeId)) {
      orphans.push(nodeId);
    }
  }

  if (orphans.length > 0) {
    return invalidResult([
      {
        code: "ORPHAN_NODE",
        message: `Found ${orphans.length} orphan node(s) not connected to workflow`,
        nodeIds: orphans,
      },
    ]);
  }

  return validResult();
}

/**
 * S1: Detect cycles using DFS with three-color marking.
 */
export function validateNoCycles(workflow: Workflow): ValidationResult {
  const adj = buildAdjacencyList(workflow);

  // 0 = unvisited, 1 = visiting (in stack), 2 = visited
  const state = new Map<NodeId, number>();
  for (const nodeId of workflow.nodes.keys()) {
    state.set(nodeId, 0);
  }

  const cycleNodes: NodeId[] = [];

  function dfs(nodeId: NodeId): boolean {
    const currentState = state.get(nodeId)!;

    if (currentState === 2) return false; // Already processed
    if (currentState === 1) return true; // Back edge = cycle

    state.set(nodeId, 1); // Mark visiting

    const outgoing = adj.get(nodeId) ?? [];
    for (const edgeId of outgoing) {
      const edge = workflow.edges.get(edgeId)!;
      if (dfs(edge.target)) {
        cycleNodes.push(nodeId);
        return true;
      }
    }

    state.set(nodeId, 2); // Mark visited
    return false;
  }

  for (const nodeId of workflow.nodes.keys()) {
    if (state.get(nodeId) === 0) {
      if (dfs(nodeId)) {
        return invalidResult([
          {
            code: "CYCLE_DETECTED",
            message: "Workflow contains a cycle",
            nodeIds: cycleNodes,
          },
        ]);
      }
    }
  }

  return validResult();
}
