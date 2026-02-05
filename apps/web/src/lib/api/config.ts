/**
 * API configuration.
 */

export const API_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  wsUrl: process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000",
  timeout: 30000,
  retries: 3,
} as const;

/**
 * API endpoints.
 */
export const API_ENDPOINTS = {
  // Health
  health: "/health",
  ready: "/ready",

  // Workflows
  workflows: "/api/v1/workflows",
  workflow: (id: string) => `/api/v1/workflows/${id}`,
  validateWorkflow: (id: string) => `/api/v1/workflows/${id}/validate`,
  validatePayload: "/api/v1/workflows/validate",

  // Executions
  executions: "/api/v1/executions",
  execution: (id: string) => `/api/v1/executions/${id}`,
  executeWorkflow: (workflowId: string) =>
    `/api/v1/executions/workflows/${workflowId}/execute`,
  cancelExecution: (id: string) => `/api/v1/executions/${id}/cancel`,
  resumeExecution: (id: string) => `/api/v1/executions/${id}/resume`,
  executionLogs: (id: string) => `/api/v1/executions/${id}/logs`,

  // WebSocket
  wsExecutions: "/ws/executions",
} as const;
