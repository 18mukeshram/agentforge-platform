# apps/api/src/agentforge_api/routes/executions.py

"""Execution routes for workflow execution management."""

from fastapi import APIRouter, Query

from agentforge_api.models import (
    WorkflowStatus,
    ExecutionStatus,
    NodeExecutionStatus,
)
from agentforge_api.core.exceptions import (
    WorkflowArchivedError,
    WorkflowInvalidError,
)
from agentforge_api.services.workflow_service import workflow_service
from agentforge_api.services.execution_service import execution_service
from agentforge_api.services.orchestrator import orchestrator
from agentforge_api.routes.dto import (
    ExecuteWorkflowRequest,
    ExecutionResponse,
    ExecutionSummary,
    ExecutionListResponse,
    ExecutionTriggerResponse,
    ExecutionCancelResponse,
    ExecutionLogsResponse,
    NodeExecutionStateResponse,
    LogEntry,
)


router = APIRouter(prefix="/executions", tags=["executions"])

# Placeholder owner ID until auth is implemented
TEMP_OWNER_ID = "user_001"


def execution_to_response(execution) -> ExecutionResponse:
    """Convert Execution model to response DTO."""
    # Compute outputs from exit nodes if completed
    outputs = None
    if execution.status == ExecutionStatus.COMPLETED:
        outputs = {}
        for state in execution.node_states:
            if state.status == NodeExecutionStatus.COMPLETED and state.output:
                # Include all completed node outputs
                # Future: filter to only output nodes
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
)
async def execute_workflow(
    workflow_id: str,
    request: ExecuteWorkflowRequest,
) -> ExecutionTriggerResponse:
    """
    Trigger workflow execution.
    
    Validates workflow, creates execution record, and dispatches jobs.
    Returns immediately with execution ID (async execution).
    """
    # Get workflow
    workflow = workflow_service.get(workflow_id, TEMP_OWNER_ID)
    
    # Check if archived
    if workflow.status == WorkflowStatus.ARCHIVED:
        raise WorkflowArchivedError(workflow_id)
    
    # Initialize orchestrator if needed
    await orchestrator.initialize()
    
    # Create execution record
    execution = execution_service.create(
        workflow=workflow,
        inputs=request.inputs,
        triggered_by=TEMP_OWNER_ID,
    )
    
    # Start execution (validates, generates plan, dispatches jobs)
    try:
        await orchestrator.start_execution(workflow, execution)
    except WorkflowInvalidError:
        # Update execution to failed if validation fails
        execution_service.update_status(execution.id, ExecutionStatus.FAILED)
        raise
    
    return ExecutionTriggerResponse(
        execution_id=execution.id,
        status=ExecutionStatus.RUNNING,
        workflow_id=workflow_id,
        created_at=execution.created_at,
    )


@router.get("/{execution_id}", response_model=ExecutionResponse)
async def get_execution(execution_id: str) -> ExecutionResponse:
    """
    Get execution status and details.
    
    Returns full execution state including all node states.
    """
    execution = execution_service.get(execution_id, TEMP_OWNER_ID)
    return execution_to_response(execution)


@router.get("", response_model=ExecutionListResponse)
async def list_executions(
    workflow_id: str = Query(..., description="Filter by workflow ID"),
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = Query(default=None),
) -> ExecutionListResponse:
    """
    List executions for a workflow.
    
    Supports cursor-based pagination.
    """
    executions, next_cursor = execution_service.list_by_workflow(
        workflow_id=workflow_id,
        owner_id=TEMP_OWNER_ID,
        limit=limit,
        cursor=cursor,
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
)
async def cancel_execution(execution_id: str) -> ExecutionCancelResponse:
    """
    Cancel a running execution.
    
    Cancels pending jobs and marks execution as cancelled.
    Already-running nodes may complete.
    """
    from agentforge_api.services.queue import job_queue
    
    # Get execution to verify it exists and is owned
    execution = execution_service.get(execution_id, TEMP_OWNER_ID)
    
    # Check if can be cancelled
    if execution.status not in (ExecutionStatus.PENDING, ExecutionStatus.RUNNING):
        return ExecutionCancelResponse(
            id=execution.id,
            status=execution.status,
        )
    
    # Cancel all pending jobs in queue
    await job_queue.cancel_execution(execution_id)
    
    # Update execution status
    updated = execution_service.cancel(execution_id, TEMP_OWNER_ID)
    
    # Mark pending nodes as skipped
    for state in execution.node_states:
        if state.status in (NodeExecutionStatus.PENDING, NodeExecutionStatus.QUEUED):
            execution_service.update_node_state(
                execution_id=execution_id,
                node_id=state.node_id,
                status=NodeExecutionStatus.SKIPPED,
                error="Cancelled by user",
            )
    
    return ExecutionCancelResponse(
        id=updated.id,
        status=updated.status,
    )


@router.get("/{execution_id}/logs", response_model=ExecutionLogsResponse)
async def get_execution_logs(
    execution_id: str,
    node_id: str | None = Query(default=None, description="Filter by node ID"),
    level: str | None = Query(default=None, description="Filter by level"),
    limit: int = Query(default=100, ge=1, le=500),
    cursor: str | None = Query(default=None),
) -> ExecutionLogsResponse:
    """
    Get execution logs.
    
    Mock implementation for Phase 5.
    Real logging will be implemented with structured log storage.
    """
    # Verify execution exists
    execution = execution_service.get(execution_id, TEMP_OWNER_ID)
    
    # Generate mock logs from node states
    logs: list[LogEntry] = []
    
    for state in execution.node_states:
        # Filter by node_id if specified
        if node_id and state.node_id != node_id:
            continue
        
        # Add state transition logs
        if state.started_at:
            log_entry = LogEntry(
                timestamp=state.started_at,
                node_id=state.node_id,
                level="info",
                message=f"Node started execution",
            )
            if not level or level == "info":
                logs.append(log_entry)
        
        if state.completed_at:
            if state.status == NodeExecutionStatus.COMPLETED:
                log_entry = LogEntry(
                    timestamp=state.completed_at,
                    node_id=state.node_id,
                    level="info",
                    message=f"Node completed successfully",
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
    
    # Sort by timestamp
    logs.sort(key=lambda l: l.timestamp)
    
    # Apply limit (simplified - no real cursor pagination)
    logs = logs[:limit]
    
    return ExecutionLogsResponse(
        items=logs,
        next_cursor=None,  # Simplified for mock
    )