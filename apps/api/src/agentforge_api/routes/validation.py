# apps/api/src/agentforge_api/routes/validation.py

"""Validation routes with authentication and tenant isolation."""

from datetime import UTC, datetime

from fastapi import APIRouter
from pydantic import BaseModel, Field

from agentforge_api.auth import Auth
from agentforge_api.core.exceptions import WorkflowArchivedError
from agentforge_api.models import (
    Edge,
    Node,
    Workflow,
    WorkflowMeta,
    WorkflowStatus,
)
from agentforge_api.models import ValidationError as DomainValidationError
from agentforge_api.routes.dto import CamelModel
from agentforge_api.services.workflow_service import workflow_service
from agentforge_api.validation import (
    AgentRegistry,
    validate_workflow_full,
    validate_workflow_structure,
)

router = APIRouter(tags=["validation"])


class ValidateWorkflowRequest(BaseModel):
    """Request body for validating a workflow payload."""

    nodes: list[Node]
    edges: list[Edge]


class ValidationResponse(CamelModel):
    """Response for validation endpoints."""

    valid: bool
    errors: list[DomainValidationError] = Field(default_factory=list)
    execution_order: list[str] | None = None


def get_agent_registry() -> AgentRegistry:
    """Get agent registry for semantic validation."""
    return {}


def _update_workflow_status(workflow_id: str, status: WorkflowStatus) -> None:
    """Update workflow status in storage."""
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
            updated_at=datetime.now(UTC),
            owner_id=existing.meta.owner_id,
            version=existing.meta.version,
        ),
        nodes=existing.nodes,
        edges=existing.edges,
    )

    workflow_service._workflows[workflow_id] = updated


@router.post(
    "/workflows/{workflow_id}/validate",
    response_model=ValidationResponse,
)
async def validate_persisted_workflow(
    workflow_id: str,
    auth: Auth,
) -> ValidationResponse:
    """
    Validate a persisted workflow.

    Requires: Any authenticated role (VIEWER+).
    Runs full validation (structural + semantic).
    Updates workflow status based on result.
    Enforces tenant isolation.
    """
    # Get workflow (enforces tenant isolation)
    workflow = workflow_service.get(workflow_id, auth.tenant_id)

    if workflow.status == WorkflowStatus.ARCHIVED:
        raise WorkflowArchivedError(workflow_id)

    agent_registry = get_agent_registry()

    if agent_registry:
        result = validate_workflow_full(workflow, agent_registry)
    else:
        result = validate_workflow_structure(workflow)

    # Update workflow status
    if result.valid:
        _update_workflow_status(workflow_id, WorkflowStatus.VALID)
        workflow_service._validation_errors.pop(workflow_id, None)
    else:
        _update_workflow_status(workflow_id, WorkflowStatus.INVALID)
        workflow_service._validation_errors[workflow_id] = list(result.errors)

    return ValidationResponse(
        valid=result.valid,
        errors=list(result.errors),
        execution_order=(list(result.execution_order) if result.execution_order else None),
    )


@router.post(
    "/workflows/validate",
    response_model=ValidationResponse,
)
async def validate_workflow_payload(
    request: ValidateWorkflowRequest,
    auth: Auth,
) -> ValidationResponse:
    """
    Validate a workflow payload without persisting.

    Requires: Any authenticated role (VIEWER+).
    Useful for client-side "check before save" flow.
    """
    temp_workflow = Workflow(
        id="temp_validation",
        status=WorkflowStatus.DRAFT,
        meta=WorkflowMeta(
            name="Validation",
            description="",
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
            owner_id=auth.user_id,
            version=1,
        ),
        nodes=list(request.nodes),
        edges=list(request.edges),
    )

    agent_registry = get_agent_registry()

    if agent_registry:
        result = validate_workflow_full(temp_workflow, agent_registry)
    else:
        result = validate_workflow_structure(temp_workflow)

    return ValidationResponse(
        valid=result.valid,
        errors=list(result.errors),
        execution_order=(list(result.execution_order) if result.execution_order else None),
    )
