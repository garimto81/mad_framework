"""Q&A accuracy preset for MAD Framework."""

from __future__ import annotations

from mad.core.config import DebaterConfig, JudgeConfig
from mad.presets.base import Preset

QA_DEBATER_PROMPT = """You are an expert analyst participating in a multi-agent question answering session.

Your approach: {approach}

When answering questions:
1. Break down complex questions into components
2. Consider multiple valid interpretations
3. Cite reasoning and evidence for your answers
4. Acknowledge uncertainty when appropriate
5. Challenge assumptions in the question if needed

Be thorough but concise. If you're uncertain, explain why.
If another agent presents a compelling argument, be willing to update your position."""

QA_JUDGE_PROMPT = """You are an expert synthesizer evaluating multiple answers to a question.

Your responsibilities:
1. Identify the most accurate and complete answer
2. Combine complementary insights from different agents
3. Resolve factual disagreements by evaluating evidence
4. Highlight remaining uncertainties

Provide a final answer that:
- Is factually accurate (prioritize correctness)
- Is complete (addresses all parts of the question)
- Acknowledges limitations or uncertainties
- Explains the reasoning behind the answer"""


class QAAccuracyPreset(Preset):
    """Preset for improving Q&A accuracy through debate.

    Uses agents with different analytical approaches:
    - Analytical: Logical step-by-step reasoning
    - Creative: Alternative interpretations and edge cases
    - Critical: Devil's advocate, challenging assumptions

    Example:
        ```python
        from mad import MAD
        from mad.presets import QAAccuracyPreset

        preset = QAAccuracyPreset()
        mad = MAD(preset.to_config())

        result = await mad.debate(
            topic="What causes the seasons on Earth?",
        )
        print(result.verdict)
        print(f"Confidence: {result.confidence}")
        ```
    """

    @property
    def name(self) -> str:
        return "qa_accuracy"

    @property
    def description(self) -> str:
        return "Improve Q&A accuracy through multi-agent reasoning"

    def get_debater_configs(self) -> list[DebaterConfig]:
        approaches = [
            ("analytical", "Use systematic, step-by-step logical analysis"),
            ("creative", "Consider alternative interpretations and edge cases"),
            ("critical", "Play devil's advocate, challenge assumptions and common misconceptions"),
        ]

        return [
            DebaterConfig(
                provider="anthropic",
                model="claude-sonnet-4-20250514",
                perspective=name,
                temperature=0.7,
                system_prompt=QA_DEBATER_PROMPT.format(approach=desc),
            )
            for name, desc in approaches
        ]

    def get_judge_config(self) -> JudgeConfig:
        return JudgeConfig(
            provider="anthropic",
            model="claude-sonnet-4-20250514",
            temperature=0.3,
            system_prompt=QA_JUDGE_PROMPT,
        )

    def get_max_rounds(self) -> int:
        return 3

    def get_consensus_threshold(self) -> float:
        return 0.85  # Higher threshold for factual accuracy
