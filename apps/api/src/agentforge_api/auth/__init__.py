# apps/api/src/agentforge_api/auth/__init__.py

"""Authentication and authorization module."""

from agentforge_api.auth.models import (
    AuthContext,
    Role,
    ROLE_HIERARCHY,
    Tenant,
    TenantId,
    UserId,
)
from agentforge_api.auth.jwt import (
    JWT_ALGORITHM,
    JWT_SECRET,
    JWTError,
    TokenExpiredError,
    InvalidTokenError,
    decode_token,
    create_auth_context,
    create_token,
)
from agentforge_api.auth.dependencies import (
    Auth,
    extract_token_from_header,
    get_auth_context,
    get_websocket_auth,
    require_role,
    require_write_access,
    require_admin_access,
)

__all__ = [
    # Models
    "AuthContext",
    "Role",
    "ROLE_HIERARCHY",
    "Tenant",
    "TenantId",
    "UserId",
    # JWT
    "JWT_ALGORITHM",
    "JWT_SECRET",
    "JWTError",
    "TokenExpiredError",
    "InvalidTokenError",
    "decode_token",
    "create_auth_context",
    "create_token",
    # Dependencies
    "Auth",
    "extract_token_from_header",
    "get_auth_context",
    "get_websocket_auth",
    "require_role",
    "require_write_access",
    "require_admin_access",
]