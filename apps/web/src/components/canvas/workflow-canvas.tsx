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
  BackgroundVariant,
  ConnectionLineType,
} from "reactflow";
import { useCanvasStore, useWorkflowStore } from "@/stores";
import { nodeTypes } from "./nodes";
import {
  toCanvasElements,
  fromCanvasElements,
  isValidConnection,
} from "./utils";
import { cn } from "@/lib/utils";

interface WorkflowCanvasProps {
  className?: string;
}

function WorkflowCanvasInner({ className }: WorkflowCanvasProps) {
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { fitView } = useReactFlow();

  // Canvas store
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setViewport,
    selectedNodeIds,
    clearSelection,
  } = useCanvasStore();

  // Workflow store
  const {
    workflow,
    setNodes: setWorkflowNodes,
    setEdges: setWorkflowEdges,
  } = useWorkflowStore();

  // Sync workflow to canvas on load
  useEffect(() => {
    if (workflow) {
      const { nodes: canvasNodes, edges: canvasEdges } = toCanvasElements(
        workflow.nodes,
        workflow.edges,
      );
      setNodes(canvasNodes);
      setEdges(canvasEdges);

      // Fit view after a short delay to ensure nodes are rendered
      setTimeout(() => {
        fitView({ padding: 0.2 });
      }, 100);
    }
  }, [workflow, setNodes, setEdges, fitView]); // Include all dependencies

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

  // Handle new connections
  const handleConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        const validation = isValidConnection(
          connection.source,
          connection.target,
          edges,
        );

        if (validation.valid) {
          onConnect(connection);
        } else {
          // TODO: Show error notification
          console.warn("Invalid connection:", validation.reason);
        }
      }
    },
    [edges, onConnect],
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
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onPaneClick={handlePaneClick}
        onInit={handleInit}
        onMoveEnd={handleMoveEnd}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        defaultEdgeOptions={{
          type: "smoothstep",
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
        panOnDrag={[1, 2]} // Middle and right mouse button
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
