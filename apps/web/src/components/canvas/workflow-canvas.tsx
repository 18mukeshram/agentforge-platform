"use client";

/**
 * Main workflow canvas component using React Flow.
 */

import { useCallback, useRef, useEffect, useMemo } from "react";
import ReactFlow, {
  Background,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  type ReactFlowInstance,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type IsValidConnection,
  BackgroundVariant,
  ConnectionLineType,
} from "reactflow";
import { useCanvasStore, useWorkflowStore, useUiStore, useExecutionStore } from "@/stores";
import { useUpdateWorkflow, useValidateWorkflowPayload, useExecuteWorkflow } from "@/hooks";
import { usePermissions } from "@/lib/permissions";
import { nodeTypes } from "./nodes";
import { getDefaultNodeConfig, getDefaultNodeLabel } from "./nodes/types";
import { edgeTypes, ConnectionLine, validateConnection } from "./edges";
import { toCanvasElements, fromCanvasElements } from "./utils";
import { Toolbar } from "./toolbar";
import { NodePalette } from "./node-palette";
import { ExecutionLogsPanel } from "./execution-logs-panel";
import { ExecutionHistoryPanel } from "@/components/executions";
import { cn } from "@/lib/utils";
import type { NodeType } from "@/types";

interface WorkflowCanvasProps {
  className?: string;
}

