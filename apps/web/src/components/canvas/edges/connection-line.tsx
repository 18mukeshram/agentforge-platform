"use client";

/**
 * Custom connection line shown while dragging to create a connection.
 */

import { memo } from "react";
import { getSmoothStepPath } from "reactflow";
import type { ConnectionLineComponentProps } from "reactflow";

export const ConnectionLine = memo(function ConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
  connectionStatus,
}: ConnectionLineComponentProps) {
  const [path] = getSmoothStepPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
    borderRadius: 8,
  });

  // Style based on connection validity
  const isValid = connectionStatus === "valid";

  return (
    <g>
      {/* Drop shadow */}
      <path
        d={path}
        fill="none"
        stroke="rgba(0,0,0,0.1)"
        strokeWidth={4}
        strokeLinecap="round"
      />
      {/* Main line */}
      <path
        d={path}
        fill="none"
        stroke={
          isValid ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"
        }
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={isValid ? "none" : "5,5"}
        className="animate-pulse"
      />
      {/* Target indicator */}
      <circle
        cx={toX}
        cy={toY}
        r={4}
        fill={isValid ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
        className="animate-pulse"
      />
    </g>
  );
});
