# apps/api/src/agentforge_api/core/__init__.py

"""Core utilities for AgentForge API."""

from agentforge_api.core.config import Settings, settings
from agentforge_api.core.exceptions import (
    APIException,
    ErrorCode,
    ErrorDetail,
    ErrorResponse,
    ExecutionNotFoundError,
    ForbiddenError,
    MissingInputsError,
    NotFoundError,
    UnauthorizedError,
    VersionConflictError,
    WorkflowArchivedError,
    WorkflowInvalidError,
    WorkflowNotFoundError,
)
from agentforge_api.core.error_handlers import (
    api_exception_handler,
    pydantic_exception_handler,
    unhandled_exception_handler,
)

__all__ = [
    # Config
    "Settings",
    "settings",
    # Exceptions
    "APIException",
    "ErrorCode",
    "ErrorDetail",
    "ErrorResponse",
    "ExecutionNotFoundError",
    "ForbiddenError",
    "MissingInputsError",
    "NotFoundError",
    "UnauthorizedError",
    "VersionConflictError",
    "WorkflowArchivedError",
    "WorkflowInvalidError",
    "WorkflowNotFoundError",
    # Handlers
    "api_exception_handler",
    "pydantic_exception_handler",
    "unhandled_exception_handler",
]