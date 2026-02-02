/**
 * React Query hooks for workflows.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import {
  listWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  validateWorkflow,
  validateWorkflowPayload,
  type ListWorkflowsParams,
} from "@/lib/api";
import type {
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
  ValidateWorkflowRequest,
} from "@/types";

/**
 * Hook to fetch workflow list.
 */
export function useWorkflows(params?: ListWorkflowsParams) {
  return useQuery({
    queryKey: queryKeys.workflows.list(params as unknown as Record<string, unknown>),
    queryFn: () => listWorkflows(params),
  });
}

/**
 * Hook to fetch a single workflow.
 */
export function useWorkflow(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.workflows.detail(id!),
    queryFn: () => getWorkflow(id!),
    enabled: !!id,
  });
}

/**
 * Hook to create a workflow.
 */
export function useCreateWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateWorkflowRequest) => createWorkflow(data),
    onSuccess: () => {
      // Invalidate workflow list
      queryClient.invalidateQueries({
        queryKey: queryKeys.workflows.lists(),
      });
    },
  });
}

/**
 * Hook to update a workflow.
 */
export function useUpdateWorkflow(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateWorkflowRequest) => updateWorkflow(id, data),
    onSuccess: (data) => {
      // Update cache with new data
      queryClient.setQueryData(queryKeys.workflows.detail(id), data);
      // Invalidate list
      queryClient.invalidateQueries({
        queryKey: queryKeys.workflows.lists(),
      });
    },
  });
}

/**
 * Hook to delete a workflow.
 */
export function useDeleteWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteWorkflow(id),
    onSuccess: (_, id) => {
      // Remove from cache
      queryClient.removeQueries({
        queryKey: queryKeys.workflows.detail(id),
      });
      // Invalidate list
      queryClient.invalidateQueries({
        queryKey: queryKeys.workflows.lists(),
      });
    },
  });
}

/**
 * Hook to validate a persisted workflow.
 */
export function useValidateWorkflow(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => validateWorkflow(id),
    onSuccess: () => {
      // Refetch workflow to get updated status
      queryClient.invalidateQueries({
        queryKey: queryKeys.workflows.detail(id),
      });
    },
  });
}

/**
 * Hook to validate a workflow payload.
 */
export function useValidateWorkflowPayload() {
  return useMutation({
    mutationFn: (data: ValidateWorkflowRequest) =>
      validateWorkflowPayload(data),
  });
}
