# apps/api/src/agentforge_api/realtime/websocket.py

"""
WebSocket endpoint for real-time execution streaming.

Handles authenticated client connections and message routing.
"""

import json
from typing import Any

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from agentforge_api.auth import create_auth_context
from agentforge_api.core.exceptions import UnauthorizedError
from agentforge_api.realtime.hub import Connection, connection_hub

router = APIRouter()


@router.websocket("/ws/executions")
async def executions_websocket(
    websocket: WebSocket,
    token: str | None = Query(default=None),
) -> None:
    """
    WebSocket endpoint for execution event streaming.

    Authentication:
    - JWT token passed as query parameter: /ws/executions?token=<jwt>
    - Verified once at connection time
    - Connection rejected if token invalid or missing

    Protocol:
    - Client connects with token
    - Server sends: { "event": "CONNECTED", ... }
    - Client sends: { "action": "subscribe", "executionId": "..." }
    - Server validates tenant isolation before allowing subscription
    - Server pushes: { "event": "NODE_COMPLETED", ... }
    - Client sends: { "action": "unsubscribe", "executionId": "..." }

    Tenant Isolation:
    - Subscriptions only allowed for executions in same tenant
    - Cross-tenant subscriptions are rejected with error
    """
    # === Authentication ===
    if not token:
        await websocket.close(code=4001, reason="Missing authentication token")
        return

    try:
        auth = create_auth_context(token)
    except UnauthorizedError as e:
        await websocket.close(code=4001, reason=str(e))
        return

    # === Connection Setup ===
    connection: Connection | None = None

    try:
        connection = await connection_hub.connect(websocket, auth)

        # Send welcome message with auth info
        await websocket.send_json(
            {
                "event": "CONNECTED",
                "connectionId": connection.id,
                "userId": auth.user_id,
                "tenantId": auth.tenant_id,
                "role": auth.role.value,
                "message": "Connected to AgentForge execution stream",
            }
        )

        # === Message Loop ===
        while True:
            try:
                raw_data = await websocket.receive_text()

                try:
                    data = json.loads(raw_data)
                except json.JSONDecodeError:
                    await connection.send_error(
                        "Invalid JSON", {"received": raw_data[:100]}
                    )
                    continue

                if not isinstance(data, dict):
                    await connection.send_error(
                        "Message must be a JSON object",
                        {"receivedType": type(data).__name__},
                    )
                    continue

                await connection_hub.handle_message(connection, data)

            except WebSocketDisconnect:
                break
            except Exception as e:
                try:
                    await connection.send_error(
                        "Internal error processing message", {"error": str(e)}
                    )
                except Exception:
                    break

    finally:
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
