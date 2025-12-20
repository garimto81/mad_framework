"""Round-robin debate strategy."""

from __future__ import annotations

from typing import TYPE_CHECKING

from mad.strategies.base import DebateStrategy

if TYPE_CHECKING:
    from mad.agents.debater import DebaterAgent
    from mad.core.state import DebateMessage, DebateState


class RoundRobinStrategy(DebateStrategy):
    """Simple round-robin strategy where each debater speaks in order.

    Each round, every debater gets one turn to present arguments.
    Debate continues until max rounds or early consensus.
    """

    def __init__(self, max_rounds: int = 3):
        """Initialize the strategy.

        Args:
            max_rounds: Maximum number of debate rounds.
        """
        self.max_rounds = max_rounds

    @property
    def name(self) -> str:
        return "round_robin"

    async def execute_round(
        self,
        debaters: list[DebaterAgent],
        state: DebateState,
    ) -> list[DebateMessage]:
        """Execute one round with all debaters speaking sequentially.

        Args:
            debaters: List of debater agents.
            state: Current debate state.

        Returns:
            List of messages from all debaters.
        """
        messages = []

        for debater in debaters:
            message = await debater.act(state)
            messages.append(message)

            # Update state with new message for next debater
            # This allows later debaters to see earlier responses
            state["messages"] = list(state["messages"]) + [message]

        return messages

    def should_continue(
        self,
        state: DebateState,
        round_messages: list[DebateMessage],
    ) -> bool:
        """Continue until max rounds reached.

        Args:
            state: Current debate state.
            round_messages: Messages from the latest round.

        Returns:
            True if more rounds should occur.
        """
        current_round = state.get("current_round", 1)
        return current_round < self.max_rounds
