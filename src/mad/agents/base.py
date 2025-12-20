"""Base agent class for MAD Framework."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Literal

from mad.core.state import DebateMessage, DebateState, create_message

if TYPE_CHECKING:
    from mad.providers.base import LLMProvider

AgentRole = Literal["debater", "judge", "moderator", "synthesizer"]


class BaseAgent(ABC):
    """Abstract base class for all agents in the debate."""

    def __init__(
        self,
        agent_id: str,
        provider: LLMProvider,
        model: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
    ):
        """Initialize the agent.

        Args:
            agent_id: Unique identifier for this agent.
            provider: LLM provider to use.
            model: Model name to use.
            system_prompt: Optional system prompt override.
            temperature: Sampling temperature.
        """
        self.agent_id = agent_id
        self.provider = provider
        self.model = model
        self.temperature = temperature
        self._system_prompt = system_prompt

    @property
    @abstractmethod
    def role(self) -> AgentRole:
        """Return the agent's role in the debate."""
        ...

    @property
    def default_system_prompt(self) -> str:
        """Return the default system prompt for this agent type."""
        return "You are a helpful assistant."

    @property
    def system_prompt(self) -> str:
        """Return the effective system prompt."""
        return self._system_prompt or self.default_system_prompt

    @abstractmethod
    async def act(self, state: DebateState) -> DebateMessage:
        """Perform the agent's action based on current state.

        Args:
            state: Current debate state.

        Returns:
            A DebateMessage containing the agent's response.
        """
        ...

    def _build_conversation_history(
        self,
        state: DebateState,
        include_own_messages: bool = True,
    ) -> list[dict[str, str]]:
        """Build conversation history from debate messages.

        Args:
            state: Current debate state.
            include_own_messages: Whether to include this agent's messages.

        Returns:
            List of message dicts for LLM input.
        """
        messages = []

        for msg in state["messages"]:
            if not include_own_messages and msg["agent_id"] == self.agent_id:
                continue

            # Format as conversation
            role = "assistant" if msg["agent_id"] == self.agent_id else "user"
            prefix = f"[{msg['agent_role'].upper()} - {msg['agent_id']}]"
            content = f"{prefix}\n{msg['content']}"

            messages.append({"role": role, "content": content})

        return messages

    def _create_response_message(
        self,
        content: str,
        state: DebateState,
        **metadata: object,
    ) -> DebateMessage:
        """Create a DebateMessage from agent response.

        Args:
            content: Response content.
            state: Current debate state.
            **metadata: Additional metadata.

        Returns:
            Formatted DebateMessage.
        """
        return create_message(
            agent_id=self.agent_id,
            agent_role=self.role,
            provider=self.provider.name,
            model=self.model,
            content=content,
            current_round=state["current_round"],
            **metadata,
        )