function WorkflowCanvasInner({ className }: WorkflowCanvasProps) {
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { fitView } = useReactFlow();

  // Stores
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setViewport,
    clearSelection,
    addNode,
  } = useCanvasStore();

  const {
    workflow,
    setNodes: setWorkflowNodes,
    setEdges: setWorkflowEdges,
    setSaving,
    setLastSavedAt,
    setValidating,
    setValidationResult,
    validationErrors,
  } = useWorkflowStore();

  const { addNotification, setExecutionPanelOpen } = useUiStore();

  // Execution store
  const { startExecution } = useExecutionStore();

  // Mutations
  const updateWorkflow = useUpdateWorkflow(workflow?.id ?? "");
  const validateWorkflow = useValidateWorkflowPayload();
  const executeWorkflow = useExecuteWorkflow(workflow?.id ?? "");

  // Permission check for read-only mode (Phase 13.4)
  const { role, canWrite } = usePermissions();
  const isReadOnlyMode = !canWrite();

  // Sync workflow to canvas on load
  useEffect(() => {
    if (workflow) {
      const { nodes: canvasNodes, edges: canvasEdges } = toCanvasElements(
        workflow.nodes,
        workflow.edges,
      );
      setNodes(canvasNodes);
      setEdges(canvasEdges);

      setTimeout(() => {
        fitView({ padding: 0.2 });
      }, 100);
    }
  }, [workflow, setNodes, setEdges, fitView]);

  // Sync canvas changes back to workflow store
  useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) {
      const { nodes: workflowNodes, edges: workflowEdges } = fromCanvasElements(
        nodes,
        edges,
      );
      setWorkflowNodes(workflowNodes);
      setWorkflowEdges(workflowEdges);
    }
  }, [nodes, edges, setWorkflowNodes, setWorkflowEdges]);

  // Handle save workflow
  const handleSave = useCallback(async () => {
    if (!workflow) return;

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
    } catch (error) {
      addNotification({
        type: "error",
        title: "Save Failed",
        message: error instanceof Error ? error.message : "Failed to save workflow",
        duration: 5000,
      });
      setSaving(false);
    }
  }, [workflow, updateWorkflow, setSaving, setLastSavedAt, addNotification]);

  // Handle validate workflow
  const handleValidate = useCallback(async () => {
    if (!workflow) return;

    setValidating(true);
    try {
      const result = await validateWorkflow.mutateAsync({
        nodes: workflow.nodes,
        edges: workflow.edges,
      });

      setValidationResult(result.errors, result.executionOrder);

      // Map validation errors to canvas nodes
      const errorsByNodeId = new Map<string, string[]>();
      for (const error of result.errors) {
        for (const nodeId of error.nodeIds) {
          const existing = errorsByNodeId.get(nodeId) || [];
          errorsByNodeId.set(nodeId, [...existing, error.message]);
        }
      }

      // Update canvas nodes with validation errors
      setNodes(
        nodes.map((node) => ({
          ...node,
          data: {
            ...node.data,
            validationErrors: errorsByNodeId.get(node.id) || [],
            isValid: !errorsByNodeId.has(node.id),
          },
        }))
      );

      if (result.valid) {
        addNotification({
          type: "success",
          title: "Validation Passed",
          message: "Workflow is valid and ready for execution.",
          duration: 3000,
        });
      } else {
        addNotification({
          type: "warning",
          title: "Validation Failed",
          message: `Found ${result.errors.length} validation error(s).`,
          duration: 5000,
        });
      }
    } catch (error) {
      addNotification({
        type: "error",
        title: "Validation Error",
        message: error instanceof Error ? error.message : "Failed to validate workflow",
        duration: 5000,
      });
      setValidating(false);
    }
  }, [workflow, validateWorkflow, setValidating, setValidationResult, setNodes, nodes, addNotification]);

  // Handle run workflow
  const handleRun = useCallback(async () => {
    if (!workflow || workflow.status !== "valid") {
      addNotification({
        type: "warning",
        title: "Cannot Run",
        message: "Please validate the workflow first.",
        duration: 3000,
      });
      return;
    }

    try {
      const result = await executeWorkflow.mutateAsync({
        inputs: {},
      });

      // Start execution in store
      startExecution({
        id: result.executionId,
        workflowId: result.workflowId,
        status: "pending",
        workflowVersion: workflow.meta.version,
        triggeredBy: "user",
        createdAt: result.createdAt,
        startedAt: null,
        completedAt: null,
        nodeStates: [],
        inputs: {},
        outputs: null,
      });

      // Open execution logs panel
      setExecutionPanelOpen(true);

      addNotification({
        type: "success",
        title: "Execution Started",
        message: `Execution ${result.executionId.slice(0, 8)}... has been started.`,
        duration: 3000,
      });
    } catch (error) {
      addNotification({
        type: "error",
        title: "Execution Failed",
        message: error instanceof Error ? error.message : "Failed to start execution",
        duration: 5000,
      });
    }
  }, [workflow, executeWorkflow, startExecution, setExecutionPanelOpen, addNotification]);

  // Handle node changes (disabled in read-only mode for position/remove)
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (isReadOnlyMode) {
        // Only allow selection changes in read-only mode
        const allowedChanges = changes.filter((c) => c.type === "select");
        if (allowedChanges.length > 0) {
          onNodesChange(allowedChanges);
        }
        return;
      }
      onNodesChange(changes);
    },
    [onNodesChange, isReadOnlyMode],
  );

  // Handle edge changes (disabled in read-only mode)
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (isReadOnlyMode) {
        // Only allow selection changes in read-only mode  
        const allowedChanges = changes.filter((c) => c.type === "select");
        if (allowedChanges.length > 0) {
          onEdgesChange(allowedChanges);
        }
        return;
      }
      onEdgesChange(changes);
    },
    [onEdgesChange, isReadOnlyMode],
  );

  // Validate connection before allowing it
  const isValidConnection: IsValidConnection = useCallback(
    (connection: Connection | any) => {
      if (!connection.source || !connection.target) return false;

      const validation = validateConnection(
        connection.source,
        connection.target,
        connection.sourceHandle || null,
        connection.targetHandle || null,
        nodes,
        edges,
      );

      return validation.valid;
    },
    [nodes, edges],
  );

  // Handle new connections (disabled in read-only mode)
  const handleConnect = useCallback(
    (connection: Connection) => {
      if (isReadOnlyMode) return; // Prevent connections in read-only mode
      
      if (!connection.source || !connection.target) return;

      const validation = validateConnection(
        connection.source,
        connection.target,
        connection.sourceHandle,
        connection.targetHandle,
        nodes,
        edges,
      );

      if (validation.valid) {
        onConnect(connection);
      } else {
        addNotification({
          type: "error",
          title: "Invalid Connection",
          message: validation.reason || "Cannot create this connection",
          duration: 3000,
        });
      }
    },
    [nodes, edges, onConnect, addNotification, isReadOnlyMode],
  );

  // Handle click on canvas background
  const handlePaneClick = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  // Handle React Flow initialization
  const handleInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance;
  }, []);

  // Handle viewport changes
  const handleMoveEnd = useCallback(
    (_: unknown, viewport: { x: number; y: number; zoom: number }) => {
      setViewport(viewport);
    },
    [setViewport],
  );

  // Handle drag over for node palette drops
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // Handle drop from node palette (disabled in read-only mode)
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      if (isReadOnlyMode) return; // Prevent drops in read-only mode
      
      event.preventDefault();

      const nodeType = event.dataTransfer.getData("application/reactflow-nodetype") as NodeType;
      if (!nodeType || !reactFlowInstance.current) return;

      // Get drop position in flow coordinates
      const position = reactFlowInstance.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Snap to grid
      const snappedPosition = {
        x: Math.round(position.x / 16) * 16,
        y: Math.round(position.y / 16) * 16,
      };

      // Create new node
      const newNode = {
        id: `${nodeType}-${Date.now()}`,
        type: nodeType,
        position: snappedPosition,
        data: {
          label: getDefaultNodeLabel(nodeType),
          config: getDefaultNodeConfig(nodeType),
        },
      };

      addNode(newNode);
    },
    [addNode, isReadOnlyMode],
  );

  return (
    <div
      ref={containerRef}
      className={cn("relative h-full w-full", className)}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onPaneClick={handlePaneClick}
        onInit={handleInit}
        onMoveEnd={handleMoveEnd}
        isValidConnection={isValidConnection}
        connectionLineComponent={ConnectionLine}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        defaultEdgeOptions={{
          type: "workflow",
          animated: false,
        }}
        connectionLineType={ConnectionLineType.SmoothStep}
        snapToGrid
        snapGrid={[16, 16]}
        minZoom={0.1}
        maxZoom={2}
        deleteKeyCode={["Backspace", "Delete"]}
        multiSelectionKeyCode={["Shift", "Meta"]}
        panOnScroll
        selectionOnDrag
        panOnDrag={[1, 2]}
        selectNodesOnDrag={false}
        elevateNodesOnSelect
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          className="!bg-muted/30"
        />
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
          className="!bg-background !border-border"
        />
      </ReactFlow>

      {/* Read-Only Mode Badge (Phase 13.4) */}
      {isReadOnlyMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-2 rounded-full bg-amber-100 border border-amber-300 px-4 py-1.5 text-sm font-medium text-amber-800 shadow-sm">
            <EyeIcon className="h-4 w-4" />
            Read-only mode (Viewer role)
          </div>
        </div>
      )}

      {/* Canvas Toolbar */}
      <Toolbar onSave={handleSave} onValidate={handleValidate} onRun={handleRun} isReadOnly={isReadOnlyMode} />

      {/* Node Palette (hidden in read-only mode) */}
      {!isReadOnlyMode && <NodePalette />}

      {/* Execution Logs Panel */}
      <ExecutionLogsPanel />

      {/* Execution History Panel */}
      <ExecutionHistoryPanel />
    </div>
  );
}

/**
 * Workflow canvas with React Flow provider.
 */
export function WorkflowCanvas({ className }: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner className={className} />
    </ReactFlowProvider>
  );
}
