# AgentForge API

Backend API for AgentForge workflow orchestration platform.

## Overview

The AgentForge API is a FastAPI-based backend that provides:

- **Workflow Management**: CRUD operations for DAG-based workflows
- **DAG Validation**: Structural and semantic validation of workflow graphs
- **Execution Engine**: Async workflow execution with job queuing
- **Real-time Updates**: WebSocket streaming of execution events
- **Multi-tenancy**: Strict tenant isolation with JWT authentication
- **Caching**: Tenant-isolated result caching for agent outputs

## Quick Start

### Prerequisites

- Python 3.11+
- pip or uv package manager

### Local Development

````bash
# Navigate to API directory
cd apps/api

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -e ".[dev]"

# Set environment variables
export AGENTFORGE_JWT_SECRET="dev-secret-change-in-production"
export AGENTFORGE_DEBUG="true"

# Run the server
uvicorn agentforge_api.main:app --reload --port 8000
Verify Installation
Bash

# Health check
curl http://localhost:8000/health

# Ready check
curl http://localhost:8000/ready
API Documentation
When running locally, access:

Swagger UI: http://localhost:8000/docs
ReDoc: http://localhost:8000/redoc
OpenAPI JSON: http://localhost:8000/openapi.json
Project Structure
text

apps/api/
├── src/agentforge_api/
│   ├── auth/           # JWT authentication & RBAC
│   ├── core/           # Config, exceptions, error handlers
│   ├── models/         # Pydantic domain models
│   ├── realtime/       # WebSocket events & hub
│   ├── routes/         # API route handlers
│   ├── services/       # Business logic services
│   ├── validation/     # DAG validation logic
│   └── main.py         # FastAPI application entry
├── tests/              # Test suite
├── Dockerfile          # Production container
└── pyproject.toml      # Dependencies & config
Environment Variables
Variable	Required	Default	Description
AGENTFORGE_JWT_SECRET	Yes	-	Secret key for JWT signing
AGENTFORGE_DEBUG	No	false	Enable debug mode
AGENTFORGE_HOST	No	0.0.0.0	Server bind host
AGENTFORGE_PORT	No	8000	Server bind port
AGENTFORGE_CORS_ORIGINS	No	http://localhost:3000	Allowed CORS origins
Testing
Bash

# Run all tests
pytest

# Run with coverage
pytest --cov=agentforge_api

# Run specific test file
pytest tests/test_validation/
Linting
Bash

# Run Ruff linter
ruff check src/ tests/

# Run with auto-fix
ruff check src/ tests/ --fix

# Type checking
mypy src/
Docker
Bash

# Build image
docker build -t agentforge-api .

# Run container
docker run -p 8000:8000 \
  -e AGENTFORGE_JWT_SECRET=your-secret \
  agentforge-api
text


```markdown
# README.md

# AgentForge

A production-grade SaaS platform for visually designing, validating, and executing AI agent workflows using a node-based canvas.

![CI](https://github.com/your-org/agentforge/workflows/CI/badge.svg)

## Overview

AgentForge enables users to build complex AI agent workflows as Directed Acyclic Graphs (DAGs) with:

- **Visual DAG Builder**: Node-based canvas for workflow design
- **DAG Validation**: Cycle detection, dependency resolution, type checking
- **Async Execution**: Background execution with retries and caching
- **Real-time Logs**: WebSocket streaming of execution progress
- **Multi-tenancy**: Secure tenant isolation with RBAC

## Architecture
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND (Next.js) │
│ Visual DAG Builder • Workflow Management │
└─────────────────────┬───────────────────┬───────────────────┘
│ REST │ WebSocket
┌─────────────────────▼───────────────────▼───────────────────┐
│ BACKEND (FastAPI) │
│ Workflow Service • Validation • Execution Engine │
└───────┬─────────────────────┬─────────────────────┬─────────┘
│ │ │
┌───────▼───────┐ ┌───────▼───────┐ ┌───────▼───────┐
│ PostgreSQL │ │ Redis │ │ BullMQ │
│ (persistent) │ │ (cache) │ │ (queues) │
└───────────────┘ └───────────────┘ └───────────────┘

text


## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local frontend development)
- Python 3.11+ (for local backend development)

### Using Docker Compose

```bash
# Clone the repository
git clone https://github.com/your-org/agentforge.git
cd agentforge

# Copy environment template
cp .env.example .env

# Edit .env and set required values
# - JWT_SECRET (required): Generate with `openssl rand -base64 32`

# Start all services
docker compose up

# Access the application
# - Web UI: http://localhost:3000
# - API: http://localhost:8000
# - API Docs: http://localhost:8000/docs
Stop Services
Bash

# Stop and remove containers
docker compose down

