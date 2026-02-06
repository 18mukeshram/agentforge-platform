# apps/api/src/agentforge_api/models/job.py

"""Job models for execution queue."""

from datetime import datetime
from enum import Enum, StrEnum
from typing import Any, NewType

from pydantic import BaseModel, Field

JobId = NewType("JobId", str)


class JobStatus(StrEnum):
    """Status of a job in the queue."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobPriority(int, Enum):
    """Job priority levels."""

    LOW = 0
    NORMAL = 1
    HIGH = 2


class NodeJob(BaseModel):
    """
    A job representing a single node execution.

    Contains all information needed to execute the node independently,
    including tenant context for cache isolation.
    """

    id: str = Field(..., description="Unique job identifier")

    # Execution context
    execution_id: str
    workflow_id: str
    node_id: str
    tenant_id: str = ""  # Tenant for cache isolation

    # Node configuration snapshot
    node_type: str
    agent_id: str | None = None
    node_config: dict[str, Any] = Field(default_factory=dict)

    # Input data
    inputs: dict[str, Any] = Field(default_factory=dict)

    # Job metadata
    status: JobStatus = JobStatus.PENDING
    priority: JobPriority = JobPriority.NORMAL

    # Retry configuration
    max_retries: int = 3
    retry_count: int = 0
    retry_backoff_ms: int = 1000

    # Timing
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None

    # Result
    output: Any | None = None
    error: str | None = None

    @property
    def job_id(self) -> JobId:
        """Return typed JobId."""
        return JobId(self.id)

    @property
    def can_retry(self) -> bool:
        """Check if job can be retried."""
        return self.retry_count < self.max_retries


class JobResult(BaseModel, frozen=True):
    """Result of job execution."""

    job_id: str
    node_id: str
    execution_id: str
    success: bool
    output: Any | None = None
    error: str | None = None
    duration_ms: int = 0


class ExecutionPlan(BaseModel):
    """Execution plan for a workflow."""

    execution_id: str
    workflow_id: str

    execution_order: list[str]
    dependencies: dict[str, list[str]] = Field(default_factory=dict)
    dependents: dict[str, list[str]] = Field(default_factory=dict)
    entry_nodes: list[str] = Field(default_factory=list)
    exit_nodes: list[str] = Field(default_factory=list)
