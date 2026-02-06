# apps/api/src/agentforge_api/validation/topological.py

"""
Topological sort for DAG execution ordering.

Uses Kahn's algorithm which also serves as independent cycle detection.
"""

from dataclasses import dataclass
from enum import StrEnum

from agentforge_api.models import Workflow
from agentforge_api.validation.graph import (
    build_adjacency_list,
    compute_in_degrees,
)


class TopologicalSortFailure(StrEnum):
    """Reasons for topological sort failure."""

    CYCLE_DETECTED = "cycle_detected"


@dataclass(frozen=True)
class TopologicalSortResult:
    """
    Result of topological sort.
    Either succeeds with ordered nodes, or fails (cycle detected).
    """

    success: bool
    order: list[str] | None = None
    failure_reason: TopologicalSortFailure | None = None

    @classmethod
    def succeeded(cls, order: list[str]) -> "TopologicalSortResult":
        """Create a successful result."""
        return cls(success=True, order=order, failure_reason=None)

    @classmethod
    def failed(cls, reason: TopologicalSortFailure) -> "TopologicalSortResult":
        """Create a failed result."""
        return cls(success=False, order=None, failure_reason=reason)


def topological_sort(workflow: Workflow) -> TopologicalSortResult:
    """
    Kahn's algorithm for topological sorting.

    Returns nodes in execution order (all dependencies before dependents).
    Fails if graph contains a cycle.

    Time: O(V + E)
    Space: O(V)
    """
    if len(workflow.nodes) == 0:
        return TopologicalSortResult.succeeded([])

    adj = build_adjacency_list(workflow)
    edge_map = workflow.get_edge_map()

    # Mutable copy of in-degrees (will be decremented)
    in_degrees = compute_in_degrees(workflow)

    # Queue starts with all entry nodes (in-degree 0)
    queue: list[str] = [node_id for node_id, degree in in_degrees.items() if degree == 0]

    order: list[str] = []

    while queue:
        node_id = queue.pop(0)
        order.append(node_id)

        # Process all outgoing edges
        for edge_id in adj.get(node_id, []):
            edge = edge_map.get(edge_id)
            if edge is None:
                continue

            target_degree = in_degrees.get(edge.target, 0)
            new_degree = target_degree - 1
            in_degrees[edge.target] = new_degree

            # Target becomes ready when all dependencies processed
            if new_degree == 0:
                queue.append(edge.target)

    # If not all nodes processed, graph has a cycle
    if len(order) != len(workflow.nodes):
        return TopologicalSortResult.failed(TopologicalSortFailure.CYCLE_DETECTED)

    return TopologicalSortResult.succeeded(order)


def get_execution_order(workflow: Workflow) -> list[str]:
    """
    Get execution order, assuming workflow is already validated.
    Raises ValueError if cycle detected (should not happen if pre-validated).
    """
    result = topological_sort(workflow)

    if not result.success:
        raise ValueError("Cannot compute execution order: cycle detected")

    return result.order or []


def compute_execution_levels(workflow: Workflow) -> dict[str, int]:
    """
    Group nodes by execution level.

    Nodes at the same level can run in parallel.
    Level 0 = entry nodes
    Level N = nodes whose max dependency is level N-1

    Time: O(V + E)
    Space: O(V)
    """
    levels: dict[str, int] = {}
    adj = build_adjacency_list(workflow)
    edge_map = workflow.get_edge_map()

    # Mutable copy of in-degrees
    in_degrees = compute_in_degrees(workflow)

    # Entry nodes are level 0
    queue: list[str] = []
    for node_id, degree in in_degrees.items():
        if degree == 0:
            levels[node_id] = 0
            queue.append(node_id)

    while queue:
        node_id = queue.pop(0)
        current_level = levels.get(node_id, 0)

        for edge_id in adj.get(node_id, []):
            edge = edge_map.get(edge_id)
            if edge is None:
                continue

            target_degree = in_degrees.get(edge.target, 0)
            new_degree = target_degree - 1
            in_degrees[edge.target] = new_degree

            # Update target's level to max of current dependencies + 1
            existing_level = levels.get(edge.target, 0)
            levels[edge.target] = max(existing_level, current_level + 1)

            if new_degree == 0:
                queue.append(edge.target)

    return levels
