/**
 * API request/response types.
 * Mirrors backend DTOs.
 */

import type { WorkflowNode } from "./node";
import type { WorkflowEdge } from "./edge";
import type { WorkflowStatus } from "./workflow";
import type { ValidationError } from "./validation";

// ============================================
// Workflow API
// ============================================

export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  version: number;
}

export interface WorkflowResponse {
  id: string;
  status: WorkflowStatus;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  version: number;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  validationErrors: ValidationError[] | null;
}

export interface WorkflowListResponse {
  items: WorkflowSummaryResponse[];
  nextCursor: string | null;
}

export interface WorkflowSummaryResponse {
  id: string;
  name: string;
  status: WorkflowStatus;
  updatedAt: string;
  nodeCount: number;
}

// ============================================
// Validation API
// ============================================

export interface ValidateWorkflowRequest {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface ValidationResponse {
  valid: boolean;
  errors: ValidationError[];
  executionOrder: string[] | null;
}

// ============================================
// Execution API
// ============================================

export interface ExecuteWorkflowRequest {
  inputs: Record<string, unknown>;
}

export interface ExecutionTriggerResponse {
  executionId: string;
  status: string;
  workflowId: string;
  createdAt: string;
}

export interface ExecutionListResponse {
  items: ExecutionSummaryResponse[];
  nextCursor: string | null;
}

export interface ExecutionSummaryResponse {
  id: string;
  workflowId: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

// ============================================
// Error Response
// ============================================

export interface ApiErrorDetail {
  field: string | null;
  message: string;
  metadata: Record<string, unknown>;
}

export interface ApiErrorResponse {
  code: string;
  message: string;
  details: ApiErrorDetail[];
  requestId: string | null;
}
