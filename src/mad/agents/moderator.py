"""Moderator agent for MAD Framework."""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any

from mad.agents.base import AgentRole, BaseAgent
from mad.core.state import DebateMessage, DebateState

if TYPE_CHECKING:
    from mad.providers.base import LLMProvider


class ModeratorAgent(BaseAgent):
    """Agent that controls debate flow and determines when to stop."""

    def __init__(
        self,
        agent_id: str = "moderator",
        provider: LLMProvider | None = None,
        model: str = "claude-sonnet-4-20250514",
        system_prompt: str | None = None,
        temperature: float = 0.3,
        consensus_threshold: float = 0.8,
    ):
        """Initialize the moderator agent.

        Args:
            agent_id: Unique identifier (default: "moderator").
            provider: LLM provider.
            model: Model name.
            system_prompt: Optional system prompt override.
            temperature: Sampling temperature.
            consensus_threshold: Score threshold for early consensus.
        """
        super().__init__(agent_id, provider, model, system_prompt, temperature)
        self.consensus_threshold = consensus_threshold

    @property
    def role(self) -> AgentRole:
        return "moderator"

    @property
    def default_system_prompt(self) -> str:
        return """You are a debate moderator responsible for managing the discussion.
Your responsibilities:
1. Evaluate whether the debaters are making progress toward resolution
2. Identify if a consensus has been reached
3. Determine if further debate rounds are needed
4. Track the quality and relevance of arguments

You should recommend stopping the debate early if:
- Clear consensus has been reached
- Arguments are becoming repetitive
- No new information is being presented
- The positions have stabilized"""

    async def act(self, state: DebateState) -> DebateMessage:
        """Evaluate the current debate round and provide moderation.

        Args:
            state: Current debate state.

        Returns:
            DebateMessage with moderation decision.
        """
        assert self.provider is not None, "Moderator requires a provider"
        messages = self._build_prompt(state)

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
        """Build the prompt for the moderator.

        Args:
            state: Current debate state.

        Returns:
            List of messages for LLM.
        """
        messages = []

        # Current round info
        current = state["current_round"]
        max_rounds = state["max_rounds"]

        prompt = "## Debate Status\n"
        prompt += f"- Round: {current}/{max_rounds}\n"
        prompt += f"- Topic: {state['topic']}\n"
        prompt += f"- Debaters: {state['debater_count']}\n\n"

        # Recent messages from this round
        prompt += "## Latest Round Arguments\n"
        round_messages = [m for m in state["messages"] if m["round"] == current]

        for msg in round_messages:
            if msg["agent_role"] == "debater":
                prompt += f"\n### {msg['agent_id']}\n{msg['content']}\n"

        messages.append({"role": "user", "content": prompt})

        # Moderation instruction
        instruction = f"""Analyze this round of debate and provide your assessment.

Your response MUST be in the following JSON format:
```json
{{
    "consensus_score": 0.7,
    "should_continue": true,
    "reasoning": "Why the debate should continue or stop",
    "key_disagreements": ["Point 1", "Point 2"],
    "key_agreements": ["Point 1"],
    "quality_score": 0.8
}}
```

- consensus_score: 0.0 (complete disagreement) to 1.0 (full consensus)
- should_continue: false if consensus >= {self.consensus_threshold} or repetitive
- quality_score: 0.0 to 1.0 based on argument quality

Ensure the JSON is valid."""

        messages.append({"role": "user", "content": instruction})

        return messages

    def parse_moderation(self, content: str) -> dict[str, Any]:
        """Parse the moderator's assessment from response content.

        Args:
            content: Raw response content.

        Returns:
            Parsed moderation dictionary.
        """
        try:
            start = content.find("{")
            end = content.rfind("}") + 1

            if start != -1 and end > start:
                json_str = content[start:end]
                result: dict[str, Any] = json.loads(json_str)
                return result
        except json.JSONDecodeError:
            pass

        # Fallback defaults
        return {
            "consensus_score": 0.0,
            "should_continue": True,
            "reasoning": "Unable to parse moderation response",
            "key_disagreements": [],
            "key_agreements": [],
            "quality_score": 0.5,
        }

    def should_stop_early(self, moderation: dict[str, Any]) -> bool:
        """Determine if debate should stop early based on moderation.

        Args:
            moderation: Parsed moderation dictionary.

        Returns:
            True if debate should stop early.
        """
        consensus = moderation.get("consensus_score", 0.0)
        should_continue = moderation.get("should_continue", True)

        return consensus >= self.consensus_threshold or not should_continue
