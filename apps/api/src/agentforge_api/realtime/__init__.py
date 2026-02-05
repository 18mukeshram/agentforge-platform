# apps/api/src/agentforge_api/realtime/__init__.py

"""Real-time WebSocket layer for execution streaming."""

from agentforge_api.realtime.events import (
    EventType,
    ExecutionEvent,
    execution_started,
    execution_completed,
    execution_failed,
    execution_cancelled,
    node_queued,
    node_running,
    node_completed,
    node_cache_hit,
    node_failed,
    node_skipped,
    log_emitted,
    # Resume events (Phase 12)
    resume_start,
    node_output_reused,
    resume_complete,
)
from agentforge_api.realtime.emitter import (
    EventEmitter,
    EventHandler,
    event_emitter,
)
from agentforge_api.realtime.hub import (
    Connection,
    ConnectionHub,
    connection_hub,
)
from agentforge_api.realtime.websocket import (
    router as websocket_router,
)

__all__ = [
    # Event types
    "EventType",
    "ExecutionEvent",
    # Event factories
    "execution_started",
    "execution_completed",
    "execution_failed",
    "execution_cancelled",
    "node_queued",
    "node_running",
    "node_completed",
    "node_cache_hit",
    "node_failed",
    "node_skipped",
    "log_emitted",
    # Resume event factories (Phase 12)
    "resume_start",
    "node_output_reused",
    "resume_complete",
    # Emitter
    "EventEmitter",
    "EventHandler",
    "event_emitter",
    # Hub
    "Connection",
    "ConnectionHub",
    "connection_hub",
    # WebSocket router
    "websocket_router",
]