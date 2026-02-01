# apps/api/src/agentforge_api/realtime/hub.py

"""
WebSocket connection and subscription manager.

Manages active WebSocket connections and routes events
to subscribed clients.
"""

import asyncio
import json
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from uuid import uuid4

from fastapi import WebSocket, WebSocketDisconnect

from agentforge_api.realtime.events import ExecutionEvent
from agentforge_api.realtime.emitter import event_emitter


@dataclass
class Connection:
    """Represents an active WebSocket connection."""
    
    id: str
    websocket: WebSocket
    subscriptions: set[str] = field(default_factory=set)
    connected_at: datetime = field(default_factory=datetime.now)
    
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
    - Track active connections
    - Manage execution subscriptions per connection
    - Route events to subscribed connections
    - Handle connection lifecycle
    """
    
    def __init__(self) -> None:
        self._connections: dict[str, Connection] = {}
        self._execution_subscribers: dict[str, set[str]] = {}  # execution_id -> connection_ids
        self._lock = asyncio.Lock()
        self._emitter_unsubscribe: callable | None = None
    
    async def initialize(self) -> None:
        """Initialize hub and subscribe to event emitter."""
        if self._emitter_unsubscribe is not None:
            return  # Already initialized
        
        self._emitter_unsubscribe = await event_emitter.subscribe_all(
            self._on_event
        )
    
    async def shutdown(self) -> None:
        """Shutdown hub and cleanup subscriptions."""
        if self._emitter_unsubscribe:
            await self._emitter_unsubscribe()
            self._emitter_unsubscribe = None
        
        # Close all connections
        async with self._lock:
            for connection in list(self._connections.values()):
                try:
                    await connection.websocket.close()
                except Exception:
                    pass
            self._connections.clear()
            self._execution_subscribers.clear()
    
    async def connect(self, websocket: WebSocket) -> Connection:
        """
        Register a new WebSocket connection.
        
        Returns the Connection object for further operations.
        """
        await websocket.accept()
        
        connection_id = str(uuid4())
        connection = Connection(
            id=connection_id,
            websocket=websocket,
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
            # Remove from all execution subscriptions
            for execution_id in list(connection.subscriptions):
                subscribers = self._execution_subscribers.get(execution_id, set())
                subscribers.discard(connection.id)
                if not subscribers and execution_id in self._execution_subscribers:
                    del self._execution_subscribers[execution_id]
            
            # Remove connection
            if connection.id in self._connections:
                del self._connections[connection.id]
    
    async def subscribe(
        self,
        connection: Connection,
        execution_id: str,
    ) -> bool:
        """
        Subscribe a connection to an execution's events.
        
        Returns True if newly subscribed, False if already subscribed.
        """
        async with self._lock:
            if execution_id in connection.subscriptions:
                return False
            
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
        
        # Send to all subscribers concurrently
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
            # Connection likely dead, clean up
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
                    "Missing 'executionId' field",
                    {"action": action}
                )
                return
            await self.subscribe(connection, execution_id)
        
        elif action == "unsubscribe":
            if not execution_id:
                await connection.send_error(
                    "Missing 'executionId' field",
                    {"action": action}
                )
                return
            await self.unsubscribe(connection, execution_id)
        
        else:
            await connection.send_error(
                f"Unknown action: {action}",
                {"validActions": ["subscribe", "unsubscribe"]}
            )
    
    @property
    def connection_count(self) -> int:
        """Number of active connections."""
        return len(self._connections)
    
    @property
    def subscription_count(self) -> int:
        """Total number of active subscriptions."""
        return sum(
            len(subscribers)
            for subscribers in self._execution_subscribers.values()
        )


# Singleton instance
connection_hub = ConnectionHub()