# Stop and remove volumes (clean slate)
docker compose down -v
Project Structure
text

agentforge/
├── apps/
│   ├── api/                 # FastAPI backend
│   │   ├── src/agentforge_api/
│   │   ├── tests/
│   │   ├── Dockerfile
│   │   └── pyproject.toml
│   └── web/                 # Next.js frontend
│       ├── src/
│       ├── Dockerfile
│       └── package.json
├── packages/
│   └── contracts/           # Shared TypeScript types
├── docker-compose.yml       # Local development stack
├── .env.example             # Environment template
└── README.md
Environment Configuration
Required Variables
Variable	Description
JWT_SECRET	Secret key for JWT token signing
Optional Variables
Variable	Default	Description
API_PORT	8000	Backend API port
WEB_PORT	3000	Frontend port
API_DEBUG	false	Enable debug mode
CORS_ORIGINS	http://localhost:3000	Allowed CORS origins
NEXT_PUBLIC_API_URL	http://localhost:8000	API URL for frontend
NEXT_PUBLIC_WS_URL	ws://localhost:8000	WebSocket URL for frontend
Generate JWT Secret
Bash

# Using OpenSSL
openssl rand -base64 32

# Using Python
python -c "import secrets; print(secrets.token_urlsafe(32))"
Development
Backend (API)
Bash

cd apps/api

# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -e ".[dev]"

# Run development server
uvicorn agentforge_api.main:app --reload

# Run tests
pytest

# Lint code
ruff check src/ tests/
Frontend (Web)
Bash

cd apps/web

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Lint code
npm run lint
API Endpoints
Health & Readiness
Endpoint	Description
GET /health	Basic health check
GET /ready	Readiness with dependency status
Workflows
Endpoint	Method	Description
/api/v1/workflows	GET	List workflows
/api/v1/workflows	POST	Create workflow
/api/v1/workflows/{id}	GET	Get workflow
/api/v1/workflows/{id}	PUT	Update workflow
/api/v1/workflows/{id}	DELETE	Archive workflow
/api/v1/workflows/{id}/validate	POST	Validate workflow
Executions
Endpoint	Method	Description
/api/v1/executions	GET	List executions
/api/v1/executions/{id}	GET	Get execution status
/api/v1/executions/{id}/cancel	POST	Cancel execution
/api/v1/executions/{id}/logs	GET	Get execution logs
/api/v1/executions/workflows/{id}/execute	POST	Trigger execution
WebSocket
Endpoint	Description
/ws/executions?token=<jwt>	Real-time execution events
Authentication
AgentForge uses JWT-based authentication:

Bash

# Include token in Authorization header
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/v1/workflows

# WebSocket authentication via query parameter
wscat -c "ws://localhost:8000/ws/executions?token=<token>"
Roles
Role	Permissions
OWNER	Full access (tenant admin)
ADMIN	Manage workflows & executions
MEMBER	Create, edit, execute workflows
VIEWER	Read-only access
CI/CD
GitHub Actions pipeline runs on push to main and pull requests:

Lint & Test: Python (Ruff, MyPy, Pytest) and Node.js (ESLint, TypeScript)
Build: Docker images for API and Web
Smoke Test: Container health checks
View workflow runs at: .github/workflows/ci.yml

Docker Images
Build Locally
Bash

# Build API
docker build -t agentforge-api ./apps/api

# Build Web
docker build -t agentforge-web ./apps/web \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:8000 \
  --build-arg NEXT_PUBLIC_WS_URL=ws://localhost:8000
Run Individually
Bash

# Run API
docker run -p 8000:8000 \
  -e AGENTFORGE_JWT_SECRET=your-secret \
  agentforge-api

# Run Web
docker run -p 3000:3000 agentforge-web
Troubleshooting
Container won't start
Bash

# Check logs
docker compose logs api
docker compose logs web

# Verify environment variables
docker compose config
API health check failing
Bash

# Check if API is running
curl http://localhost:8000/health

# Check container status
docker ps
docker logs agentforge-api
WebSocket connection issues
Verify NEXT_PUBLIC_WS_URL is set correctly
Check CORS configuration
Ensure JWT token is valid
License
MIT License - see LICENSE for details.

Contributing
Fork the repository
Create a feature branch
Make your changes
Run tests and linting
Submit a pull request
See CONTRIBUTING.md for detailed guidelines.

text


**Design notes:**
- Root README covers full project with architecture diagram
- API README provides service-specific details
- Quick start uses Docker Compose (simplest path)
- Environment variables documented in tables
- All API endpoints listed with methods
- Authentication and roles explained
- Troubleshooting section for common issues
- CI/CD overview links to workflow file
- Commands are copy-pasteable

---
````
