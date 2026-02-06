# apps/api/src/agentforge_api/validation/validator.py

"""
Composed DAG validator.

Runs all validations in correct order:
1. Structural (S1-S5) - must pass before semantic
2. Semantic (M1-M2) - requires agent registry
"""

from dataclasses import dataclass

from agentforge_api.models import (
    ValidationError,
    ValidationResult,
    Workflow,
)
from agentforge_api.validation.semantic import (
    AgentRegistry,
    validate_required_inputs,
    validate_type_compatibility,
)
from agentforge_api.validation.structural import (
    validate_edge_references,
    validate_has_entry_node,
    validate_no_cycles,
    validate_no_duplicate_edges,
    validate_no_orphans,
)
from agentforge_api.validation.topological import (
    get_execution_order,
)


@dataclass(frozen=True)
class ValidateWorkflowOptions:
    """Options for workflow validation."""

    agent_registry: AgentRegistry | None = None
    """Agent registry for semantic validation. If None, semantic validation is skipped."""

    fail_fast: bool = False
    """If True, stop at first error category. If False, collect all errors."""


def validate_workflow(
    workflow: Workflow,
    options: ValidateWorkflowOptions | None = None,
) -> ValidationResult:
    """
    Validate a workflow against all invariants.

    Runs validations in order:
    1. Structural (S1-S5) - must pass before semantic
    2. Semantic (M1-M2) - requires agent registry

    Returns combined result with all errors.
    """
    if options is None:
        options = ValidateWorkflowOptions()

    all_errors: list[ValidationError] = []

    def collect_errors(result: ValidationResult) -> bool:
        """
        Collect errors from result.
        Returns True if should exit early (fail_fast mode with errors).
        """
        if not result.valid:
            all_errors.extend(result.errors)
            if options.fail_fast:
                return True
        return False

    # === Structural Validation (order matters) ===

    # S2: Edge references must be valid first
    if collect_errors(validate_edge_references(workflow)):
        return ValidationResult.failure(all_errors)

    # S3: No duplicate edges
    if collect_errors(validate_no_duplicate_edges(workflow)):
        return ValidationResult.failure(all_errors)

    # S4: Must have entry node
    if collect_errors(validate_has_entry_node(workflow)):
        return ValidationResult.failure(all_errors)

    # S1: No cycles (requires valid edges)
    if collect_errors(validate_no_cycles(workflow)):
        return ValidationResult.failure(all_errors)

    # S5: No orphans (requires acyclic graph)
    if collect_errors(validate_no_orphans(workflow)):
        return ValidationResult.failure(all_errors)

    # Exit if structural errors and no semantic validation requested
    if all_errors and options.agent_registry is None:
        return ValidationResult.failure(all_errors)

    # === Semantic Validation (requires agent registry) ===

    if options.agent_registry is not None:
        # M1: Type compatibility
        if collect_errors(validate_type_compatibility(workflow, options.agent_registry)):
            return ValidationResult.failure(all_errors)

        # M2: Required inputs satisfied
        if collect_errors(validate_required_inputs(workflow, options.agent_registry)):
            return ValidationResult.failure(all_errors)

    # Return result
    if all_errors:
        return ValidationResult.failure(all_errors)

    # Compute execution order for valid workflows
    execution_order = get_execution_order(workflow)
    return ValidationResult.success(execution_order=execution_order)


def validate_workflow_structure(workflow: Workflow) -> ValidationResult:
    """
    Quick structural-only validation.
    Use for fast feedback during editing.
    """
    return validate_workflow(
        workflow,
        ValidateWorkflowOptions(
            agent_registry=None,
            fail_fast=False,
        ),
    )


def validate_workflow_full(
    workflow: Workflow,
    agent_registry: AgentRegistry,
) -> ValidationResult:
    """
    Full validation including semantics.
    Use before execution.
    """
    return validate_workflow(
        workflow,
        ValidateWorkflowOptions(
            agent_registry=agent_registry,
            fail_fast=False,
        ),
    )
