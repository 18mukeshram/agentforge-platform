# apps/api/tests/test_execution_flow.py

"""
Integration test for execution flow.

Tests the complete flow from workflow creation to execution.
"""

import pytest
from httpx import AsyncClient, ASGITransport

from agentforge_api.main import app
from agentforge_api.services.workflow_service import workflow_service
from agentforge_api.services.execution_service import execution_service
from agentforge_api.services.queue import job_queue
from agentforge_api.services.orchestrator import orchestrator


@pytest.fixture(autouse=True)
async def cleanup():
    """Clean up services before each test."""
    workflow_service._workflows.clear()
    workflow_service._validation_errors.clear()
    execution_service._executions.clear()
    orchestrator._plans.clear()
    job_queue.clear()
    yield


@pytest.fixture
async def client():
    """Create test client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    """Test health endpoint."""
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_create_and_execute_workflow(client: AsyncClient):
    """Test complete workflow creation and execution flow."""
    
    # 1. Create a simple workflow with two nodes
    workflow_data = {
        "name": "Test Workflow",
        "description": "A test workflow",
        "nodes": [
            {
                "id": "node_1",
                "type": "input",
                "label": "Input Node",
                "position": {"x": 0, "y": 0},
                "config": {}
            },
            {
                "id": "node_2",
                "type": "output",
                "label": "Output Node",
                "position": {"x": 200, "y": 0},
                "config": {}
            }
        ],
        "edges": [
            {
                "id": "edge_1",
                "source": "node_1",
                "source_port": "output",
                "target": "node_2",
                "target_port": "input"
            }
        ]
    }
    
    response = await client.post("/api/v1/workflows", json=workflow_data)
    assert response.status_code == 201
    
    workflow = response.json()
    workflow_id = workflow["id"]
    assert workflow["status"] == "valid"
    
    # 2. Validate the workflow
    response = await client.post(f"/api/v1/workflows/{workflow_id}/validate")
    assert response.status_code == 200
    
    validation = response.json()
    assert validation["valid"] is True
    assert validation["execution_order"] == ["node_1", "node_2"]
    
    # 3. Execute the workflow
    execute_data = {
        "inputs": {"message": "Hello, World!"}
    }
    
    response = await client.post(
        f"/api/v1/executions/workflows/{workflow_id}/execute",
        json=execute_data
    )
    assert response.status_code == 202
    
    execution = response.json()
    execution_id = execution["execution_id"]
    assert execution["status"] == "running"
    
    # 4. Wait for execution to complete (drain the queue)
    await job_queue.drain()
    
    # 5. Check execution status
    response = await client.get(f"/api/v1/executions/{execution_id}")
    assert response.status_code == 200
    
    result = response.json()
    assert result["status"] == "completed"
    assert len(result["node_states"]) == 2
    
    # Verify all nodes completed
    for node_state in result["node_states"]:
        assert node_state["status"] == "completed"


@pytest.mark.asyncio
async def test_cancel_execution(client: AsyncClient):
    """Test execution cancellation."""
    
    # Create workflow
    workflow_data = {
        "name": "Cancel Test",
        "nodes": [
            {
                "id": "node_1",
                "type": "input",
                "label": "Input",
                "position": {"x": 0, "y": 0},
                "config": {}
            }
        ],
        "edges": []
    }
    
    response = await client.post("/api/v1/workflows", json=workflow_data)
    workflow_id = response.json()["id"]
    
    # Execute
    response = await client.post(
        f"/api/v1/executions/workflows/{workflow_id}/execute",
        json={"inputs": {}}
    )
    execution_id = response.json()["execution_id"]
    
    # Cancel immediately
    response = await client.post(f"/api/v1/executions/{execution_id}/cancel")
    assert response.status_code == 202
    
    # Status should be cancelled (or completed if too fast)
    result = response.json()
    assert result["status"] in ["cancelled", "completed"]