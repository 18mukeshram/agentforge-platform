# apps/api/src/agentforge_api/validation/graph.py

"""
Graph utilities for DAG validation.

Pure functions to transform workflow structure into forms
useful for validation algorithms.
"""

from agentforge_api.models import Node, Edge, Workflow


# Type aliases for clarity
AdjacencyList = dict[str, list[str]]      # node_id -> list of edge_ids
ReverseAdjacencyList = dict[str, list[str]]  # node_id -> list of edge_ids
InDegreeMap = dict[str, int]              # node_id -> count of incoming edges


def build_adjacency_list(workflow: Workflow) -> AdjacencyList:
    """
    Build adjacency list from workflow edges.
    Maps each node to its outgoing edge IDs.
    
    Time: O(V + E)
    Space: O(V + E)
    """
    adj: AdjacencyList = {}
    
    # Initialize all nodes with empty lists
    for node in workflow.nodes:
        adj[node.id] = []
    
    # Populate outgoing edges
    edge_map = workflow.get_edge_map()
    for edge in workflow.edges:
        if edge.source in adj:
            adj[edge.source].append(edge.id)
    
    return adj


def build_reverse_adjacency_list(workflow: Workflow) -> ReverseAdjacencyList:
    """
    Build reverse adjacency list from workflow edges.
    Maps each node to its incoming edge IDs.
    
    Time: O(V + E)
    Space: O(V + E)
    """
    rev: ReverseAdjacencyList = {}
    
    # Initialize all nodes with empty lists
    for node in workflow.nodes:
        rev[node.id] = []
    
    # Populate incoming edges
    for edge in workflow.edges:
        if edge.target in rev:
            rev[edge.target].append(edge.id)
    
    return rev


def compute_in_degrees(workflow: Workflow) -> InDegreeMap:
    """
    Compute in-degree for each node.
    
    Time: O(V + E)
    Space: O(V)
    """
    degrees: InDegreeMap = {}
    
    # Initialize all nodes with zero
    for node in workflow.nodes:
        degrees[node.id] = 0
    
    # Count incoming edges
    for edge in workflow.edges:
        if edge.target in degrees:
            degrees[edge.target] += 1
    
    return degrees


def find_entry_nodes(workflow: Workflow) -> list[str]:
    """
    Find entry nodes (nodes with no incoming edges).
    
    Time: O(V + E)
    Space: O(V)
    """
    in_degrees = compute_in_degrees(workflow)
    
    return [
        node_id
        for node_id, degree in in_degrees.items()
        if degree == 0
    ]


def find_exit_nodes(workflow: Workflow) -> list[str]:
    """
    Find exit nodes (nodes with no outgoing edges).
    
    Time: O(V + E)
    Space: O(V)
    """
    adj = build_adjacency_list(workflow)
    
    return [
        node_id
        for node_id, outgoing in adj.items()
        if len(outgoing) == 0
    ]