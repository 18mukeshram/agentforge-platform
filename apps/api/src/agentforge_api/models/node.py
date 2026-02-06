# apps/api/src/agentforge_api/models/node.py

"""Node domain models."""

from enum import StrEnum
from typing import Annotated, Any, NewType

from pydantic import BaseModel, Field

# Branded type equivalents using NewType
NodeId = NewType("NodeId", str)


class NodeType(StrEnum):
    """The category of node, determining its execution behavior."""

    AGENT = "agent"  # Executes an AI agent
    TOOL = "tool"  # Executes a deterministic tool/function
    INPUT = "input"  # Workflow entry point (user-provided data)
    OUTPUT = "output"  # Workflow exit point (final result)


class NodePosition(BaseModel, frozen=True):
    """Visual position on the canvas. Not relevant to execution."""

    x: float
    y: float


class NodeConfig(BaseModel, frozen=True):
    """
    Node-specific configuration. Varies by node type.
    Will be refined with discriminated unions later.
    """

    agent_id: str | None = None
    tool_id: str | None = None
    parameters: dict[str, Any] = Field(default_factory=dict)


class Node(BaseModel, frozen=True):
    """A single node in the workflow DAG."""

    id: Annotated[str, Field(description="Unique node identifier")]
    type: NodeType
    label: str
    position: NodePosition
    config: NodeConfig = Field(default_factory=NodeConfig)

    @property
    def node_id(self) -> NodeId:
        """Return typed NodeId."""
        return NodeId(self.id)
