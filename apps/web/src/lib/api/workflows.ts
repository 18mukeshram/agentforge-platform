/**
 * Workflow API functions.
 */

import { apiClient } from "./client";
import { API_ENDPOINTS } from "./config";
import type {
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
  WorkflowResponse,
  WorkflowListResponse,
  ValidateWorkflowRequest,
  ValidationResponse,
} from "@/types";

export interface ListWorkflowsParams {
  [key: string]: string | number | boolean | undefined;
  status?: string;
  limit?: number;
  cursor?: string;
}

/**
 * List workflows.
 */
export async function listWorkflows(
  params?: ListWorkflowsParams,
): Promise<WorkflowListResponse> {
  return apiClient.get<WorkflowListResponse>(API_ENDPOINTS.workflows, {
    params,
  });
}

/**
 * Get a workflow by ID.
 */
export async function getWorkflow(id: string): Promise<WorkflowResponse> {
  return apiClient.get<WorkflowResponse>(API_ENDPOINTS.workflow(id));
}

/**
 * Create a new workflow.
 */
export async function createWorkflow(
  data: CreateWorkflowRequest,
): Promise<WorkflowResponse> {
  return apiClient.post<WorkflowResponse>(API_ENDPOINTS.workflows, data);
}

/**
 * Update a workflow.
 */
export async function updateWorkflow(
  id: string,
  data: UpdateWorkflowRequest,
): Promise<WorkflowResponse> {
  return apiClient.put<WorkflowResponse>(API_ENDPOINTS.workflow(id), data);
}

/**
 * Delete (archive) a workflow.
 */
export async function deleteWorkflow(
  id: string,
): Promise<{ id: string; status: string }> {
  return apiClient.delete<{ id: string; status: string }>(
    API_ENDPOINTS.workflow(id),
  );
}

/**
 * Validate a persisted workflow.
 */
export async function validateWorkflow(
  id: string,
): Promise<ValidationResponse> {
  return apiClient.post<ValidationResponse>(API_ENDPOINTS.validateWorkflow(id));
}

/**
 * Validate a workflow payload without persisting.
 */
export async function validateWorkflowPayload(
  data: ValidateWorkflowRequest,
): Promise<ValidationResponse> {
  return apiClient.post<ValidationResponse>(
    API_ENDPOINTS.validatePayload,
    data,
  );
}
