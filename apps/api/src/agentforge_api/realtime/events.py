# apps/api/src/agentforge_api/realtime/events.py

"""
Event definitions for real-time streaming.

These events are emitted by the execution engine and
consumed by the WebSocket layer.
"""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class EventType(str, Enum):
    """Types of real-time events."""
    
    # Execution lifecycle
    EXECUTION_STARTED = "EXECUTION_STARTED"
    EXECUTION_COMPLETED = "EXECUTION_COMPLETED"
    EXECUTION_FAILED = "EXECUTION_FAILED"
    EXECUTION_CANCELLED = "EXECUTION_CANCELLED"
    
    # Node lifecycle
    NODE_QUEUED = "NODE_QUEUED"
    NODE_RUNNING = "NODE_RUNNING"
    NODE_COMPLETED = "NODE_COMPLETED"
    NODE_FAILED = "NODE_FAILED"
    NODE_SKIPPED = "NODE_SKIPPED"
    
    # Cache events
    NODE_CACHE_HIT = "NODE_CACHE_HIT"
    
    # Logging
    LOG_EMITTED = "LOG_EMITTED"


class ExecutionEvent(BaseModel):
    """
    Base event for all real-time events.
    
    Immutable and JSON-serializable for WebSocket transmission.
    """
    
    event_type: EventType
    execution_id: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now())
    payload: dict[str, Any] = Field(default_factory=dict)
    
    def to_message(self) -> dict:
        """Convert to WebSocket message format."""
        return {
            "event": self.event_type.value,
            "executionId": self.execution_id,
            "timestamp": self.timestamp.isoformat(),
            "payload": self.payload,
        }


# === Event Factory Functions ===


def execution_started(
    execution_id: str,
    workflow_id: str,
    node_count: int,
) -> ExecutionEvent:
    """Create EXECUTION_STARTED event."""
    return ExecutionEvent(
        event_type=EventType.EXECUTION_STARTED,
        execution_id=execution_id,
        payload={
            "workflowId": workflow_id,
            "nodeCount": node_count,
        },
    )


def execution_completed(
    execution_id: str,
    duration_ms: int,
) -> ExecutionEvent:
    """Create EXECUTION_COMPLETED event."""
    return ExecutionEvent(
        event_type=EventType.EXECUTION_COMPLETED,
        execution_id=execution_id,
        payload={
            "durationMs": duration_ms,
        },
    )


def execution_failed(
    execution_id: str,
    error: str,
) -> ExecutionEvent:
    """Create EXECUTION_FAILED event."""
    return ExecutionEvent(
        event_type=EventType.EXECUTION_FAILED,
        execution_id=execution_id,
        payload={
            "error": error,
        },
    )


def execution_cancelled(
    execution_id: str,
) -> ExecutionEvent:
    """Create EXECUTION_CANCELLED event."""
    return ExecutionEvent(
        event_type=EventType.EXECUTION_CANCELLED,
        execution_id=execution_id,
        payload={},
    )


def node_queued(
    execution_id: str,
    node_id: str,
) -> ExecutionEvent:
    """Create NODE_QUEUED event."""
    return ExecutionEvent(
        event_type=EventType.NODE_QUEUED,
        execution_id=execution_id,
        payload={
            "nodeId": node_id,
        },
    )


def node_running(
    execution_id: str,
    node_id: str,
    retry_count: int = 0,
) -> ExecutionEvent:
    """Create NODE_RUNNING event."""
    return ExecutionEvent(
        event_type=EventType.NODE_RUNNING,
        execution_id=execution_id,
        payload={
            "nodeId": node_id,
            "retryCount": retry_count,
        },
    )


def node_completed(
    execution_id: str,
    node_id: str,
    duration_ms: int,
    output_summary: str | None = None,
    cached: bool = False,
) -> ExecutionEvent:
    """Create NODE_COMPLETED event."""
    return ExecutionEvent(
        event_type=EventType.NODE_COMPLETED,
        execution_id=execution_id,
        payload={
            "nodeId": node_id,
            "durationMs": duration_ms,
            "outputSummary": output_summary,
            "cached": cached,
        },
    )


def node_cache_hit(
    execution_id: str,
    node_id: str,
    original_duration_ms: int,
) -> ExecutionEvent:
    """Create NODE_CACHE_HIT event."""
    return ExecutionEvent(
        event_type=EventType.NODE_CACHE_HIT,
        execution_id=execution_id,
        payload={
            "nodeId": node_id,
            "originalDurationMs": original_duration_ms,
            "message": "Result retrieved from cache",
        },
    )


def node_failed(
    execution_id: str,
    node_id: str,
    error: str,
    retry_count: int,
    will_retry: bool,
) -> ExecutionEvent:
    """Create NODE_FAILED event."""
    return ExecutionEvent(
        event_type=EventType.NODE_FAILED,
        execution_id=execution_id,
        payload={
            "nodeId": node_id,
            "error": error,
            "retryCount": retry_count,
            "willRetry": will_retry,
        },
    )


def node_skipped(
    execution_id: str,
    node_id: str,
    reason: str,
) -> ExecutionEvent:
    """Create NODE_SKIPPED event."""
    return ExecutionEvent(
        event_type=EventType.NODE_SKIPPED,
        execution_id=execution_id,
        payload={
            "nodeId": node_id,
            "reason": reason,
        },
    )


def log_emitted(
    execution_id: str,
    node_id: str,
    level: str,
    message: str,
) -> ExecutionEvent:
    """Create LOG_EMITTED event."""
    return ExecutionEvent(
        event_type=EventType.LOG_EMITTED,
        execution_id=execution_id,
        payload={
            "nodeId": node_id,
            "level": level,
            "message": message,
        },
    )