"""Debater agent for MAD Framework."""

from __future__ import annotations

from typing import TYPE_CHECKING

from mad.agents.base import AgentRole, BaseAgent
from mad.core.state import DebateMessage, DebateState

if TYPE_CHECKING:
    from mad.providers.base import LLMProvider


class DebaterAgent(BaseAgent):
    """Agent that participates in debates by presenting arguments."""

    def __init__(
        self,
        agent_id: str,
        provider: LLMProvider,
        model: str,
        perspective: str | None = None,
        system_prompt: str | None = None,
        temperature: float = 0.7,
    ):
        """Initialize the debater agent.

        Args:
            agent_id: Unique identifier.
            provider: LLM provider.
            model: Model name.
            perspective: Optional debate perspective (e.g., "security", "performance").
            system_prompt: Optional system prompt override.
            temperature: Sampling temperature.
        """
        super().__init__(agent_id, provider, model, system_prompt, temperature)
        self.perspective = perspective

    @property
    def role(self) -> AgentRole:
        return "debater"

    @property
    def default_system_prompt(self) -> str:
        base_prompt = """You are a skilled debater participating in a multi-agent debate.
Your goal is to:
1. Present clear, well-reasoned arguments
2. Consider and respond to other participants' points
3. Acknowledge valid counterarguments while defending your position
4. Work toward finding the most accurate or optimal solution

Be concise but thorough. Support your arguments with reasoning and examples when helpful.
If you change your position based on compelling arguments, explain why."""

        if self.perspective:
            base_prompt += f"""

Your specific perspective/focus: {self.perspective}
Analyze the topic primarily through this lens while remaining open to other viewpoints."""

        return base_prompt

    async def act(self, state: DebateState) -> DebateMessage:
        """Generate a debate argument based on current state.

        Args:
            state: Current debate state.

        Returns:
            DebateMessage with the agent's argument.
        """
        assert self.provider is not None, "Debater requires a provider"
        # Build messages for LLM
        messages = self._build_prompt(state)

        # Generate response
        response = await self.provider.generate(
            messages=messages,
            model=self.model,
            temperature=self.temperature,
            system=self.system_prompt,
        )

        return self._create_response_message(
            content=response["content"],
            state=state,
            input_tokens=response["input_tokens"],
            output_tokens=response["output_tokens"],
            cost=response["cost"],
            latency_ms=response["latency_ms"],
        )

    def _build_prompt(self, state: DebateState) -> list[dict[str, str]]:
        """Build the prompt for the debater.

        Args:
            state: Current debate state.

        Returns:
            List of messages for LLM.
        """
        messages = []

        # Initial topic and context
        topic_msg = f"## Debate Topic\n{state['topic']}"
        if state["context"]:
            topic_msg += f"\n\n## Context\n{state['context']}"

        messages.append({"role": "user", "content": topic_msg})

        # Add conversation history
        history = self._build_conversation_history(state)
        messages.extend(history)

        # Add round instruction
        round_num = state["current_round"]
        max_rounds = state["max_rounds"]

        if round_num == 1 and not history:
            instruction = "Please present your initial position and arguments on this topic."
        elif round_num == max_rounds:
            instruction = (
                f"This is the final round ({round_num}/{max_rounds}). "
                "Please provide your final, refined position considering all previous arguments."
            )
        else:
            instruction = (
                f"Round {round_num}/{max_rounds}. "
                "Review the other participants' arguments and respond with your analysis. "
                "You may refine, defend, or update your position."
            )

        if self.perspective:
            instruction += f"\n\nRemember to focus on the {self.perspective} perspective."

        messages.append({"role": "user", "content": instruction})

        return messages
