# apps/api/src/agentforge_api/validation/__init__.py

"""DAG Validation module for AgentForge."""

# Graph utilities
from agentforge_api.validation.graph import (
    AdjacencyList,
    ReverseAdjacencyList,
    InDegreeMap,
    build_adjacency_list,
    build_reverse_adjacency_list,
    compute_in_degrees,
    find_entry_nodes,
    find_exit_nodes,
)

# Topological sort
from agentforge_api.validation.topological import (
    TopologicalSortResult,
    TopologicalSortFailure,
    topological_sort,
    get_execution_order,
    compute_execution_levels,
)

# Semantic types
from agentforge_api.validation.semantic import AgentRegistry

# Composed validator
from agentforge_api.validation.validator import (
    ValidateWorkflowOptions,
    validate_workflow,
    validate_workflow_structure,
    validate_workflow_full,
)

__all__ = [
    # Graph utilities
    "AdjacencyList",
    "ReverseAdjacencyList",
    "InDegreeMap",
    "build_adjacency_list",
    "build_reverse_adjacency_list",
    "compute_in_degrees",
    "find_entry_nodes",
    "find_exit_nodes",
    # Topological sort
    "TopologicalSortResult",
    "TopologicalSortFailure",
    "topological_sort",
    "get_execution_order",
    "compute_execution_levels",
    # Semantic types
    "AgentRegistry",
    # Composed validator
    "ValidateWorkflowOptions",
    "validate_workflow",
    "validate_workflow_structure",
    "validate_workflow_full",
]