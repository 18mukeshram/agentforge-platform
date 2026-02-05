# apps/api/src/agentforge_api/realtime/hub.py

"""
WebSocket connection and subscription manager.

Manages active WebSocket connections and routes events
to subscribed clients. Enforces tenant isolation.
"""

import asyncio
import contextlib
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from uuid import uuid4

from fastapi import WebSocket

from agentforge_api.auth import AuthContext
from agentforge_api.realtime.emitter import event_emitter
from agentforge_api.realtime.events import ExecutionEvent


@dataclass
class Connection:
    """Represents an authenticated WebSocket connection."""

    id: str
    websocket: WebSocket
    auth: AuthContext  # Authentication context
    subscriptions: set[str] = field(default_factory=set)
    connected_at: datetime = field(default_factory=datetime.now)

    @property
    def tenant_id(self) -> str:
        """Get tenant ID from auth context."""
        return self.auth.tenant_id

    @property
    def user_id(self) -> str:
        """Get user ID from auth context."""
        return self.auth.user_id

    async def send_event(self, event: ExecutionEvent) -> bool:
        """
        Send event to this connection.

        Returns True if sent successfully, False on error.
        """
        try:
            message = event.to_message()
            await self.websocket.send_json(message)
            return True
        except Exception:
            return False

    async def send_error(self, error: str, context: dict | None = None) -> bool:
        """Send error message to client."""
        try:
            message = {
                "event": "ERROR",
                "error": error,
                "context": context or {},
                "timestamp": datetime.now().isoformat(),
            }
            await self.websocket.send_json(message)
            return True
        except Exception:
            return False

    async def send_ack(self, action: str, execution_id: str) -> bool:
        """Send acknowledgment for client action."""
        try:
            message = {
                "event": "ACK",
                "action": action,
                "executionId": execution_id,
                "timestamp": datetime.now().isoformat(),
            }
            await self.websocket.send_json(message)
            return True
        except Exception:
            return False


