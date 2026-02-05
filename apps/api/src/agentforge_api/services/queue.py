# apps/api/src/agentforge_api/services/queue.py

"""
In-memory queue simulator.

Simulates BullMQ behavior for development and testing.
Will be replaced with real BullMQ + Redis in production.
"""

import asyncio
import contextlib
from collections import deque
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime

from agentforge_api.models import (
    JobResult,
    JobStatus,
    NodeJob,
)

# Type alias for job processor function
JobProcessor = Callable[[NodeJob], Awaitable[JobResult]]


class InMemoryQueue:
    """
    In-memory queue that simulates BullMQ behavior.

    Features:
    - FIFO job processing
    - Async job execution
    - Retry support
    - Job status tracking
    - Completion callbacks

    Limitations (vs real BullMQ):
    - No persistence (jobs lost on restart)
    - No distributed workers
    - No rate limiting
    - No delayed jobs
    """

    def __init__(self, name: str = "default") -> None:
        self.name = name
        self._queue: deque[str] = deque()  # Queue of job IDs
        self._jobs: dict[str, NodeJob] = {}  # Job storage
        self._processor: JobProcessor | None = None
        self._running = False
        self._worker_task: asyncio.Task | None = None
        self._completion_callbacks: list[Callable[[JobResult], Awaitable[None]]] = []

    @property
    def pending_count(self) -> int:
        """Number of jobs waiting to be processed."""
        return len(self._queue)

    @property
    def total_jobs(self) -> int:
        """Total number of jobs (all statuses)."""
        return len(self._jobs)

    async def add(self, job: NodeJob) -> str:
        """
        Add a job to the queue.

        Returns the job ID.
        """
        self._jobs[job.id] = job
        self._queue.append(job.id)
        return job.id

    async def get_job(self, job_id: str) -> NodeJob | None:
        """Get a job by ID."""
        return self._jobs.get(job_id)

    async def get_jobs_by_execution(self, execution_id: str) -> list[NodeJob]:
        """Get all jobs for an execution."""
        return [job for job in self._jobs.values() if job.execution_id == execution_id]

    async def cancel_job(self, job_id: str) -> bool:
        """
        Cancel a pending job.

        Returns True if job was cancelled, False if already processed.
        """
        job = self._jobs.get(job_id)
        if job is None:
            return False

        if job.status not in (JobStatus.PENDING, JobStatus.RUNNING):
            return False

        # Update job status
        updated_job = NodeJob(
            **job.model_dump(exclude={"status", "completed_at", "error"}),
            status=JobStatus.CANCELLED,
            completed_at=datetime.now(UTC),
            error="Cancelled by user",
        )
        self._jobs[job_id] = updated_job

        # Remove from queue if still pending
        # Remove from queue if still pending
        with contextlib.suppress(ValueError):
            self._queue.remove(job_id)

        return True

    async def cancel_execution(self, execution_id: str) -> int:
        """
        Cancel all jobs for an execution.

        Returns number of jobs cancelled.
        """
        cancelled = 0
        for job in list(self._jobs.values()):

            if job.execution_id == execution_id and await self.cancel_job(job.id):
                cancelled += 1
        return cancelled

    def set_processor(self, processor: JobProcessor) -> None:
        """Set the job processor function."""
        self._processor = processor

    def on_completed(
        self,
        callback: Callable[[JobResult], Awaitable[None]],
    ) -> None:
        """Register a callback for job completion."""
        self._completion_callbacks.append(callback)

    async def start_worker(self) -> None:
        """Start the background worker."""
        if self._running:
            return

        if self._processor is None:
            raise RuntimeError("No processor set. Call set_processor() first.")

        self._running = True
        self._worker_task = asyncio.create_task(self._worker_loop())

    async def stop_worker(self) -> None:
        """Stop the background worker."""
        self._running = False
        if self._worker_task:
            self._worker_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._worker_task
            self._worker_task = None

    async def _worker_loop(self) -> None:
        """Main worker loop that processes jobs."""
        while self._running:
            if not self._queue:
                # No jobs, wait a bit
                await asyncio.sleep(0.01)
                continue

            job_id = self._queue.popleft()
            job = self._jobs.get(job_id)

            if job is None or job.status == JobStatus.CANCELLED:
                continue

            await self._process_job(job)

    async def _process_job(self, job: NodeJob) -> None:
        """Process a single job."""
        # Mark as running
        running_job = NodeJob(
            **job.model_dump(exclude={"status", "started_at"}),
            status=JobStatus.RUNNING,
            started_at=datetime.now(UTC),
        )
        self._jobs[job.id] = running_job

        try:
            # Execute the job
            result = await self._processor(running_job)

            # Update job with result
            if result.success:
                completed_job = NodeJob(
                    **running_job.model_dump(
                        exclude={"status", "completed_at", "output"}
                    ),
                    status=JobStatus.COMPLETED,
                    completed_at=datetime.now(UTC),
                    output=result.output,
                )
            else:
                # Check if we should retry
                if running_job.can_retry:
                    retry_job = NodeJob(
                        **running_job.model_dump(
                            exclude={"status", "retry_count", "started_at"}
                        ),
                        status=JobStatus.PENDING,
                        retry_count=running_job.retry_count + 1,
                        started_at=None,
                    )
                    self._jobs[job.id] = retry_job

                    # Re-queue with backoff
                    backoff_seconds = (
                        running_job.retry_backoff_ms
                        * (2**running_job.retry_count)
                        / 1000
                    )
                    await asyncio.sleep(backoff_seconds)
                    self._queue.append(job.id)
                    return  # Don't notify completion yet
                else:
                    # No more retries
                    completed_job = NodeJob(
                        **running_job.model_dump(
                            exclude={"status", "completed_at", "error"}
                        ),
                        status=JobStatus.FAILED,
                        completed_at=datetime.now(UTC),
                        error=result.error,
                    )

            self._jobs[job.id] = completed_job

            # Notify completion
            for callback in self._completion_callbacks:
                with contextlib.suppress(Exception):
                    await callback(result)

        except Exception as e:
            # Unexpected error
            error_job = NodeJob(
                **running_job.model_dump(exclude={"status", "completed_at", "error"}),
                status=JobStatus.FAILED,
                completed_at=datetime.now(UTC),
                error=str(e),
            )
            self._jobs[job.id] = error_job

            # Notify failure
            result = JobResult(
                job_id=job.id,
                node_id=job.node_id,
                execution_id=job.execution_id,
                success=False,
                error=str(e),
            )
            for callback in self._completion_callbacks:
                with contextlib.suppress(Exception):
                    await callback(result)

    async def drain(self) -> None:
        """Wait for all pending jobs to complete."""
        while self._queue or any(
            j.status == JobStatus.RUNNING for j in self._jobs.values()
        ):
            await asyncio.sleep(0.01)

    def clear(self) -> None:
        """Clear all jobs (for testing)."""
        self._queue.clear()
        self._jobs.clear()


# Singleton instance
job_queue = InMemoryQueue(name="node_execution")
