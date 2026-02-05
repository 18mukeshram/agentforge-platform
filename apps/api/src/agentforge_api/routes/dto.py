# apps/api/src/agentforge_api/routes/dto.py

"""Data Transfer Objects for API requests and responses."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from agentforge_api.models import (
    Edge,
    ExecutionStatus,
    Node,
    NodeExecutionStatus,
    ValidationError,
    WorkflowStatus,
)

# === Workflow DTOs (existing) ===


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
    version: int = Field(
        ..., ge=1, description="Current version for optimistic locking"
    )


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


# === Execution DTOs (new) ===


class ExecuteWorkflowRequest(BaseModel):
    """Request body for triggering workflow execution."""

    inputs: dict[str, Any] = Field(
        default_factory=dict,
        description="Input values for workflow entry nodes",
    )


class NodeExecutionStateResponse(BaseModel):
    """Execution state for a single node."""

    node_id: str
    status: NodeExecutionStatus
    started_at: datetime | None = None
    completed_at: datetime | None = None
    retry_count: int = 0
    error: str | None = None
    output: Any | None = None


class ExecutionResponse(BaseModel):
    """Full execution response."""

    id: str
    workflow_id: str
    status: ExecutionStatus
    workflow_version: int
    triggered_by: str
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None
    node_states: list[NodeExecutionStateResponse]
    inputs: dict[str, Any]
    outputs: dict[str, Any] | None = None


class ExecutionSummary(BaseModel):
    """Execution summary for list responses."""

    id: str
    workflow_id: str
    status: ExecutionStatus
    created_at: datetime
    completed_at: datetime | None = None


class ExecutionListResponse(BaseModel):
    """Response for execution list endpoint."""

    items: list[ExecutionSummary]
    next_cursor: str | None = None


class ExecutionTriggerResponse(BaseModel):
    """Response when execution is triggered (202 Accepted)."""

    execution_id: str
    status: ExecutionStatus
    workflow_id: str
    created_at: datetime


class ExecutionCancelResponse(BaseModel):
    """Response for execution cancellation."""

    id: str
    status: ExecutionStatus


class LogEntry(BaseModel):
    """A single log entry from execution."""

    timestamp: datetime
    node_id: str
    level: str  # "info" | "warn" | "error"
    message: str


class ExecutionLogsResponse(BaseModel):
    """Response for execution logs endpoint."""

    items: list[LogEntry]
    next_cursor: str | None = None


# === Resume DTOs (Phase 12) ===


class ResumeExecutionRequest(BaseModel):
    """Request body for resuming a failed execution."""

    node_id: str = Field(
        ...,
        description="Node ID to resume from (must be a failed node)",
    )


class ResumeExecutionResponse(BaseModel):
    """Response for resume execution endpoint."""

    execution_id: str = Field(description="New execution ID")
    parent_execution_id: str = Field(description="Original failed execution ID")
    resumed_from_node_id: str = Field(description="Node ID resumed from")
    workflow_id: str
    workflow_version: int
    skipped_nodes: list[str] = Field(
        description="Nodes that will be skipped (already completed)"
    )
    rerun_nodes: list[str] = Field(description="Nodes that will be re-executed")
    status: ExecutionStatus = ExecutionStatus.PENDING
