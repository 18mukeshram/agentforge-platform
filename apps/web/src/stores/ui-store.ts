/**
 * UI state store.
 * Manages global UI state like sidebar, modals, and panels.
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

interface UiState {
  // Sidebar
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;

  // Panels
  nodePaletteOpen: boolean;
  propertiesPanelOpen: boolean;
  executionPanelOpen: boolean;
  executionHistoryOpen: boolean;

  // Modals
  activeModal: ModalType | null;
  modalData: Record<string, unknown>;

  // Notifications
  notifications: Notification[];
}

interface UiActions {
  // Sidebar
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Panels
  toggleNodePalette: () => void;
  togglePropertiesPanel: () => void;
  toggleExecutionPanel: () => void;
  toggleExecutionHistory: () => void;
  setNodePaletteOpen: (open: boolean) => void;
  setPropertiesPanelOpen: (open: boolean) => void;
  setExecutionPanelOpen: (open: boolean) => void;
  setExecutionHistoryOpen: (open: boolean) => void;

  // Modals
  openModal: (type: ModalType, data?: Record<string, unknown>) => void;
  closeModal: () => void;

  // Notifications
  addNotification: (notification: Omit<Notification, "id">) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

export type ModalType =
  | "create-workflow"
  | "delete-workflow"
  | "workflow-settings"
  | "execute-workflow"
  | "node-config"
  | "confirm";

export interface Notification {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
  duration?: number;
}

export type UiStore = UiState & UiActions;

const initialState: UiState = {
  sidebarOpen: true,
  sidebarCollapsed: false,
  nodePaletteOpen: true,
  propertiesPanelOpen: true,
  executionPanelOpen: false,
  executionHistoryOpen: false,
  activeModal: null,
  modalData: {},
  notifications: [],
};

export const useUiStore = create<UiStore>()(
  immer((set) => ({
    ...initialState,

    // Sidebar
    toggleSidebar: () =>
      set((state) => {
        state.sidebarOpen = !state.sidebarOpen;
      }),

    setSidebarOpen: (open) =>
      set((state) => {
        state.sidebarOpen = open;
      }),

    setSidebarCollapsed: (collapsed) =>
      set((state) => {
        state.sidebarCollapsed = collapsed;
      }),

    // Panels
    toggleNodePalette: () =>
      set((state) => {
        state.nodePaletteOpen = !state.nodePaletteOpen;
      }),

    togglePropertiesPanel: () =>
      set((state) => {
        state.propertiesPanelOpen = !state.propertiesPanelOpen;
      }),

    toggleExecutionPanel: () =>
      set((state) => {
        state.executionPanelOpen = !state.executionPanelOpen;
      }),

    toggleExecutionHistory: () =>
      set((state) => {
        state.executionHistoryOpen = !state.executionHistoryOpen;
      }),

    setNodePaletteOpen: (open) =>
      set((state) => {
        state.nodePaletteOpen = open;
      }),

    setPropertiesPanelOpen: (open) =>
      set((state) => {
        state.propertiesPanelOpen = open;
      }),

    setExecutionPanelOpen: (open) =>
      set((state) => {
        state.executionPanelOpen = open;
      }),

    setExecutionHistoryOpen: (open) =>
      set((state) => {
        state.executionHistoryOpen = open;
      }),

    // Modals
    openModal: (type, data = {}) =>
      set((state) => {
        state.activeModal = type;
        state.modalData = data;
      }),

    closeModal: () =>
      set((state) => {
        state.activeModal = null;
        state.modalData = {};
      }),

    // Notifications
    addNotification: (notification) =>
      set((state) => {
        const id = `notification-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        state.notifications.push({ ...notification, id });
      }),

    removeNotification: (id) =>
      set((state) => {
        state.notifications = state.notifications.filter((n) => n.id !== id);
      }),

    clearNotifications: () =>
      set((state) => {
        state.notifications = [];
      }),
  })),
);
