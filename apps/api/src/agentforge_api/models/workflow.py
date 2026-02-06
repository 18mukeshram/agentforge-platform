# apps/api/src/agentforge_api/models/workflow.py

"""Workflow domain models."""

from datetime import datetime
from enum import StrEnum
from typing import Annotated, NewType

from pydantic import BaseModel, Field

from agentforge_api.models.edge import Edge
from agentforge_api.models.node import Node

WorkflowId = NewType("WorkflowId", str)


class WorkflowStatus(StrEnum):
    """Lifecycle status of a workflow definition."""

    DRAFT = "draft"  # Being edited, not executable
    VALID = "valid"  # Passed validation, ready to execute
    INVALID = "invalid"  # Failed validation, needs fixes
    ARCHIVED = "archived"  # Soft-deleted, not executable


class WorkflowMeta(BaseModel, frozen=True):
    """Workflow metadata, separate from graph structure."""

    name: str
    description: str = ""
    created_at: datetime
    updated_at: datetime
    owner_id: str
    version: Annotated[int, Field(ge=1, description="Optimistic concurrency control")]


class Workflow(BaseModel, frozen=True):
    """
    A complete workflow definition.

    The nodes and edges form a DAG.
    Invariants (enforced by DAG Validator):
    - Acyclic
    - All edge references resolve to existing nodes
    - At least one entry node (zero incoming edges)
    - No orphan nodes
    """

    id: Annotated[str, Field(description="Unique workflow identifier")]
    status: WorkflowStatus = WorkflowStatus.DRAFT
    meta: WorkflowMeta
    nodes: Annotated[list[Node], Field(default_factory=list)]
    edges: Annotated[list[Edge], Field(default_factory=list)]

    @property
    def workflow_id(self) -> WorkflowId:
        """Return typed WorkflowId."""
        return WorkflowId(self.id)

    def get_node_map(self) -> dict[str, Node]:
        """Build node lookup map. O(n) construction, O(1) lookup."""
        return {node.id: node for node in self.nodes}

    def get_edge_map(self) -> dict[str, Edge]:
        """Build edge lookup map. O(n) construction, O(1) lookup."""
        return {edge.id: edge for edge in self.edges}
