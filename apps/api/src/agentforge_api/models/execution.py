# apps/api/src/agentforge_api/models/execution.py

"""Execution domain models."""

from datetime import datetime
from enum import Enum
from typing import Annotated, Any, NewType

from pydantic import BaseModel, Field


ExecutionId = NewType("ExecutionId", str)


class ExecutionStatus(str, Enum):
    """Overall execution status for the entire workflow run."""
    
    PENDING = "pending"       # Created, not yet started
    RUNNING = "running"       # At least one node is executing
    COMPLETED = "completed"   # All nodes finished successfully
    FAILED = "failed"         # At least one node failed (after retries)
    CANCELLED = "cancelled"   # User-initiated cancellation


class NodeExecutionStatus(str, Enum):
    """Execution status for a single node."""
    
    PENDING = "pending"     # Waiting for dependencies
    QUEUED = "queued"       # Dependencies met, in queue
    RUNNING = "running"     # Currently executing
    COMPLETED = "completed" # Finished successfully
    FAILED = "failed"       # Failed after all retries
    SKIPPED = "skipped"     # Skipped due to upstream failure


class NodeExecutionState(BaseModel, frozen=True):
    """Runtime state of a single node during execution."""
    
    node_id: str
    status: NodeExecutionStatus = NodeExecutionStatus.PENDING
    
    started_at: datetime | None = None
    completed_at: datetime | None = None
    
    retry_count: Annotated[int, Field(ge=0)] = 0
    error: str | None = None
    output: Any | None = None


class Execution(BaseModel, frozen=True):
    """A single execution run of a workflow."""
    
    id: Annotated[str, Field(description="Unique execution identifier")]
    workflow_id: str
    status: ExecutionStatus = ExecutionStatus.PENDING
    
    # Snapshot of workflow version at execution time
    workflow_version: Annotated[int, Field(ge=1)]
    
    # User who triggered the execution
    triggered_by: str
    
    # Execution timing
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None
    
    # Per-node execution state
    node_states: list[NodeExecutionState] = Field(default_factory=list)
    
    # Inputs provided at execution start
    inputs: dict[str, Any] = Field(default_factory=dict)
    
    @property
    def execution_id(self) -> ExecutionId:
        """Return typed ExecutionId."""
        return ExecutionId(self.id)
    
    def get_node_state_map(self) -> dict[str, NodeExecutionState]:
        """Build node state lookup map."""
        return {state.node_id: state for state in self.node_states}