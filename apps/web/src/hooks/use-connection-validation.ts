/**
 * Hook for real-time connection validation.
 */

import { useCallback } from "react";
import { useCanvasStore } from "@/stores";
import {
  validateConnection,
  canAcceptConnection,
  canCreateConnection,
} from "@/components/canvas/edges";
import type { ConnectionValidation } from "@/components/canvas/edges";

export function useConnectionValidation() {
  const { nodes, edges } = useCanvasStore();

  /**
   * Validate a potential connection.
   */
  const validate = useCallback(
    (
      sourceId: string,
      targetId: string,
      sourceHandle?: string | null,
      targetHandle?: string | null,
    ): ConnectionValidation => {
      return validateConnection(
        sourceId,
        targetId,
        sourceHandle || null,
        targetHandle || null,
        nodes,
        edges,
      );
    },
    [nodes, edges],
  );

  /**
   * Check if a node can receive a new connection.
   */
  const canReceive = useCallback(
    (nodeId: string, maxConnections?: number): boolean => {
      return canAcceptConnection(nodeId, nodes, edges, maxConnections);
    },
    [nodes, edges],
  );

  /**
   * Check if a node can create a new outgoing connection.
   */
  const canSend = useCallback(
    (nodeId: string, maxConnections?: number): boolean => {
      return canCreateConnection(nodeId, nodes, edges, maxConnections);
    },
    [nodes, edges],
  );

  return {
    validate,
    canReceive,
    canSend,
  };
}
