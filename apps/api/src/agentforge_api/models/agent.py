# apps/api/src/agentforge_api/models/agent.py

"""Agent domain models."""

from enum import Enum
from typing import Annotated, Any, NewType

from pydantic import BaseModel, Field


AgentId = NewType("AgentId", str)


class DataType(str, Enum):
    """Primitive types supported for agent inputs/outputs."""
    
    STRING = "string"
    NUMBER = "number"
    BOOLEAN = "boolean"
    OBJECT = "object"
    ARRAY = "array"


class PortSchema(BaseModel, frozen=True):
    """Schema for a single input or output port."""
    
    name: str
    type: DataType
    required: bool = True
    description: str = ""


class AgentInputSchema(BaseModel, frozen=True):
    """Definition of an agent's input requirements."""
    
    ports: list[PortSchema] = Field(default_factory=list)


class AgentOutputSchema(BaseModel, frozen=True):
    """Definition of an agent's output structure."""
    
    ports: list[PortSchema] = Field(default_factory=list)


class AgentCategory(str, Enum):
    """Agent category for organization and filtering."""
    
    LLM = "llm"              # Language model invocation
    RETRIEVAL = "retrieval"  # RAG, vector search
    TRANSFORM = "transform"  # Data transformation
    INTEGRATION = "integration"  # External API calls
    LOGIC = "logic"          # Branching, conditionals


class RetryPolicy(BaseModel, frozen=True):
    """Retry behavior for agent execution."""
    
    max_retries: Annotated[int, Field(ge=0)] = 3
    backoff_ms: Annotated[int, Field(ge=0)] = 1000
    backoff_multiplier: Annotated[float, Field(ge=1.0)] = 2.0


class AgentDefinition(BaseModel, frozen=True):
    """
    Complete definition of an agent available in the system.
    
    This is a template/blueprint, not an instance.
    Nodes reference agents by AgentId.
    """
    
    id: Annotated[str, Field(description="Unique agent identifier")]
    name: str
    description: str = ""
    category: AgentCategory
    
    input_schema: AgentInputSchema = Field(default_factory=AgentInputSchema)
    output_schema: AgentOutputSchema = Field(default_factory=AgentOutputSchema)
    
    default_config: dict[str, Any] = Field(default_factory=dict)
    cacheable: bool = True
    retry_policy: RetryPolicy = Field(default_factory=RetryPolicy)
    
    @property
    def agent_id(self) -> AgentId:
        """Return typed AgentId."""
        return AgentId(self.id)