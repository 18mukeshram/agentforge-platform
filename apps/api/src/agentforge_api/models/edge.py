# apps/api/src/agentforge_api/models/edge.py

"""Edge domain models."""

from typing import Annotated, NewType

from pydantic import BaseModel, Field

# Branded type equivalents using NewType
EdgeId = NewType("EdgeId", str)
PortId = NewType("PortId", str)


class Edge(BaseModel, frozen=True):
    """
    A directed edge connecting two nodes in the workflow DAG.

    Invariants enforced by validator:
    - source and target must reference existing nodes
    - no duplicate (source, sourcePort, target, targetPort) tuples
    - must not create a cycle
    """

    id: Annotated[str, Field(description="Unique edge identifier")]

    # Source node and port
    source: Annotated[str, Field(description="Node producing the data")]
    source_port: Annotated[str, Field(default="output", description="Output port on source node")]

    # Target node and port
    target: Annotated[str, Field(description="Node consuming the data")]
    target_port: Annotated[str, Field(default="input", description="Input port on target node")]

    @property
    def edge_id(self) -> EdgeId:
        """Return typed EdgeId."""
        return EdgeId(self.id)
