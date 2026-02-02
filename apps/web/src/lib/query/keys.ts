/**
 * React Query cache keys.
 * Centralized key management for cache invalidation.
 */

export const queryKeys = {
  // Workflows
  workflows: {
    all: ["workflows"] as const,
    lists: () => [...queryKeys.workflows.all, "list"] as const,
    list: (params?: Record<string, unknown>) =>
      [...queryKeys.workflows.lists(), params] as const,
    details: () => [...queryKeys.workflows.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.workflows.details(), id] as const,
  },

  // Executions
  executions: {
    all: ["executions"] as const,
    lists: () => [...queryKeys.executions.all, "list"] as const,
    list: (workflowId: string, params?: Record<string, unknown>) =>
      [...queryKeys.executions.lists(), workflowId, params] as const,
    details: () => [...queryKeys.executions.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.executions.details(), id] as const,
    logs: (id: string, params?: Record<string, unknown>) =>
      [...queryKeys.executions.detail(id), "logs", params] as const,
  },

  // Validation
  validation: {
    all: ["validation"] as const,
    workflow: (id: string) => [...queryKeys.validation.all, id] as const,
  },
} as const;
