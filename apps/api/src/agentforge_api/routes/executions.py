# apps/api/src/agentforge_api/routes/executions.py

"""Execution routes with authentication and tenant isolation."""

from fastapi import APIRouter, Depends, Query

from agentforge_api.auth import (
    Auth,
    require_write_access,
)
from agentforge_api.core.exceptions import (
    WorkflowArchivedError,
    WorkflowInvalidError,
)
from agentforge_api.models import (
    ExecutionStatus,
    NodeExecutionStatus,
    WorkflowStatus,
)
from agentforge_api.routes.dto import (
    ExecuteWorkflowRequest,
    ExecutionCancelResponse,
    ExecutionListResponse,
    ExecutionLogsResponse,
    ExecutionResponse,
    ExecutionSummary,
    ExecutionTriggerResponse,
    LogEntry,
    NodeExecutionStateResponse,
    ResumeExecutionRequest,
    ResumeExecutionResponse,
)
from agentforge_api.services.execution_service import execution_service
from agentforge_api.services.orchestrator import orchestrator
from agentforge_api.services.workflow_service import workflow_service

router = APIRouter(prefix="/executions", tags=["executions"])


def execution_to_response(execution) -> ExecutionResponse:
    """Convert Execution model to response DTO."""
    outputs = None
    if execution.status == ExecutionStatus.COMPLETED:
        outputs = {}
        for state in execution.node_states:
            if state.status == NodeExecutionStatus.COMPLETED and state.output:
                outputs[state.node_id] = state.output

    return ExecutionResponse(
        id=execution.id,
        workflow_id=execution.workflow_id,
        status=execution.status,
        workflow_version=execution.workflow_version,
        triggered_by=execution.triggered_by,
        created_at=execution.created_at,
        started_at=execution.started_at,
        completed_at=execution.completed_at,
        node_states=[
            NodeExecutionStateResponse(
                node_id=state.node_id,
                status=state.status,
                started_at=state.started_at,
                completed_at=state.completed_at,
                retry_count=state.retry_count,
                error=state.error,
                output=state.output,
            )
            for state in execution.node_states
        ],
        inputs=execution.inputs,
        outputs=outputs,
    )


@router.post(
    "/workflows/{workflow_id}/execute",
    status_code=202,
    response_model=ExecutionTriggerResponse,
    tags=["workflows"],
    dependencies=[Depends(require_write_access)],
)
async def execute_workflow(
    workflow_id: str,
    request: ExecuteWorkflowRequest,
    auth: Auth,
) -> ExecutionTriggerResponse:
    """
    Trigger workflow execution.

    Requires: MEMBER, ADMIN, or OWNER role.
    Validates workflow, creates execution record, and dispatches jobs.
    Returns immediately with execution ID (async execution).
    Enforces tenant isolation.
    """
    # Get workflow (enforces tenant isolation)
    workflow = workflow_service.get(workflow_id, auth.tenant_id)

    if workflow.status == WorkflowStatus.ARCHIVED:
        raise WorkflowArchivedError(workflow_id)

    # Initialize orchestrator if needed
    await orchestrator.initialize()

    # Create execution record with tenant context
    execution = execution_service.create(
        workflow=workflow,
        inputs=request.inputs,
        triggered_by=auth.user_id,
        tenant_id=auth.tenant_id,
    )

    # Start execution
    try:
        await orchestrator.start_execution(workflow, execution)
    except WorkflowInvalidError:
        execution_service.update_status(execution.id, ExecutionStatus.FAILED)
        raise

    return ExecutionTriggerResponse(
        execution_id=execution.id,
        status=ExecutionStatus.RUNNING,
        workflow_id=workflow_id,
        created_at=execution.created_at,
    )


@router.get("/{execution_id}", response_model=ExecutionResponse)
async def get_execution(
    execution_id: str,
    auth: Auth,
) -> ExecutionResponse:
    """
    Get execution status and details.

    Requires: Any authenticated role (VIEWER+).
    Returns full execution state including all node states.
    Enforces tenant isolation.
    """
    execution = execution_service.get(execution_id, auth.tenant_id)
    return execution_to_response(execution)


