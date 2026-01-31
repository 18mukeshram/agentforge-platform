// validation/topological.ts

import type { Workflow, NodeId } from "../types";
import { computeInDegrees, buildAdjacencyList } from "./graph";

/**
 * Result of topological sort.
 * Either succeeds with ordered nodes, or fails (cycle detected).
 */
export type TopologicalSortResult =
  | { readonly success: true; readonly order: readonly NodeId[] }
  | { readonly success: false; readonly reason: "cycle_detected" };

/**
 * Kahn's algorithm for topological sorting.
 *
 * Returns nodes in execution order (all dependencies before dependents).
 * Fails if graph contains a cycle.
 *
 * Time: O(V + E)
 * Space: O(V)
 */
export function topologicalSort(workflow: Workflow): TopologicalSortResult {
  if (workflow.nodes.size === 0) {
    return { success: true, order: [] };
  }

  const adj = buildAdjacencyList(workflow);

  // Mutable copy of in-degrees (will be decremented)
  const inDegrees = new Map<NodeId, number>(computeInDegrees(workflow));

  // Queue starts with all entry nodes (in-degree 0)
  const queue: NodeId[] = [];
  for (const [nodeId, degree] of inDegrees) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  const order: NodeId[] = [];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    order.push(nodeId);

    // Process all outgoing edges
    const outgoing = adj.get(nodeId) ?? [];
    for (const edgeId of outgoing) {
      const edge = workflow.edges.get(edgeId)!;
      const targetDegree = inDegrees.get(edge.target)!;
      const newDegree = targetDegree - 1;
      inDegrees.set(edge.target, newDegree);

      // Target becomes ready when all dependencies processed
      if (newDegree === 0) {
        queue.push(edge.target);
      }
    }
  }

  // If not all nodes processed, graph has a cycle
  if (order.length !== workflow.nodes.size) {
    return { success: false, reason: "cycle_detected" };
  }

  return { success: true, order };
}

/**
 * Get execution order, assuming workflow is already validated.
 * Throws if cycle detected (should not happen if pre-validated).
 */
export function getExecutionOrder(workflow: Workflow): readonly NodeId[] {
  const result = topologicalSort(workflow);

  if (!result.success) {
    throw new Error("Cannot compute execution order: cycle detected");
  }

  return result.order;
}

/**
 * Group nodes by execution level (nodes at same level can run in parallel).
 * Level 0 = entry nodes, Level N = nodes whose max dependency is level N-1.
 */
export function computeExecutionLevels(
  workflow: Workflow,
): ReadonlyMap<NodeId, number> {
  const levels = new Map<NodeId, number>();
  const adj = buildAdjacencyList(workflow);
  const inDegrees = new Map<NodeId, number>(computeInDegrees(workflow));

  // Entry nodes are level 0
  const queue: NodeId[] = [];
  for (const [nodeId, degree] of inDegrees) {
    if (degree === 0) {
      levels.set(nodeId, 0);
      queue.push(nodeId);
    }
  }

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const currentLevel = levels.get(nodeId)!;

    const outgoing = adj.get(nodeId) ?? [];
    for (const edgeId of outgoing) {
      const edge = workflow.edges.get(edgeId)!;
      const targetDegree = inDegrees.get(edge.target)!;
      const newDegree = targetDegree - 1;
      inDegrees.set(edge.target, newDegree);

      // Update target's level to max of current dependencies + 1
      const existingLevel = levels.get(edge.target) ?? 0;
      levels.set(edge.target, Math.max(existingLevel, currentLevel + 1));

      if (newDegree === 0) {
        queue.push(edge.target);
      }
    }
  }

  return levels;
}
