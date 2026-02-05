# apps/api/src/agentforge_api/models/validation.py

"""Validation result models."""

from enum import Enum
from typing import Annotated

from pydantic import BaseModel, Field


class ValidationErrorCode(str, Enum):
    """Categories of validation errors."""

    # Structural (S1-S5)
    CYCLE_DETECTED = "CYCLE_DETECTED"
    INVALID_EDGE_REFERENCE = "INVALID_EDGE_REFERENCE"
    DUPLICATE_EDGE = "DUPLICATE_EDGE"
    NO_ENTRY_NODE = "NO_ENTRY_NODE"
    ORPHAN_NODE = "ORPHAN_NODE"

    # Semantic (M1-M2)
    TYPE_MISMATCH = "TYPE_MISMATCH"
    MISSING_REQUIRED_INPUT = "MISSING_REQUIRED_INPUT"


class ValidationError(BaseModel, frozen=True):
    """A single validation error with context."""

    code: ValidationErrorCode
    message: str

    node_ids: Annotated[
        list[str], Field(default_factory=list, description="Affected node(s)")
    ]
    edge_ids: Annotated[
        list[str], Field(default_factory=list, description="Affected edge(s)")
    ]


class ValidationResult(BaseModel, frozen=True):
    """
    Result of validating a workflow.

    If valid=True, errors will be empty.
    If valid=False, errors contains one or more ValidationError.
    """

    valid: bool
    errors: list[ValidationError] = Field(default_factory=list)
    execution_order: Annotated[
        list[str] | None, Field(description="Topological order of nodes, if valid")
    ] = None

    @classmethod
    def success(cls, execution_order: list[str] | None = None) -> "ValidationResult":
        """Create a successful validation result."""
        return cls(valid=True, errors=[], execution_order=execution_order)

    @classmethod
    def failure(cls, errors: list[ValidationError]) -> "ValidationResult":
        """Create a failed validation result."""
        return cls(valid=False, errors=errors, execution_order=None)
