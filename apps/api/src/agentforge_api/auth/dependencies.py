# apps/api/src/agentforge_api/auth/dependencies.py

"""FastAPI dependencies for authentication."""

from typing import Annotated

from fastapi import Depends, Header, Query, WebSocket

from agentforge_api.auth.models import AuthContext, Role
from agentforge_api.auth.jwt import create_auth_context
from agentforge_api.core.exceptions import UnauthorizedError, ForbiddenError


def extract_token_from_header(
    authorization: Annotated[str | None, Header()] = None,
) -> str:
    """
    Extract JWT token from Authorization header.
    
    Expects: Authorization: Bearer <token>
    """
    if not authorization:
        raise UnauthorizedError("Missing Authorization header")
    
    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise UnauthorizedError("Invalid Authorization header format. Expected: Bearer <token>")
    
    return parts[1]


async def get_auth_context(
    token: Annotated[str, Depends(extract_token_from_header)],
) -> AuthContext:
    """
    Dependency to get authenticated user context.
    
    Verifies JWT and returns AuthContext.
    """
    return create_auth_context(token)


# Type alias for cleaner route signatures
Auth = Annotated[AuthContext, Depends(get_auth_context)]


def require_role(*allowed_roles: Role):
    """
    Dependency factory to require specific roles.
    
    Usage:
        @router.post("/", dependencies=[Depends(require_role(Role.ADMIN, Role.OWNER))])
        async def create_something(auth: Auth):
            ...
    """
    async def check_role(auth: Auth) -> AuthContext:
        if auth.role not in allowed_roles:
            raise ForbiddenError(
                f"Role {auth.role.value} not authorized. Required: {[r.value for r in allowed_roles]}"
            )
        return auth
    
    return check_role


def require_write_access(auth: Auth) -> AuthContext:
    """Require at least MEMBER role (can create/edit)."""
    if not auth.can_write():
        raise ForbiddenError("Write access required")
    return auth


def require_admin_access(auth: Auth) -> AuthContext:
    """Require at least ADMIN role."""
    if not auth.is_admin_or_above():
        raise ForbiddenError("Admin access required")
    return auth


async def get_websocket_auth(
    websocket: WebSocket,
    token: Annotated[str | None, Query()] = None,
) -> AuthContext:
    """
    Authenticate WebSocket connection.
    
    Token passed as query parameter: /ws/executions?token=<jwt>
    """
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        raise UnauthorizedError("Missing token")
    
    try:
        return create_auth_context(token)
    except UnauthorizedError as e:
        await websocket.close(code=4001, reason=str(e))
        raise