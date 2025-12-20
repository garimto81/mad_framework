"""Provider registry for managing LLM providers."""

from __future__ import annotations

from typing import TYPE_CHECKING, Literal

from mad.providers.anthropic import AnthropicProvider
from mad.providers.openai import OpenAIProvider

if TYPE_CHECKING:
    from mad.providers.base import LLMProvider

ProviderType = Literal["anthropic", "openai", "google"]


class ProviderRegistry:
    """Registry for managing and instantiating LLM providers."""

    _providers: dict[str, type[LLMProvider]] = {
        "anthropic": AnthropicProvider,
        "openai": OpenAIProvider,
    }

    _instances: dict[str, LLMProvider] = {}

    @classmethod
    def register(cls, name: str, provider_class: type[LLMProvider]) -> None:
        """Register a new provider class."""
        cls._providers[name] = provider_class

    @classmethod
    def get(
        cls,
        name: ProviderType,
    ) -> LLMProvider:
        """Get or create a provider instance.

        Args:
            name: Provider name ('anthropic', 'openai', 'google').

        Returns:
            LLMProvider instance.

        Raises:
            ValueError: If provider not found.
        """
        if name not in cls._providers:
            available = ", ".join(cls._providers.keys())
            msg = f"Unknown provider '{name}'. Available: {available}"
            raise ValueError(msg)

        if name not in cls._instances:
            provider_class = cls._providers[name]
            cls._instances[name] = provider_class()

        return cls._instances[name]

    @classmethod
    def available_providers(cls) -> list[str]:
        """List all registered provider names."""
        return list(cls._providers.keys())

    @classmethod
    def clear_cache(cls) -> None:
        """Clear all cached provider instances."""
        cls._instances.clear()


def get_provider(
    name: ProviderType,
) -> LLMProvider:
    """Convenience function to get a provider from the registry.

    Args:
        name: Provider name ('anthropic', 'openai', 'google').

    Returns:
        LLMProvider instance.
    """
    return ProviderRegistry.get(name)
