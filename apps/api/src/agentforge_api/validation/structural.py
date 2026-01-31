# apps/api/src/agentforge_api/validation/structural.py

"""
Structural validators for DAG invariants S1-S5.

Each validator is a pure function returning a ValidationResult.
"""

from collections import deque

from agentforge_api.models import (
    Workflow,
    ValidationResult,
    ValidationError,
    ValidationErrorCode,
)
from agentforge_api.validation.graph import (
    build_adjacency_list,
    build_reverse_adjacency_list,
    find_entry_nodes,
    find_exit_nodes,
)


def validate_edge_references(workflow: Workflow) -> ValidationResult:
    """
    S2: Every edge must reference existing nodes.
    """
    errors: list[ValidationError] = []
    node_ids = {node.id for node in workflow.nodes}
    
    for edge in workflow.edges:
        if edge.source not in node_ids:
            errors.append(ValidationError(
                code=ValidationErrorCode.INVALID_EDGE_REFERENCE,
                message=f"Edge references non-existent source node: {edge.source}",
                edge_ids=[edge.id],
                node_ids=[edge.source],
            ))
        
        if edge.target not in node_ids:
            errors.append(ValidationError(
                code=ValidationErrorCode.INVALID_EDGE_REFERENCE,
                message=f"Edge references non-existent target node: {edge.target}",
                edge_ids=[edge.id],
                node_ids=[edge.target],
            ))
    
    if errors:
        return ValidationResult.failure(errors)
    return ValidationResult.success()


def validate_no_duplicate_edges(workflow: Workflow) -> ValidationResult:
    """
    S3: No duplicate edges between same (source, sourcePort, target, targetPort).
    """
    seen: dict[str, str] = {}  # key -> first edge_id
    errors: list[ValidationError] = []
    
    for edge in workflow.edges:
        key = f"{edge.source}:{edge.source_port}->{edge.target}:{edge.target_port}"
        existing = seen.get(key)
        
        if existing is not None:
            errors.append(ValidationError(
                code=ValidationErrorCode.DUPLICATE_EDGE,
                message="Duplicate edge between same ports",
                edge_ids=[existing, edge.id],
            ))
        else:
            seen[key] = edge.id
    
    if errors:
        return ValidationResult.failure(errors)
    return ValidationResult.success()


def validate_has_entry_node(workflow: Workflow) -> ValidationResult:
    """
    S4: Workflow must have at least one entry node.
    """
    if len(workflow.nodes) == 0:
        return ValidationResult.failure([ValidationError(
            code=ValidationErrorCode.NO_ENTRY_NODE,
            message="Workflow has no nodes",
        )])
    
    entries = find_entry_nodes(workflow)
    
    if len(entries) == 0:
        return ValidationResult.failure([ValidationError(
            code=ValidationErrorCode.NO_ENTRY_NODE,
            message="Workflow has no entry nodes (all nodes have incoming edges)",
        )])
    
    return ValidationResult.success()


def validate_no_orphans(workflow: Workflow) -> ValidationResult:
    """
    S5: No orphan nodes (every node must be reachable from entry OR reach exit).
    
    Uses bidirectional BFS: forward from entries, backward from exits.
    """
    entries = find_entry_nodes(workflow)
    exits = find_exit_nodes(workflow)
    adj = build_adjacency_list(workflow)
    rev_adj = build_reverse_adjacency_list(workflow)
    edge_map = workflow.get_edge_map()
    
    # BFS forward from entries
    reachable_from_entry: set[str] = set()
    forward_queue: deque[str] = deque(entries)
    
    while forward_queue:
        node_id = forward_queue.popleft()
        if node_id in reachable_from_entry:
            continue
        reachable_from_entry.add(node_id)
        
        for edge_id in adj.get(node_id, []):
            edge = edge_map.get(edge_id)
            if edge:
                forward_queue.append(edge.target)
    
    # BFS backward from exits
    reaches_exit: set[str] = set()
    backward_queue: deque[str] = deque(exits)
    
    while backward_queue:
        node_id = backward_queue.popleft()
        if node_id in reaches_exit:
            continue
        reaches_exit.add(node_id)
        
        for edge_id in rev_adj.get(node_id, []):
            edge = edge_map.get(edge_id)
            if edge:
                backward_queue.append(edge.source)
    
    # Find orphans: nodes not in either set
    orphans = [
        node.id
        for node in workflow.nodes
        if node.id not in reachable_from_entry and node.id not in reaches_exit
    ]
    
    if orphans:
        return ValidationResult.failure([ValidationError(
            code=ValidationErrorCode.ORPHAN_NODE,
            message=f"Found {len(orphans)} orphan node(s) not connected to workflow",
            node_ids=orphans,
        )])
    
    return ValidationResult.success()


def validate_no_cycles(workflow: Workflow) -> ValidationResult:
    """
    S1: Detect cycles using DFS with three-color marking.
    
    Colors:
    - 0 = unvisited
    - 1 = visiting (in current DFS path)
    - 2 = visited (fully processed)
    """
    adj = build_adjacency_list(workflow)
    edge_map = workflow.get_edge_map()
    
    # Initialize all nodes as unvisited
    state: dict[str, int] = {node.id: 0 for node in workflow.nodes}
    cycle_nodes: list[str] = []
    
    def dfs(node_id: str) -> bool:
        """Returns True if cycle detected."""
        current_state = state.get(node_id, 0)
        
        if current_state == 2:  # Already fully processed
            return False
        if current_state == 1:  # Back edge = cycle
            return True
        
        state[node_id] = 1  # Mark as visiting
        
        for edge_id in adj.get(node_id, []):
            edge = edge_map.get(edge_id)
            if edge and dfs(edge.target):
                cycle_nodes.append(node_id)
                return True
        
        state[node_id] = 2  # Mark as visited
        return False
    
    for node in workflow.nodes:
        if state.get(node.id, 0) == 0:
            if dfs(node.id):
                return ValidationResult.failure([ValidationError(
                    code=ValidationErrorCode.CYCLE_DETECTED,
                    message="Workflow contains a cycle",
                    node_ids=cycle_nodes,
                )])
    
    return ValidationResult.success()