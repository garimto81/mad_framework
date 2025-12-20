"""Multi-provider debate example.

This example shows how to use different LLM providers in the same debate.
"""

import asyncio

from mad import MAD, DebateConfig
from mad.core.config import DebaterConfig, JudgeConfig


async def main():
    """Run a debate with mixed providers (Claude vs GPT)."""
    # Configure debate with different providers
    config = DebateConfig(
        debaters=[
            # Claude debater
            DebaterConfig(
                provider="anthropic",
                model="claude-sonnet-4-20250514",
                perspective="analytical",
                temperature=0.7,
            ),
            # GPT debater
            DebaterConfig(
                provider="openai",
                model="gpt-4o",
                perspective="creative",
                temperature=0.8,
            ),
        ],
        # Claude as judge (tends to be more balanced)
        judge=JudgeConfig(
            provider="anthropic",
            model="claude-sonnet-4-20250514",
            temperature=0.3,
        ),
        max_rounds=3,
    )

    mad = MAD(config)

    print("Starting multi-provider debate (Claude vs GPT)...")
    print("=" * 60)

    result = await mad.debate(
        topic="What is the most important skill for software engineers in 2025?",
        context="""
        Consider the rapidly evolving tech landscape:
        - AI/ML integration in development workflows
        - Remote and distributed teams
        - Cloud-native architectures
        - Security and privacy concerns
        - User experience focus
        """,
    )

    print("\n" + "=" * 60)
    print("DEBATE RESULTS")
    print("=" * 60)

    print(f"\nVerdict: {result.verdict}")
    print(f"\nConfidence: {result.confidence:.0%}")
    print(f"\nReasoning: {result.reasoning}")

    # Show how different providers contributed
    print("\n--- Debate Transcript Summary ---")
    for msg in result.final_state["messages"]:
        if msg["agent_role"] == "debater":
            print(f"\n[{msg['agent_id']}] ({msg['provider']}/{msg['model']})")
            print(f"  Round {msg['round']}: {msg['content'][:200]}...")

    print(f"\n{result.cost_summary}")


if __name__ == "__main__":
    asyncio.run(main())