@router.get("", response_model=ExecutionListResponse)
async def list_executions(
    auth: Auth,
    workflow_id: str | None = Query(default=None, description="Filter by workflow ID"),
    status: str | None = Query(default=None, description="Filter by status"),
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = Query(default=None),
) -> ExecutionListResponse:
    """
    List executions.

    Requires: Any authenticated role (VIEWER+).
    Supports cursor-based pagination.
    Can filter by workflow_id and/or status.
    Enforces tenant isolation.
    """
    # If workflow_id is provided, verify it belongs to tenant
    if workflow_id:
        workflow_service.get(workflow_id, auth.tenant_id)

    executions, next_cursor = execution_service.list_by_workflow(
        workflow_id=workflow_id,
        tenant_id=auth.tenant_id,
        limit=limit,
        cursor=cursor,
        status=status,
    )

    items = [
        ExecutionSummary(
            id=e.id,
            workflow_id=e.workflow_id,
            status=e.status,
            created_at=e.created_at,
            completed_at=e.completed_at,
        )
        for e in executions
    ]

    return ExecutionListResponse(items=items, next_cursor=next_cursor)


@router.post(
    "/{execution_id}/cancel",
    status_code=202,
    response_model=ExecutionCancelResponse,
    dependencies=[Depends(require_write_access)],
)
async def cancel_execution(
    execution_id: str,
    auth: Auth,
) -> ExecutionCancelResponse:
    """
    Cancel a running execution.

    Requires: MEMBER, ADMIN, or OWNER role.
    Cancels pending jobs and marks execution as cancelled.
    Already-running nodes may complete.
    Enforces tenant isolation.
    """
    from agentforge_api.services.queue import job_queue

    # Get execution (enforces tenant isolation)
    execution = execution_service.get(execution_id, auth.tenant_id)

    if execution.status not in (ExecutionStatus.PENDING, ExecutionStatus.RUNNING):
        return ExecutionCancelResponse(
            id=execution.id,
            status=execution.status,
        )

    # Cancel all pending jobs
    await job_queue.cancel_execution(execution_id)

    # Update execution status
    updated = execution_service.cancel(execution_id, auth.tenant_id)

    # Mark pending nodes as skipped
    for state in execution.node_states:
        if state.status in (NodeExecutionStatus.PENDING, NodeExecutionStatus.QUEUED):
            execution_service.update_node_state(
                execution_id=execution_id,
                node_id=state.node_id,
                status=NodeExecutionStatus.SKIPPED,
                error="Cancelled by user",
            )

    # Emit cancellation event
    await orchestrator.cancel_execution(execution_id)

    return ExecutionCancelResponse(
        id=updated.id,
        status=updated.status,
    )


@router.get("/{execution_id}/logs", response_model=ExecutionLogsResponse)
async def get_execution_logs(
    execution_id: str,
    auth: Auth,
    node_id: str | None = Query(default=None, description="Filter by node ID"),
    level: str | None = Query(default=None, description="Filter by level"),
    limit: int = Query(default=100, ge=1, le=500),
    cursor: str | None = Query(default=None),
) -> ExecutionLogsResponse:
    """
    Get execution logs.

    Requires: Any authenticated role (VIEWER+).
    Enforces tenant isolation.
    """
    # Verify execution belongs to tenant
    execution = execution_service.get(execution_id, auth.tenant_id)

    logs: list[LogEntry] = []

    for state in execution.node_states:
        if node_id and state.node_id != node_id:
            continue

        if state.started_at:
            log_entry = LogEntry(
                timestamp=state.started_at,
                node_id=state.node_id,
                level="info",
                message="Node started execution",
            )
            if not level or level == "info":
                logs.append(log_entry)

        if state.completed_at:
            if state.status == NodeExecutionStatus.COMPLETED:
                log_entry = LogEntry(
                    timestamp=state.completed_at,
                    node_id=state.node_id,
                    level="info",
                    message="Node completed successfully",
                )
                if not level or level == "info":
                    logs.append(log_entry)
            elif state.status == NodeExecutionStatus.FAILED:
                log_entry = LogEntry(
                    timestamp=state.completed_at,
                    node_id=state.node_id,
                    level="error",
                    message=f"Node failed: {state.error}",
                )
                if not level or level == "error":
                    logs.append(log_entry)
            elif state.status == NodeExecutionStatus.SKIPPED:
                log_entry = LogEntry(
                    timestamp=state.completed_at,
                    node_id=state.node_id,
                    level="warn",
                    message=f"Node skipped: {state.error}",
                )
                if not level or level == "warn":
                    logs.append(log_entry)

    logs.sort(key=lambda log: log.timestamp)
    logs = logs[:limit]

    return ExecutionLogsResponse(
        items=logs,
        next_cursor=None,
    )


