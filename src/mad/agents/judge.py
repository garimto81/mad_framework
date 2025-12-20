"""Judge agent for MAD Framework."""

from __future__ import annotations

import json
from typing import TYPE_CHECKING

from mad.agents.base import AgentRole, BaseAgent
from mad.core.state import DebateMessage, DebateState

if TYPE_CHECKING:
    from mad.providers.base import LLMProvider


class JudgeAgent(BaseAgent):
    """Agent that evaluates debate arguments and renders a final verdict."""

    def __init__(
        self,
        agent_id: str = "judge",
        provider: LLMProvider | None = None,
        model: str = "claude-sonnet-4-20250514",
        system_prompt: str | None = None,
        temperature: float = 0.3,
    ):
        """Initialize the judge agent.

        Args:
            agent_id: Unique identifier (default: "judge").
            provider: LLM provider.
            model: Model name.
            system_prompt: Optional system prompt override.
            temperature: Sampling temperature (lower for consistency).
        """
        super().__init__(agent_id, provider, model, system_prompt, temperature)

    @property
    def role(self) -> AgentRole:
        return "judge"

    @property
    def default_system_prompt(self) -> str:
        return """You are an impartial judge evaluating a multi-agent debate.
Your responsibilities:
1. Carefully analyze all arguments presented by each debater
2. Evaluate the strength of reasoning, evidence, and logic
3. Identify points of agreement and disagreement
4. Render a fair verdict based on the quality of arguments

You must be objective and not favor any particular debater.
Consider the validity of arguments, not just their persuasiveness.

When rendering your verdict, provide:
- A clear final answer or decision
- Confidence score (0.0 to 1.0)
- Key reasoning that led to your decision
- Acknowledgment of valid dissenting points"""

    async def act(self, state: DebateState) -> DebateMessage:
        """Evaluate the debate and render a verdict.

        Args:
            state: Current debate state.

        Returns:
            DebateMessage with the verdict.
        """
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
        """Build the prompt for the judge.

        Args:
            state: Current debate state.

        Returns:
            List of messages for LLM.
        """
        messages = []

        # Topic and context
        prompt = f"## Debate Topic\n{state['topic']}"
        if state["context"]:
            prompt += f"\n\n## Context\n{state['context']}"

        prompt += "\n\n## Debate Transcript\n"

        # Add all debate messages
        for msg in state["messages"]:
            if msg["agent_role"] == "debater":
                prompt += f"\n### {msg['agent_id']} (Round {msg['round']})\n"
                prompt += msg["content"]
                prompt += "\n"

        messages.append({"role": "user", "content": prompt})

        # Judgment instruction
        instruction = """Please evaluate this debate and provide your verdict.

Your response MUST be in the following JSON format:
```json
{
    "verdict": "Your final answer or decision",
    "confidence": 0.85,
    "reasoning": "Key points that led to your decision",
    "consensus_points": ["Point 1 all debaters agreed on", "Point 2"],
    "dissenting_points": ["Valid point from minority position"],
    "recommendations": "Any additional recommendations or insights"
}
```

Ensure the JSON is valid and complete."""

        messages.append({"role": "user", "content": instruction})

        return messages

    def parse_verdict(self, content: str) -> dict:
        """Parse the judge's verdict from response content.

        Args:
            content: Raw response content.

        Returns:
            Parsed verdict dictionary.
        """
        try:
            # Try to extract JSON from response
            start = content.find("{")
            end = content.rfind("}") + 1

            if start != -1 and end > start:
                json_str = content[start:end]
                return json.loads(json_str)
        except json.JSONDecodeError:
            pass

        # Fallback: return raw content
        return {
            "verdict": content,
            "confidence": 0.5,
            "reasoning": "Unable to parse structured verdict",
            "consensus_points": [],
            "dissenting_points": [],
            "recommendations": "",
        }
