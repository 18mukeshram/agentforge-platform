# apps/api/src/agentforge_api/core/exceptions.py

"""
API exceptions and error handling.

Maps domain errors to HTTP responses with structured error bodies.
"""

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class ErrorCode(str, Enum):
    """API error codes."""
    
    # Request errors (4xx)
    INVALID_REQUEST_BODY = "INVALID_REQUEST_BODY"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    WORKFLOW_NOT_FOUND = "WORKFLOW_NOT_FOUND"
    EXECUTION_NOT_FOUND = "EXECUTION_NOT_FOUND"
    WORKFLOW_INVALID = "WORKFLOW_INVALID"
    WORKFLOW_ARCHIVED = "WORKFLOW_ARCHIVED"
    MISSING_INPUTS = "MISSING_INPUTS"
    VERSION_CONFLICT = "VERSION_CONFLICT"
    INVALID_CURSOR = "INVALID_CURSOR"
    RESUME_NOT_ALLOWED = "RESUME_NOT_ALLOWED"
    
    # Auth errors
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    
    # Server errors (5xx)
    INTERNAL_ERROR = "INTERNAL_ERROR"


class ErrorDetail(BaseModel):
    """Detailed error information."""
    
    field: str | None = None
    message: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    """Structured API error response."""
    
    code: ErrorCode
    message: str
    details: list[ErrorDetail] = Field(default_factory=list)
    request_id: str | None = None


class APIException(Exception):
    """Base exception for all API errors."""
    
    def __init__(
        self,
        code: ErrorCode,
        message: str,
        status_code: int = 400,
        details: list[ErrorDetail] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or []
    
    def to_response(self, request_id: str | None = None) -> ErrorResponse:
        """Convert exception to error response."""
        return ErrorResponse(
            code=self.code,
            message=self.message,
            details=self.details,
            request_id=request_id,
        )


# === Specific Exception Classes ===


class NotFoundError(APIException):
    """Resource not found (404)."""
    
    def __init__(
        self,
        resource: str,
        resource_id: str,
        code: ErrorCode = ErrorCode.WORKFLOW_NOT_FOUND,
    ) -> None:
        super().__init__(
            code=code,
            message=f"{resource} not found: {resource_id}",
            status_code=404,
        )
        self.resource = resource
        self.resource_id = resource_id


class WorkflowNotFoundError(NotFoundError):
    """Workflow not found."""
    
    def __init__(self, workflow_id: str) -> None:
        super().__init__(
            resource="Workflow",
            resource_id=workflow_id,
            code=ErrorCode.WORKFLOW_NOT_FOUND,
        )


class ExecutionNotFoundError(NotFoundError):
    """Execution not found."""
    
    def __init__(self, execution_id: str) -> None:
        super().__init__(
            resource="Execution",
            resource_id=execution_id,
            code=ErrorCode.EXECUTION_NOT_FOUND,
        )


class WorkflowInvalidError(APIException):
    """Workflow failed validation, cannot execute."""
    
    def __init__(
        self,
        message: str = "Workflow is invalid and cannot be executed",
        details: list[ErrorDetail] | None = None,
    ) -> None:
        super().__init__(
            code=ErrorCode.WORKFLOW_INVALID,
            message=message,
            status_code=400,
            details=details,
        )


class WorkflowArchivedError(APIException):
    """Workflow is archived, cannot be modified or executed."""
    
    def __init__(self, workflow_id: str) -> None:
        super().__init__(
            code=ErrorCode.WORKFLOW_ARCHIVED,
            message=f"Workflow is archived: {workflow_id}",
            status_code=400,
        )


class VersionConflictError(APIException):
    """Optimistic concurrency conflict."""
    
    def __init__(
        self,
        expected_version: int,
        actual_version: int,
    ) -> None:
        super().__init__(
            code=ErrorCode.VERSION_CONFLICT,
            message=f"Version conflict: expected {expected_version}, found {actual_version}",
            status_code=409,
        )
        self.expected_version = expected_version
        self.actual_version = actual_version


class MissingInputsError(APIException):
    """Required execution inputs not provided."""
    
    def __init__(self, missing_inputs: list[str]) -> None:
        super().__init__(
            code=ErrorCode.MISSING_INPUTS,
            message=f"Missing required inputs: {', '.join(missing_inputs)}",
            status_code=400,
            details=[
                ErrorDetail(field=inp, message="Required input not provided")
                for inp in missing_inputs
            ],
        )
        self.missing_inputs = missing_inputs


class UnauthorizedError(APIException):
    """Authentication required."""
    
    def __init__(self, message: str = "Authentication required") -> None:
        super().__init__(
            code=ErrorCode.UNAUTHORIZED,
            message=message,
            status_code=401,
        )


class ForbiddenError(APIException):
    """Access denied."""
    
    def __init__(self, message: str = "Access denied") -> None:
        super().__init__(
            code=ErrorCode.FORBIDDEN,
            message=message,
            status_code=403,
        )


class ResumeNotAllowedError(APIException):
    """Execution cannot be resumed."""
    
    def __init__(self, execution_id: str, reason: str) -> None:
        super().__init__(
            code=ErrorCode.RESUME_NOT_ALLOWED,
            message=f"Cannot resume execution {execution_id}: {reason}",
            status_code=400,
        )
        self.execution_id = execution_id
        self.reason = reason