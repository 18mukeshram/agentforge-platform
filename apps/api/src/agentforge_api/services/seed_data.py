# apps/api/src/agentforge_api/services/seed_data.py

"""
Seed data for development.

Creates demo workflows on server startup so the frontend has data to display.
"""

from datetime import UTC, datetime

from agentforge_api.models import (
    Edge,
    Node,
    NodeConfig,
    NodePosition,
    NodeType,
    Workflow,
    WorkflowMeta,
    WorkflowStatus,
)
from agentforge_api.services.workflow_service import workflow_service

# Use consistent IDs so frontend links work
DEMO_TENANT_ID = "demo-tenant"
DEMO_USER_ID = "demo-user"


def seed_demo_data() -> None:
    """
    Seed demo workflows for development.

    Called on server startup. Uses consistent IDs that match frontend links.
    """
    # Check if already seeded (avoid duplicates on hot reload)
    existing, _ = workflow_service.list(tenant_id=DEMO_TENANT_ID, limit=1)
    if existing:
        print(f"Demo data already seeded ({len(existing)} workflows found)")
        return

    now = datetime.now(UTC)

    # === Workflow 1: Content Generation Pipeline ===
    wf1_id = "workflow-1"
    wf1_nodes = [
        Node(
            id="input-1",
            type=NodeType.INPUT,
            label="User Prompt",
            position=NodePosition(x=100, y=200),
            config=NodeConfig(),
        ),
        Node(
            id="agent-1",
            type=NodeType.AGENT,
            label="Content Writer",
            position=NodePosition(x=350, y=200),
            config=NodeConfig(agent_id="gpt-4-writer"),
        ),
        Node(
            id="output-1",
            type=NodeType.OUTPUT,
            label="Generated Content",
            position=NodePosition(x=600, y=200),
            config=NodeConfig(),
        ),
    ]
    wf1_edges = [
        Edge(id="edge-1", source="input-1", target="agent-1"),
        Edge(id="edge-2", source="agent-1", target="output-1"),
    ]

    wf1 = Workflow(
        id=wf1_id,
        status=WorkflowStatus.VALID,
        meta=WorkflowMeta(
            name="Content Generation Pipeline",
            description="Automated content creation flow with AI writer",
            created_at=now,
            updated_at=now,
            owner_id=DEMO_USER_ID,
            version=1,
        ),
        nodes=wf1_nodes,
        edges=wf1_edges,
    )

    # Store directly (bypass validation since we know it's valid)
    workflow_service._workflows[wf1_id] = wf1
    workflow_service._workflow_tenants[wf1_id] = DEMO_TENANT_ID

    # === Workflow 2: Data Analysis Workflow ===
    wf2_id = "workflow-2"
    wf2_nodes = [
        Node(
            id="input-2",
            type=NodeType.INPUT,
            label="CSV Upload",
            position=NodePosition(x=100, y=200),
            config=NodeConfig(),
        ),
        Node(
            id="tool-1",
            type=NodeType.TOOL,
            label="Data Parser",
            position=NodePosition(x=350, y=150),
            config=NodeConfig(tool_id="csv_parser"),
        ),
        Node(
            id="agent-2",
            type=NodeType.AGENT,
            label="Data Analyst",
            position=NodePosition(x=350, y=300),
            config=NodeConfig(agent_id="gpt-4-analyst"),
        ),
        Node(
            id="output-2",
            type=NodeType.OUTPUT,
            label="Analysis Report",
            position=NodePosition(x=600, y=200),
            config=NodeConfig(),
        ),
    ]
    wf2_edges = [
        Edge(id="edge-3", source="input-2", target="tool-1"),
        Edge(id="edge-4", source="tool-1", target="agent-2"),
        Edge(id="edge-5", source="agent-2", target="output-2"),
    ]

    wf2 = Workflow(
        id=wf2_id,
        status=WorkflowStatus.VALID,
        meta=WorkflowMeta(
            name="Data Analysis Workflow",
            description="Analyze sales data from CSV with AI insights",
            created_at=now,
            updated_at=now,
            owner_id=DEMO_USER_ID,
            version=1,
        ),
        nodes=wf2_nodes,
        edges=wf2_edges,
    )

    workflow_service._workflows[wf2_id] = wf2
    workflow_service._workflow_tenants[wf2_id] = DEMO_TENANT_ID

    print(f"✅ Seeded {len(workflow_service._workflows)} demo workflows")
