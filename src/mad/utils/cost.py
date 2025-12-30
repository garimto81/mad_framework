"""Cost tracking utilities for MAD Framework."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class CostEntry:
    """A single cost entry."""

    provider: str
    model: str
    input_tokens: int
    output_tokens: int
    cost: float
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class CostSummary:
    """Summary of costs for a debate session."""

    total_cost: float
    total_input_tokens: int
    total_output_tokens: int
    total_tokens: int
    by_provider: dict[str, float]
    by_model: dict[str, float]
    entries: list[CostEntry]

    def __str__(self) -> str:
        """Format cost summary as string."""
        lines = [
            f"Total Cost: ${self.total_cost:.4f}",
            f"Total Tokens: {self.total_tokens:,}",
            f"  Input: {self.total_input_tokens:,}",
            f"  Output: {self.total_output_tokens:,}",
            "",
            "By Provider:",
        ]
        for provider, cost in self.by_provider.items():
            lines.append(f"  {provider}: ${cost:.4f}")

        lines.append("")
        lines.append("By Model:")
        for model, cost in self.by_model.items():
            lines.append(f"  {model}: ${cost:.4f}")

        return "\n".join(lines)


class CostTracker:
    """Track costs across a debate session."""

    def __init__(self) -> None:
        """Initialize the cost tracker."""
        self._entries: list[CostEntry] = []

    def add(
        self,
        provider: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        cost: float,
    ) -> None:
        """Add a cost entry.

        Args:
            provider: LLM provider name.
            model: Model name.
            input_tokens: Number of input tokens.
            output_tokens: Number of output tokens.
            cost: Cost in USD.
        """
        self._entries.append(
            CostEntry(
                provider=provider,
                model=model,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost=cost,
            )
        )

    def get_summary(self) -> CostSummary:
        """Get a summary of all tracked costs.

        Returns:
            CostSummary with aggregated data.
        """
        total_cost = sum(e.cost for e in self._entries)
        total_input = sum(e.input_tokens for e in self._entries)
        total_output = sum(e.output_tokens for e in self._entries)

        by_provider: dict[str, float] = {}
        by_model: dict[str, float] = {}

        for entry in self._entries:
            by_provider[entry.provider] = by_provider.get(entry.provider, 0) + entry.cost
            by_model[entry.model] = by_model.get(entry.model, 0) + entry.cost

        return CostSummary(
            total_cost=total_cost,
            total_input_tokens=total_input,
            total_output_tokens=total_output,
            total_tokens=total_input + total_output,
            by_provider=by_provider,
            by_model=by_model,
            entries=list(self._entries),
        )

    def reset(self) -> None:
        """Clear all tracked entries."""
        self._entries.clear()

    @property
    def total_cost(self) -> float:
        """Get total cost so far."""
        return sum(e.cost for e in self._entries)

    @property
    def total_tokens(self) -> int:
        """Get total tokens used."""
        return sum(e.input_tokens + e.output_tokens for e in self._entries)