@router.post(
    "/{execution_id}/resume",
    status_code=201,
    response_model=ResumeExecutionResponse,
    dependencies=[Depends(require_write_access)],
)
async def resume_execution(
    execution_id: str,
    request: ResumeExecutionRequest,
    auth: Auth,
) -> ResumeExecutionResponse:
    """
    Resume a failed execution from a specific failed node.

    Creates a new execution with lineage to the original.
    Does NOT start execution - only creates the resume plan.

    Requires: MEMBER, ADMIN, or OWNER role.
    Enforces tenant isolation.

    Validation:
    - Execution must exist
    - Execution must be FAILED
    - Node must exist in execution
    - Node must be in FAILED status
    - Workflow version must match
    """
    from agentforge_api.core.exceptions import ResumeNotAllowedError
    from agentforge_api.services.execution_service import compute_downstream_nodes

    # Get execution (enforces tenant isolation)
    execution = execution_service.get(execution_id, auth.tenant_id)

    # Validate execution is failed
    if execution.status != ExecutionStatus.FAILED:
        raise ResumeNotAllowedError(
            execution_id,
            f"Execution status is '{execution.status.value}', must be 'failed'",
        )

    # Validate node exists in execution
    state_map = execution.get_node_state_map()
    node_state = state_map.get(request.node_id)

    if node_state is None:
        raise ResumeNotAllowedError(
            execution_id,
            f"Node '{request.node_id}' not found in execution",
        )

    # Validate node is failed
    if node_state.status != NodeExecutionStatus.FAILED:
        raise ResumeNotAllowedError(
            execution_id,
            f"Node '{request.node_id}' status is '{node_state.status.value}', must be 'failed'",
        )

    # Get current workflow (ensure workflow is retrievable)
    workflow = workflow_service.get(execution.workflow_id, auth.tenant_id)

    # Validate workflow version matches
    if workflow.meta.version != execution.workflow_version:
        raise ResumeNotAllowedError(
            execution_id,
            f"Workflow version changed (was {execution.workflow_version}, now {workflow.meta.version})",
        )

    # Validate node still exists in workflow
    workflow_node_ids = {node.id for node in workflow.nodes}
    if request.node_id not in workflow_node_ids:
        raise ResumeNotAllowedError(
            execution_id,
            f"Node '{request.node_id}' no longer exists in workflow",
        )

    # Compute skip/rerun plan
    skipped_nodes, rerun_nodes = compute_downstream_nodes(workflow, request.node_id)

    # Validate all upstream nodes completed
    for node_id in skipped_nodes:
        upstream_state = state_map.get(node_id)
        if upstream_state and upstream_state.status != NodeExecutionStatus.COMPLETED:
            raise ResumeNotAllowedError(
                execution_id,
                f"Upstream node '{node_id}' is not completed (status: {upstream_state.status.value})",
            )

    # Create new execution with lineage
    new_execution = execution_service.create_resumed(
        parent_execution=execution,
        workflow=workflow,
        resume_from_node_id=request.node_id,
        triggered_by=auth.user_id,
        tenant_id=auth.tenant_id,
        skipped_nodes=skipped_nodes,
        rerun_nodes=rerun_nodes,
    )

    return ResumeExecutionResponse(
        execution_id=new_execution.id,
        parent_execution_id=execution.id,
        resumed_from_node_id=request.node_id,
        workflow_id=workflow.id,
        workflow_version=workflow.meta.version,
        skipped_nodes=skipped_nodes,
        rerun_nodes=rerun_nodes,
        status=new_execution.status,
    )
