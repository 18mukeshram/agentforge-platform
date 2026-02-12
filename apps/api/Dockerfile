# apps/api/Dockerfile

# ============================================
# AgentForge API - Production Dockerfile
# ============================================
# Multi-stage build for minimal image size
# Base: python:3.11-slim
# ============================================

# ------------------------------
# Stage 1: Builder
# ------------------------------
FROM python:3.11-slim AS builder

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python dependencies
# Copy both pyproject.toml AND source code (hatchling needs src/ to build)
COPY pyproject.toml ./
COPY src/ ./src/

RUN pip install --upgrade pip && \
    pip install .

# ------------------------------
# Stage 2: Production
# ------------------------------
FROM python:3.11-slim AS production

# Labels
LABEL org.opencontainers.image.title="AgentForge API" \
      org.opencontainers.image.description="Backend API for AgentForge workflow orchestration" \
      org.opencontainers.image.version="0.1.0"

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    # App settings
    AGENTFORGE_HOST=0.0.0.0 \
    AGENTFORGE_PORT=8000 \
    AGENTFORGE_DEBUG=false \
    # Python path
    PATH="/opt/venv/bin:$PATH"

# Create non-root user for security
RUN groupadd --gid 1000 appgroup && \
    useradd --uid 1000 --gid appgroup --shell /bin/bash --create-home appuser

WORKDIR /app

# Copy virtual environment from builder (includes installed agentforge_api package)
COPY --from=builder /opt/venv /opt/venv

# Set ownership
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Run the application
CMD ["uvicorn", "agentforge_api.main:app", "--host", "0.0.0.0", "--port", "8000"]