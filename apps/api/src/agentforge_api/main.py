# apps/api/src/agentforge_api/main.py

"""
AgentForge API Entry Point.

FastAPI application with all routes and middleware configured.
"""

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError as PydanticValidationError

from agentforge_api.core.config import settings
from agentforge_api.core.exceptions import APIException
from agentforge_api.core.error_handlers import (
    api_exception_handler,
    pydantic_exception_handler,
    unhandled_exception_handler,
)
from agentforge_api.routes import (
    workflows_router,
    validation_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """
    Application lifespan manager.
    
    Handles startup and shutdown events.
    """
    # Startup
    # Future: initialize database connections, Redis, etc.
    print(f"Starting {settings.app_name} v{settings.app_version}")
    
    yield
    
    # Shutdown
    # Future: close database connections, cleanup resources
    print(f"Shutting down {settings.app_name}")


def create_app() -> FastAPI:
    """
    Application factory.
    
    Creates and configures the FastAPI application.
    """
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        debug=settings.debug,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )
    
    # === Middleware ===
    
    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # === Exception Handlers ===
    
    app.add_exception_handler(APIException, api_exception_handler)
    app.add_exception_handler(PydanticValidationError, pydantic_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
    
    # === Routes ===
    
    # Health check
    @app.get("/health", tags=["health"])
    async def health_check() -> dict:
        """Health check endpoint."""
        return {
            "status": "healthy",
            "version": settings.app_version,
        }
    
    # API routes
    app.include_router(workflows_router, prefix="/api/v1")
    app.include_router(validation_router, prefix="/api/v1")
    
    return app


# Create application instance
app = create_app()


# === Development Entry Point ===

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "agentforge_api.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )