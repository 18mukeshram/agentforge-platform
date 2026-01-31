# apps/api/src/agentforge_api/validation/semantic.py

"""
Semantic validators for DAG invariants M1-M2.

Validates type compatibility and required input satisfaction.
Requires agent registry for schema lookup.
"""

from agentforge_api.models import (
    Workflow,
    ValidationResult,
    ValidationError,
    ValidationErrorCode,
    AgentDefinition,
    DataType,
)
from agentforge_api.validation.graph import build_reverse_adjacency_list


# Type alias for agent registry
AgentRegistry = dict[str, AgentDefinition]


def are_types_compatible(source: DataType, target: DataType) -> bool:
    """
    Check if source type can flow to target type.
    Currently strict equality; can be extended for coercion rules.
    """
    # Strict equality for now
    if source == target:
        return True
    
    # Future: could add coercion rules
    # e.g., number -> string, object -> array (if array of objects)
    
    return False


def validate_type_compatibility(
    workflow: Workflow,
    registry: AgentRegistry,
) -> ValidationResult:
    """
    M1: Source output type must match target input type.
    """
    errors: list[ValidationError] = []
    node_map = workflow.get_node_map()
    
    for edge in workflow.edges:
        source_node = node_map.get(edge.source)
        target_node = node_map.get(edge.target)
        
        # Skip if nodes don't exist (caught by structural validation)
        if source_node is None or target_node is None:
            continue
        
        # Get agent IDs from node config
        source_agent_id = source_node.config.agent_id
        target_agent_id = target_node.config.agent_id
        
        # Skip non-agent nodes (input/output nodes have dynamic types)
        if source_agent_id is None or target_agent_id is None:
            continue
        
        source_agent = registry.get(source_agent_id)
        target_agent = registry.get(target_agent_id)
        
        if source_agent is None or target_agent is None:
            errors.append(ValidationError(
                code=ValidationErrorCode.TYPE_MISMATCH,
                message="Unknown agent definition referenced",
                node_ids=[edge.source, edge.target],
                edge_ids=[edge.id],
            ))
            continue
        
        # Find port schemas
        source_port = next(
            (p for p in source_agent.output_schema.ports if p.name == edge.source_port),
            None,
        )
        target_port = next(
            (p for p in target_agent.input_schema.ports if p.name == edge.target_port),
            None,
        )
        
        if source_port is None:
            errors.append(ValidationError(
                code=ValidationErrorCode.TYPE_MISMATCH,
                message=f"Source node has no output port: {edge.source_port}",
                node_ids=[edge.source],
                edge_ids=[edge.id],
            ))
            continue
        
        if target_port is None:
            errors.append(ValidationError(
                code=ValidationErrorCode.TYPE_MISMATCH,
                message=f"Target node has no input port: {edge.target_port}",
                node_ids=[edge.target],
                edge_ids=[edge.id],
            ))
            continue
        
        # Check type compatibility
        if not are_types_compatible(source_port.type, target_port.type):
            errors.append(ValidationError(
                code=ValidationErrorCode.TYPE_MISMATCH,
                message=f"Type mismatch: {source_port.type.value} -> {target_port.type.value}",
                node_ids=[edge.source, edge.target],
                edge_ids=[edge.id],
            ))
    
    if errors:
        return ValidationResult.failure(errors)
    return ValidationResult.success()


def validate_required_inputs(
    workflow: Workflow,
    registry: AgentRegistry,
) -> ValidationResult:
    """
    M2: All required inputs of a node must have incoming edges.
    """
    errors: list[ValidationError] = []
    rev_adj = build_reverse_adjacency_list(workflow)
    edge_map = workflow.get_edge_map()
    
    for node in workflow.nodes:
        # Skip non-agent nodes
        agent_id = node.config.agent_id
        if agent_id is None:
            continue
        
        agent = registry.get(agent_id)
        if agent is None:
            continue  # Caught by type compatibility validation
        
        # Get incoming edges for this node
        incoming_edge_ids = rev_adj.get(node.id, [])
        connected_ports: set[str] = set()
        
        for edge_id in incoming_edge_ids:
            edge = edge_map.get(edge_id)
            if edge:
                connected_ports.add(edge.target_port)
        
        # Check each required input port
        missing_ports: list[str] = [
            port.name
            for port in agent.input_schema.ports
            if port.required and port.name not in connected_ports
        ]
        
        if missing_ports:
            errors.append(ValidationError(
                code=ValidationErrorCode.MISSING_REQUIRED_INPUT,
                message=f"Missing required inputs: {', '.join(missing_ports)}",
                node_ids=[node.id],
            ))
    
    if errors:
        return ValidationResult.failure(errors)
    return ValidationResult.success()