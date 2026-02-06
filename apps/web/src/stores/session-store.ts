/**
 * Session store for user authentication state.
 * Manages current user session and role-based permissions.
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Role, User } from "@/types";

interface SessionState {
  user: User | null;
  token: string | null;  // JWT token
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface SessionActions {
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
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
  // Dev token for local development (valid for 1 year)
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZW1vLXVzZXIiLCJ0ZW5hbnRfaWQiOiJkZW1vLXRlbmFudCIsInJvbGUiOiJNRU1CRVIiLCJleHAiOjE4MDE4MzkyOTl9.gHQLU2Lkw0n8uFzPXRdDk9nj5umFc_M77gt8RBYmGOE",
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

    setToken: (token) =>
      set((state) => {
        state.token = token;
      }),

    setLoading: (loading) =>
      set((state) => {
        state.isLoading = loading;
      }),

    clear: () =>
      set((state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
      }),
  }))
);
