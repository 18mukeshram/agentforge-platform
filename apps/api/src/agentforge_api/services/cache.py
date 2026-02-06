# apps/api/src/agentforge_api/services/cache.py

"""
In-memory cache for agent execution results.

Provides deterministic caching based on tenant, agent identity, and inputs.
Cache is an optimization only - execution must be correct without it.
Strict tenant isolation: cache keys include tenant_id.
"""

import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any


@dataclass(frozen=True)
class CacheKey:
    """
    Immutable cache key for agent execution results.

    Key components (in order):
    - tenant_id: Tenant isolation (CRITICAL)
    - agent_id: Which agent was executed
    - inputs_hash: Hash of resolved inputs
    - agent_version: Version of agent definition

    Intentionally excludes:
    - execution_id (same inputs should hit cache across executions)
    - node_id (same agent+inputs in different nodes should share cache)

    Tenant isolation is non-negotiable:
    - Same agent + same inputs in different tenants = different cache entries
    - Prevents cross-tenant data leakage
    """

    tenant_id: str
    agent_id: str
    inputs_hash: str
    agent_version: str

    def __str__(self) -> str:
        """String representation for storage key."""
        return f"{self.tenant_id}:{self.agent_id}:{self.agent_version}:{self.inputs_hash}"


@dataclass(frozen=True)
class CacheMetadata:
    """Metadata about cached result."""

    duration_ms: int
    cached_at: datetime
    tenant_id: str  # Track which tenant owns this entry


@dataclass(frozen=True)
class CacheEntry:
    """A cached execution result."""

    output: Any
    metadata: CacheMetadata

    def to_dict(self) -> dict:
        """Convert to dictionary for serialization."""
        return {
            "output": self.output,
            "metadata": {
                "duration_ms": self.metadata.duration_ms,
                "cached_at": self.metadata.cached_at.isoformat(),
                "tenant_id": self.metadata.tenant_id,
            },
        }


def compute_inputs_hash(inputs: dict[str, Any]) -> str:
    """
    Compute deterministic hash of inputs.

    Uses JSON serialization with sorted keys for consistency.
    Returns SHA-256 hash truncated to 16 characters.
    """
    try:
        serialized = json.dumps(
            inputs,
            sort_keys=True,
            separators=(",", ":"),
            default=str,
        )
    except (TypeError, ValueError):
        serialized = str(inputs)

    hash_bytes = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
    return hash_bytes[:16]


def generate_cache_key(
    tenant_id: str,
    agent_id: str,
    inputs: dict[str, Any],
    agent_version: str = "1.0.0",
) -> CacheKey:
    """
    Generate a cache key for an agent execution.

    Args:
        tenant_id: Tenant identifier (REQUIRED for isolation)
        agent_id: Unique identifier of the agent
        inputs: Resolved inputs for this execution
        agent_version: Version of the agent definition

    Returns:
        CacheKey that uniquely identifies this computation within a tenant
    """
    if not tenant_id:
        raise ValueError("tenant_id is required for cache key generation")

    inputs_hash = compute_inputs_hash(inputs)

    return CacheKey(
        tenant_id=tenant_id,
        agent_id=agent_id,
        inputs_hash=inputs_hash,
        agent_version=agent_version,
    )


class ResultCache:
    """
    In-memory cache for agent execution results.

    Features:
    - Tenant-isolated cache keys
    - Deterministic key-based lookup
    - Stores only successful outputs
    - Thread-safe for async operations

    Limitations (by design for Phase 7):
    - No TTL/expiration
    - No size limits
    - No persistence
    - No distributed sync

    Cache failures are silent - execution continues without cache.

    CRITICAL: All operations are tenant-scoped. Cross-tenant
    cache access is impossible by design (tenant_id in key).
    """

    def __init__(self) -> None:
        self._store: dict[str, CacheEntry] = {}
        self._hits: int = 0
        self._misses: int = 0
        self._tenant_stats: dict[str, dict[str, int]] = {}  # tenant_id -> {hits, misses}

    def get(self, key: CacheKey) -> CacheEntry | None:
        """
        Retrieve cached result.

        Returns None on cache miss.
        Never raises exceptions - cache failures are silent.
        """
        try:
            entry = self._store.get(str(key))
            if entry is not None:
                self._hits += 1
                self._increment_tenant_stat(key.tenant_id, "hits")
                return entry
            else:
                self._misses += 1
                self._increment_tenant_stat(key.tenant_id, "misses")
                return None
        except Exception:
            self._misses += 1
            return None

    def set(
        self,
        key: CacheKey,
        output: Any,
        duration_ms: int,
    ) -> bool:
        """
        Store successful result in cache.

        Returns True if stored successfully, False otherwise.
        Never raises exceptions - cache failures are silent.
        """
        try:
            entry = CacheEntry(
                output=output,
                metadata=CacheMetadata(
                    duration_ms=duration_ms,
                    cached_at=datetime.now(UTC),
                    tenant_id=key.tenant_id,
                ),
            )
            self._store[str(key)] = entry
            return True
        except Exception:
            return False

    def has(self, key: CacheKey) -> bool:
        """Check if key exists in cache."""
        try:
            return str(key) in self._store
        except Exception:
            return False

    def invalidate(self, key: CacheKey) -> bool:
        """
        Remove entry from cache.

        Returns True if entry existed and was removed.
        """
        try:
            if str(key) in self._store:
                del self._store[str(key)]
                return True
            return False
        except Exception:
            return False

    def invalidate_tenant(self, tenant_id: str) -> int:
        """
        Remove all cache entries for a tenant.

        Returns number of entries removed.
        Useful for tenant deletion or data cleanup.
        """
        try:
            keys_to_remove = [
                key for key, entry in self._store.items() if entry.metadata.tenant_id == tenant_id
            ]
            for key in keys_to_remove:
                del self._store[key]

            # Clear tenant stats
            self._tenant_stats.pop(tenant_id, None)

            return len(keys_to_remove)
        except Exception:
            return 0

    def clear(self) -> None:
        """Clear all cached entries."""
        self._store.clear()
        self._hits = 0
        self._misses = 0
        self._tenant_stats.clear()

    def _increment_tenant_stat(self, tenant_id: str, stat: str) -> None:
        """Increment a tenant-specific statistic."""
        if tenant_id not in self._tenant_stats:
            self._tenant_stats[tenant_id] = {"hits": 0, "misses": 0}
        self._tenant_stats[tenant_id][stat] = self._tenant_stats[tenant_id].get(stat, 0) + 1

    @property
    def size(self) -> int:
        """Number of entries in cache."""
        return len(self._store)

    @property
    def hit_rate(self) -> float:
        """Cache hit rate (0.0 to 1.0)."""
        total = self._hits + self._misses
        if total == 0:
            return 0.0
        return self._hits / total

    @property
    def stats(self) -> dict:
        """Cache statistics for monitoring."""
        return {
            "size": self.size,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": round(self.hit_rate, 4),
        }

    def tenant_stats(self, tenant_id: str) -> dict:
        """Get cache statistics for a specific tenant."""
        stats = self._tenant_stats.get(tenant_id, {"hits": 0, "misses": 0})
        total = stats["hits"] + stats["misses"]
        hit_rate = stats["hits"] / total if total > 0 else 0.0

        # Count entries for this tenant
        entry_count = sum(
            1 for entry in self._store.values() if entry.metadata.tenant_id == tenant_id
        )

        return {
            "entries": entry_count,
            "hits": stats["hits"],
            "misses": stats["misses"],
            "hit_rate": round(hit_rate, 4),
        }


# Singleton instance
result_cache = ResultCache()
