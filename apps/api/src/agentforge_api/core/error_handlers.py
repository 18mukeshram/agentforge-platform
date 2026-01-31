# apps/api/src/agentforge_api/core/error_handlers.py

"""FastAPI exception handlers."""

from fastapi import Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError as PydanticValidationError

from agentforge_api.core.exceptions import (
    APIException,
    ErrorCode,
    ErrorDetail,
    ErrorResponse,
)


async def api_exception_handler(
    request: Request,
    exc: APIException,
) -> JSONResponse:
    """Handle APIException and subclasses."""
    request_id = getattr(request.state, "request_id", None)
    response = exc.to_response(request_id=request_id)
    
    return JSONResponse(
        status_code=exc.status_code,
        content=response.model_dump(mode="json"),
    )


async def pydantic_exception_handler(
    request: Request,
    exc: PydanticValidationError,
) -> JSONResponse:
    """Handle Pydantic validation errors."""
    request_id = getattr(request.state, "request_id", None)
    
    details = [
        ErrorDetail(
            field=".".join(str(loc) for loc in error["loc"]),
            message=error["msg"],
            metadata={"type": error["type"]},
        )
        for error in exc.errors()
    ]
    
    response = ErrorResponse(
        code=ErrorCode.VALIDATION_ERROR,
        message="Request validation failed",
        details=details,
        request_id=request_id,
    )
    
    return JSONResponse(
        status_code=422,
        content=response.model_dump(mode="json"),
    )


async def unhandled_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    """Handle unexpected exceptions."""
    request_id = getattr(request.state, "request_id", None)
    
    # Log the exception here in production
    # logger.exception("Unhandled exception", request_id=request_id)
    
    response = ErrorResponse(
        code=ErrorCode.INTERNAL_ERROR,
        message="An unexpected error occurred",
        request_id=request_id,
    )
    
    return JSONResponse(
        status_code=500,
        content=response.model_dump(mode="json"),
    )