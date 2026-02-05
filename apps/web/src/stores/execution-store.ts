/**
 * Execution state store.
 * Manages active execution, real-time updates, and execution history.
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  Execution,
  ExecutionStatus,
  NodeExecutionStatus,
  NodeExecutionState,
  ExecutionEvent,
} from "@/types";

interface ExecutionState {
  // Current execution
  activeExecution: Execution | null;
  isExecuting: boolean;

  // Real-time updates
  nodeStates: Map<string, NodeExecutionState>;
  logs: ExecutionLog[];

  // Connection
  isConnected: boolean;
  connectionError: string | null;

  // Resume state (Phase 12.4)
  isResuming: boolean;
  resumeInfo: {
    parentExecutionId: string;
    resumedFromNodeId: string;
    skippedCount: number;
    rerunCount: number;
  } | null;
  reusedOutputNodes: Set<string>;
}

interface ExecutionActions {
  // Execution lifecycle
  startExecution: (execution: Execution) => void;
  updateExecution: (updates: Partial<Execution>) => void;
  completeExecution: (status: ExecutionStatus) => void;
  clearExecution: () => void;

  // Node states
  updateNodeState: (nodeId: string, state: Partial<NodeExecutionState>) => void;
  setNodeStatus: (nodeId: string, status: NodeExecutionStatus) => void;

  // Logs
  addLog: (log: Omit<ExecutionLog, "id">) => void;
  clearLogs: () => void;

  // Events
  handleEvent: (event: ExecutionEvent) => void;

  // Connection
  setConnected: (connected: boolean) => void;
  setConnectionError: (error: string | null) => void;

  // Resume (Phase 12.4)
  setResuming: (isResuming: boolean) => void;
}

export interface ExecutionLog {
  id: string;
  timestamp: string;
  nodeId: string;
  level: "info" | "warn" | "error";
  message: string;
}

export type ExecutionStore = ExecutionState & ExecutionActions;

const initialState: ExecutionState = {
  activeExecution: null,
  isExecuting: false,
  nodeStates: new Map(),
  logs: [],
  isConnected: false,
  connectionError: null,
  // Resume state
  isResuming: false,
  resumeInfo: null,
  reusedOutputNodes: new Set(),
};

export const useExecutionStore = create<ExecutionStore>()(
  immer((set, get) => ({
    ...initialState,

    // Execution lifecycle
    startExecution: (execution) =>
      set((state) => {
        state.activeExecution = execution;
        state.isExecuting = true;
        state.nodeStates = new Map();
        state.logs = [];

        // Initialize node states
        for (const nodeState of execution.nodeStates) {
          state.nodeStates.set(nodeState.nodeId, nodeState);
        }
      }),

    updateExecution: (updates) =>
      set((state) => {
        if (state.activeExecution) {
          state.activeExecution = { ...state.activeExecution, ...updates };
        }
      }),

    completeExecution: (status) =>
      set((state) => {
        if (state.activeExecution) {
          state.activeExecution = {
            ...state.activeExecution,
            status,
            completedAt: new Date().toISOString(),
          };
        }
        state.isExecuting = false;
      }),

    clearExecution: () =>
      set((state) => {
        state.activeExecution = null;
        state.isExecuting = false;
        state.nodeStates = new Map();
        state.logs = [];
      }),

    // Node states
    updateNodeState: (nodeId, updates) =>
      set((state) => {
        const current = state.nodeStates.get(nodeId);
        if (current) {
          state.nodeStates.set(nodeId, { ...current, ...updates });
        } else {
          state.nodeStates.set(nodeId, {
            nodeId,
            status: "pending",
            startedAt: null,
            completedAt: null,
            retryCount: 0,
            error: null,
            output: null,
            ...updates,
          });
        }
      }),

    setNodeStatus: (nodeId, status) =>
      set((state) => {
        const current = state.nodeStates.get(nodeId);
        const now = new Date().toISOString();

        const updates: Partial<NodeExecutionState> = { status };

        if (status === "running" && (!current || !current.startedAt)) {
          (updates as any).startedAt = now;
        }
        if (
          status === "completed" ||
          status === "failed" ||
          status === "skipped"
        ) {
          (updates as any).completedAt = now;
        }

        get().updateNodeState(nodeId, updates);
      }),

    // Logs
    addLog: (log) =>
      set((state) => {
        const id = `log-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        state.logs.push({ ...log, id });

        // Keep only last 1000 logs
        if (state.logs.length > 1000) {
          state.logs = state.logs.slice(-1000);
        }
      }),

    clearLogs: () =>
      set((state) => {
        state.logs = [];
      }),

    // Events
    handleEvent: (event) => {
      const { event: eventType, payload } = event;
      const nodeId = payload.nodeId as string | undefined;

      switch (eventType) {
        case "EXECUTION_STARTED":
          get().updateExecution({ status: "running" });
          break;

        case "EXECUTION_COMPLETED":
          get().completeExecution("completed");
          break;

        case "EXECUTION_FAILED":
          get().completeExecution("failed");
          break;

        case "EXECUTION_CANCELLED":
          get().completeExecution("cancelled");
          break;

        case "NODE_QUEUED":
          if (nodeId) get().setNodeStatus(nodeId, "queued");
          break;

        case "NODE_RUNNING":
          if (nodeId) {
            get().setNodeStatus(nodeId, "running");
            get().updateNodeState(nodeId, {
              retryCount: (payload.retryCount as number) || 0,
            });
          }
          break;

        case "NODE_COMPLETED":
          if (nodeId) {
            get().setNodeStatus(nodeId, "completed");
          }
          break;

        case "NODE_FAILED":
          if (nodeId) {
            get().setNodeStatus(nodeId, "failed");
            get().updateNodeState(nodeId, {
              error: (payload.error as string) || "Unknown error",
            });
          }
          break;

        case "NODE_SKIPPED":
          if (nodeId) {
            get().setNodeStatus(nodeId, "skipped");
            get().updateNodeState(nodeId, {
              error: (payload.reason as string) || "Skipped",
            });
          }
          break;

        case "LOG_EMITTED":
          if (nodeId) {
            get().addLog({
              timestamp: event.timestamp,
              nodeId,
              level: (payload.level as "info" | "warn" | "error") || "info",
              message: (payload.message as string) || "",
            });
          }
          break;

        // Resume events (Phase 12.4)
        case "RESUME_START":
          set((state) => {
            state.resumeInfo = {
              parentExecutionId: (payload.parentExecutionId as string) || "",
              resumedFromNodeId: (payload.resumedFromNodeId as string) || "",
              skippedCount: (payload.skippedCount as number) || 0,
              rerunCount: (payload.rerunCount as number) || 0,
            };
          });
          get().addLog({
            timestamp: event.timestamp,
            nodeId: payload.resumedFromNodeId as string || "",
            level: "info",
            message: `Resumed from node (parent: ${payload.parentExecutionId})`,
          });
          break;

        case "NODE_OUTPUT_REUSED":
          if (nodeId) {
            set((state) => {
              state.reusedOutputNodes.add(nodeId);
            });
            get().addLog({
              timestamp: event.timestamp,
              nodeId,
              level: "info",
              message: `Output reused from ${payload.sourceExecutionId}`,
            });
          }
          break;

        case "RESUME_COMPLETE":
          set((state) => {
            state.isResuming = false;
          });
          get().addLog({
            timestamp: event.timestamp,
            nodeId: "",
            level: "info",
            message: `Resume completed with status: ${payload.status}`,
          });
          break;
      }
    },

    // Connection
    setConnected: (connected) =>
      set((state) => {
        state.isConnected = connected;
        if (connected) {
          state.connectionError = null;
        }
      }),

    setConnectionError: (error) =>
      set((state) => {
        state.connectionError = error;
        state.isConnected = false;
      }),

    // Resume (Phase 12.4)
    setResuming: (isResuming) =>
      set((state) => {
        state.isResuming = isResuming;
        if (!isResuming) {
          state.resumeInfo = null;
          state.reusedOutputNodes = new Set();
        }
      }),
  })),
);
