# apps/api/src/agentforge_api/realtime/websocket.py

"""
WebSocket endpoint for real-time execution streaming.

Handles client connections and message routing.
"""

import json
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from agentforge_api.realtime.hub import connection_hub, Connection


router = APIRouter()


@router.websocket("/ws/executions")
async def executions_websocket(websocket: WebSocket) -> None:
    """
    WebSocket endpoint for execution event streaming.
    
    Protocol:
    - Client connects to /ws/executions
    - Client sends: { "action": "subscribe", "executionId": "..." }
    - Server sends: { "event": "ACK", "action": "subscribe", ... }
    - Server pushes: { "event": "NODE_COMPLETED", "executionId": "...", ... }
    - Client sends: { "action": "unsubscribe", "executionId": "..." }
    - Client disconnects when done
    
    Error handling:
    - Invalid JSON: sends error, continues listening
    - Invalid message format: sends error, continues listening
    - Connection error: cleans up and exits
    """
    connection: Connection | None = None
    
    try:
        # Accept connection and register with hub
        connection = await connection_hub.connect(websocket)
        
        # Send welcome message
        await websocket.send_json({
            "event": "CONNECTED",
            "connectionId": connection.id,
            "message": "Connected to AgentForge execution stream",
        })
        
        # Message loop
        while True:
            try:
                # Receive message from client
                raw_data = await websocket.receive_text()
                
                # Parse JSON
                try:
                    data = json.loads(raw_data)
                except json.JSONDecodeError:
                    await connection.send_error(
                        "Invalid JSON",
                        {"received": raw_data[:100]}  # Truncate for safety
                    )
                    continue
                
                # Validate message is a dict
                if not isinstance(data, dict):
                    await connection.send_error(
                        "Message must be a JSON object",
                        {"receivedType": type(data).__name__}
                    )
                    continue
                
                # Handle message
                await connection_hub.handle_message(connection, data)
                
            except WebSocketDisconnect:
                # Client disconnected normally
                break
            except Exception as e:
                # Unexpected error during message handling
                try:
                    await connection.send_error(
                        "Internal error processing message",
                        {"error": str(e)}
                    )
                except Exception:
                    # Can't even send error, connection is dead
                    break
    
    finally:
        # Clean up connection
        if connection:
            await connection_hub.disconnect(connection)


@router.get("/ws/status")
async def websocket_status() -> dict[str, Any]:
    """
    Get WebSocket hub status.
    
    Useful for monitoring and debugging.
    """
    return {
        "connections": connection_hub.connection_count,
        "subscriptions": connection_hub.subscription_count,
    }