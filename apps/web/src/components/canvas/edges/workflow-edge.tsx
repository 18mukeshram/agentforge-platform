"use client";

/**
 * Custom edge component with execution status visualization.
 */

import { memo, useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useReactFlow,
} from "reactflow";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/stores";
import type { WorkflowEdgeProps } from "./types";

export const WorkflowEdge = memo(function WorkflowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
  markerEnd,
}: WorkflowEdgeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { removeEdge } = useCanvasStore();
  const { setEdges } = useReactFlow();

  // Calculate edge path
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  // Determine edge style based on state
  const getEdgeStyle = () => {
    if (data?.executionStatus === "active") {
      return {
        stroke: "hsl(221, 83%, 53%)", // blue-600
        strokeWidth: 2,
        animation: "flowAnimation 1s linear infinite",
      };
    }
    if (data?.executionStatus === "completed") {
      return {
        stroke: "hsl(142, 76%, 36%)", // green-600
        strokeWidth: 2,
      };
    }
    if (data?.executionStatus === "failed") {
      return {
        stroke: "hsl(0, 84%, 60%)", // red-500
        strokeWidth: 2,
      };
    }
    if (!data?.isValid) {
      return {
        stroke: "hsl(0, 84%, 60%)", // red-500
        strokeWidth: 2,
        strokeDasharray: "5,5",
      };
    }
    if (selected) {
      return {
        stroke: "hsl(var(--primary))",
        strokeWidth: 2,
      };
    }
    if (isHovered) {
      return {
        stroke: "hsl(var(--primary))",
        strokeWidth: 2,
        opacity: 0.8,
      };
    }
    return {
      stroke: "hsl(var(--border))",
      strokeWidth: 2,
    };
  };

  const handleDelete = () => {
    removeEdge(id);
    setEdges((edges) => edges.filter((e) => e.id !== id));
  };

  return (
    <>
      {/* Invisible wider path for easier hover/selection */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="cursor-pointer"
      />

      {/* Visible edge */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...getEdgeStyle(),
          transition: "all 0.2s",
        }}
      />

      {/* Edge label/delete button on hover or select */}
      {(isHovered || selected) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className="nodrag nopan"
          >
            <button
              onClick={handleDelete}
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full",
                "bg-destructive text-destructive-foreground",
                "text-xs font-medium shadow-sm",
                "hover:bg-destructive/90 transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-destructive/50",
              )}
              title="Delete connection"
            >
              ×
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});
