/**
 * Execution API functions.
 */

import { apiClient } from "./client";
import { API_ENDPOINTS } from "./config";
import type {
  ExecuteWorkflowRequest,
  ExecutionTriggerResponse,
  ExecutionListResponse,
} from "@/types";
import type { Execution } from "@/types";

export interface ListExecutionsParams {
  workflowId: string;
  limit?: number;
  cursor?: string;
}

export interface GetExecutionLogsParams {
  nodeId?: string;
  level?: string;
  limit?: number;
  cursor?: string;
}

export interface ExecutionLogsResponse {
  items: {
    timestamp: string;
    nodeId: string;
    level: string;
    message: string;
  }[];
  nextCursor: string | null;
}

/**
 * List executions for a workflow.
 */
export async function listExecutions(
  params: ListExecutionsParams,
): Promise<ExecutionListResponse> {
  return apiClient.get<ExecutionListResponse>(API_ENDPOINTS.executions, {
    params: {
      workflow_id: params.workflowId,
      limit: params.limit,
      cursor: params.cursor,
    },
  });
}

/**
 * Params for listing all executions.
 */
export interface ListAllExecutionsParams {
  workflowId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

/**
 * List all executions with pagination (offset-based).
 */
export async function listAllExecutions(
  params?: ListAllExecutionsParams,
): Promise<ExecutionListResponse> {
  return apiClient.get<ExecutionListResponse>(API_ENDPOINTS.executions, {
    params: {
      workflow_id: params?.workflowId,
      status: params?.status,
      limit: params?.limit,
      offset: params?.offset,
    },
  });
}

/**
 * Get an execution by ID.
 */
export async function getExecution(id: string): Promise<Execution> {
  return apiClient.get<Execution>(API_ENDPOINTS.execution(id));
}

/**
 * Trigger workflow execution.
 */
export async function executeWorkflow(
  workflowId: string,
  data: ExecuteWorkflowRequest,
): Promise<ExecutionTriggerResponse> {
  return apiClient.post<ExecutionTriggerResponse>(
    API_ENDPOINTS.executeWorkflow(workflowId),
    data,
  );
}

/**
 * Cancel an execution.
 */
export async function cancelExecution(
  id: string,
): Promise<{ id: string; status: string }> {
  return apiClient.post<{ id: string; status: string }>(
    API_ENDPOINTS.cancelExecution(id),
  );
}

/**
 * Get execution logs.
 */
export async function getExecutionLogs(
  id: string,
  params?: GetExecutionLogsParams,
): Promise<ExecutionLogsResponse> {
  return apiClient.get<ExecutionLogsResponse>(API_ENDPOINTS.executionLogs(id), {
    params: {
      node_id: params?.nodeId,
      level: params?.level,
      limit: params?.limit,
      cursor: params?.cursor,
    },
  });
}

/**
 * Resume execution request.
 */
export interface ResumeExecutionRequest {
  nodeId: string;
}

/**
 * Resume execution response.
 */
export interface ResumeExecutionResponse {
  executionId: string;
  parentExecutionId: string;
  resumedFromNodeId: string;
  workflowId: string;
  workflowVersion: number;
  skippedNodes: string[];
  rerunNodes: string[];
  status: string;
}

/**
 * Resume a failed execution from a specific node.
 */
export async function resumeExecution(
  id: string,
  data: ResumeExecutionRequest,
): Promise<ResumeExecutionResponse> {
  return apiClient.post<ResumeExecutionResponse>(
    API_ENDPOINTS.resumeExecution(id),
    { node_id: data.nodeId },
  );
}
