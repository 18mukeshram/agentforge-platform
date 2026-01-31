# apps/api/src/agentforge_api/services/agent_runtime.py

"""
Agent runtime for executing individual nodes.

This is a mock implementation for Phase 5.
Real agent execution will be implemented in later phases.
"""

import asyncio
import random
from datetime import datetime, timezone

from agentforge_api.models import (
    NodeJob,
    JobResult,
    NodeType,
)


class AgentRuntime:
    """
    Runtime for executing agent nodes.
    
    Mock implementation that simulates:
    - Variable execution time
    - Success/failure scenarios
    - Output generation
    """
    
    def __init__(
        self,
        min_delay_ms: int = 100,
        max_delay_ms: int = 500,
        failure_rate: float = 0.0,  # 0.0 = never fail, 1.0 = always fail
    ) -> None:
        self.min_delay_ms = min_delay_ms
        self.max_delay_ms = max_delay_ms
        self.failure_rate = failure_rate
    
    async def execute(self, job: NodeJob) -> JobResult:
        """
        Execute a node job.
        
        Dispatches to appropriate handler based on node type.
        """
        start_time = datetime.now(timezone.utc)
        
        try:
            # Simulate processing time
            delay_ms = random.randint(self.min_delay_ms, self.max_delay_ms)
            await asyncio.sleep(delay_ms / 1000)
            
            # Simulate random failures
            if random.random() < self.failure_rate:
                raise RuntimeError("Simulated random failure")
            
            # Dispatch based on node type
            node_type = NodeType(job.node_type) if job.node_type else None
            
            if node_type == NodeType.INPUT:
                output = await self._execute_input_node(job)
            elif node_type == NodeType.OUTPUT:
                output = await self._execute_output_node(job)
            elif node_type == NodeType.AGENT:
                output = await self._execute_agent_node(job)
            elif node_type == NodeType.TOOL:
                output = await self._execute_tool_node(job)
            else:
                output = await self._execute_generic_node(job)
            
            end_time = datetime.now(timezone.utc)
            duration_ms = int((end_time - start_time).total_seconds() * 1000)
            
            return JobResult(
                job_id=job.id,
                node_id=job.node_id,
                execution_id=job.execution_id,
                success=True,
                output=output,
                duration_ms=duration_ms,
            )
            
        except Exception as e:
            end_time = datetime.now(timezone.utc)
            duration_ms = int((end_time - start_time).total_seconds() * 1000)
            
            return JobResult(
                job_id=job.id,
                node_id=job.node_id,
                execution_id=job.execution_id,
                success=False,
                error=str(e),
                duration_ms=duration_ms,
            )
    
    async def _execute_input_node(self, job: NodeJob) -> dict:
        """
        Execute an input node.
        
        Passes through the provided inputs.
        """
        return {
            "type": "input",
            "node_id": job.node_id,
            "data": job.inputs,
        }
    
    async def _execute_output_node(self, job: NodeJob) -> dict:
        """
        Execute an output node.
        
        Collects and formats final outputs.
        """
        return {
            "type": "output",
            "node_id": job.node_id,
            "data": job.inputs,
        }
    
    async def _execute_agent_node(self, job: NodeJob) -> dict:
        """
        Execute an agent node.
        
        Mock implementation that simulates LLM/agent response.
        """
        agent_id = job.agent_id or "unknown"
        
        # Simulate agent processing
        return {
            "type": "agent",
            "node_id": job.node_id,
            "agent_id": agent_id,
            "result": f"Mock agent response from {agent_id}",
            "inputs_received": job.inputs,
            "config": job.node_config,
            "metadata": {
                "model": "mock-model-v1",
                "tokens_used": random.randint(50, 200),
            },
        }
    
    async def _execute_tool_node(self, job: NodeJob) -> dict:
        """
        Execute a tool node.
        
        Mock implementation that simulates tool execution.
        """
        tool_id = job.node_config.get("tool_id", "unknown")
        
        return {
            "type": "tool",
            "node_id": job.node_id,
            "tool_id": tool_id,
            "result": f"Mock tool output from {tool_id}",
            "inputs_received": job.inputs,
        }
    
    async def _execute_generic_node(self, job: NodeJob) -> dict:
        """
        Execute a generic/unknown node type.
        
        Fallback handler.
        """
        return {
            "type": "generic",
            "node_id": job.node_id,
            "node_type": job.node_type,
            "inputs_received": job.inputs,
            "message": "Executed as generic node",
        }


# Default runtime instance
agent_runtime = AgentRuntime(
    min_delay_ms=100,
    max_delay_ms=300,
    failure_rate=0.0,  # No failures by default
)


async def process_node_job(job: NodeJob) -> JobResult:
    """
    Process a node job.
    
    This is the function passed to the queue as the job processor.
    """
    return await agent_runtime.execute(job)