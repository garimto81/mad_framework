"""Base strategy interface for debate execution."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from mad.agents.debater import DebaterAgent
    from mad.core.state import DebateMessage, DebateState


class DebateStrategy(ABC):
    """Abstract base class for debate execution strategies.

    Strategies control how debaters take turns and interact.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Return the strategy name."""
        ...

    @abstractmethod
    async def execute_round(
        self,
        debaters: list[DebaterAgent],
        state: DebateState,
    ) -> list[DebateMessage]:
        """Execute one round of debate.

        Args:
            debaters: List of debater agents.
            state: Current debate state.

        Returns:
            List of messages from this round.
        """
        ...

    @abstractmethod
    def should_continue(
        self,
        state: DebateState,
        round_messages: list[DebateMessage],
    ) -> bool:
        """Determine if debate should continue.

        Args:
            state: Current debate state.
            round_messages: Messages from the latest round.

        Returns:
            True if debate should continue.
        """
        ...
