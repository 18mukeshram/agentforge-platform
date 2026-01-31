# apps/api/src/agentforge_api/routes/validation.py

"""Validation routes for workflow DAG validation."""

from fastapi import APIRouter

from agentforge_api.models import (
    Node,
    Edge,
    Workflow,
    WorkflowMeta,
    WorkflowStatus,
    ValidationError as DomainValidationError,
    AgentDefinition,
)
from agentforge_api.core.exceptions import WorkflowArchivedError
from agentforge_api.services.workflow_service import workflow_service
from agentforge_api.validation import (
    validate_workflow_structure,
    validate_workflow_full,
    AgentRegistry,
)
from pydantic import BaseModel, Field
from datetime import datetime, timezone


router = APIRouter(tags=["validation"])

# Placeholder owner ID until auth is implemented
TEMP_OWNER_ID = "user_001"


# === DTOs ===


class ValidateWorkflowRequest(BaseModel):
    """Request body for validating a workflow payload."""
    
    nodes: list[Node]
    edges: list[Edge]


class ValidationResponse(BaseModel):
    """Response for validation endpoints."""
    
    valid: bool
    errors: list[DomainValidationError] = Field(default_factory=list)
    execution_order: list[str] | None = None


# === In-Memory Agent Registry (temporary) ===


def get_agent_registry() -> AgentRegistry:
    """
    Get agent registry for semantic validation.
    
    Temporary in-memory implementation.
    Will be replaced with database lookup.
    """
    # Empty for now - semantic validation will be skipped
    # until we have agent management
    return {}


# === Route Handlers ===


@router.post(
    "/workflows/{workflow_id}/validate",
    response_model=ValidationResponse,
)
async def validate_persisted_workflow(
    workflow_id: str,
) -> ValidationResponse:
    """
    Validate a persisted workflow.
    
    Runs full validation (structural + semantic).
    Updates workflow status based on result.
    """
    # Fetch workflow
    workflow = workflow_service.get(workflow_id, TEMP_OWNER_ID)
    
    if workflow.status == WorkflowStatus.ARCHIVED:
        raise WorkflowArchivedError(workflow_id)
    
    # Get agent registry for semantic validation
    agent_registry = get_agent_registry()
    
    # Run full validation
    if agent_registry:
        result = validate_workflow_full(workflow, agent_registry)
    else:
        # Fall back to structural-only if no agents registered
        result = validate_workflow_structure(workflow)
    
    # Update workflow status in storage
    if result.valid:
        _update_workflow_status(workflow_id, WorkflowStatus.VALID)
        workflow_service._validation_errors.pop(workflow_id, None)
    else:
        _update_workflow_status(workflow_id, WorkflowStatus.INVALID)
        workflow_service._validation_errors[workflow_id] = list(result.errors)
    
    return ValidationResponse(
        valid=result.valid,
        errors=list(result.errors),
        execution_order=list(result.execution_order) if result.execution_order else None,
    )


@router.post(
    "/workflows/validate",
    response_model=ValidationResponse,
)
async def validate_workflow_payload(
    request: ValidateWorkflowRequest,
) -> ValidationResponse:
    """
    Validate a workflow payload without persisting.
    
    Useful for client-side "check before save" flow.
    Runs full validation (structural + semantic).
    """
    # Build temporary workflow for validation
    temp_workflow = Workflow(
        id="temp_validation",
        status=WorkflowStatus.DRAFT,
        meta=WorkflowMeta(
            name="Validation",
            description="",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            owner_id=TEMP_OWNER_ID,
            version=1,
        ),
        nodes=list(request.nodes),
        edges=list(request.edges),
    )
    
    # Get agent registry for semantic validation
    agent_registry = get_agent_registry()
    
    # Run full validation
    if agent_registry:
        result = validate_workflow_full(temp_workflow, agent_registry)
    else:
        # Fall back to structural-only if no agents registered
        result = validate_workflow_structure(temp_workflow)
    
    return ValidationResponse(
        valid=result.valid,
        errors=list(result.errors),
        execution_order=list(result.execution_order) if result.execution_order else None,
    )


# === Helpers ===


def _update_workflow_status(workflow_id: str, status: WorkflowStatus) -> None:
    """
    Update workflow status in storage.
    
    Helper to update just the status without full update flow.
    """
    existing = workflow_service._workflows.get(workflow_id)
    if existing is None:
        return
    
    updated = Workflow(
        id=existing.id,
        status=status,
        meta=WorkflowMeta(
            name=existing.meta.name,
            description=existing.meta.description,
            created_at=existing.meta.created_at,
            updated_at=datetime.now(timezone.utc),
            owner_id=existing.meta.owner_id,
            version=existing.meta.version,
        ),
        nodes=existing.nodes,
        edges=existing.edges,
    )
    
    workflow_service._workflows[workflow_id] = updated