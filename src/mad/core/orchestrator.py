"""Main orchestrator for MAD Framework."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from mad.agents.debater import DebaterAgent
from mad.agents.judge import JudgeAgent
from mad.agents.moderator import ModeratorAgent
from mad.core.config import DebateConfig, DebaterConfig, JudgeConfig, MADConfig
from mad.core.graph import create_debate_graph
from mad.core.state import DebateState, create_initial_state
from mad.providers.registry import get_provider

if TYPE_CHECKING:
    from mad.providers.base import LLMProvider


@dataclass
class DebateResult:
    """Result of a debate session."""

    verdict: str
    confidence: float
    reasoning: str
    consensus_points: list[str]
    dissenting_opinions: list[str]
    recommendations: str

    # Metadata
    total_rounds: int
    early_consensus: bool
    total_tokens: int
    total_cost: float
    execution_time_ms: float

    # Full state for debugging
    final_state: DebateState

    @property
    def cost_summary(self) -> str:
        """Return formatted cost summary."""
        return (
            f"Tokens: {self.total_tokens:,} | "
            f"Cost: ${self.total_cost:.4f} | "
            f"Rounds: {self.total_rounds}"
        )


class MAD:
    """Multi-Agent Debate orchestrator.

    Main entry point for running debates between multiple LLM agents.

    Example:
        ```python
        from mad import MAD, DebateConfig
        from mad.core.config import DebaterConfig, JudgeConfig

        config = DebateConfig(
            debaters=[
                DebaterConfig(provider="anthropic", perspective="security"),
                DebaterConfig(provider="openai", perspective="performance"),
            ],
            judge=JudgeConfig(provider="anthropic"),
            max_rounds=3,
        )

        mad = MAD(config)
        result = await mad.debate(
            topic="Should we use eval() in Python?",
            context="def process(data): eval(data['cmd'])"
        )
        print(result.verdict)
        ```
    """

    def __init__(
        self,
        config: DebateConfig,
        global_config: MADConfig | None = None,
    ):
        """Initialize the MAD orchestrator.

        Args:
            config: Debate configuration.
            global_config: Optional global configuration for API keys.
        """
        self.config = config
        self.global_config = global_config or MADConfig()

        # Initialize agents
        self._debaters = self._create_debaters()
        self._judge = self._create_judge()
        self._moderator = self._create_moderator()

        # Build graph
        self._graph = create_debate_graph(
            debaters=self._debaters,
            judge=self._judge,
            moderator=self._moderator,
        )

    def _get_provider(self, provider_name: str) -> LLMProvider:
        """Get a provider instance."""
        return get_provider(provider_name)

    def _create_debaters(self) -> list[DebaterAgent]:
        """Create debater agents from config."""
        debaters = []

        for i, debater_config in enumerate(self.config.debaters):
            if isinstance(debater_config, dict):
                debater_config = DebaterConfig(**debater_config)

            provider = self._get_provider(debater_config.provider)

            agent = DebaterAgent(
                agent_id=f"debater_{i + 1}",
                provider=provider,
                model=debater_config.model,
                perspective=debater_config.perspective,
                system_prompt=debater_config.system_prompt,
                temperature=debater_config.temperature,
            )
            debaters.append(agent)

        # Default: 2 debaters if none specified
        if not debaters:
            default_provider = self._get_provider(self.global_config.default_provider)
            debaters = [
                DebaterAgent(
                    agent_id="debater_1",
                    provider=default_provider,
                    model=self.global_config.default_model,
                    perspective="advocate",
                ),
                DebaterAgent(
                    agent_id="debater_2",
                    provider=default_provider,
                    model=self.global_config.default_model,
                    perspective="critic",
                ),
            ]

        return debaters

    def _create_judge(self) -> JudgeAgent:
        """Create judge agent from config."""
        judge_config = self.config.judge
        if isinstance(judge_config, dict):
            judge_config = JudgeConfig(**judge_config)

        provider = self._get_provider(judge_config.provider)

        return JudgeAgent(
            agent_id="judge",
            provider=provider,
            model=judge_config.model,
            system_prompt=judge_config.system_prompt,
            temperature=judge_config.temperature,
        )

    def _create_moderator(self) -> ModeratorAgent | None:
        """Create moderator agent if early stopping is enabled."""
        if not self.config.early_stop_on_consensus:
            return None

        # Use same provider as judge for moderator
        judge_config = self.config.judge
        if isinstance(judge_config, dict):
            judge_config = JudgeConfig(**judge_config)

        provider = self._get_provider(judge_config.provider)

        return ModeratorAgent(
            agent_id="moderator",
            provider=provider,
            model=judge_config.model,
            consensus_threshold=self.config.consensus_threshold,
        )

    async def debate(
        self,
        topic: str,
        context: str | None = None,
        preset: str | None = None,
    ) -> DebateResult:
        """Run a debate on the given topic.

        Args:
            topic: The debate topic or question.
            context: Optional additional context (e.g., code to review).
            preset: Optional preset name to apply.

        Returns:
            DebateResult with verdict and metadata.
        """
        # Create initial state
        initial_state = create_initial_state(
            topic=topic,
            context=context,
            preset=preset or self.config.preset,
            max_rounds=self.config.max_rounds,
            debater_count=len(self._debaters),
        )

        # Run the graph
        final_state = await self._graph.ainvoke(initial_state)

        # Extract result
        verdict = final_state.get("judge_verdict", {})

        # Calculate execution time
        start = final_state.get("start_time", "")
        end = final_state.get("end_time", "")
        execution_time = 0.0
        if start and end:
            from datetime import datetime

            start_dt = datetime.fromisoformat(start)
            end_dt = datetime.fromisoformat(end)
            execution_time = (end_dt - start_dt).total_seconds() * 1000

        return DebateResult(
            verdict=verdict.get("verdict", final_state.get("final_answer", "")),
            confidence=final_state.get("confidence_score", 0.5),
            reasoning=verdict.get("reasoning", ""),
            consensus_points=verdict.get("consensus_points", []),
            dissenting_opinions=final_state.get("dissenting_opinions", []),
            recommendations=verdict.get("recommendations", ""),
            total_rounds=final_state.get("current_round", 1),
            early_consensus=final_state.get("early_consensus", False),
            total_tokens=final_state.get("total_tokens", 0),
            total_cost=final_state.get("total_cost", 0.0),
            execution_time_ms=execution_time,
            final_state=final_state,
        )

    async def stream_debate(
        self,
        topic: str,
        context: str | None = None,
    ):
        """Stream debate progress (yields intermediate states).

        Args:
            topic: The debate topic.
            context: Optional additional context.

        Yields:
            Intermediate DebateState updates.
        """
        initial_state = create_initial_state(
            topic=topic,
            context=context,
            max_rounds=self.config.max_rounds,
            debater_count=len(self._debaters),
        )

        async for state in self._graph.astream(initial_state):
            yield state
