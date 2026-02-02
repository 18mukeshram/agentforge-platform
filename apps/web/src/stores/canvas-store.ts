/**
 * Canvas state store.
 * Manages React Flow canvas state, selection, and viewport.
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  Node,
  Edge,
  Viewport,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
} from "reactflow";

interface CanvasState {
  // React Flow nodes/edges (visual representation)
  nodes: Node[];
  edges: Edge[];

  // Viewport
  viewport: Viewport;

  // Selection
  selectedNodeIds: string[];
  selectedEdgeIds: string[];

  // Interaction state
  isConnecting: boolean;
  connectionSourceId: string | null;

  // Canvas mode
  mode: CanvasMode;

  // Clipboard
  clipboard: ClipboardData | null;
}

interface CanvasActions {
  // Nodes
  setNodes: (nodes: Node[]) => void;
  addNode: (node: Node) => void;
  updateNode: (nodeId: string, updates: Partial<Node>) => void;
  updateNodePosition: (
    nodeId: string,
    position: { x: number; y: number },
  ) => void;
  removeNode: (nodeId: string) => void;

  // Edges
  setEdges: (edges: Edge[]) => void;
  addEdge: (edge: Edge) => void;
  updateEdge: (edgeId: string, updates: Partial<Edge>) => void;
  removeEdge: (edgeId: string) => void;

  // React Flow handlers
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  // Viewport
  setViewport: (viewport: Viewport) => void;
  fitView: () => void;
  resetViewport: () => void;

  // Selection
  selectNode: (nodeId: string, addToSelection?: boolean) => void;
  selectEdge: (edgeId: string, addToSelection?: boolean) => void;
  selectAll: () => void;
  clearSelection: () => void;
  deleteSelected: () => void;

  // Interaction
  setConnecting: (connecting: boolean, sourceId?: string | null) => void;

  // Mode
  setMode: (mode: CanvasMode) => void;

  // Clipboard
  copySelected: () => void;
  paste: () => void;

  // Reset
  resetCanvas: () => void;
}

export type CanvasMode = "select" | "pan" | "connect";

export interface ClipboardData {
  nodes: Node[];
  edges: Edge[];
}

export type CanvasStore = CanvasState & CanvasActions;

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

const initialState: CanvasState = {
  nodes: [],
  edges: [],
  viewport: DEFAULT_VIEWPORT,
  selectedNodeIds: [],
  selectedEdgeIds: [],
  isConnecting: false,
  connectionSourceId: null,
  mode: "select",
  clipboard: null,
};

export const useCanvasStore = create<CanvasStore>()(
  immer((set, get) => ({
    ...initialState,

    // Nodes
    setNodes: (nodes) =>
      set((state) => {
        state.nodes = nodes;
      }),

    addNode: (node) =>
      set((state) => {
        state.nodes.push(node);
      }),

    updateNode: (nodeId, updates) =>
      set((state) => {
        const index = state.nodes.findIndex((n) => n.id === nodeId);
        if (index !== -1) {
          state.nodes[index] = { ...state.nodes[index], ...updates };
        }
      }),

    updateNodePosition: (nodeId, position) =>
      set((state) => {
        const index = state.nodes.findIndex((n) => n.id === nodeId);
        if (index !== -1) {
          state.nodes[index].position = position;
        }
      }),

    removeNode: (nodeId) =>
      set((state) => {
        state.nodes = state.nodes.filter((n) => n.id !== nodeId);
        state.edges = state.edges.filter(
          (e) => e.source !== nodeId && e.target !== nodeId,
        );
        state.selectedNodeIds = state.selectedNodeIds.filter(
          (id) => id !== nodeId,
        );
      }),

    // Edges
    setEdges: (edges) =>
      set((state) => {
        state.edges = edges;
      }),

    addEdge: (edge) =>
      set((state) => {
        // Prevent duplicate edges
        const exists = state.edges.some(
          (e) =>
            e.source === edge.source &&
            e.target === edge.target &&
            e.sourceHandle === edge.sourceHandle &&
            e.targetHandle === edge.targetHandle,
        );
        if (!exists) {
          state.edges.push(edge);
        }
      }),

    updateEdge: (edgeId, updates) =>
      set((state) => {
        const index = state.edges.findIndex((e) => e.id === edgeId);
        if (index !== -1) {
          state.edges[index] = { ...state.edges[index], ...updates };
        }
      }),

    removeEdge: (edgeId) =>
      set((state) => {
        state.edges = state.edges.filter((e) => e.id !== edgeId);
        state.selectedEdgeIds = state.selectedEdgeIds.filter(
          (id) => id !== edgeId,
        );
      }),

    // React Flow handlers
    onNodesChange: (changes) => {
      set((state) => {
        for (const change of changes) {
          if (change.type === "position" && change.position) {
            const index = state.nodes.findIndex((n) => n.id === change.id);
            if (index !== -1) {
              state.nodes[index].position = change.position;
            }
          } else if (change.type === "select") {
            if (change.selected) {
              if (!state.selectedNodeIds.includes(change.id)) {
                state.selectedNodeIds.push(change.id);
              }
            } else {
              state.selectedNodeIds = state.selectedNodeIds.filter(
                (id) => id !== change.id,
              );
            }
          } else if (change.type === "remove") {
            state.nodes = state.nodes.filter((n) => n.id !== change.id);
            state.selectedNodeIds = state.selectedNodeIds.filter(
              (id) => id !== change.id,
            );
          }
        }
      });
    },

    onEdgesChange: (changes) => {
      set((state) => {
        for (const change of changes) {
          if (change.type === "select") {
            if (change.selected) {
              if (!state.selectedEdgeIds.includes(change.id)) {
                state.selectedEdgeIds.push(change.id);
              }
            } else {
              state.selectedEdgeIds = state.selectedEdgeIds.filter(
                (id) => id !== change.id,
              );
            }
          } else if (change.type === "remove") {
            state.edges = state.edges.filter((e) => e.id !== change.id);
            state.selectedEdgeIds = state.selectedEdgeIds.filter(
              (id) => id !== change.id,
            );
          }
        }
      });
    },

    onConnect: (connection) => {
      if (connection.source && connection.target) {
        const edgeId = `edge-${connection.source}-${connection.target}-${Date.now()}`;
        get().addEdge({
          id: edgeId,
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle,
          targetHandle: connection.targetHandle,
        });
      }
    },

    // Viewport
    setViewport: (viewport) =>
      set((state) => {
        state.viewport = viewport;
      }),

    fitView: () => {
      // This will be handled by React Flow's fitView function
      // The store just signals the intent
    },

    resetViewport: () =>
      set((state) => {
        state.viewport = DEFAULT_VIEWPORT;
      }),

    // Selection
    selectNode: (nodeId, addToSelection = false) =>
      set((state) => {
        if (addToSelection) {
          if (!state.selectedNodeIds.includes(nodeId)) {
            state.selectedNodeIds.push(nodeId);
          }
        } else {
          state.selectedNodeIds = [nodeId];
          state.selectedEdgeIds = [];
        }
      }),

    selectEdge: (edgeId, addToSelection = false) =>
      set((state) => {
        if (addToSelection) {
          if (!state.selectedEdgeIds.includes(edgeId)) {
            state.selectedEdgeIds.push(edgeId);
          }
        } else {
          state.selectedEdgeIds = [edgeId];
          state.selectedNodeIds = [];
        }
      }),

    selectAll: () =>
      set((state) => {
        state.selectedNodeIds = state.nodes.map((n) => n.id);
        state.selectedEdgeIds = state.edges.map((e) => e.id);
      }),

    clearSelection: () =>
      set((state) => {
        state.selectedNodeIds = [];
        state.selectedEdgeIds = [];
      }),

    deleteSelected: () =>
      set((state) => {
        // Remove selected nodes and their connected edges
        const nodeIdsToRemove = new Set(state.selectedNodeIds);
        state.edges = state.edges.filter(
          (e) =>
            !state.selectedEdgeIds.includes(e.id) &&
            !nodeIdsToRemove.has(e.source) &&
            !nodeIdsToRemove.has(e.target),
        );
        state.nodes = state.nodes.filter((n) => !nodeIdsToRemove.has(n.id));
        state.selectedNodeIds = [];
        state.selectedEdgeIds = [];
      }),

    // Interaction
    setConnecting: (connecting, sourceId = null) =>
      set((state) => {
        state.isConnecting = connecting;
        state.connectionSourceId = sourceId;
      }),

    // Mode
    setMode: (mode) =>
      set((state) => {
        state.mode = mode;
      }),

    // Clipboard
    copySelected: () =>
      set((state) => {
        const selectedNodes = state.nodes.filter((n) =>
          state.selectedNodeIds.includes(n.id),
        );
        const selectedNodeIds = new Set(state.selectedNodeIds);
        const selectedEdges = state.edges.filter(
          (e) => selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target),
        );
        state.clipboard = {
          nodes: JSON.parse(JSON.stringify(selectedNodes)),
          edges: JSON.parse(JSON.stringify(selectedEdges)),
        };
      }),

    paste: () =>
      set((state) => {
        if (!state.clipboard) return;

        const idMap = new Map<string, string>();
        const offset = 50;

        // Create new nodes with offset positions
        const newNodes = state.clipboard.nodes.map((node) => {
          const newId = `${node.id}-copy-${Date.now()}`;
          idMap.set(node.id, newId);
          return {
            ...node,
            id: newId,
            position: {
              x: node.position.x + offset,
              y: node.position.y + offset,
            },
            selected: true,
          };
        });

        // Create new edges with updated IDs
        const newEdges = state.clipboard.edges.map((edge) => ({
          ...edge,
          id: `${edge.id}-copy-${Date.now()}`,
          source: idMap.get(edge.source) || edge.source,
          target: idMap.get(edge.target) || edge.target,
        }));

        // Deselect existing and add new
        state.nodes.forEach((n) => (n.selected = false));
        state.nodes.push(...newNodes);
        state.edges.push(...newEdges);
        state.selectedNodeIds = newNodes.map((n) => n.id);
        state.selectedEdgeIds = [];
      }),

    // Reset
    resetCanvas: () =>
      set((state) => {
        Object.assign(state, initialState);
      }),
  })),
);
