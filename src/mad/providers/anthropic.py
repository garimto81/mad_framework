"""Anthropic (Claude) provider adapter."""

from __future__ import annotations

import time
from typing import AsyncIterator

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from mad.providers.base import LLMProvider, ProviderResponse

# Pricing per 1M tokens (as of Dec 2024)
ANTHROPIC_PRICING = {
    "claude-opus-4-20250514": {"input": 15.0, "output": 75.0},
    "claude-sonnet-4-20250514": {"input": 3.0, "output": 15.0},
    "claude-3-5-sonnet-latest": {"input": 3.0, "output": 15.0},
    "claude-3-5-haiku-latest": {"input": 0.80, "output": 4.0},
    "claude-3-opus-latest": {"input": 15.0, "output": 75.0},
}


class AnthropicProvider(LLMProvider):
    """Anthropic Claude provider using LangChain."""

    def __init__(self):
        """Initialize the Anthropic provider."""
        self._clients: dict[str, ChatAnthropic] = {}

    @property
    def name(self) -> str:
        return "anthropic"

    @property
    def supported_models(self) -> list[str]:
        return list(ANTHROPIC_PRICING.keys())

    def _get_client(self, model: str, temperature: float) -> ChatAnthropic:
        """Get or create a cached client for the model."""
        cache_key = f"{model}:{temperature}"
        if cache_key not in self._clients:
            self._clients[cache_key] = ChatAnthropic(
                model=model,
                temperature=temperature,
            )
        return self._clients[cache_key]

    def _convert_messages(
        self, messages: list[dict[str, str]], system: str | None = None
    ) -> tuple[list, str | None]:
        """Convert dict messages to LangChain format."""
        lc_messages = []
        sys_prompt = system

        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")

            if role == "system":
                sys_prompt = content
            elif role == "assistant":
                lc_messages.append(AIMessage(content=content))
            else:  # user
                lc_messages.append(HumanMessage(content=content))

        return lc_messages, sys_prompt

    async def generate(
        self,
        messages: list[dict[str, str]],
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        system: str | None = None,
        **kwargs: object,
    ) -> ProviderResponse:
        """Generate a response using Claude."""
        start_time = time.perf_counter()

        client = self._get_client(model, temperature)
        lc_messages, sys_prompt = self._convert_messages(messages, system)

        # Add system message if present
        if sys_prompt:
            lc_messages.insert(0, SystemMessage(content=sys_prompt))

        response = await client.ainvoke(lc_messages, max_tokens=max_tokens)

        latency_ms = (time.perf_counter() - start_time) * 1000

        # Extract token usage
        usage = response.usage_metadata or {}
        input_tokens = usage.get("input_tokens", 0)
        output_tokens = usage.get("output_tokens", 0)

        return ProviderResponse(
            content=str(response.content),
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            model=model,
            cost=self.estimate_cost(input_tokens, output_tokens, model),
            latency_ms=latency_ms,
        )

    async def stream(
        self,
        messages: list[dict[str, str]],
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        system: str | None = None,
        **kwargs: object,
    ) -> AsyncIterator[str]:
        """Stream a response from Claude."""
        client = self._get_client(model, temperature)
        lc_messages, sys_prompt = self._convert_messages(messages, system)

        if sys_prompt:
            lc_messages.insert(0, SystemMessage(content=sys_prompt))

        async for chunk in client.astream(lc_messages, max_tokens=max_tokens):
            if chunk.content:
                yield str(chunk.content)

    def estimate_cost(
        self,
        input_tokens: int,
        output_tokens: int,
        model: str,
    ) -> float:
        """Estimate cost based on Anthropic pricing."""
        pricing = ANTHROPIC_PRICING.get(model, {"input": 3.0, "output": 15.0})
        input_cost = (input_tokens / 1_000_000) * pricing["input"]
        output_cost = (output_tokens / 1_000_000) * pricing["output"]
        return input_cost + output_cost
