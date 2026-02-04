"use client";

/**
 * Main workflow canvas component using React Flow.
 */

import { useCallback, useRef, useEffect } from "react";
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
import { useCanvasStore, useWorkflowStore, useUiStore } from "@/stores";
import { useUpdateWorkflow, useValidateWorkflowPayload } from "@/hooks";
import { nodeTypes } from "./nodes";
import { getDefaultNodeConfig, getDefaultNodeLabel } from "./nodes/types";
import { edgeTypes, ConnectionLine, validateConnection } from "./edges";
import { toCanvasElements, fromCanvasElements } from "./utils";
import { Toolbar } from "./toolbar";
import { NodePalette } from "./node-palette";
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

  const { addNotification } = useUiStore();

  // Mutations
  const updateWorkflow = useUpdateWorkflow(workflow?.id ?? "");
  const validateWorkflow = useValidateWorkflowPayload();

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

  // Handle node changes
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
    },
    [onNodesChange],
  );

  // Handle edge changes
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
    },
    [onEdgesChange],
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

  // Handle new connections
  const handleConnect = useCallback(
    (connection: Connection) => {
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
    [nodes, edges, onConnect, addNotification],
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

  // Handle drop from node palette
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
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
    [addNode],
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

      {/* Canvas Toolbar */}
      <Toolbar onSave={handleSave} onValidate={handleValidate} />

      {/* Node Palette */}
      <NodePalette />
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
