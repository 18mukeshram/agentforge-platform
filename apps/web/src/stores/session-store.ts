/**
 * Session store for user authentication state.
 * Manages current user session and role-based permissions.
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Role, User } from "@/types";

interface SessionState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface SessionActions {
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  clear: () => void;
}

export type SessionStore = SessionState & SessionActions;

const initialState: SessionState = {
  // Default to MEMBER role for demo (in production, would be loaded from JWT)
  user: {
    id: "demo-user",
    email: "demo@agentforge.io",
    name: "Demo User",
    role: "MEMBER" as Role,
    tenantId: "demo-tenant",
  },
  isAuthenticated: true,
  isLoading: false,
};

export const useSessionStore = create<SessionStore>()(
  immer((set) => ({
    ...initialState,

    setUser: (user) =>
      set((state) => {
        state.user = user;
        state.isAuthenticated = user !== null;
      }),

    setLoading: (loading) =>
      set((state) => {
        state.isLoading = loading;
      }),

    clear: () =>
      set((state) => {
        state.user = null;
        state.isAuthenticated = false;
      }),
  }))
);
