"use client";

/**
 * Main workflow canvas component using React Flow.
 */

import { useCallback, useRef, useEffect } from "react";
import ReactFlow, {
  Background,
  Controls,
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
import { nodeTypes } from "./nodes";
import { edgeTypes, ConnectionLine, validateConnection } from "./edges";
import { toCanvasElements, fromCanvasElements } from "./utils";
import { cn } from "@/lib/utils";

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
  } = useCanvasStore();

  const {
    workflow,
    setNodes: setWorkflowNodes,
    setEdges: setWorkflowEdges,
  } = useWorkflowStore();

  const { addNotification } = useUiStore();

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

  return (
    <div ref={containerRef} className={cn("h-full w-full", className)}>
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
        <Controls
          showZoom
          showFitView
          showInteractive={false}
          className="!shadow-md"
        />
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
          className="!bg-background !border-border"
        />
      </ReactFlow>
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
