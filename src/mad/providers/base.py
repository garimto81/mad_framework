"""Base provider interface for LLM adapters."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, AsyncIterator, TypedDict

if TYPE_CHECKING:
    pass


class ProviderResponse(TypedDict):
    """Response from an LLM provider."""

    content: str
    input_tokens: int
    output_tokens: int
    model: str
    cost: float
    latency_ms: float


class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Return the provider name (e.g., 'anthropic', 'openai')."""
        ...

    @property
    @abstractmethod
    def supported_models(self) -> list[str]:
        """Return list of supported model names."""
        ...

    @abstractmethod
    async def generate(
        self,
        messages: list[dict[str, str]],
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        system: str | None = None,
        **kwargs: object,
    ) -> ProviderResponse:
        """Generate a response from the LLM.

        Args:
            messages: List of message dicts with 'role' and 'content'.
            model: Model name to use.
            temperature: Sampling temperature.
            max_tokens: Maximum tokens to generate.
            system: Optional system prompt.
            **kwargs: Additional provider-specific arguments.

        Returns:
            ProviderResponse with content and metadata.
        """
        ...

    @abstractmethod
    async def stream(
        self,
        messages: list[dict[str, str]],
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        system: str | None = None,
        **kwargs: object,
    ) -> AsyncIterator[str]:
        """Stream a response from the LLM.

        Args:
            messages: List of message dicts with 'role' and 'content'.
            model: Model name to use.
            temperature: Sampling temperature.
            max_tokens: Maximum tokens to generate.
            system: Optional system prompt.
            **kwargs: Additional provider-specific arguments.

        Yields:
            String chunks of the response.
        """
        ...

    @abstractmethod
    def estimate_cost(
        self,
        input_tokens: int,
        output_tokens: int,
        model: str,
    ) -> float:
        """Estimate the cost of a request in USD.

        Args:
            input_tokens: Number of input tokens.
            output_tokens: Number of output tokens.
            model: Model name used.

        Returns:
            Estimated cost in USD.
        """
        ...

    def validate_model(self, model: str) -> bool:
        """Check if a model is supported by this provider."""
        return model in self.supported_models
