"""Tests for LLM providers."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from mad.providers.base import LLMProvider, ProviderResponse
from mad.providers.registry import ProviderRegistry, get_provider


class TestProviderResponse:
    """Tests for ProviderResponse TypedDict."""

    def test_creates_response_dict(self):
        """ProviderResponse should be a valid dict."""
        response: ProviderResponse = {
            "content": "Test response",
            "input_tokens": 100,
            "output_tokens": 50,
            "model": "test-model",
            "cost": 0.001,
            "latency_ms": 500.0,
        }

        assert response["content"] == "Test response"
        assert response["input_tokens"] == 100
        assert response["output_tokens"] == 50
        assert response["model"] == "test-model"
        assert response["cost"] == 0.001
        assert response["latency_ms"] == 500.0


class TestLLMProvider:
    """Tests for LLMProvider base class."""

    def test_is_abstract(self):
        """LLMProvider should not be directly instantiable."""
        with pytest.raises(TypeError):
            LLMProvider()  # type: ignore[abstract]

    def test_validate_model_valid(self):
        """validate_model should return True for supported models."""

        class ConcreteProvider(LLMProvider):
            @property
            def name(self):
                return "test"

            @property
            def supported_models(self):
                return ["model-a", "model-b"]

            async def generate(self, messages, model, **kwargs):
                pass

            def stream(self, messages, model, **kwargs):
                pass

            def estimate_cost(self, input_tokens, output_tokens, model):
                return 0.0

        provider = ConcreteProvider()
        assert provider.validate_model("model-a") is True
        assert provider.validate_model("model-b") is True

    def test_validate_model_invalid(self):
        """validate_model should return False for unsupported models."""

        class ConcreteProvider(LLMProvider):
            @property
            def name(self):
                return "test"

            @property
            def supported_models(self):
                return ["model-a", "model-b"]

            async def generate(self, messages, model, **kwargs):
                pass

            def stream(self, messages, model, **kwargs):
                pass

            def estimate_cost(self, input_tokens, output_tokens, model):
                return 0.0

        provider = ConcreteProvider()
        assert provider.validate_model("model-c") is False
        assert provider.validate_model("unknown") is False


class TestProviderRegistry:
    """Tests for ProviderRegistry class methods."""

    def test_register_adds_provider(self):
        """register should add a new provider class."""
        mock_provider_class = MagicMock()

        # Register under a unique name
        ProviderRegistry.register("test_unique_provider", mock_provider_class)

        assert "test_unique_provider" in ProviderRegistry._providers

    def test_get_returns_provider_instance(self):
        """get should return a provider instance."""
        # Clear cache first
        ProviderRegistry.clear_cache()

        # anthropic is pre-registered
        provider = ProviderRegistry.get("anthropic")

        assert provider is not None
        assert provider.name == "anthropic"

    def test_get_caches_provider(self):
        """get should cache provider instances."""
        ProviderRegistry.clear_cache()

        provider1 = ProviderRegistry.get("anthropic")
        provider2 = ProviderRegistry.get("anthropic")

        assert provider1 is provider2

    def test_get_unknown_provider_raises(self):
        """get should raise ValueError for unknown provider."""
        with pytest.raises(ValueError, match="Unknown provider"):
            ProviderRegistry.get("nonexistent_provider_xyz")  # type: ignore[arg-type]

    def test_available_providers(self):
        """available_providers should list registered providers."""
        providers = ProviderRegistry.available_providers()

        assert "anthropic" in providers
        assert "openai" in providers

    def test_clear_cache(self):
        """clear_cache should remove cached instances."""
        ProviderRegistry.clear_cache()

        # Get a provider (creates instance)
        ProviderRegistry.get("anthropic")
        assert "anthropic" in ProviderRegistry._instances

        # Clear cache
        ProviderRegistry.clear_cache()
        assert "anthropic" not in ProviderRegistry._instances


class TestGetProviderFunction:
    """Tests for get_provider convenience function."""

    def test_get_provider_returns_provider(self):
        """get_provider should return a provider instance."""
        ProviderRegistry.clear_cache()

        provider = get_provider("anthropic")

        assert provider is not None
        assert provider.name == "anthropic"

    def test_get_provider_unknown_raises(self):
        """get_provider should raise for unknown provider."""
        with pytest.raises(ValueError):
            get_provider("unknown_xyz_provider")  # type: ignore[arg-type]


class TestAnthropicProvider:
    """Tests for AnthropicProvider."""

    def test_provider_name(self):
        """AnthropicProvider.name should be 'anthropic'."""
        from mad.providers.anthropic import AnthropicProvider

        provider = AnthropicProvider()
        assert provider.name == "anthropic"

    def test_supported_models(self):
        """AnthropicProvider should list supported Claude models."""
        from mad.providers.anthropic import AnthropicProvider

        provider = AnthropicProvider()
        models = provider.supported_models

        assert len(models) > 0
        assert any("claude" in m for m in models)

    def test_estimate_cost_known_model(self):
        """estimate_cost should calculate for known models."""
        from mad.providers.anthropic import AnthropicProvider

        provider = AnthropicProvider()
        cost = provider.estimate_cost(1000, 500, "claude-sonnet-4-20250514")

        assert cost >= 0.0
        assert isinstance(cost, float)

    def test_estimate_cost_unknown_model(self):
        """estimate_cost should use fallback for unknown models."""
        from mad.providers.anthropic import AnthropicProvider

        provider = AnthropicProvider()
        cost = provider.estimate_cost(1000, 500, "unknown-model")

        # Should use fallback pricing
        assert cost >= 0.0

    def test_validate_model(self):
        """validate_model should check supported models."""
        from mad.providers.anthropic import AnthropicProvider

        provider = AnthropicProvider()

        assert provider.validate_model("claude-sonnet-4-20250514") is True
        assert provider.validate_model("nonexistent-model") is False


class TestOpenAIProvider:
    """Tests for OpenAIProvider."""

    def test_provider_name(self):
        """OpenAIProvider.name should be 'openai'."""
        from mad.providers.openai import OpenAIProvider

        provider = OpenAIProvider()
        assert provider.name == "openai"

    def test_supported_models(self):
        """OpenAIProvider should list supported GPT models."""
        from mad.providers.openai import OpenAIProvider

        provider = OpenAIProvider()
        models = provider.supported_models

        assert len(models) > 0
        assert any("gpt" in m for m in models)

    def test_estimate_cost_known_model(self):
        """estimate_cost should calculate for known models."""
        from mad.providers.openai import OpenAIProvider

        provider = OpenAIProvider()
        cost = provider.estimate_cost(1000, 500, "gpt-4o")

        assert cost >= 0.0
        assert isinstance(cost, float)

    def test_estimate_cost_unknown_model(self):
        """estimate_cost should use fallback for unknown models."""
        from mad.providers.openai import OpenAIProvider

        provider = OpenAIProvider()
        cost = provider.estimate_cost(1000, 500, "unknown-model")

        # Should use fallback pricing
        assert cost >= 0.0

    def test_validate_model(self):
        """validate_model should check supported models."""
        from mad.providers.openai import OpenAIProvider

        provider = OpenAIProvider()

        assert provider.validate_model("gpt-4o") is True
        assert provider.validate_model("nonexistent-model") is False
