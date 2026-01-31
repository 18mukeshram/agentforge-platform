# apps/api/src/agentforge_api/core/config.py

"""Application configuration."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Application settings.
    
    Values can be overridden via environment variables.
    """
    
    # Application
    app_name: str = "AgentForge API"
    app_version: str = "0.1.0"
    debug: bool = False
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    
    # CORS (will be configured properly in production)
    cors_origins: list[str] = ["http://localhost:3000"]
    
    class Config:
        env_prefix = "AGENTFORGE_"
        env_file = ".env"


settings = Settings()