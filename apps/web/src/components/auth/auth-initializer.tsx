"use client";

import { useEffect } from "react";
import { configureApiClient } from "@/lib/api/client";
import { useSessionStore } from "@/stores";

/**
 * Initializes authentication configuration for the API client.
 * Must be a client component to access the session store.
 */
export function AuthInitializer() {
  useEffect(() => {
    // Configure API client to use session token
    configureApiClient({
      getToken: () => useSessionStore.getState().token,
      onUnauthorized: () => {
        useSessionStore.getState().clear();
      },
    });
  }, []);

  return null;
}
