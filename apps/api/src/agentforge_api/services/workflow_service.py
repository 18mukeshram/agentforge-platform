# apps/api/src/agentforge_api/services/workflow_service.py

"""
Workflow service for CRUD operations.

Uses in-memory storage for now. Will be replaced with PostgreSQL.
"""

from datetime import datetime, timezone
from uuid import uuid4

from agentforge_api.models import (
    Workflow,
    WorkflowMeta,
    WorkflowStatus,
    Node,
    Edge,
    ValidationError,
)
from agentforge_api.core.exceptions import (
    WorkflowNotFoundError,
    WorkflowArchivedError,
    VersionConflictError,
)
from agentforge_api.validation import validate_workflow_structure


class WorkflowService:
    """
    Workflow CRUD service.
    
    In-memory implementation for Phase 4.
    Thread-safety not addressed (single-threaded dev server).
    """
    
    def __init__(self) -> None:
        self._workflows: dict[str, Workflow] = {}
        self._validation_errors: dict[str, list[ValidationError]] = {}
    
    def create(
        self,
        name: str,
        description: str,
        nodes: list[Node],
        edges: list[Edge],
        owner_id: str,
    ) -> tuple[Workflow, list[ValidationError] | None]:
        """
        Create a new workflow.
        
        Runs structural validation and sets status accordingly.
        Returns workflow and validation errors (if any).
        """
        workflow_id = str(uuid4())
        now = datetime.now(timezone.utc)
        
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
        return workflow, errors
    
    def get(self, workflow_id: str, owner_id: str) -> Workflow:
        """
        Get a workflow by ID.
        
        Raises WorkflowNotFoundError if not found or not owned.
        """
        workflow = self._workflows.get(workflow_id)
        
        if workflow is None or workflow.meta.owner_id != owner_id:
            raise WorkflowNotFoundError(workflow_id)
        
        return workflow
    
    def get_validation_errors(self, workflow_id: str) -> list[ValidationError] | None:
        """Get cached validation errors for a workflow."""
        return self._validation_errors.get(workflow_id)
    
    def list(
        self,
        owner_id: str,
        status: WorkflowStatus | None = None,
        limit: int = 20,
        cursor: str | None = None,
    ) -> tuple[list[Workflow], str | None]:
        """
        List workflows for an owner.
        
        Returns (workflows, next_cursor).
        Simple implementation: cursor is just the last workflow ID.
        """
        # Filter by owner and optionally by status
        workflows = [
            w for w in self._workflows.values()
            if w.meta.owner_id == owner_id
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
        owner_id: str,
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
        """
        existing = self.get(workflow_id, owner_id)
        
        if existing.status == WorkflowStatus.ARCHIVED:
            raise WorkflowArchivedError(workflow_id)
        
        if existing.meta.version != version:
            raise VersionConflictError(
                expected_version=version,
                actual_version=existing.meta.version,
            )
        
        now = datetime.now(timezone.utc)
        
        # Build updated workflow
        workflow = Workflow(
            id=workflow_id,
            status=existing.status,  # Will be updated after validation
            meta=WorkflowMeta(
                name=name if name is not None else existing.meta.name,
                description=description if description is not None else existing.meta.description,
                created_at=existing.meta.created_at,
                updated_at=now,
                owner_id=owner_id,
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
        return workflow, errors
    
    def delete(self, workflow_id: str, owner_id: str) -> Workflow:
        """
        Soft-delete a workflow by setting status to ARCHIVED.
        """
        existing = self.get(workflow_id, owner_id)
        
        now = datetime.now(timezone.utc)
        
        workflow = Workflow(
            id=workflow_id,
            status=WorkflowStatus.ARCHIVED,
            meta=WorkflowMeta(
                name=existing.meta.name,
                description=existing.meta.description,
                created_at=existing.meta.created_at,
                updated_at=now,
                owner_id=owner_id,
                version=existing.meta.version,
            ),
            nodes=existing.nodes,
            edges=existing.edges,
        )
        
        self._workflows[workflow_id] = workflow
        self._validation_errors.pop(workflow_id, None)
        
        return workflow


# Singleton instance for now (will be replaced with DI)
workflow_service = WorkflowService()