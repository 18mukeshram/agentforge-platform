# apps/api/src/agentforge_api/services/cache.py

"""
In-memory cache for agent execution results.

Provides deterministic caching based on agent identity and inputs.
Cache is an optimization only - execution must be correct without it.
"""

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass(frozen=True)
class CacheKey:
    """
    Immutable cache key for agent execution results.
    
    Key components:
    - agent_id: Which agent was executed
    - inputs_hash: Hash of resolved inputs
    - agent_version: Version of agent definition
    
    Intentionally excludes:
    - execution_id (same inputs should hit cache across executions)
    - node_id (same agent+inputs in different nodes should share cache)
    """
    
    agent_id: str
    inputs_hash: str
    agent_version: str
    
    def __str__(self) -> str:
        """String representation for storage key."""
        return f"{self.agent_id}:{self.agent_version}:{self.inputs_hash}"


@dataclass(frozen=True)
class CacheMetadata:
    """Metadata about cached result."""
    
    duration_ms: int
    cached_at: datetime


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
            },
        }


def compute_inputs_hash(inputs: dict[str, Any]) -> str:
    """
    Compute deterministic hash of inputs.
    
    Uses JSON serialization with sorted keys for consistency.
    Returns SHA-256 hash truncated to 16 characters.
    """
    # Serialize with sorted keys for determinism
    try:
        serialized = json.dumps(
            inputs,
            sort_keys=True,
            separators=(",", ":"),
            default=str,  # Handle non-serializable types
        )
    except (TypeError, ValueError):
        # Fallback for non-serializable inputs
        serialized = str(inputs)
    
    # Compute SHA-256 hash
    hash_bytes = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
    
    # Truncate to 16 chars (64 bits, sufficient for cache keys)
    return hash_bytes[:16]


def generate_cache_key(
    agent_id: str,
    inputs: dict[str, Any],
    agent_version: str = "1.0.0",
) -> CacheKey:
    """
    Generate a cache key for an agent execution.
    
    Args:
        agent_id: Unique identifier of the agent
        inputs: Resolved inputs for this execution
        agent_version: Version of the agent definition
    
    Returns:
        CacheKey that uniquely identifies this computation
    """
    inputs_hash = compute_inputs_hash(inputs)
    
    return CacheKey(
        agent_id=agent_id,
        inputs_hash=inputs_hash,
        agent_version=agent_version,
    )


class ResultCache:
    """
    In-memory cache for agent execution results.
    
    Features:
    - Deterministic key-based lookup
    - Stores only successful outputs
    - Thread-safe for async operations
    
    Limitations (by design for Phase 7):
    - No TTL/expiration
    - No size limits
    - No persistence
    - No distributed sync
    
    Cache failures are silent - execution continues without cache.
    """
    
    def __init__(self) -> None:
        self._store: dict[str, CacheEntry] = {}
        self._hits: int = 0
        self._misses: int = 0
    
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
                return entry
            else:
                self._misses += 1
                return None
        except Exception:
            # Cache failures must never break execution
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
                    cached_at=datetime.now(timezone.utc),
                ),
            )
            self._store[str(key)] = entry
            return True
        except Exception:
            # Cache failures must never break execution
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
    
    def clear(self) -> None:
        """Clear all cached entries."""
        self._store.clear()
        self._hits = 0
        self._misses = 0
    
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


# Singleton instance
result_cache = ResultCache()