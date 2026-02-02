/**
 * WebSocket event types.
 * Mirrors backend: agentforge_api/realtime/events.py
 */

/**
 * Types of real-time events.
 */
export type EventType =
  // Execution lifecycle
  | "EXECUTION_STARTED"
  | "EXECUTION_COMPLETED"
  | "EXECUTION_FAILED"
  | "EXECUTION_CANCELLED"
  // Node lifecycle
  | "NODE_QUEUED"
  | "NODE_RUNNING"
  | "NODE_COMPLETED"
  | "NODE_FAILED"
  | "NODE_SKIPPED"
  | "NODE_CACHE_HIT"
  // Logging
  | "LOG_EMITTED"
  // Connection
  | "CONNECTED"
  | "ACK"
  | "ERROR";

/**
 * Base event structure from WebSocket.
 */
export interface ExecutionEvent {
  event: EventType;
  executionId: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

/**
 * Client-to-server message.
 */
export interface SubscribeMessage {
  action: "subscribe";
  executionId: string;
}

export interface UnsubscribeMessage {
  action: "unsubscribe";
  executionId: string;
}

export type ClientMessage = SubscribeMessage | UnsubscribeMessage;

/**
 * Connection acknowledgment.
 */
export interface ConnectedEvent {
  event: "CONNECTED";
  connectionId: string;
  userId: string;
  tenantId: string;
  role: string;
  message: string;
}
