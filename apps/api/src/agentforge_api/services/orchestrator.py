# apps/api/src/agentforge_api/services/orchestrator.py

"""
Execution orchestrator.

Responsible for:
- Generating execution plans from validated workflows
- Dispatching jobs to the queue
- Coordinating job completion and dependent job dispatch
- Managing execution lifecycle
- Emitting real-time events
"""

from datetime import UTC, datetime
from uuid import uuid4

from agentforge_api.core.exceptions import (
    ErrorDetail,
    WorkflowInvalidError,
)
from agentforge_api.models import (
    Execution,
    ExecutionPlan,
    ExecutionStatus,
    JobResult,
    NodeExecutionState,
    NodeExecutionStatus,
    NodeJob,
    Workflow,
)
from agentforge_api.realtime import (  # Resume events (Phase 12)
    connection_hub,
    event_emitter,
    execution_cancelled,
    execution_completed,
    execution_failed,
    execution_started,
    node_completed,
    node_failed,
    node_output_reused,
    node_queued,
    node_skipped,
    resume_complete,
    resume_start,
)
from agentforge_api.services.execution_service import execution_service
from agentforge_api.services.queue import job_queue
from agentforge_api.validation import (
    build_adjacency_list,
    build_reverse_adjacency_list,
    find_entry_nodes,
    find_exit_nodes,
    get_execution_order,
    validate_workflow_structure,
)


