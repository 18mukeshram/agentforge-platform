"use client";

import { useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useWorkflow, useUpdateWorkflow, useExecuteWorkflow } from "@/hooks";
import { useWorkflowStore, useUiStore } from "@/stores";
import { WorkflowCanvas } from "@/components/canvas/workflow-canvas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function WorkflowEditorPage() {
  const params = useParams();
  const workflowId = params.id as string;

  // Fetch workflow data
  const { data: workflowData, isLoading, error } = useWorkflow(workflowId);

  // Workflow store
  const { workflow, setWorkflow, setLoading, setError, isDirty, isSaving, setSaving, setLastSavedAt } =
    useWorkflowStore();

  // UI store for notifications
  const { addNotification, setExecutionPanelOpen } = useUiStore();

  // Mutations
  const updateWorkflow = useUpdateWorkflow(workflowId);
  const executeWorkflow = useExecuteWorkflow(workflowId);

  // Sync fetched data to store
  useEffect(() => {
    if (workflowData) {
      setWorkflow({
        id: workflowData.id,
        status: workflowData.status,
        meta: {
          name: workflowData.name,
          description: workflowData.description,
          createdAt: workflowData.createdAt,
          updatedAt: workflowData.updatedAt,
          ownerId: workflowData.ownerId,
          version: workflowData.version,
        },
        nodes: workflowData.nodes,
        edges: workflowData.edges,
      });
    }
  }, [workflowData, setWorkflow]);

  // Handle loading and error states
  useEffect(() => {
    setLoading(isLoading);
    if (error) {
      setError(
        error instanceof Error ? error.message : "Failed to load workflow",
      );
    }
  }, [isLoading, error, setLoading, setError]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!workflow || !isDirty) return;

    setSaving(true);
    try {
      await updateWorkflow.mutateAsync({
        nodes: workflow.nodes,
        edges: workflow.edges,
        version: workflow.meta.version,
      });
      setLastSavedAt(new Date().toISOString());
      addNotification({
        type: "success",
        title: "Workflow Saved",
        message: "Your changes have been saved successfully.",
        duration: 3000,
      });
    } catch (err) {
      addNotification({
        type: "error",
        title: "Save Failed",
        message: err instanceof Error ? err.message : "Failed to save workflow",
        duration: 5000,
      });
    } finally {
      setSaving(false);
    }
  }, [workflow, isDirty, setSaving, updateWorkflow, setLastSavedAt, addNotification]);

  // Handle run
  const handleRun = useCallback(async () => {
    if (!workflow || workflow.status !== "valid") return;

    try {
      const result = await executeWorkflow.mutateAsync({ inputs: {} });
      // Set active execution ID to trigger WebSocket connection
      setExecutionPanelOpen(true);
      addNotification({
        type: "success",
        title: "Execution Started",
        message: `Execution ${result.executionId.slice(0, 8)}... has begun.`,
        duration: 3000,
      });
    } catch (err) {
      addNotification({
        type: "error",
        title: "Execution Failed",
        message: err instanceof Error ? err.message : "Failed to start execution",
        duration: 5000,
      });
    }
  }, [workflow, executeWorkflow, setExecutionPanelOpen, addNotification]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading workflow...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !workflow) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Failed to load workflow</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Editor Header */}
      <div className="flex items-center justify-between border-b bg-background px-4 py-2">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">{workflow.meta.name}</h1>
          <Badge
            variant={workflow.status === "valid" ? "default" : "secondary"}
          >
            {workflow.status}
          </Badge>
          {isDirty && (
            <Badge variant="outline" className="text-yellow-600">
              Unsaved changes
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!isDirty || isSaving}
            onClick={handleSave}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
          <Button
            size="sm"
            disabled={workflow.status !== "valid" || executeWorkflow.isPending}
            onClick={handleRun}
          >
            {executeWorkflow.isPending ? "Starting..." : "Run"}
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1">
        <WorkflowCanvas className="h-full" />
      </div>
    </div>
  );
}
