"""LangGraph state definitions for MAD Framework."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal, TypedDict

from langgraph.graph.message import add_messages


class DebateMessage(TypedDict):
    """A single message in the debate."""

    agent_id: str
    agent_role: Literal["debater", "judge", "moderator", "synthesizer"]
    provider: str
    model: str
    content: str
    round: int
    timestamp: str
    metadata: dict


def create_message(
    agent_id: str,
    agent_role: Literal["debater", "judge", "moderator", "synthesizer"],
    provider: str,
    model: str,
    content: str,
    current_round: int,
    **metadata: object,
) -> DebateMessage:
    """Factory function to create a DebateMessage."""
    return DebateMessage(
        agent_id=agent_id,
        agent_role=agent_role,
        provider=provider,
        model=model,
        content=content,
        round=current_round,
        timestamp=datetime.now().isoformat(),
        metadata=dict(metadata),
    )


class DebateState(TypedDict):
    """LangGraph state schema for debate sessions."""

    # Input
    topic: str
    context: str | None
    preset: str | None

    # Debate configuration
    max_rounds: int
    current_round: int
    debater_count: int

    # Debate progress
    messages: Annotated[list[DebateMessage], add_messages]
    phase: Literal["init", "debate", "moderate", "judge", "synthesize", "complete"]

    # Moderator control
    should_continue: bool
    early_consensus: bool
    consensus_score: float

    # Results
    judge_verdict: dict | None
    final_answer: str | None
    confidence_score: float | None
    dissenting_opinions: list[str]

    # Metadata
    total_tokens: int
    total_cost: float
    start_time: str
    end_time: str | None


def create_initial_state(
    topic: str,
    context: str | None = None,
    preset: str | None = None,
    max_rounds: int = 3,
    debater_count: int = 2,
) -> DebateState:
    """Create an initial debate state."""
    return DebateState(
        topic=topic,
        context=context,
        preset=preset,
        max_rounds=max_rounds,
        current_round=0,
        debater_count=debater_count,
        messages=[],
        phase="init",
        should_continue=True,
        early_consensus=False,
        consensus_score=0.0,
        judge_verdict=None,
        final_answer=None,
        confidence_score=None,
        dissenting_opinions=[],
        total_tokens=0,
        total_cost=0.0,
        start_time=datetime.now().isoformat(),
        end_time=None,
    )
