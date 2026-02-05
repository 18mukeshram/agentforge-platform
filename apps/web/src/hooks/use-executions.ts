/**
 * React Query hooks for executions.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import {
  listExecutions,
  listAllExecutions,
  getExecution,
  executeWorkflow,
  cancelExecution,
  getExecutionLogs,
  type ListExecutionsParams,
  type ListAllExecutionsParams,
  type GetExecutionLogsParams,
} from "@/lib/api";
import type { ExecuteWorkflowRequest } from "@/types";

/**
 * Hook to fetch executions for a workflow.
 */
export function useExecutions(params: ListExecutionsParams) {
  return useQuery({
    queryKey: queryKeys.executions.list(
      params.workflowId,
      params as unknown as Record<string, unknown>,
    ),
    queryFn: () => listExecutions(params),
    enabled: !!params.workflowId,
  });
}

/**
 * Hook to fetch all executions with pagination.
 */
export function useAllExecutions(params?: ListAllExecutionsParams) {
  return useQuery({
    queryKey: ["executions", "all", params],
    queryFn: () => listAllExecutions(params),
  });
}

/**
 * Hook to fetch a single execution.
 */
export function useExecution(
  id: string | undefined,
  options?: { refetchInterval?: number },
) {
  return useQuery({
    queryKey: queryKeys.executions.detail(id!),
    queryFn: () => getExecution(id!),
    enabled: !!id,
    refetchInterval: options?.refetchInterval,
  });
}

/**
 * Hook to fetch execution logs.
 */
export function useExecutionLogs(
  id: string | undefined,
  params?: GetExecutionLogsParams,
) {
  return useQuery({
    queryKey: queryKeys.executions.logs(
      id!,
      params as unknown as Record<string, unknown>,
    ),
    queryFn: () => getExecutionLogs(id!, params),
    enabled: !!id,
  });
}

/**
 * Hook to trigger workflow execution.
 */
export function useExecuteWorkflow(workflowId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ExecuteWorkflowRequest) =>
      executeWorkflow(workflowId, data),
    onSuccess: () => {
      // Invalidate executions list
      queryClient.invalidateQueries({
        queryKey: queryKeys.executions.list(workflowId),
      });
    },
  });
}

/**
 * Hook to cancel an execution.
 */
export function useCancelExecution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => cancelExecution(id),
    onSuccess: (_, id) => {
      // Refetch execution to get updated status
      queryClient.invalidateQueries({
        queryKey: queryKeys.executions.detail(id),
      });
    },
  });
}
