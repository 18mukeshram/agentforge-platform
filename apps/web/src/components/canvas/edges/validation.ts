/**
 * Edge validation utilities.
 */

import type { Edge, Node } from "reactflow";
import type { ConnectionValidation } from "./types";
import type { NodeType } from "@/types";

/**
 * Validate a connection between two nodes.
 */
export function validateConnection(
  sourceId: string,
  targetId: string,
  sourceHandle: string | null,
  targetHandle: string | null,
  nodes: Node[],
  edges: Edge[],
): ConnectionValidation {
  // Rule 1: Cannot connect to self
  if (sourceId === targetId) {
    return { valid: false, reason: "Cannot connect a node to itself" };
  }

  // Rule 2: Check for existing connection
  const existingConnection = edges.find(
    (e) =>
      e.source === sourceId &&
      e.target === targetId &&
      e.sourceHandle === sourceHandle &&
      e.targetHandle === targetHandle,
  );
  if (existingConnection) {
    return { valid: false, reason: "Connection already exists" };
  }

  // Rule 3: Check for duplicate edge (same source/target, any handles)
  const duplicateEdge = edges.find(
    (e) => e.source === sourceId && e.target === targetId,
  );
  if (duplicateEdge) {
    return {
      valid: false,
      reason: "A connection between these nodes already exists",
    };
  }

  // Rule 4: Check for reverse connection (would create immediate cycle)
  const reverseConnection = edges.find(
    (e) => e.source === targetId && e.target === sourceId,
  );
  if (reverseConnection) {
    return {
      valid: false,
      reason: "Reverse connection would create a cycle",
    };
  }

  // Rule 5: Check node types for valid connections
  const sourceNode = nodes.find((n) => n.id === sourceId);
  const targetNode = nodes.find((n) => n.id === targetId);

  if (!sourceNode || !targetNode) {
    return { valid: false, reason: "Source or target node not found" };
  }

  const sourceType = sourceNode.type as NodeType;
  const targetType = targetNode.type as NodeType;

  // Output nodes cannot be sources
  if (sourceType === "output") {
    return {
      valid: false,
      reason: "Output nodes cannot have outgoing connections",
    };
  }

  // Input nodes cannot be targets
  if (targetType === "input") {
    return {
      valid: false,
      reason: "Input nodes cannot have incoming connections",
    };
  }

  // Rule 6: Check for cycles using DFS
  if (wouldCreateCycle(edges, sourceId, targetId)) {
    return { valid: false, reason: "Connection would create a cycle" };
  }

  return { valid: true };
}

/**
 * Check if adding an edge would create a cycle.
 */
export function wouldCreateCycle(
  edges: Edge[],
  source: string,
  target: string,
): boolean {
  // Build adjacency list including the new edge
  const adjacency = new Map<string, Set<string>>();

  for (const edge of edges) {
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, new Set());
    }
    adjacency.get(edge.source)!.add(edge.target);
  }

  // Add the proposed edge
  if (!adjacency.has(source)) {
    adjacency.set(source, new Set());
  }
  adjacency.get(source)!.add(target);

  // DFS to detect cycle
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function hasCycle(nodeId: string): boolean {
    if (inStack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;

    visited.add(nodeId);
    inStack.add(nodeId);

    const neighbors = adjacency.get(nodeId);
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (hasCycle(neighbor)) return true;
      }
    }

    inStack.delete(nodeId);
    return false;
  }

  // Check all nodes
  for (const nodeId of adjacency.keys()) {
    if (hasCycle(nodeId)) return true;
  }

  return false;
}

/**
 * Validate all edges in the graph.
 */
export function validateAllEdges(
  nodes: Node[],
  edges: Edge[],
): Map<string, ConnectionValidation> {
  const results = new Map<string, ConnectionValidation>();

  for (const edge of edges) {
    // Temporarily remove this edge for validation
    const otherEdges = edges.filter((e) => e.id !== edge.id);

    const validation = validateConnection(
      edge.source,
      edge.target,
      edge.sourceHandle || null,
      edge.targetHandle || null,
      nodes,
      otherEdges,
    );

    results.set(edge.id, validation);
  }

  return results;
}

/**
 * Check if a node can accept more incoming connections.
 */
export function canAcceptConnection(
  nodeId: string,
  nodes: Node[],
  edges: Edge[],
  maxConnections: number = Infinity,
): boolean {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return false;

  // Input nodes cannot accept any incoming
  if (node.type === "input") return false;

  const incomingCount = edges.filter((e) => e.target === nodeId).length;
  return incomingCount < maxConnections;
}

/**
 * Check if a node can have more outgoing connections.
 */
export function canCreateConnection(
  nodeId: string,
  nodes: Node[],
  edges: Edge[],
  maxConnections: number = Infinity,
): boolean {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return false;

  // Output nodes cannot create outgoing
  if (node.type === "output") return false;

  const outgoingCount = edges.filter((e) => e.source === nodeId).length;
  return outgoingCount < maxConnections;
}
