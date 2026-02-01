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
from agentforge_api.realtime import (
    event_emitter,
    node_running,
    node_cache_hit,
    log_emitted,
)
from agentforge_api.services.cache import (
    CacheKey,
    generate_cache_key,
    result_cache,
)


class AgentRuntime:
    """
    Runtime for executing agent nodes.
    
    Mock implementation that simulates:
    - Variable execution time
    - Success/failure scenarios
    - Output generation
    - Real-time event emission
    - Result caching
    
    Cache behavior:
    - Cache checked ONLY on first attempt (retry_count == 0)
    - Cache written ONLY on success
    - Retries NEVER consult cache
    - Cache failures NEVER break execution
    """
    
    def __init__(
        self,
        min_delay_ms: int = 100,
        max_delay_ms: int = 500,
        failure_rate: float = 0.0,  # 0.0 = never fail, 1.0 = always fail
        cache_enabled: bool = True,
    ) -> None:
        self.min_delay_ms = min_delay_ms
        self.max_delay_ms = max_delay_ms
        self.failure_rate = failure_rate
        self.cache_enabled = cache_enabled
    
    async def execute(self, job: NodeJob) -> JobResult:
        """
        Execute a node job.
        
        Flow:
        1. If first attempt and cacheable, check cache
        2. If cache hit, return cached result immediately
        3. If cache miss or retry, execute node
        4. If success, write to cache
        5. Return result
        """
        start_time = datetime.now(timezone.utc)
        is_first_attempt = job.retry_count == 0
        is_cacheable = self._is_cacheable(job)
        cache_key: CacheKey | None = None
        
        # === Cache Lookup (first attempt only) ===
        if self.cache_enabled and is_first_attempt and is_cacheable:
            cache_key = self._generate_cache_key(job)
            cached_result = await self._check_cache(job, cache_key)
            if cached_result is not None:
                return cached_result
        
        # === Execute Node ===
        result = await self._execute_node(job, start_time)
        
        # === Cache Write (success only) ===
        if self.cache_enabled and result.success and is_cacheable:
            # Generate key if not already done (retry success case)
            if cache_key is None:
                cache_key = self._generate_cache_key(job)
            await self._write_cache(job, cache_key, result)
        
        return result
    
    def _is_cacheable(self, job: NodeJob) -> bool:
        """
        Determine if a job's output can be cached.
        
        Currently caches agent and tool nodes only.
        Input/output nodes are pass-through and not cached.
        """
        try:
            node_type = NodeType(job.node_type) if job.node_type else None
            return node_type in (NodeType.AGENT, NodeType.TOOL)
        except (ValueError, TypeError):
            return False
    
    def _generate_cache_key(self, job: NodeJob) -> CacheKey:
        """Generate cache key for a job."""
        agent_id = job.agent_id or job.node_type or "unknown"
        agent_version = job.node_config.get("version", "1.0.0")
        
        return generate_cache_key(
            agent_id=agent_id,
            inputs=job.inputs,
            agent_version=str(agent_version),
        )
    
    async def _check_cache(
        self,
        job: NodeJob,
        cache_key: CacheKey,
    ) -> JobResult | None:
        """
        Check cache for existing result.
        
        Returns JobResult if cache hit, None if miss.
        Never raises exceptions.
        """
        try:
            entry = result_cache.get(cache_key)
            
            if entry is None:
                await self._emit_log(job, "info", "Cache miss - executing node")
                return None
            
            # Cache hit - emit specific event
            await event_emitter.emit(node_cache_hit(
                execution_id=job.execution_id,
                node_id=job.node_id,
                original_duration_ms=entry.metadata.duration_ms,
            ))
            
            await self._emit_log(
                job,
                "info",
                f"Cache hit - returning cached result (originally took {entry.metadata.duration_ms}ms)",
            )
            
            return JobResult(
                job_id=job.id,
                node_id=job.node_id,
                execution_id=job.execution_id,
                success=True,
                output=entry.output,
                duration_ms=0,  # Instant return from cache
            )
            
        except Exception as e:
            # Cache failures must never break execution
            await self._emit_log(
                job,
                "warn",
                f"Cache lookup failed, continuing with execution: {e}",
            )
            return None
    
    async def _write_cache(
        self,
        job: NodeJob,
        cache_key: CacheKey,
        result: JobResult,
    ) -> None:
        """
        Write successful result to cache.
        
        Never raises exceptions.
        """
        try:
            success = result_cache.set(
                key=cache_key,
                output=result.output,
                duration_ms=result.duration_ms,
            )
            
            if success:
                await self._emit_log(job, "info", "Result cached for future executions")
            else:
                await self._emit_log(job, "warn", "Failed to cache result")
                
        except Exception as e:
            # Cache failures must never break execution
            await self._emit_log(job, "warn", f"Cache write failed: {e}")
    
    async def _execute_node(
        self,
        job: NodeJob,
        start_time: datetime,
    ) -> JobResult:
        """
        Execute the actual node logic.
        
        This is the core execution path, used on cache miss or retry.
        """
        # Emit NODE_RUNNING event
        await event_emitter.emit(node_running(
            execution_id=job.execution_id,
            node_id=job.node_id,
            retry_count=job.retry_count,
        ))
        
        # Emit log for execution start
        if job.retry_count > 0:
            await self._emit_log(
                job,
                "info",
                f"Retrying execution (attempt {job.retry_count + 1})",
            )
        else:
            await self._emit_log(
                job,
                "info",
                f"Starting execution",
            )
        
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
            
            # Emit success log
            await self._emit_log(
                job,
                "info",
                f"Execution completed in {duration_ms}ms",
            )
            
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
            
            # Emit error log
            await self._emit_log(
                job,
                "error",
                f"Execution failed: {str(e)}",
            )
            
            return JobResult(
                job_id=job.id,
                node_id=job.node_id,
                execution_id=job.execution_id,
                success=False,
                error=str(e),
                duration_ms=duration_ms,
            )
    
    async def _emit_log(
        self,
        job: NodeJob,
        level: str,
        message: str,
    ) -> None:
        """Emit a log event."""
        await event_emitter.emit(log_emitted(
            execution_id=job.execution_id,
            node_id=job.node_id,
            level=level,
            message=message,
        ))
    
    async def _execute_input_node(self, job: NodeJob) -> dict:
        """Execute an input node."""
        await self._emit_log(job, "info", "Processing input data")
        
        return {
            "type": "input",
            "node_id": job.node_id,
            "data": job.inputs,
        }
    
    async def _execute_output_node(self, job: NodeJob) -> dict:
        """Execute an output node."""
        await self._emit_log(job, "info", "Collecting output data")
        
        return {
            "type": "output",
            "node_id": job.node_id,
            "data": job.inputs,
        }
    
    async def _execute_agent_node(self, job: NodeJob) -> dict:
        """Execute an agent node (mock)."""
        agent_id = job.agent_id or "unknown"
        
        await self._emit_log(job, "info", f"Invoking agent: {agent_id}")
        await asyncio.sleep(0.05)
        await self._emit_log(job, "info", "Agent response received")
        
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
        """Execute a tool node (mock)."""
        tool_id = job.node_config.get("tool_id", "unknown")
        
        await self._emit_log(job, "info", f"Executing tool: {tool_id}")
        
        return {
            "type": "tool",
            "node_id": job.node_id,
            "tool_id": tool_id,
            "result": f"Mock tool output from {tool_id}",
            "inputs_received": job.inputs,
        }
    
    async def _execute_generic_node(self, job: NodeJob) -> dict:
        """Execute a generic/unknown node type."""
        await self._emit_log(job, "warn", f"Unknown node type: {job.node_type}")
        
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
    failure_rate=0.0,
    cache_enabled=True,
)


async def process_node_job(job: NodeJob) -> JobResult:
    """Process a node job."""
    return await agent_runtime.execute(job)