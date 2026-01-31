# apps/api/src/agentforge_api/services/orchestrator.py

"""
Execution orchestrator.

Responsible for:
- Generating execution plans from validated workflows
- Dispatching jobs to the queue
- Coordinating job completion and dependent job dispatch
- Managing execution lifecycle
"""

from datetime import datetime, timezone
from uuid import uuid4

from agentforge_api.models import (
    Workflow,
    Execution,
    ExecutionStatus,
    ExecutionPlan,
    NodeJob,
    JobResult,
    JobStatus,
    NodeExecutionStatus,
)
from agentforge_api.validation import (
    validate_workflow_structure,
    get_execution_order,
    build_adjacency_list,
    build_reverse_adjacency_list,
    find_entry_nodes,
    find_exit_nodes,
)
from agentforge_api.services.execution_service import execution_service
from agentforge_api.services.queue import job_queue
from agentforge_api.core.exceptions import (
    WorkflowInvalidError,
    ErrorDetail,
)


class ExecutionOrchestrator:
    """
    Coordinates workflow execution.
    
    Generates execution plans, dispatches jobs, and handles
    job completion to trigger dependent jobs.
    """
    
    def __init__(self) -> None:
        self._plans: dict[str, ExecutionPlan] = {}
        self._initialized = False
    
    async def initialize(self) -> None:
        """
        Initialize the orchestrator.
        
        Sets up job completion handler and starts the queue worker.
        """
        if self._initialized:
            return
        
        # Import here to avoid circular dependency
        from agentforge_api.services.agent_runtime import process_node_job
        
        job_queue.set_processor(process_node_job)
        job_queue.on_completed(self._on_job_completed)
        await job_queue.start_worker()
        
        self._initialized = True
    
    async def shutdown(self) -> None:
        """Shutdown the orchestrator."""
        await job_queue.stop_worker()
        self._initialized = False
    
    def generate_plan(self, workflow: Workflow, execution_id: str) -> ExecutionPlan:
        """
        Generate an execution plan for a workflow.
        
        Computes topological order and dependency maps.
        """
        # Get execution order
        execution_order = get_execution_order(workflow)
        
        # Build dependency maps
        adj = build_adjacency_list(workflow)
        rev_adj = build_reverse_adjacency_list(workflow)
        edge_map = workflow.get_edge_map()
        
        # dependencies: node_id -> parent node_ids
        dependencies: dict[str, list[str]] = {}
        for node in workflow.nodes:
            incoming_edges = rev_adj.get(node.id, [])
            parent_ids = []
            for edge_id in incoming_edges:
                edge = edge_map.get(edge_id)
                if edge:
                    parent_ids.append(edge.source)
            dependencies[node.id] = parent_ids
        
        # dependents: node_id -> child node_ids
        dependents: dict[str, list[str]] = {}
        for node in workflow.nodes:
            outgoing_edges = adj.get(node.id, [])
            child_ids = []
            for edge_id in outgoing_edges:
                edge = edge_map.get(edge_id)
                if edge:
                    child_ids.append(edge.target)
            dependents[node.id] = child_ids
        
        # Entry and exit nodes
        entry_nodes = find_entry_nodes(workflow)
        exit_nodes = find_exit_nodes(workflow)
        
        plan = ExecutionPlan(
            execution_id=execution_id,
            workflow_id=workflow.id,
            execution_order=list(execution_order),
            dependencies=dependencies,
            dependents=dependents,
            entry_nodes=list(entry_nodes),
            exit_nodes=list(exit_nodes),
        )
        
        self._plans[execution_id] = plan
        return plan
    
    async def start_execution(
        self,
        workflow: Workflow,
        execution: Execution,
    ) -> ExecutionPlan:
        """
        Start executing a workflow.
        
        Validates workflow, generates plan, and dispatches entry node jobs.
        """
        # Validate workflow
        validation_result = validate_workflow_structure(workflow)
        if not validation_result.valid:
            details = [
                ErrorDetail(
                    field=None,
                    message=error.message,
                    metadata={"code": error.code.value},
                )
                for error in validation_result.errors
            ]
            raise WorkflowInvalidError(
                message="Workflow validation failed",
                details=details,
            )
        
        # Generate execution plan
        plan = self.generate_plan(workflow, execution.id)
        
        # Update execution status to RUNNING
        execution_service.update_status(execution.id, ExecutionStatus.RUNNING)
        
        # Create and dispatch entry node jobs
        node_map = workflow.get_node_map()
        
        for node_id in plan.entry_nodes:
            node = node_map.get(node_id)
            if node is None:
                continue
            
            # Entry nodes get inputs from execution inputs
            node_inputs = self._resolve_entry_inputs(
                node_id=node_id,
                execution=execution,
                workflow=workflow,
            )
            
            job = self._create_job(
                execution=execution,
                workflow=workflow,
                node_id=node_id,
                inputs=node_inputs,
            )
            
            # Update node state to QUEUED
            execution_service.update_node_state(
                execution_id=execution.id,
                node_id=node_id,
                status=NodeExecutionStatus.QUEUED,
            )
            
            await job_queue.add(job)
        
        return plan
    
    async def _on_job_completed(self, result: JobResult) -> None:
        """
        Handle job completion.
        
        Updates node state and dispatches dependent jobs if ready.
        """
        execution_id = result.execution_id
        node_id = result.node_id
        
        # Get the job for retry count
        job = await job_queue.get_job(result.job_id)
        retry_count = job.retry_count if job else 0
        
        if result.success:
            # Update node state to COMPLETED
            execution_service.update_node_state(
                execution_id=execution_id,
                node_id=node_id,
                status=NodeExecutionStatus.COMPLETED,
                output=result.output,
                retry_count=retry_count,
            )
            
            # Dispatch dependent jobs
            await self._dispatch_dependents(execution_id, node_id)
        else:
            # Update node state to FAILED
            execution_service.update_node_state(
                execution_id=execution_id,
                node_id=node_id,
                status=NodeExecutionStatus.FAILED,
                error=result.error,
                retry_count=retry_count,
            )
            
            # Skip all descendants (invariant E2)
            await self._skip_descendants(execution_id, node_id)
        
        # Check if execution is complete
        await self._check_execution_complete(execution_id)
    
    async def _dispatch_dependents(
        self,
        execution_id: str,
        completed_node_id: str,
    ) -> None:
        """Dispatch jobs for nodes whose dependencies are now satisfied."""
        plan = self._plans.get(execution_id)
        if plan is None:
            return
        
        execution = execution_service._executions.get(execution_id)
        if execution is None:
            return
        
        # Get workflow from execution
        from agentforge_api.services.workflow_service import workflow_service
        try:
            workflow = workflow_service._workflows.get(execution.workflow_id)
        except Exception:
            return
        
        if workflow is None:
            return
        
        node_map = workflow.get_node_map()
        state_map = execution.get_node_state_map()
        
        # Check each dependent of the completed node
        dependent_ids = plan.dependents.get(completed_node_id, [])
        
        for dep_id in dependent_ids:
            dep_state = state_map.get(dep_id)
            
            # Skip if already processed
            if dep_state and dep_state.status != NodeExecutionStatus.PENDING:
                continue
            
            # Check if all dependencies are completed
            dep_dependencies = plan.dependencies.get(dep_id, [])
            all_deps_complete = all(
                state_map.get(d) and state_map.get(d).status == NodeExecutionStatus.COMPLETED
                for d in dep_dependencies
            )
            
            if not all_deps_complete:
                continue
            
            # All dependencies complete, dispatch this node
            node = node_map.get(dep_id)
            if node is None:
                continue
            
            # Resolve inputs from parent outputs
            node_inputs = self._resolve_node_inputs(
                node_id=dep_id,
                execution_id=execution_id,
                plan=plan,
            )
            
            job = self._create_job(
                execution=execution,
                workflow=workflow,
                node_id=dep_id,
                inputs=node_inputs,
            )
            
            # Update node state to QUEUED
            execution_service.update_node_state(
                execution_id=execution_id,
                node_id=dep_id,
                status=NodeExecutionStatus.QUEUED,
            )
            
            await job_queue.add(job)
    
    async def _skip_descendants(
        self,
        execution_id: str,
        failed_node_id: str,
    ) -> None:
        """Skip all descendants of a failed node (invariant E2)."""
        plan = self._plans.get(execution_id)
        if plan is None:
            return
        
        # BFS to find all descendants
        to_skip: set[str] = set()
        queue = list(plan.dependents.get(failed_node_id, []))
        
        while queue:
            node_id = queue.pop(0)
            if node_id in to_skip:
                continue
            to_skip.add(node_id)
            queue.extend(plan.dependents.get(node_id, []))
        
        # Mark all as skipped
        for node_id in to_skip:
            execution_service.update_node_state(
                execution_id=execution_id,
                node_id=node_id,
                status=NodeExecutionStatus.SKIPPED,
                error=f"Skipped due to upstream failure: {failed_node_id}",
            )
    
    async def _check_execution_complete(self, execution_id: str) -> None:
        """Check if execution is complete and update status."""
        aggregate_status = execution_service.compute_aggregate_status(execution_id)
        
        current = execution_service._executions.get(execution_id)
        if current and current.status != aggregate_status:
            execution_service.update_status(execution_id, aggregate_status)
    
    def _create_job(
        self,
        execution: Execution,
        workflow: Workflow,
        node_id: str,
        inputs: dict,
    ) -> NodeJob:
        """Create a NodeJob for execution."""
        node_map = workflow.get_node_map()
        node = node_map.get(node_id)
        
        return NodeJob(
            id=str(uuid4()),
            execution_id=execution.id,
            workflow_id=workflow.id,
            node_id=node_id,
            node_type=node.type.value if node else "unknown",
            agent_id=node.config.agent_id if node else None,
            node_config=dict(node.config.parameters) if node else {},
            inputs=inputs,
            created_at=datetime.now(timezone.utc),
            max_retries=3,
            retry_backoff_ms=1000,
        )
    
    def _resolve_entry_inputs(
        self,
        node_id: str,
        execution: Execution,
        workflow: Workflow,
    ) -> dict:
        """Resolve inputs for entry nodes from execution inputs."""
        # For now, pass all execution inputs to entry nodes
        # Future: map specific inputs to specific entry nodes
        return dict(execution.inputs)
    
    def _resolve_node_inputs(
        self,
        node_id: str,
        execution_id: str,
        plan: ExecutionPlan,
    ) -> dict:
        """Resolve inputs for a node from its parents' outputs."""
        inputs = {}
        
        parent_ids = plan.dependencies.get(node_id, [])
        
        for parent_id in parent_ids:
            parent_output = execution_service.get_node_output(
                execution_id=execution_id,
                node_id=parent_id,
            )
            
            if parent_output is not None:
                # Use parent node ID as input key
                # Future: map based on edge port connections
                inputs[parent_id] = parent_output
        
        return inputs
    
    def get_plan(self, execution_id: str) -> ExecutionPlan | None:
        """Get execution plan for an execution."""
        return self._plans.get(execution_id)


# Singleton instance
orchestrator = ExecutionOrchestrator()