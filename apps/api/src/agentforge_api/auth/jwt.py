# apps/api/src/agentforge_api/auth/jwt.py

"""JWT token handling."""

import os
from datetime import datetime, timezone
from typing import Any

import jwt
from pydantic import ValidationError

from agentforge_api.auth.models import AuthContext, Role
from agentforge_api.core.exceptions import UnauthorizedError


# JWT configuration
JWT_SECRET = os.environ.get("AGENTFORGE_JWT_SECRET", "dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"


class JWTError(Exception):
    """Base exception for JWT errors."""
    pass


class TokenExpiredError(JWTError):
    """Token has expired."""
    pass


class InvalidTokenError(JWTError):
    """Token is invalid."""
    pass


def decode_token(token: str) -> dict[str, Any]:
    """
    Decode and verify a JWT token.
    
    Raises:
        TokenExpiredError: If token has expired
        InvalidTokenError: If token is invalid
    """
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "tenant_id", "role", "exp"]},
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise TokenExpiredError("Token has expired")
    except jwt.InvalidTokenError as e:
        raise InvalidTokenError(f"Invalid token: {e}")


def create_auth_context(token: str) -> AuthContext:
    """
    Create AuthContext from JWT token.
    
    Raises:
        UnauthorizedError: If token is invalid or expired
    """
    try:
        payload = decode_token(token)
        
        # Parse role
        role_str = payload.get("role", "").upper()
        try:
            role = Role(role_str)
        except ValueError:
            raise InvalidTokenError(f"Invalid role: {role_str}")
        
        # Parse expiration
        exp_timestamp = payload.get("exp", 0)
        exp = datetime.fromtimestamp(exp_timestamp, tz=timezone.utc)
        
        return AuthContext(
            user_id=payload["sub"],
            tenant_id=payload["tenant_id"],
            role=role,
            exp=exp,
        )
        
    except TokenExpiredError:
        raise UnauthorizedError("Token has expired")
    except (InvalidTokenError, ValidationError, KeyError) as e:
        raise UnauthorizedError(f"Invalid token: {e}")


def create_token(
    user_id: str,
    tenant_id: str,
    role: Role,
    exp: datetime,
) -> str:
    """
    Create a JWT token.
    
    Used for testing and development.
    """
    payload = {
        "sub": user_id,
        "tenant_id": tenant_id,
        "role": role.value,
        "exp": int(exp.timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)