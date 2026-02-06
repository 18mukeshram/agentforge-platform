# apps/api/src/agentforge_api/services/workflow_service.py
"""
Workflow service for CRUD operations.

Uses in-memory storage for now. Will be replaced with PostgreSQL.
All operations enforce tenant isolation.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from agentforge_api.core.exceptions import (
    VersionConflictError,
    WorkflowArchivedError,
    WorkflowNotFoundError,
)
from agentforge_api.models import (
    Edge,
    Node,
    ValidationError,
    Workflow,
    WorkflowMeta,
    WorkflowStatus,
)
from agentforge_api.validation import validate_workflow_structure


class WorkflowService:
    """
    Workflow CRUD service.

    In-memory implementation for Phase 4.
    Thread-safety not addressed (single-threaded dev server).
    All operations enforce tenant isolation.
    """

    def __init__(self) -> None:
        self._workflows: dict[str, Workflow] = {}
        self._validation_errors: dict[str, list[ValidationError]] = {}
        # Track tenant ownership
        self._workflow_tenants: dict[str, str] = {}  # workflow_id -> tenant_id

    def create(
        self,
        name: str,
        description: str,
        nodes: list[Node],
        edges: list[Edge],
        owner_id: str,
        tenant_id: str,
    ) -> tuple[Workflow, list[ValidationError] | None]:
        """
        Create a new workflow.

        Runs structural validation and sets status accordingly.
        Returns workflow and validation errors (if any).
        """
        workflow_id = str(uuid4())
        now = datetime.now(UTC)

        # Build workflow
        workflow = Workflow(
            id=workflow_id,
            status=WorkflowStatus.DRAFT,
            meta=WorkflowMeta(
                name=name,
                description=description,
                created_at=now,
                updated_at=now,
                owner_id=owner_id,
                version=1,
            ),
            nodes=nodes,
            edges=edges,
        )

        # Validate and update status
        validation_result = validate_workflow_structure(workflow)

        if validation_result.valid:
            workflow = Workflow(
                id=workflow.id,
                status=WorkflowStatus.VALID,
                meta=workflow.meta,
                nodes=workflow.nodes,
                edges=workflow.edges,
            )
            errors = None
        else:
            workflow = Workflow(
                id=workflow.id,
                status=WorkflowStatus.INVALID,
                meta=workflow.meta,
                nodes=workflow.nodes,
                edges=workflow.edges,
            )
            errors = list(validation_result.errors)
            self._validation_errors[workflow_id] = errors

        self._workflows[workflow_id] = workflow
        self._workflow_tenants[workflow_id] = tenant_id

        return workflow, errors

    def get(self, workflow_id: str, tenant_id: str) -> Workflow:
        """
        Get a workflow by ID.

        Raises WorkflowNotFoundError if not found or wrong tenant.
        Enforces tenant isolation.
        """
        workflow = self._workflows.get(workflow_id)
        stored_tenant = self._workflow_tenants.get(workflow_id)

        # Check existence AND tenant match
        if workflow is None or stored_tenant != tenant_id:
            raise WorkflowNotFoundError(workflow_id)

        return workflow

    def get_validation_errors(self, workflow_id: str) -> list[ValidationError] | None:
        """Get cached validation errors for a workflow."""
        return self._validation_errors.get(workflow_id)

    def list(
        self,
        tenant_id: str,
        status: WorkflowStatus | None = None,
        limit: int = 20,
        cursor: str | None = None,
    ) -> tuple[list[Workflow], str | None]:
        """
        List workflows for a tenant.

        Returns (workflows, next_cursor).
        Only returns workflows belonging to the specified tenant.
        """
        # Filter by tenant and optionally by status
        workflows = [
            w
            for w in self._workflows.values()
            if self._workflow_tenants.get(w.id) == tenant_id
            and (status is None or w.status == status)
        ]

        # Sort by updated_at descending
        workflows.sort(key=lambda w: w.meta.updated_at, reverse=True)

        # Apply cursor (skip until we find the cursor ID)
        if cursor is not None:
            cursor_found = False
            filtered = []
            for w in workflows:
                if cursor_found:
                    filtered.append(w)
                elif w.id == cursor:
                    cursor_found = True
            workflows = filtered

        # Apply limit
        has_more = len(workflows) > limit
        workflows = workflows[:limit]

        # Compute next cursor
        next_cursor = workflows[-1].id if has_more and workflows else None

        return workflows, next_cursor

    def update(
        self,
        workflow_id: str,
        tenant_id: str,
        nodes: list[Node],
        edges: list[Edge],
        version: int,
        name: str | None = None,
        description: str | None = None,
    ) -> tuple[Workflow, list[ValidationError] | None]:
        """
        Update a workflow.

        Runs structural validation and updates status.
        Raises VersionConflictError if version doesn't match.
        Raises WorkflowArchivedError if workflow is archived.
        Enforces tenant isolation.
        """
        existing = self.get(workflow_id, tenant_id)

        if existing.status == WorkflowStatus.ARCHIVED:
            raise WorkflowArchivedError(workflow_id)

        if existing.meta.version != version:
            raise VersionConflictError(
                expected_version=version,
                actual_version=existing.meta.version,
            )

        now = datetime.now(UTC)

        # Build updated workflow
        workflow = Workflow(
            id=workflow_id,
            status=existing.status,  # Will be updated after validation
            meta=WorkflowMeta(
                name=name if name is not None else existing.meta.name,
                description=(description if description is not None else existing.meta.description),
                created_at=existing.meta.created_at,
                updated_at=now,
                owner_id=existing.meta.owner_id,
                version=existing.meta.version + 1,
            ),
            nodes=nodes,
            edges=edges,
        )

        # Validate and update status
        validation_result = validate_workflow_structure(workflow)

        if validation_result.valid:
            workflow = Workflow(
                id=workflow.id,
                status=WorkflowStatus.VALID,
                meta=workflow.meta,
                nodes=workflow.nodes,
                edges=workflow.edges,
            )
            errors = None
            self._validation_errors.pop(workflow_id, None)
        else:
            workflow = Workflow(
                id=workflow.id,
                status=WorkflowStatus.INVALID,
                meta=workflow.meta,
                nodes=workflow.nodes,
                edges=workflow.edges,
            )
            errors = list(validation_result.errors)
            self._validation_errors[workflow_id] = errors

        self._workflows[workflow_id] = workflow
        # Tenant doesn't change on update

        return workflow, errors

    def delete(self, workflow_id: str, tenant_id: str) -> Workflow:
        """
        Soft-delete a workflow by setting status to ARCHIVED.

        Enforces tenant isolation.
        """
        existing = self.get(workflow_id, tenant_id)

        now = datetime.now(UTC)

        workflow = Workflow(
            id=workflow_id,
            status=WorkflowStatus.ARCHIVED,
            meta=WorkflowMeta(
                name=existing.meta.name,
                description=existing.meta.description,
                created_at=existing.meta.created_at,
                updated_at=now,
                owner_id=existing.meta.owner_id,
                version=existing.meta.version,
            ),
            nodes=existing.nodes,
            edges=existing.edges,
        )

        self._workflows[workflow_id] = workflow
        self._validation_errors.pop(workflow_id, None)

        return workflow

    def get_tenant_id(self, workflow_id: str) -> str | None:
        """Get the tenant ID for a workflow (used by execution service)."""
        return self._workflow_tenants.get(workflow_id)


# Singleton instance for now (will be replaced with DI)
workflow_service = WorkflowService()
