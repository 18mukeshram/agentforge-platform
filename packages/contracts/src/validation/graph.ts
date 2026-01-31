// validation/graph.ts

import type { NodeId, EdgeId, Workflow, Edge } from "../types";

/**
 * Adjacency list: for each node, the list of outgoing edges.
 */
export type AdjacencyList = ReadonlyMap<NodeId, readonly EdgeId[]>;

/**
 * Reverse adjacency list: for each node, the list of incoming edges.
 */
export type ReverseAdjacencyList = ReadonlyMap<NodeId, readonly EdgeId[]>;

/**
 * In-degree map: for each node, count of incoming edges.
 */
export type InDegreeMap = ReadonlyMap<NodeId, number>;

/**
 * Build adjacency list from workflow edges.
 * Maps each node to its outgoing edges.
 */
export function buildAdjacencyList(workflow: Workflow): AdjacencyList {
  const adj = new Map<NodeId, EdgeId[]>();

  // Initialize all nodes with empty arrays
  for (const nodeId of workflow.nodes.keys()) {
    adj.set(nodeId, []);
  }

  // Populate outgoing edges
  for (const [edgeId, edge] of workflow.edges) {
    const outgoing = adj.get(edge.source);
    if (outgoing) {
      outgoing.push(edgeId);
    }
  }

  return adj;
}

/**
 * Build reverse adjacency list from workflow edges.
 * Maps each node to its incoming edges.
 */
export function buildReverseAdjacencyList(
  workflow: Workflow,
): ReverseAdjacencyList {
  const rev = new Map<NodeId, EdgeId[]>();

  // Initialize all nodes with empty arrays
  for (const nodeId of workflow.nodes.keys()) {
    rev.set(nodeId, []);
  }

  // Populate incoming edges
  for (const [edgeId, edge] of workflow.edges) {
    const incoming = rev.get(edge.target);
    if (incoming) {
      incoming.push(edgeId);
    }
  }

  return rev;
}

/**
 * Compute in-degree for each node.
 */
export function computeInDegrees(workflow: Workflow): InDegreeMap {
  const degrees = new Map<NodeId, number>();

  // Initialize all nodes with zero
  for (const nodeId of workflow.nodes.keys()) {
    degrees.set(nodeId, 0);
  }

  // Count incoming edges
  for (const edge of workflow.edges.values()) {
    const current = degrees.get(edge.target) ?? 0;
    degrees.set(edge.target, current + 1);
  }

  return degrees;
}

/**
 * Find entry nodes (nodes with no incoming edges).
 */
export function findEntryNodes(workflow: Workflow): readonly NodeId[] {
  const inDegrees = computeInDegrees(workflow);
  const entries: NodeId[] = [];

  for (const [nodeId, degree] of inDegrees) {
    if (degree === 0) {
      entries.push(nodeId);
    }
  }

  return entries;
}

/**
 * Find exit nodes (nodes with no outgoing edges).
 */
export function findExitNodes(workflow: Workflow): readonly NodeId[] {
  const adj = buildAdjacencyList(workflow);
  const exits: NodeId[] = [];

  for (const [nodeId, outgoing] of adj) {
    if (outgoing.length === 0) {
      exits.push(nodeId);
    }
  }

  return exits;
}
