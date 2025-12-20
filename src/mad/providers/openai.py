"""OpenAI (GPT) provider adapter."""

from __future__ import annotations

import time
from typing import AsyncIterator

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from mad.providers.base import LLMProvider, ProviderResponse

# Pricing per 1M tokens (as of Dec 2024)
OPENAI_PRICING = {
    "gpt-4o": {"input": 2.50, "output": 10.0},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "gpt-4-turbo": {"input": 10.0, "output": 30.0},
    "gpt-4": {"input": 30.0, "output": 60.0},
    "gpt-3.5-turbo": {"input": 0.50, "output": 1.50},
    "o1": {"input": 15.0, "output": 60.0},
    "o1-mini": {"input": 3.0, "output": 12.0},
}


class OpenAIProvider(LLMProvider):
    """OpenAI GPT provider using LangChain."""

    def __init__(self):
        """Initialize the OpenAI provider."""
        self._clients: dict[str, ChatOpenAI] = {}

    @property
    def name(self) -> str:
        return "openai"

    @property
    def supported_models(self) -> list[str]:
        return list(OPENAI_PRICING.keys())

    def _get_client(self, model: str, temperature: float) -> ChatOpenAI:
        """Get or create a cached client for the model."""
        cache_key = f"{model}:{temperature}"
        if cache_key not in self._clients:
            self._clients[cache_key] = ChatOpenAI(
                model=model,
                temperature=temperature,
            )
        return self._clients[cache_key]

    def _convert_messages(
        self, messages: list[dict[str, str]], system: str | None = None
    ) -> list:
        """Convert dict messages to LangChain format."""
        lc_messages = []

        if system:
            lc_messages.append(SystemMessage(content=system))

        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")

            if role == "system":
                lc_messages.append(SystemMessage(content=content))
            elif role == "assistant":
                lc_messages.append(AIMessage(content=content))
            else:  # user
                lc_messages.append(HumanMessage(content=content))

        return lc_messages

    async def generate(
        self,
        messages: list[dict[str, str]],
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        system: str | None = None,
        **kwargs: object,
    ) -> ProviderResponse:
        """Generate a response using GPT."""
        start_time = time.perf_counter()

        client = self._get_client(model, temperature)
        lc_messages = self._convert_messages(messages, system)

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
        """Stream a response from GPT."""
        client = self._get_client(model, temperature)
        lc_messages = self._convert_messages(messages, system)

        async for chunk in client.astream(lc_messages, max_tokens=max_tokens):
            if chunk.content:
                yield str(chunk.content)

    def estimate_cost(
        self,
        input_tokens: int,
        output_tokens: int,
        model: str,
    ) -> float:
        """Estimate cost based on OpenAI pricing."""
        pricing = OPENAI_PRICING.get(model, {"input": 2.50, "output": 10.0})
        input_cost = (input_tokens / 1_000_000) * pricing["input"]
        output_cost = (output_tokens / 1_000_000) * pricing["output"]
        return input_cost + output_cost
