# apps/api/src/agentforge_api/services/execution_service.py

"""
Execution service for managing workflow executions.

Uses in-memory storage for now. Will be replaced with PostgreSQL.
All operations enforce tenant isolation.
"""

from datetime import datetime, timezone
from uuid import uuid4

from agentforge_api.models import (
    Workflow,
    Execution,
    ExecutionStatus,
    NodeExecutionState,
    NodeExecutionStatus,
)
from agentforge_api.core.exceptions import (
    ExecutionNotFoundError,
)


class ExecutionService:
    """
    Execution management service.
    
    Handles creation, status tracking, and lifecycle management.
    In-memory implementation for Phase 5.
    All operations enforce tenant isolation.
    """
    
    def __init__(self) -> None:
        self._executions: dict[str, Execution] = {}
        self._execution_tenants: dict[str, str] = {}  # execution_id -> tenant_id
    
    def create(
        self,
        workflow: Workflow,
        inputs: dict,
        triggered_by: str,
        tenant_id: str,
    ) -> Execution:
        """
        Create a new execution for a workflow.
        
        Initializes all node states to PENDING.
        """
        execution_id = str(uuid4())
        now = datetime.now(timezone.utc)
        
        node_states = [
            NodeExecutionState(
                node_id=node.id,
                status=NodeExecutionStatus.PENDING,
            )
            for node in workflow.nodes
        ]
        
        execution = Execution(
            id=execution_id,
            workflow_id=workflow.id,
            status=ExecutionStatus.PENDING,
            workflow_version=workflow.meta.version,
            triggered_by=triggered_by,
            created_at=now,
            node_states=node_states,
            inputs=inputs,
        )
        
        self._executions[execution_id] = execution
        self._execution_tenants[execution_id] = tenant_id
        
        return execution
    
    def get(self, execution_id: str, tenant_id: str) -> Execution:
        """
        Get an execution by ID.
        
        Raises ExecutionNotFoundError if not found or wrong tenant.
        Enforces tenant isolation.
        """
        execution = self._executions.get(execution_id)
        stored_tenant = self._execution_tenants.get(execution_id)
        
        # Check existence AND tenant match
        if execution is None or stored_tenant != tenant_id:
            raise ExecutionNotFoundError(execution_id)
        
        return execution
    
    def get_tenant_id(self, execution_id: str) -> str | None:
        """Get the tenant ID for an execution."""
        return self._execution_tenants.get(execution_id)
    
    def list_by_workflow(
        self,
        workflow_id: str,
        tenant_id: str,
        limit: int = 20,
        cursor: str | None = None,
    ) -> tuple[list[Execution], str | None]:
        """
        List executions for a workflow.
        
        Returns (executions, next_cursor).
        Enforces tenant isolation.
        """
        # Filter by workflow and tenant
        executions = [
            e for e in self._executions.values()
            if e.workflow_id == workflow_id
            and self._execution_tenants.get(e.id) == tenant_id
        ]
        
        # Sort by created_at descending
        executions.sort(key=lambda e: e.created_at, reverse=True)
        
        # Apply cursor
        if cursor is not None:
            cursor_found = False
            filtered = []
            for e in executions:
                if cursor_found:
                    filtered.append(e)
                elif e.id == cursor:
                    cursor_found = True
            executions = filtered
        
        # Apply limit
        has_more = len(executions) > limit
        executions = executions[:limit]
        
        # Compute next cursor
        next_cursor = executions[-1].id if has_more and executions else None
        
        return executions, next_cursor
    
    def update_status(
        self,
        execution_id: str,
        status: ExecutionStatus,
    ) -> Execution:
        """Update execution status (internal use, no tenant check)."""
        execution = self._executions.get(execution_id)
        if execution is None:
            raise ExecutionNotFoundError(execution_id)
        
        now = datetime.now(timezone.utc)
        
        started_at = execution.started_at
        completed_at = execution.completed_at
        
        if status == ExecutionStatus.RUNNING and started_at is None:
            started_at = now
        
        if status in (
            ExecutionStatus.COMPLETED,
            ExecutionStatus.FAILED,
            ExecutionStatus.CANCELLED,
        ):
            completed_at = now
        
        updated = Execution(
            id=execution.id,
            workflow_id=execution.workflow_id,
            status=status,
            workflow_version=execution.workflow_version,
            triggered_by=execution.triggered_by,
            created_at=execution.created_at,
            started_at=started_at,
            completed_at=completed_at,
            node_states=execution.node_states,
            inputs=execution.inputs,
        )
        
        self._executions[execution_id] = updated
        return updated
    
    def update_node_state(
        self,
        execution_id: str,
        node_id: str,
        status: NodeExecutionStatus,
        output: any = None,
        error: str | None = None,
        retry_count: int | None = None,
    ) -> Execution:
        """Update a single node's execution state (internal use)."""
        execution = self._executions.get(execution_id)
        if execution is None:
            raise ExecutionNotFoundError(execution_id)
        
        now = datetime.now(timezone.utc)
        
        updated_node_states = []
        for state in execution.node_states:
            if state.node_id == node_id:
                started_at = state.started_at
                completed_at = state.completed_at
                
                if status == NodeExecutionStatus.RUNNING and started_at is None:
                    started_at = now
                
                if status in (
                    NodeExecutionStatus.COMPLETED,
                    NodeExecutionStatus.FAILED,
                    NodeExecutionStatus.SKIPPED,
                ):
                    completed_at = now
                
                updated_state = NodeExecutionState(
                    node_id=node_id,
                    status=status,
                    started_at=started_at,
                    completed_at=completed_at,
                    retry_count=retry_count if retry_count is not None else state.retry_count,
                    error=error,
                    output=output,
                )
                updated_node_states.append(updated_state)
            else:
                updated_node_states.append(state)
        
        updated = Execution(
            id=execution.id,
            workflow_id=execution.workflow_id,
            status=execution.status,
            workflow_version=execution.workflow_version,
            triggered_by=execution.triggered_by,
            created_at=execution.created_at,
            started_at=execution.started_at,
            completed_at=execution.completed_at,
            node_states=updated_node_states,
            inputs=execution.inputs,
        )
        
        self._executions[execution_id] = updated
        return updated
    
    def cancel(self, execution_id: str, tenant_id: str) -> Execution:
        """
        Cancel an execution.
        
        Only pending or running executions can be cancelled.
        Enforces tenant isolation.
        """
        execution = self.get(execution_id, tenant_id)
        
        if execution.status not in (
            ExecutionStatus.PENDING,
            ExecutionStatus.RUNNING,
        ):
            return execution
        
        return self.update_status(execution_id, ExecutionStatus.CANCELLED)
    
    def compute_aggregate_status(self, execution_id: str) -> ExecutionStatus:
        """Compute aggregate execution status from node states."""
        execution = self._executions.get(execution_id)
        if execution is None:
            raise ExecutionNotFoundError(execution_id)
        
        has_failed = False
        has_pending = False
        has_running = False
        
        for state in execution.node_states:
            if state.status == NodeExecutionStatus.FAILED:
                has_failed = True
            elif state.status == NodeExecutionStatus.RUNNING:
                has_running = True
            elif state.status in (
                NodeExecutionStatus.PENDING,
                NodeExecutionStatus.QUEUED,
            ):
                has_pending = True
        
        if has_running:
            return ExecutionStatus.RUNNING
        if has_pending:
            return ExecutionStatus.RUNNING
        if has_failed:
            return ExecutionStatus.FAILED
        
        return ExecutionStatus.COMPLETED
    
    def get_node_output(
        self,
        execution_id: str,
        node_id: str,
    ) -> any:
        """Get the output of a completed node."""
        execution = self._executions.get(execution_id)
        if execution is None:
            raise ExecutionNotFoundError(execution_id)
        
        state_map = execution.get_node_state_map()
        state = state_map.get(node_id)
        
        if state is None:
            return None
        
        return state.output


# Singleton instance
execution_service = ExecutionService()