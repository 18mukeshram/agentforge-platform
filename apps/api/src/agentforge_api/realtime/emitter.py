# apps/api/src/agentforge_api/realtime/emitter.py

"""
In-process event emitter for real-time events.

Provides pub/sub mechanism for decoupling execution engine
from WebSocket layer.
"""

import asyncio
from collections import defaultdict
from collections.abc import Awaitable, Callable

from agentforge_api.realtime.events import ExecutionEvent

# Type alias for event handlers
EventHandler = Callable[[ExecutionEvent], Awaitable[None]]


class EventEmitter:
    """
    In-process pub/sub event emitter.

    Features:
    - Subscribe to all events or specific execution IDs
    - Async event handlers
    - Non-blocking emit (fire-and-forget)
    - Safe handler execution (errors don't propagate)

    This is NOT for distributed systems. For horizontal scaling,
    replace with Redis pub/sub.
    """

    def __init__(self) -> None:
        # Global handlers (receive all events)
        self._global_handlers: list[EventHandler] = []

        # Per-execution handlers
        self._execution_handlers: dict[str, list[EventHandler]] = defaultdict(list)

        # Lock for thread-safe modifications
        self._lock = asyncio.Lock()

    async def subscribe_all(
        self, handler: EventHandler
    ) -> Callable[[], Awaitable[None]]:
        """
        Subscribe to all events.

        Returns an unsubscribe function.
        """
        async with self._lock:
            self._global_handlers.append(handler)

        async def unsubscribe() -> None:
            async with self._lock:
                if handler in self._global_handlers:
                    self._global_handlers.remove(handler)

        return unsubscribe

    async def subscribe(
        self,
        execution_id: str,
        handler: EventHandler,
    ) -> Callable[[], Awaitable[None]]:
        """
        Subscribe to events for a specific execution.

        Returns an unsubscribe function.
        """
        async with self._lock:
            self._execution_handlers[execution_id].append(handler)

        async def unsubscribe() -> None:
            async with self._lock:
                handlers = self._execution_handlers.get(execution_id, [])
                if handler in handlers:
                    handlers.remove(handler)
                # Clean up empty lists
                if not handlers and execution_id in self._execution_handlers:
                    del self._execution_handlers[execution_id]

        return unsubscribe

    async def emit(self, event: ExecutionEvent) -> None:
        """
        Emit an event to all relevant subscribers.

        Non-blocking: creates tasks for each handler.
        Safe: handler errors are caught and logged.
        """
        handlers_to_notify: list[EventHandler] = []

        async with self._lock:
            # Collect global handlers
            handlers_to_notify.extend(self._global_handlers)

            # Collect execution-specific handlers
            execution_handlers = self._execution_handlers.get(event.execution_id, [])
            handlers_to_notify.extend(execution_handlers)

        # Notify all handlers concurrently
        if handlers_to_notify:
            await asyncio.gather(
                *[self._safe_call(handler, event) for handler in handlers_to_notify],
                return_exceptions=True,
            )

    async def _safe_call(
        self,
        handler: EventHandler,
        event: ExecutionEvent,
    ) -> None:
        """Call handler with error protection."""
        try:
            await handler(event)
        except Exception as e:
            # Log error but don't propagate
            # In production, use proper logging
            print(f"Event handler error: {e}")

    async def clear_execution(self, execution_id: str) -> None:
        """Remove all handlers for an execution (cleanup)."""
        async with self._lock:
            if execution_id in self._execution_handlers:
                del self._execution_handlers[execution_id]

    @property
    def subscriber_count(self) -> int:
        """Total number of active subscriptions."""
        return len(self._global_handlers) + sum(
            len(handlers) for handlers in self._execution_handlers.values()
        )


# Singleton instance
event_emitter = EventEmitter()