class ConnectionHub:
    """
    Manages all WebSocket connections and subscriptions.

    Responsibilities:
    - Track authenticated connections
    - Manage execution subscriptions per connection
    - Enforce tenant isolation on subscriptions
    - Route events to subscribed connections
    """

    def __init__(self) -> None:
        self._connections: dict[str, Connection] = {}
        self._execution_subscribers: dict[str, set[str]] = (
            {}
        )  # execution_id -> connection_ids
        self._execution_tenants: dict[str, str] = (
            {}
        )  # execution_id -> tenant_id (cached)
        self._lock = asyncio.Lock()
        self._emitter_unsubscribe: callable | None = None

    async def initialize(self) -> None:
        """Initialize hub and subscribe to event emitter."""
        if self._emitter_unsubscribe is not None:
            return

        self._emitter_unsubscribe = await event_emitter.subscribe_all(self._on_event)

    async def shutdown(self) -> None:
        """Shutdown hub and cleanup subscriptions."""
        if self._emitter_unsubscribe:
            await self._emitter_unsubscribe()
            self._emitter_unsubscribe = None

        async with self._lock:
            for connection in list(self._connections.values()):
                with contextlib.suppress(Exception):
                    await connection.websocket.close()
            self._connections.clear()
            self._execution_subscribers.clear()
            self._execution_tenants.clear()

    async def connect(self, websocket: WebSocket, auth: AuthContext) -> Connection:
        """
        Register a new authenticated WebSocket connection.

        Returns the Connection object for further operations.
        """
        await websocket.accept()

        connection_id = str(uuid4())
        connection = Connection(
            id=connection_id,
            websocket=websocket,
            auth=auth,
        )

        async with self._lock:
            self._connections[connection_id] = connection

        return connection

    async def disconnect(self, connection: Connection) -> None:
        """
        Unregister a WebSocket connection.

        Cleans up all subscriptions for this connection.
        """
        async with self._lock:
            for execution_id in list(connection.subscriptions):
                subscribers = self._execution_subscribers.get(execution_id, set())
                subscribers.discard(connection.id)
                if not subscribers and execution_id in self._execution_subscribers:
                    del self._execution_subscribers[execution_id]

            if connection.id in self._connections:
                del self._connections[connection.id]

    def register_execution_tenant(self, execution_id: str, tenant_id: str) -> None:
        """
        Register tenant ownership for an execution.

        Called when execution is created to enable tenant validation.
        """
        self._execution_tenants[execution_id] = tenant_id

    async def subscribe(
        self,
        connection: Connection,
        execution_id: str,
    ) -> bool:
        """
        Subscribe a connection to an execution's events.

        Enforces tenant isolation: connection can only subscribe
        to executions belonging to the same tenant.

        Returns True if subscribed, False if denied or already subscribed.
        """
        # Check tenant isolation
        execution_tenant = self._execution_tenants.get(execution_id)

        if execution_tenant is None:
            # Try to get from execution service
            from agentforge_api.services.execution_service import execution_service

            execution_tenant = execution_service.get_tenant_id(execution_id)

            if execution_tenant is None:
                await connection.send_error(
                    "Execution not found", {"executionId": execution_id}
                )
                return False

            # Cache for future checks
            self._execution_tenants[execution_id] = execution_tenant

        # Enforce tenant isolation
        if execution_tenant != connection.tenant_id:
            await connection.send_error(
                "Access denied: execution belongs to different tenant",
                {"executionId": execution_id},
            )
            return False

        async with self._lock:
            if execution_id in connection.subscriptions:
                # Already subscribed
                await connection.send_ack("subscribe", execution_id)
                return True

            connection.subscriptions.add(execution_id)

            if execution_id not in self._execution_subscribers:
                self._execution_subscribers[execution_id] = set()
            self._execution_subscribers[execution_id].add(connection.id)

        await connection.send_ack("subscribe", execution_id)
        return True

    async def unsubscribe(
        self,
        connection: Connection,
        execution_id: str,
    ) -> bool:
        """
        Unsubscribe a connection from an execution's events.

        Returns True if unsubscribed, False if wasn't subscribed.
        """
        async with self._lock:
            if execution_id not in connection.subscriptions:
                return False

            connection.subscriptions.discard(execution_id)

            subscribers = self._execution_subscribers.get(execution_id, set())
            subscribers.discard(connection.id)
            if not subscribers and execution_id in self._execution_subscribers:
                del self._execution_subscribers[execution_id]

        await connection.send_ack("unsubscribe", execution_id)
        return True

    async def _on_event(self, event: ExecutionEvent) -> None:
        """
        Handle event from emitter.

        Routes event to all connections subscribed to this execution.
        """
        async with self._lock:
            subscriber_ids = self._execution_subscribers.get(
                event.execution_id, set()
            ).copy()

        if not subscriber_ids:
            return

        tasks = []
        for connection_id in subscriber_ids:
            connection = self._connections.get(connection_id)
            if connection:
                tasks.append(self._send_to_connection(connection, event))

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _send_to_connection(
        self,
        connection: Connection,
        event: ExecutionEvent,
    ) -> None:
        """Send event to a single connection with error handling."""
        success = await connection.send_event(event)
        if not success:
            await self.disconnect(connection)

    async def handle_message(
        self,
        connection: Connection,
        data: dict[str, Any],
    ) -> None:
        """
        Handle incoming message from client.

        Supported actions:
        - subscribe: { "action": "subscribe", "executionId": "..." }
        - unsubscribe: { "action": "unsubscribe", "executionId": "..." }
        """
        action = data.get("action")
        execution_id = data.get("executionId")

        if not action:
            await connection.send_error("Missing 'action' field")
            return

        if action == "subscribe":
            if not execution_id:
                await connection.send_error(
                    "Missing 'executionId' field", {"action": action}
                )
                return
            await self.subscribe(connection, execution_id)

        elif action == "unsubscribe":
            if not execution_id:
                await connection.send_error(
                    "Missing 'executionId' field", {"action": action}
                )
                return
            await self.unsubscribe(connection, execution_id)

        else:
            await connection.send_error(
                f"Unknown action: {action}",
                {"validActions": ["subscribe", "unsubscribe"]},
            )

    @property
    def connection_count(self) -> int:
        """Number of active connections."""
        return len(self._connections)

    @property
    def subscription_count(self) -> int:
        """Total number of active subscriptions."""
        return sum(
            len(subscribers) for subscribers in self._execution_subscribers.values()
        )


# Singleton instance
connection_hub = ConnectionHub()
