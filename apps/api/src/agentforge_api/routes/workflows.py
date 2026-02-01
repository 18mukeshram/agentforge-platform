# apps/api/src/agentforge_api/routes/workflows.py

"""Workflow CRUD routes with authentication and tenant isolation."""

from fastapi import APIRouter, Query, Depends

from agentforge_api.models import WorkflowStatus
from agentforge_api.services.workflow_service import workflow_service
from agentforge_api.auth import (
    Auth,
    Role,
    require_role,
    require_write_access,
    require_admin_access,
)
from agentforge_api.routes.dto import (
    CreateWorkflowRequest,
    UpdateWorkflowRequest,
    WorkflowResponse,
    WorkflowSummary,
    WorkflowListResponse,
    WorkflowDeleteResponse,
)


router = APIRouter(prefix="/workflows", tags=["workflows"])


def workflow_to_response(
    workflow,
    validation_errors=None,
) -> WorkflowResponse:
    """Convert Workflow model to response DTO."""
    return WorkflowResponse(
        id=workflow.id,
        status=workflow.status,
        name=workflow.meta.name,
        description=workflow.meta.description,
        created_at=workflow.meta.created_at,
        updated_at=workflow.meta.updated_at,
        owner_id=workflow.meta.owner_id,
        version=workflow.meta.version,
        nodes=list(workflow.nodes),
        edges=list(workflow.edges),
        validation_errors=validation_errors,
    )


@router.post(
    "",
    status_code=201,
    response_model=WorkflowResponse,
    dependencies=[Depends(require_write_access)],
)
async def create_workflow(
    request: CreateWorkflowRequest,
    auth: Auth,
) -> WorkflowResponse:
    """
    Create a new workflow.
    
    Requires: MEMBER, ADMIN, or OWNER role.
    Runs structural validation on creation.
    Saves even if invalid (status will be 'invalid').
    """
    workflow, errors = workflow_service.create(
        name=request.name,
        description=request.description,
        nodes=list(request.nodes),
        edges=list(request.edges),
        owner_id=auth.user_id,
        tenant_id=auth.tenant_id,
    )
    
    return workflow_to_response(workflow, errors)


@router.get("", response_model=WorkflowListResponse)
async def list_workflows(
    auth: Auth,
    status: WorkflowStatus | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = Query(default=None),
) -> WorkflowListResponse:
    """
    List workflows for the current tenant.
    
    Requires: Any authenticated role (VIEWER+).
    Only returns workflows belonging to the user's tenant.
    """
    workflows, next_cursor = workflow_service.list(
        tenant_id=auth.tenant_id,
        status=status,
        limit=limit,
        cursor=cursor,
    )
    
    items = [
        WorkflowSummary(
            id=w.id,
            name=w.meta.name,
            status=w.status,
            updated_at=w.meta.updated_at,
            node_count=len(w.nodes),
        )
        for w in workflows
    ]
    
    return WorkflowListResponse(items=items, next_cursor=next_cursor)


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(
    workflow_id: str,
    auth: Auth,
) -> WorkflowResponse:
    """
    Get a workflow by ID.
    
    Requires: Any authenticated role (VIEWER+).
    Returns full workflow with nodes, edges, and validation errors.
    Enforces tenant isolation.
    """
    workflow = workflow_service.get(
        workflow_id=workflow_id,
        tenant_id=auth.tenant_id,
    )
    errors = workflow_service.get_validation_errors(workflow_id)
    
    return workflow_to_response(workflow, errors)


@router.put(
    "/{workflow_id}",
    response_model=WorkflowResponse,
    dependencies=[Depends(require_write_access)],
)
async def update_workflow(
    workflow_id: str,
    request: UpdateWorkflowRequest,
    auth: Auth,
) -> WorkflowResponse:
    """
    Update a workflow.
    
    Requires: MEMBER, ADMIN, or OWNER role.
    Requires version for optimistic concurrency control.
    Runs structural validation on update.
    Enforces tenant isolation.
    """
    workflow, errors = workflow_service.update(
        workflow_id=workflow_id,
        tenant_id=auth.tenant_id,
        nodes=list(request.nodes),
        edges=list(request.edges),
        version=request.version,
        name=request.name,
        description=request.description,
    )
    
    return workflow_to_response(workflow, errors)


@router.delete(
    "/{workflow_id}",
    response_model=WorkflowDeleteResponse,
    dependencies=[Depends(require_admin_access)],
)
async def delete_workflow(
    workflow_id: str,
    auth: Auth,
) -> WorkflowDeleteResponse:
    """
    Soft-delete a workflow.
    
    Requires: ADMIN or OWNER role.
    Sets status to 'archived'. Can be restored via update.
    Enforces tenant isolation.
    """
    workflow = workflow_service.delete(
        workflow_id=workflow_id,
        tenant_id=auth.tenant_id,
    )
    
    return WorkflowDeleteResponse(
        id=workflow.id,
        status=workflow.status,
    )