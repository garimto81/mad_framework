"""Basic debate example for MAD Framework.

This example demonstrates a simple debate between two agents.
"""

import asyncio

from mad import MAD, DebateConfig
from mad.core.config import DebaterConfig, JudgeConfig


async def main():
    """Run a basic debate between two agents."""
    # Configure the debate
    config = DebateConfig(
        debaters=[
            DebaterConfig(
                provider="anthropic",
                model="claude-sonnet-4-20250514",
                perspective="advocate",
                temperature=0.7,
            ),
            DebaterConfig(
                provider="anthropic",
                model="claude-sonnet-4-20250514",
                perspective="critic",
                temperature=0.7,
            ),
        ],
        judge=JudgeConfig(
            provider="anthropic",
            model="claude-sonnet-4-20250514",
            temperature=0.3,
        ),
        max_rounds=3,
        early_stop_on_consensus=True,
        consensus_threshold=0.8,
    )

    # Create the MAD orchestrator
    mad = MAD(config)

    # Run the debate
    print("Starting debate...")
    print("=" * 60)

    result = await mad.debate(
        topic="Should software developers use AI coding assistants?",
        context="""
        Consider:
        - Productivity impact
        - Code quality implications
        - Learning and skill development
        - Security concerns
        - Team collaboration
        """,
    )

    # Print results
    print("\n" + "=" * 60)
    print("DEBATE RESULTS")
    print("=" * 60)

    print(f"\nVerdict: {result.verdict}")
    print(f"\nConfidence: {result.confidence:.0%}")
    print(f"\nReasoning: {result.reasoning}")

    if result.consensus_points:
        print("\nConsensus Points:")
        for point in result.consensus_points:
            print(f"  - {point}")

    if result.dissenting_opinions:
        print("\nDissenting Opinions:")
        for opinion in result.dissenting_opinions:
            print(f"  - {opinion}")

    if result.recommendations:
        print(f"\nRecommendations: {result.recommendations}")

    print(f"\n{result.cost_summary}")


if __name__ == "__main__":
    asyncio.run(main())
