/**
 * Canvas utility functions.
 */

import type { Node, Edge } from "reactflow";
import type { WorkflowNode, WorkflowEdge } from "@/types";
import type {
  WorkflowNodeData,
  WorkflowCanvasNode,
  WorkflowCanvasEdge,
} from "./types";
import { NODE_DIMENSIONS } from "./types";

/**
 * Generate a unique node ID.
 */
export function generateNodeId(type: string): string {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Generate a unique edge ID.
 */
export function generateEdgeId(source: string, target: string): string {
  return `edge-${source}-${target}-${Date.now()}`;
}

/**
 * Convert WorkflowNode to React Flow Node.
 */
export function toCanvasNode(node: WorkflowNode): WorkflowCanvasNode {
  return {
    id: node.id,
    type: node.type,
    position: { x: node.position.x, y: node.position.y },
    data: {
      label: node.label,
      type: node.type,
      config: node.config,
    },
    dragHandle: ".node-drag-handle",
  };
}

/**
 * Convert React Flow Node to WorkflowNode.
 */
export function fromCanvasNode(node: WorkflowCanvasNode): WorkflowNode {
  return {
    id: node.id,
    type: node.data.type,
    label: node.data.label,
    position: { x: node.position.x, y: node.position.y },
    config: node.data.config,
  };
}

/**
 * Convert WorkflowEdge to React Flow Edge.
 */
export function toCanvasEdge(edge: WorkflowEdge): WorkflowCanvasEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourcePort,
    targetHandle: edge.targetPort,
    type: "smoothstep",
  };
}

/**
 * Convert React Flow Edge to WorkflowEdge.
 */
export function fromCanvasEdge(edge: WorkflowCanvasEdge): WorkflowEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourcePort: edge.sourceHandle || "output",
    targetPort: edge.targetHandle || "input",
  };
}

/**
 * Convert workflow nodes and edges to canvas format.
 */
export function toCanvasElements(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): { nodes: WorkflowCanvasNode[]; edges: WorkflowCanvasEdge[] } {
  return {
    nodes: nodes.map(toCanvasNode),
    edges: edges.map(toCanvasEdge),
  };
}

/**
 * Convert canvas elements back to workflow format.
 */
export function fromCanvasElements(
  nodes: WorkflowCanvasNode[],
  edges: WorkflowCanvasEdge[],
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  return {
    nodes: nodes.map(fromCanvasNode),
    edges: edges.map(fromCanvasEdge),
  };
}

/**
 * Calculate center position for new node.
 */
export function calculateNodePosition(
  existingNodes: Node[],
  viewport: { x: number; y: number; zoom: number },
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  // Calculate center of visible canvas
  const centerX = (-viewport.x + canvasWidth / 2) / viewport.zoom;
  const centerY = (-viewport.y + canvasHeight / 2) / viewport.zoom;

  // Offset if there are existing nodes at the center
  const offset = existingNodes.length * 20;

  return {
    x: centerX - NODE_DIMENSIONS.width / 2 + offset,
    y: centerY - NODE_DIMENSIONS.height / 2 + offset,
  };
}

/**
 * Check if a connection would create a cycle.
 */
export function wouldCreateCycle(
  edges: Edge[],
  source: string,
  target: string,
): boolean {
  // Build adjacency list
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, []);
    }
    adjacency.get(edge.source)!.push(edge.target);
  }

  // Add the new edge temporarily
  if (!adjacency.has(source)) {
    adjacency.set(source, []);
  }
  adjacency.get(source)!.push(target);

  // DFS to detect cycle
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(nodeId: string): boolean {
    if (inStack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;

    visited.add(nodeId);
    inStack.add(nodeId);

    const neighbors = adjacency.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (dfs(neighbor)) return true;
    }

    inStack.delete(nodeId);
    return false;
  }

  // Check for cycles starting from all nodes
  for (const nodeId of adjacency.keys()) {
    if (dfs(nodeId)) return true;
  }

  return false;
}

/**
 * Validate connection before allowing it.
 */
export function isValidConnection(
  source: string,
  target: string,
  edges: Edge[],
): { valid: boolean; reason?: string } {
  // Can't connect to self
  if (source === target) {
    return { valid: false, reason: "Cannot connect node to itself" };
  }

  // Check for existing connection
  const exists = edges.some((e) => e.source === source && e.target === target);
  if (exists) {
    return { valid: false, reason: "Connection already exists" };
  }

  // Check for cycles
  if (wouldCreateCycle(edges, source, target)) {
    return { valid: false, reason: "Connection would create a cycle" };
  }

  return { valid: true };
}
