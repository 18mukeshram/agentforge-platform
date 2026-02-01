# apps/api/src/agentforge_api/auth/models.py

"""Authentication and authorization models."""

from datetime import datetime
from enum import Enum
from typing import NewType

from pydantic import BaseModel, Field


TenantId = NewType("TenantId", str)
UserId = NewType("UserId", str)


class Role(str, Enum):
    """User roles with hierarchical permissions."""
    
    OWNER = "OWNER"    # Full access (tenant admin)
    ADMIN = "ADMIN"    # Manage workflows & executions
    MEMBER = "MEMBER"  # Create / edit / execute workflows
    VIEWER = "VIEWER"  # Read-only access


# Role hierarchy for permission checks
ROLE_HIERARCHY: dict[Role, int] = {
    Role.OWNER: 4,
    Role.ADMIN: 3,
    Role.MEMBER: 2,
    Role.VIEWER: 1,
}


class AuthContext(BaseModel, frozen=True):
    """
    Authentication context for a request.
    
    Injected into route handlers after JWT verification.
    Immutable to prevent tampering.
    """
    
    user_id: str
    tenant_id: str
    role: Role
    exp: datetime  # Token expiration time
    
    def has_role(self, required_role: Role) -> bool:
        """Check if user has at least the required role."""
        user_level = ROLE_HIERARCHY.get(self.role, 0)
        required_level = ROLE_HIERARCHY.get(required_role, 0)
        return user_level >= required_level
    
    def is_owner(self) -> bool:
        """Check if user is tenant owner."""
        return self.role == Role.OWNER
    
    def is_admin_or_above(self) -> bool:
        """Check if user is admin or owner."""
        return self.has_role(Role.ADMIN)
    
    def can_write(self) -> bool:
        """Check if user can create/edit resources."""
        return self.has_role(Role.MEMBER)
    
    def can_read(self) -> bool:
        """Check if user can read resources."""
        return self.has_role(Role.VIEWER)


class Tenant(BaseModel, frozen=True):
    """Tenant model for multi-tenancy."""
    
    id: str
    name: str
    created_at: datetime
    is_active: bool = True