class ExecutionOrchestrator:
    """
    Coordinates workflow execution.

    Generates execution plans, dispatches jobs, and handles
    job completion to trigger dependent jobs.
    """

    def __init__(self) -> None:
        self._plans: dict[str, ExecutionPlan] = {}
        self._start_times: dict[str, datetime] = {}
        self._initialized = False

    async def initialize(self) -> None:
        """
        Initialize the orchestrator.

        Sets up job completion handler and starts the queue worker.
        """
        if self._initialized:
            return

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
        """Generate an execution plan for a workflow."""
        execution_order = get_execution_order(workflow)

        adj = build_adjacency_list(workflow)
        rev_adj = build_reverse_adjacency_list(workflow)
        edge_map = workflow.get_edge_map()

        dependencies: dict[str, list[str]] = {}
        for node in workflow.nodes:
            incoming_edges = rev_adj.get(node.id, [])
            parent_ids = []
            for edge_id in incoming_edges:
                edge = edge_map.get(edge_id)
                if edge:
                    parent_ids.append(edge.source)
            dependencies[node.id] = parent_ids

        dependents: dict[str, list[str]] = {}
        for node in workflow.nodes:
            outgoing_edges = adj.get(node.id, [])
            child_ids = []
            for edge_id in outgoing_edges:
                edge = edge_map.get(edge_id)
                if edge:
                    child_ids.append(edge.target)
            dependents[node.id] = child_ids

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
        For resumed executions, delegates to start_resumed_execution.
        """
        # Check if this is a resumed execution
        if execution.parent_execution_id is not None:
            return await self.start_resumed_execution(workflow, execution)

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

        # Track start time
        self._start_times[execution.id] = datetime.now(UTC)

        # Register execution tenant with WebSocket hub
        tenant_id = execution_service.get_tenant_id(execution.id)
        if tenant_id:
            connection_hub.register_execution_tenant(execution.id, tenant_id)

        # Update execution status to RUNNING
        execution_service.update_status(execution.id, ExecutionStatus.RUNNING)

        # Emit EXECUTION_STARTED event
        await event_emitter.emit(
            execution_started(
                execution_id=execution.id,
                workflow_id=workflow.id,
                node_count=len(workflow.nodes),
            )
        )

        # Create and dispatch entry node jobs
        node_map = workflow.get_node_map()

        for node_id in plan.entry_nodes:
            node = node_map.get(node_id)
            if node is None:
                continue

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

            execution_service.update_node_state(
                execution_id=execution.id,
                node_id=node_id,
                status=NodeExecutionStatus.QUEUED,
            )

            await event_emitter.emit(
                node_queued(
                    execution_id=execution.id,
                    node_id=node_id,
                )
            )

            await job_queue.add(job)

        return plan

    async def start_resumed_execution(
        self,
        workflow: Workflow,
        execution: Execution,
    ) -> ExecutionPlan:
        """
        Start a resumed execution.

        Skipped nodes (already completed in parent) remain COMPLETED.
        Only dispatches jobs for nodes that need to re-run.
        Emits resume-specific WebSocket events.
        """
        # Generate execution plan (same DAG structure)
        plan = self.generate_plan(workflow, execution.id)

        # Track start time
        self._start_times[execution.id] = datetime.now(UTC)

        # Register execution tenant with WebSocket hub
        tenant_id = execution_service.get_tenant_id(execution.id)
        if tenant_id:
            connection_hub.register_execution_tenant(execution.id, tenant_id)

        # Update execution status to RUNNING
        execution_service.update_status(execution.id, ExecutionStatus.RUNNING)

        # Emit EXECUTION_STARTED event (for compatibility)
        await event_emitter.emit(
            execution_started(
                execution_id=execution.id,
                workflow_id=workflow.id,
                node_count=len(workflow.nodes),
            )
        )

        # Get current node states (skipped nodes are already COMPLETED)
        state_map = execution.get_node_state_map()

        # Count skipped and rerun nodes
        skipped_nodes = [
            n for n, s in state_map.items() if s.status == NodeExecutionStatus.COMPLETED
        ]
        rerun_nodes = [
            n for n, s in state_map.items() if s.status == NodeExecutionStatus.PENDING
        ]

        # Emit RESUME_START event (Phase 12.3)
        await event_emitter.emit(
            resume_start(
                execution_id=execution.id,
                parent_execution_id=execution.parent_execution_id or "",
                resumed_from_node_id=execution.resumed_from_node_id or "",
                skipped_count=len(skipped_nodes),
                rerun_count=len(rerun_nodes),
            )
        )

        # Emit NODE_OUTPUT_REUSED events for skipped nodes (Phase 12.3)
        for node_id in skipped_nodes:
            await event_emitter.emit(
                node_output_reused(
                    execution_id=execution.id,
                    node_id=node_id,
                    source_execution_id=execution.parent_execution_id or "",
                )
            )

        # Find resume entry nodes: nodes that are PENDING and have all dependencies COMPLETED
        resume_entry_nodes = self._find_resume_entry_nodes(plan, state_map)

        if not resume_entry_nodes:
            # No nodes to dispatch - execution is already done
            await self._check_execution_complete(execution.id)
            return plan

        # Dispatch jobs for resume entry nodes
        node_map = workflow.get_node_map()

        for node_id in resume_entry_nodes:
            node = node_map.get(node_id)
            if node is None:
                continue

            # Resolve inputs from parent's completed nodes (cached outputs)
            node_inputs = self._resolve_node_inputs(
                node_id=node_id,
                execution_id=execution.id,
                plan=plan,
            )

            job = self._create_job(
                execution=execution,
                workflow=workflow,
                node_id=node_id,
                inputs=node_inputs,
            )

            execution_service.update_node_state(
                execution_id=execution.id,
                node_id=node_id,
                status=NodeExecutionStatus.QUEUED,
            )

            await event_emitter.emit(
                node_queued(
                    execution_id=execution.id,
                    node_id=node_id,
                )
            )

            await job_queue.add(job)

        return plan

    def _find_resume_entry_nodes(
        self,
        plan: ExecutionPlan,
        state_map: dict[str, NodeExecutionState],
    ) -> list[str]:
        """
        Find entry nodes for resume execution.

        These are PENDING nodes whose dependencies are all COMPLETED.
        """
        resume_entries = []

        for node_id in plan.execution_order:
            state = state_map.get(node_id)

            # Only consider PENDING nodes
            if state is None or state.status != NodeExecutionStatus.PENDING:
                continue

            # Check if all dependencies are completed
            dependencies = plan.dependencies.get(node_id, [])
            all_deps_completed = all(
                state_map.get(dep_id)
                and state_map.get(dep_id).status == NodeExecutionStatus.COMPLETED
                for dep_id in dependencies
            )

            if all_deps_completed:
                resume_entries.append(node_id)

        return resume_entries

    async def _on_job_completed(self, result: JobResult) -> None:
        """Handle job completion."""
        execution_id = result.execution_id
        node_id = result.node_id

        job = await job_queue.get_job(result.job_id)
        retry_count = job.retry_count if job else 0

        if result.success:
            execution_service.update_node_state(
                execution_id=execution_id,
                node_id=node_id,
                status=NodeExecutionStatus.COMPLETED,
                output=result.output,
                retry_count=retry_count,
            )

            output_summary = None
            if isinstance(result.output, dict):
                output_summary = str(result.output.get("result", ""))[:100]
            await event_emitter.emit(
                node_completed(
                    execution_id=execution_id,
                    node_id=node_id,
                    duration_ms=result.duration_ms,
                    output_summary=output_summary,
                )
            )

            await self._dispatch_dependents(execution_id, node_id)
        else:
            execution_service.update_node_state(
                execution_id=execution_id,
                node_id=node_id,
                status=NodeExecutionStatus.FAILED,
                error=result.error,
                retry_count=retry_count,
            )

            await event_emitter.emit(
                node_failed(
                    execution_id=execution_id,
                    node_id=node_id,
                    error=result.error or "Unknown error",
                    retry_count=retry_count,
                    will_retry=False,
                )
            )

            await self._skip_descendants(execution_id, node_id)

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

        from agentforge_api.services.workflow_service import workflow_service

        try:
            workflow = workflow_service._workflows.get(execution.workflow_id)
        except Exception:
            return

        if workflow is None:
            return

        node_map = workflow.get_node_map()
        state_map = execution.get_node_state_map()

        dependent_ids = plan.dependents.get(completed_node_id, [])

        for dep_id in dependent_ids:
            dep_state = state_map.get(dep_id)

            if dep_state and dep_state.status != NodeExecutionStatus.PENDING:
                continue

            dep_dependencies = plan.dependencies.get(dep_id, [])
            all_deps_complete = all(
                state_map.get(d)
                and state_map.get(d).status == NodeExecutionStatus.COMPLETED
                for d in dep_dependencies
            )

            if not all_deps_complete:
                continue

            node = node_map.get(dep_id)
            if node is None:
                continue

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

            execution_service.update_node_state(
                execution_id=execution_id,
                node_id=dep_id,
                status=NodeExecutionStatus.QUEUED,
            )

            await event_emitter.emit(
                node_queued(
                    execution_id=execution_id,
                    node_id=dep_id,
                )
            )

            await job_queue.add(job)

    async def _skip_descendants(
        self,
        execution_id: str,
        failed_node_id: str,
    ) -> None:
        """Skip all descendants of a failed node."""
        plan = self._plans.get(execution_id)
        if plan is None:
            return

        to_skip: set[str] = set()
        queue = list(plan.dependents.get(failed_node_id, []))

        while queue:
            node_id = queue.pop(0)
            if node_id in to_skip:
                continue
            to_skip.add(node_id)
            queue.extend(plan.dependents.get(node_id, []))

        for node_id in to_skip:
            reason = f"Skipped due to upstream failure: {failed_node_id}"

            execution_service.update_node_state(
                execution_id=execution_id,
                node_id=node_id,
                status=NodeExecutionStatus.SKIPPED,
                error=reason,
            )

            await event_emitter.emit(
                node_skipped(
                    execution_id=execution_id,
                    node_id=node_id,
                    reason=reason,
                )
            )

    async def _check_execution_complete(self, execution_id: str) -> None:
        """Check if execution is complete and update status."""
        aggregate_status = execution_service.compute_aggregate_status(execution_id)

        current = execution_service._executions.get(execution_id)
        if current and current.status != aggregate_status:
            execution_service.update_status(execution_id, aggregate_status)

            duration_ms = self._compute_duration(execution_id)

            if aggregate_status == ExecutionStatus.COMPLETED:
                await event_emitter.emit(
                    execution_completed(
                        execution_id=execution_id,
                        duration_ms=duration_ms,
                    )
                )

                # Emit RESUME_COMPLETE for resumed executions (Phase 12.3)
                if current.parent_execution_id is not None:
                    await event_emitter.emit(
                        resume_complete(
                            execution_id=execution_id,
                            status="completed",
                            duration_ms=duration_ms,
                        )
                    )

                self._cleanup_execution(execution_id)

            elif aggregate_status == ExecutionStatus.FAILED:
                await event_emitter.emit(
                    execution_failed(
                        execution_id=execution_id,
                        error="One or more nodes failed",
                    )
                )

                # Emit RESUME_COMPLETE for resumed executions (Phase 12.3)
                if current.parent_execution_id is not None:
                    await event_emitter.emit(
                        resume_complete(
                            execution_id=execution_id,
                            status="failed",
                            duration_ms=duration_ms,
                        )
                    )

                self._cleanup_execution(execution_id)

    async def cancel_execution(self, execution_id: str) -> None:
        """Cancel an execution and emit event."""
        await event_emitter.emit(
            execution_cancelled(
                execution_id=execution_id,
            )
        )
        self._cleanup_execution(execution_id)

    def _compute_duration(self, execution_id: str) -> int:
        """Compute execution duration in milliseconds."""
        start_time = self._start_times.get(execution_id)
        if start_time is None:
            return 0

        duration = datetime.now(UTC) - start_time
        return int(duration.total_seconds() * 1000)

    def _cleanup_execution(self, execution_id: str) -> None:
        """Clean up execution tracking data."""
        self._plans.pop(execution_id, None)
        self._start_times.pop(execution_id, None)

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

        # Get tenant_id for the job
        tenant_id = execution_service.get_tenant_id(execution.id) or ""

        return NodeJob(
            id=str(uuid4()),
            execution_id=execution.id,
            workflow_id=workflow.id,
            node_id=node_id,
            node_type=node.type.value if node else "unknown",
            agent_id=node.config.agent_id if node else None,
            node_config=dict(node.config.parameters) if node else {},
            inputs=inputs,
            created_at=datetime.now(UTC),
            max_retries=3,
            retry_backoff_ms=1000,
            tenant_id=tenant_id,  # Include tenant for cache isolation
        )

    def _resolve_entry_inputs(
        self,
        node_id: str,
        execution: Execution,
        workflow: Workflow,
    ) -> dict:
        """Resolve inputs for entry nodes from execution inputs."""
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
                inputs[parent_id] = parent_output

        return inputs

    def get_plan(self, execution_id: str) -> ExecutionPlan | None:
        """Get execution plan for an execution."""
        return self._plans.get(execution_id)


# Singleton instance
orchestrator = ExecutionOrchestrator()
