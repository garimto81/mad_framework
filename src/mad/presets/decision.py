"""Decision support preset for MAD Framework."""

from __future__ import annotations

from mad.core.config import DebaterConfig, JudgeConfig
from mad.presets.base import Preset

DECISION_DEBATER_PROMPT = """You are a strategic advisor participating in a multi-agent decision analysis.

Your perspective: {perspective}

When analyzing decisions:
1. Clearly state the trade-offs involved
2. Consider short-term and long-term implications
3. Identify risks and mitigation strategies
4. Support arguments with concrete examples or data
5. Acknowledge valid points from opposing viewpoints

Be balanced and objective. Present both benefits and drawbacks.
The goal is to help make the best decision, not to "win" the debate."""

DECISION_JUDGE_PROMPT = """You are a senior decision advisor synthesizing multiple perspectives.

Your responsibilities:
1. Weigh the pros and cons from each perspective
2. Identify the key decision factors
3. Recommend a course of action with clear reasoning
4. Outline implementation considerations
5. Note any contingencies or conditions

Provide a decision recommendation that:
- Clearly states the recommended choice
- Explains the key factors that led to this recommendation
- Acknowledges significant trade-offs
- Suggests risk mitigation for identified concerns
- Includes confidence level in the recommendation"""


class DecisionPreset(Preset):
    """Preset for decision support through multi-perspective analysis.

    Uses agents representing different stakeholder perspectives:
    - Pragmatist: Focuses on practical implementation and feasibility
    - Strategist: Considers long-term implications and alignment with goals
    - Risk Analyst: Identifies potential risks and failure modes

    Example:
        ```python
        from mad import MAD
        from mad.presets import DecisionPreset

        preset = DecisionPreset()
        mad = MAD(preset.to_config())

        result = await mad.debate(
            topic="Should we migrate our monolith to microservices?",
            context='''
            Current state:
            - 500k LOC Python monolith
            - 50 developers
            - 99.9% uptime requirement
            - Growing 30% YoY
            '''
        )
        print(result.verdict)
        print(result.recommendations)
        ```
    """

    @property
    def name(self) -> str:
        return "decision"

    @property
    def description(self) -> str:
        return "Multi-perspective decision analysis and recommendation"

    def get_debater_configs(self) -> list[DebaterConfig]:
        perspectives = [
            (
                "pragmatist",
                "Focus on practical implementation, feasibility, resource requirements, and timeline",
            ),
            (
                "strategist",
                "Consider long-term implications, strategic alignment, scalability, and future opportunities",
            ),
            (
                "risk_analyst",
                "Identify risks, failure modes, dependencies, and mitigation strategies",
            ),
        ]

        return [
            DebaterConfig(
                provider="anthropic",
                model="claude-sonnet-4-20250514",
                perspective=name,
                temperature=0.6,
                system_prompt=DECISION_DEBATER_PROMPT.format(perspective=desc),
            )
            for name, desc in perspectives
        ]

    def get_judge_config(self) -> JudgeConfig:
        return JudgeConfig(
            provider="anthropic",
            model="claude-sonnet-4-20250514",
            temperature=0.4,
            system_prompt=DECISION_JUDGE_PROMPT,
        )

    def get_max_rounds(self) -> int:
        return 3

    def get_consensus_threshold(self) -> float:
        return 0.75  # Allow for healthy disagreement in strategic decisions
