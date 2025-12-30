"""LangGraph StateGraph definition for MAD Framework."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any, Literal

from langgraph.graph import END, StateGraph
from langgraph.graph.state import CompiledStateGraph

from mad.core.state import DebateState

if TYPE_CHECKING:
    from mad.agents.debater import DebaterAgent
    from mad.agents.judge import JudgeAgent
    from mad.agents.moderator import ModeratorAgent


def create_debate_graph(
    debaters: list[DebaterAgent],
    judge: JudgeAgent,
    moderator: ModeratorAgent | None = None,
) -> CompiledStateGraph[DebateState]:
    """Create a LangGraph StateGraph for debate orchestration.

    Args:
        debaters: List of debater agents.
        judge: Judge agent for final verdict.
        moderator: Optional moderator agent for flow control.

    Returns:
        Compiled StateGraph ready for execution.
    """
    graph: StateGraph[DebateState] = StateGraph(DebateState)

    # Node: Initialize debate
    async def initialize_node(state: DebateState) -> dict[str, Any]:
        """Initialize the debate state."""
        return {
            "phase": "debate",
            "current_round": 1,
            "start_time": datetime.now().isoformat(),
        }

    # Node: Run debate round (all debaters)
    async def debate_node(state: DebateState) -> dict[str, Any]:
        """Execute one round of debate with all debaters."""
        messages = []
        total_tokens = state.get("total_tokens", 0)
        total_cost = state.get("total_cost", 0.0)

        for debater in debaters:
            message = await debater.act(state)
            messages.append(message)

            # Accumulate costs
            total_tokens += message["metadata"].get("input_tokens", 0)
            total_tokens += message["metadata"].get("output_tokens", 0)
            total_cost += message["metadata"].get("cost", 0.0)

        return {
            "messages": messages,
            "total_tokens": total_tokens,
            "total_cost": total_cost,
        }

    # Node: Moderator review
    async def moderate_node(state: DebateState) -> dict[str, Any]:
        """Moderator evaluates the round and decides whether to continue."""
        if moderator is None:
            # No moderator: continue until max rounds
            current = state["current_round"]
            max_rounds = state["max_rounds"]
            should_continue = current < max_rounds

            return {
                "phase": "debate" if should_continue else "judge",
                "current_round": current + 1 if should_continue else current,
                "should_continue": should_continue,
            }

        # Run moderator
        message = await moderator.act(state)
        moderation = moderator.parse_moderation(message["content"])

        should_stop = moderator.should_stop_early(moderation)
        current = state["current_round"]
        max_rounds = state["max_rounds"]

        if should_stop or current >= max_rounds:
            return {
                "messages": [message],
                "phase": "judge",
                "should_continue": False,
                "early_consensus": should_stop and current < max_rounds,
                "consensus_score": moderation.get("consensus_score", 0.0),
            }

        return {
            "messages": [message],
            "phase": "debate",
            "current_round": current + 1,
            "should_continue": True,
            "consensus_score": moderation.get("consensus_score", 0.0),
        }

    # Node: Judge deliberation
    async def judge_node(state: DebateState) -> dict[str, Any]:
        """Judge evaluates arguments and renders verdict."""
        message = await judge.act(state)
        verdict = judge.parse_verdict(message["content"])

        total_tokens = state.get("total_tokens", 0)
        total_cost = state.get("total_cost", 0.0)
        total_tokens += message["metadata"].get("input_tokens", 0)
        total_tokens += message["metadata"].get("output_tokens", 0)
        total_cost += message["metadata"].get("cost", 0.0)

        return {
            "messages": [message],
            "phase": "complete",
            "judge_verdict": verdict,
            "final_answer": verdict.get("verdict", ""),
            "confidence_score": verdict.get("confidence", 0.5),
            "dissenting_opinions": verdict.get("dissenting_points", []),
            "total_tokens": total_tokens,
            "total_cost": total_cost,
            "end_time": datetime.now().isoformat(),
        }

    # Add nodes
    graph.add_node("initialize", initialize_node)
    graph.add_node("debate", debate_node)
    graph.add_node("moderate", moderate_node)
    graph.add_node("judge", judge_node)

    # Define routing function
    def route_after_moderate(
        state: DebateState,
    ) -> Literal["debate", "judge"]:
        """Route based on moderation result."""
        if state["phase"] == "judge":
            return "judge"
        return "debate"

    # Add edges
    graph.set_entry_point("initialize")
    graph.add_edge("initialize", "debate")
    graph.add_edge("debate", "moderate")
    graph.add_conditional_edges(
        "moderate",
        route_after_moderate,
        {"debate": "debate", "judge": "judge"},
    )
    graph.add_edge("judge", END)

    return graph.compile()  # type: ignore[return-value]
