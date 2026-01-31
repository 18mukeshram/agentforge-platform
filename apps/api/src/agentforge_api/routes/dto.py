# apps/api/src/agentforge_api/routes/dto.py

"""Data Transfer Objects for API requests and responses."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from agentforge_api.models import (
    Node,
    Edge,
    WorkflowStatus,
    ValidationError,
)


# === Workflow DTOs ===


class CreateWorkflowRequest(BaseModel):
    """Request body for creating a workflow."""
    
    name: str = Field(..., min_length=1, max_length=255)
    description: str = ""
    nodes: list[Node] = Field(default_factory=list)
    edges: list[Edge] = Field(default_factory=list)


class UpdateWorkflowRequest(BaseModel):
    """Request body for updating a workflow."""
    
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    nodes: list[Node]
    edges: list[Edge]
    version: int = Field(..., ge=1, description="Current version for optimistic locking")


class WorkflowResponse(BaseModel):
    """Full workflow response."""
    
    id: str
    status: WorkflowStatus
    name: str
    description: str
    created_at: datetime
    updated_at: datetime
    owner_id: str
    version: int
    nodes: list[Node]
    edges: list[Edge]
    validation_errors: list[ValidationError] | None = None


class WorkflowSummary(BaseModel):
    """Workflow summary for list responses."""
    
    id: str
    name: str
    status: WorkflowStatus
    updated_at: datetime
    node_count: int


class WorkflowListResponse(BaseModel):
    """Response for workflow list endpoint."""
    
    items: list[WorkflowSummary]
    next_cursor: str | None = None


class WorkflowDeleteResponse(BaseModel):
    """Response for workflow deletion."""
    
    id: str
    status: WorkflowStatus