/**
 * Workflow state store.
 * Manages current workflow, save status, and validation state.
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  WorkflowStatus,
  ValidationError,
} from "@/types";

interface WorkflowState {
  // Current workflow
  workflow: Workflow | null;
  isLoading: boolean;
  error: string | null;

  // Edit state
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: string | null;

  // Validation
  isValidating: boolean;
  validationErrors: ValidationError[];
  executionOrder: string[] | null;
}

interface WorkflowActions {
  // Workflow CRUD
  setWorkflow: (workflow: Workflow) => void;
  clearWorkflow: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Edit state
  markDirty: () => void;
  markClean: () => void;
  setSaving: (saving: boolean) => void;
  setLastSavedAt: (timestamp: string) => void;

  // Workflow updates
  updateMeta: (updates: { name?: string; description?: string }) => void;
  setNodes: (nodes: WorkflowNode[]) => void;
  setEdges: (edges: WorkflowEdge[]) => void;
  addNode: (node: WorkflowNode) => void;
  updateNode: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  removeNode: (nodeId: string) => void;
  addEdge: (edge: WorkflowEdge) => void;
  removeEdge: (edgeId: string) => void;

  // Validation
  setValidating: (validating: boolean) => void;
  setValidationResult: (
    errors: ValidationError[],
    executionOrder: string[] | null,
  ) => void;
  clearValidation: () => void;

  // Status
  setStatus: (status: WorkflowStatus) => void;
}

export type WorkflowStore = WorkflowState & WorkflowActions;

const initialState: WorkflowState = {
  workflow: null,
  isLoading: false,
  error: null,
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,
  isValidating: false,
  validationErrors: [],
  executionOrder: null,
};

export const useWorkflowStore = create<WorkflowStore>()(
  immer((set) => ({
    ...initialState,

    // Workflow CRUD
    setWorkflow: (workflow) =>
      set((state) => {
        state.workflow = workflow;
        state.isLoading = false;
        state.error = null;
        state.isDirty = false;
      }),

    clearWorkflow: () =>
      set((state) => {
        state.workflow = null;
        state.isDirty = false;
        state.validationErrors = [];
        state.executionOrder = null;
      }),

    setLoading: (loading) =>
      set((state) => {
        state.isLoading = loading;
      }),

    setError: (error) =>
      set((state) => {
        state.error = error;
        state.isLoading = false;
      }),

    // Edit state
    markDirty: () =>
      set((state) => {
        state.isDirty = true;
      }),

    markClean: () =>
      set((state) => {
        state.isDirty = false;
      }),

    setSaving: (saving) =>
      set((state) => {
        state.isSaving = saving;
      }),

    setLastSavedAt: (timestamp) =>
      set((state) => {
        state.lastSavedAt = timestamp;
        state.isSaving = false;
        state.isDirty = false;
      }),

    // Workflow updates
    updateMeta: (updates) =>
      set((state) => {
        if (state.workflow) {
          state.workflow = {
            ...state.workflow,
            meta: {
              ...state.workflow.meta,
              ...updates,
            },
          };
          state.isDirty = true;
        }
      }),

    setNodes: (nodes) =>
      set((state) => {
        if (state.workflow) {
          state.workflow = {
            ...state.workflow,
            nodes,
          };
          state.isDirty = true;
        }
      }),

    setEdges: (edges) =>
      set((state) => {
        if (state.workflow) {
          state.workflow = {
            ...state.workflow,
            edges,
          };
          state.isDirty = true;
        }
      }),

    addNode: (node) =>
      set((state) => {
        if (state.workflow) {
          state.workflow = {
            ...state.workflow,
            nodes: [...state.workflow.nodes, node],
          };
          state.isDirty = true;
        }
      }),

    updateNode: (nodeId, updates) =>
      set((state) => {
        if (state.workflow) {
          state.workflow = {
            ...state.workflow,
            nodes: state.workflow.nodes.map((node) =>
              node.id === nodeId ? { ...node, ...updates } : node,
            ),
          };
          state.isDirty = true;
        }
      }),

    removeNode: (nodeId) =>
      set((state) => {
        if (state.workflow) {
          state.workflow = {
            ...state.workflow,
            nodes: state.workflow.nodes.filter((node) => node.id !== nodeId),
            // Also remove connected edges
            edges: state.workflow.edges.filter(
              (edge) => edge.source !== nodeId && edge.target !== nodeId,
            ),
          };
          state.isDirty = true;
        }
      }),

    addEdge: (edge) =>
      set((state) => {
        if (state.workflow) {
          state.workflow = {
            ...state.workflow,
            edges: [...state.workflow.edges, edge],
          };
          state.isDirty = true;
        }
      }),

    removeEdge: (edgeId) =>
      set((state) => {
        if (state.workflow) {
          state.workflow = {
            ...state.workflow,
            edges: state.workflow.edges.filter((edge) => edge.id !== edgeId),
          };
          state.isDirty = true;
        }
      }),

    // Validation
    setValidating: (validating) =>
      set((state) => {
        state.isValidating = validating;
      }),

    setValidationResult: (errors, executionOrder) =>
      set((state) => {
        state.validationErrors = errors;
        state.executionOrder = executionOrder;
        state.isValidating = false;
        if (state.workflow) {
          state.workflow = {
            ...state.workflow,
            status: errors.length === 0 ? "valid" : "invalid",
          };
        }
      }),

    clearValidation: () =>
      set((state) => {
        state.validationErrors = [];
        state.executionOrder = null;
      }),

    // Status
    setStatus: (status) =>
      set((state) => {
        if (state.workflow) {
          state.workflow = {
            ...state.workflow,
            status,
          };
        }
      }),
  })),
);
