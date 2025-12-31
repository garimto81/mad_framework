"""Tests for agent classes."""

import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from mad.agents.base import BaseAgent
from mad.agents.debater import DebaterAgent
from mad.agents.judge import JudgeAgent
from mad.agents.moderator import ModeratorAgent


# Mock provider for testing
def create_mock_provider(response_content: str = "Test response"):
    """Create a mock LLM provider."""
    provider = MagicMock()
    provider.name = "mock"
    provider.generate = AsyncMock(
        return_value={
            "content": response_content,
            "input_tokens": 100,
            "output_tokens": 50,
            "model": "mock-model",
            "cost": 0.001,
            "latency_ms": 500,
        }
    )
    return provider


def create_test_state(messages=None, current_round=1, max_rounds=3):
    """Create a test debate state."""
    return {
        "topic": "Test topic",
        "context": "Test context",
        "messages": messages or [],
        "current_round": current_round,
        "max_rounds": max_rounds,
        "debater_count": 2,
        "phase": "debate",
    }


class TestBaseAgent:
    """Tests for BaseAgent abstract class."""

    def test_is_abstract(self):
        """BaseAgent should not be directly instantiable."""
        with pytest.raises(TypeError):
            BaseAgent("test", None, "model")  # type: ignore[abstract]

    def test_system_prompt_uses_override(self):
        """system_prompt should return override when provided."""

        class ConcreteAgent(BaseAgent):
            @property
            def role(self):
                return "debater"

            async def act(self, state):
                pass

        agent = ConcreteAgent(
            "test", None, "model", system_prompt="Custom prompt", temperature=0.5
        )
        assert agent.system_prompt == "Custom prompt"

    def test_system_prompt_uses_default(self):
        """system_prompt should return default when no override."""

        class ConcreteAgent(BaseAgent):
            @property
            def role(self):
                return "debater"

            @property
            def default_system_prompt(self):
                return "Default prompt"

            async def act(self, state):
                pass

        agent = ConcreteAgent("test", None, "model")
        assert agent.system_prompt == "Default prompt"

    def test_build_conversation_history(self):
        """_build_conversation_history should format messages correctly."""

        class ConcreteAgent(BaseAgent):
            @property
            def role(self):
                return "debater"

            async def act(self, state):
                pass

        agent = ConcreteAgent("agent1", None, "model")
        state = create_test_state(
            messages=[
                {
                    "agent_id": "agent1",
                    "agent_role": "debater",
                    "content": "My argument",
                    "round": 1,
                    "metadata": {},
                },
                {
                    "agent_id": "agent2",
                    "agent_role": "debater",
                    "content": "Other argument",
                    "round": 1,
                    "metadata": {},
                },
            ]
        )

        history = agent._build_conversation_history(state)

        assert len(history) == 2
        assert history[0]["role"] == "assistant"  # own message
        assert history[1]["role"] == "user"  # other's message
        assert "[DEBATER - agent1]" in history[0]["content"]
        assert "[DEBATER - agent2]" in history[1]["content"]

    def test_build_conversation_history_excludes_own(self):
        """_build_conversation_history can exclude own messages."""

        class ConcreteAgent(BaseAgent):
            @property
            def role(self):
                return "debater"

            async def act(self, state):
                pass

        agent = ConcreteAgent("agent1", None, "model")
        state = create_test_state(
            messages=[
                {
                    "agent_id": "agent1",
                    "agent_role": "debater",
                    "content": "My argument",
                    "round": 1,
                    "metadata": {},
                },
                {
                    "agent_id": "agent2",
                    "agent_role": "debater",
                    "content": "Other argument",
                    "round": 1,
                    "metadata": {},
                },
            ]
        )

        history = agent._build_conversation_history(state, include_own_messages=False)

        assert len(history) == 1
        assert "agent2" in history[0]["content"]

    def test_create_response_message(self):
        """_create_response_message should create proper message."""

        class ConcreteAgent(BaseAgent):
            @property
            def role(self):
                return "debater"

            async def act(self, state):
                pass

        provider = create_mock_provider()
        agent = ConcreteAgent("agent1", provider, "test-model")
        state = create_test_state()

        message = agent._create_response_message(
            content="Test content", state=state, custom_field="value"
        )

        assert message["agent_id"] == "agent1"
        assert message["agent_role"] == "debater"
        assert message["content"] == "Test content"
        assert message["round"] == 1
        assert message["metadata"]["custom_field"] == "value"


class TestDebaterAgent:
    """Tests for DebaterAgent."""

    def test_role_is_debater(self):
        """DebaterAgent.role should return 'debater'."""
        provider = create_mock_provider()
        agent = DebaterAgent("debater1", provider, "test-model")
        assert agent.role == "debater"

    def test_default_system_prompt(self):
        """DebaterAgent should have a default system prompt."""
        provider = create_mock_provider()
        agent = DebaterAgent("debater1", provider, "test-model")

        assert "debater" in agent.default_system_prompt.lower()
        assert "argument" in agent.default_system_prompt.lower()

    def test_perspective_added_to_prompt(self):
        """Perspective should be added to system prompt."""
        provider = create_mock_provider()
        agent = DebaterAgent(
            "debater1", provider, "test-model", perspective="security"
        )

        assert "security" in agent.default_system_prompt.lower()

    def test_perspective_stored(self):
        """Perspective should be stored on agent."""
        provider = create_mock_provider()
        agent = DebaterAgent(
            "debater1", provider, "test-model", perspective="performance"
        )

        assert agent.perspective == "performance"

    @pytest.mark.asyncio
    async def test_act_calls_provider(self):
        """act should call provider.generate."""
        provider = create_mock_provider("Test argument")
        agent = DebaterAgent("debater1", provider, "test-model")
        state = create_test_state()

        message = await agent.act(state)

        provider.generate.assert_called_once()
        assert message["content"] == "Test argument"
        assert message["agent_id"] == "debater1"

    @pytest.mark.asyncio
    async def test_act_includes_metadata(self):
        """act should include token and cost metadata."""
        provider = create_mock_provider()
        agent = DebaterAgent("debater1", provider, "test-model")
        state = create_test_state()

        message = await agent.act(state)

        assert message["metadata"]["input_tokens"] == 100
        assert message["metadata"]["output_tokens"] == 50
        assert message["metadata"]["cost"] == 0.001

    def test_build_prompt_includes_topic(self):
        """_build_prompt should include the debate topic."""
        provider = create_mock_provider()
        agent = DebaterAgent("debater1", provider, "test-model")
        state = create_test_state()

        messages = agent._build_prompt(state)

        # First message should contain topic
        assert "Test topic" in messages[0]["content"]

    def test_build_prompt_includes_context(self):
        """_build_prompt should include context when provided."""
        provider = create_mock_provider()
        agent = DebaterAgent("debater1", provider, "test-model")
        state = create_test_state()

        messages = agent._build_prompt(state)

        assert "Test context" in messages[0]["content"]

    def test_build_prompt_round_1_instruction(self):
        """_build_prompt should have initial position instruction for round 1."""
        provider = create_mock_provider()
        agent = DebaterAgent("debater1", provider, "test-model")
        state = create_test_state(current_round=1)

        messages = agent._build_prompt(state)

        # Last message should be instruction
        last_msg = messages[-1]["content"]
        assert "initial position" in last_msg.lower()

    def test_build_prompt_final_round_instruction(self):
        """_build_prompt should have final round instruction."""
        provider = create_mock_provider()
        agent = DebaterAgent("debater1", provider, "test-model")
        state = create_test_state(current_round=3, max_rounds=3)

        messages = agent._build_prompt(state)

        last_msg = messages[-1]["content"]
        assert "final" in last_msg.lower()


class TestJudgeAgent:
    """Tests for JudgeAgent."""

    def test_role_is_judge(self):
        """JudgeAgent.role should return 'judge'."""
        provider = create_mock_provider()
        agent = JudgeAgent(provider=provider)
        assert agent.role == "judge"

    def test_default_agent_id(self):
        """JudgeAgent should default to 'judge' id."""
        provider = create_mock_provider()
        agent = JudgeAgent(provider=provider)
        assert agent.agent_id == "judge"

    def test_lower_default_temperature(self):
        """JudgeAgent should have lower default temperature."""
        provider = create_mock_provider()
        agent = JudgeAgent(provider=provider)
        assert agent.temperature == 0.3

    def test_default_system_prompt(self):
        """JudgeAgent should have appropriate system prompt."""
        provider = create_mock_provider()
        agent = JudgeAgent(provider=provider)

        assert "judge" in agent.default_system_prompt.lower()
        assert "verdict" in agent.default_system_prompt.lower()

    @pytest.mark.asyncio
    async def test_act_calls_provider(self):
        """act should call provider.generate."""
        provider = create_mock_provider("Judge verdict")
        agent = JudgeAgent(provider=provider)
        state = create_test_state()

        message = await agent.act(state)

        provider.generate.assert_called_once()
        assert message["content"] == "Judge verdict"

    def test_parse_verdict_valid_json(self):
        """parse_verdict should extract JSON verdict."""
        provider = create_mock_provider()
        agent = JudgeAgent(provider=provider)

        content = """Here is my verdict:
```json
{
    "verdict": "Option A is better",
    "confidence": 0.85,
    "reasoning": "Because of X and Y",
    "consensus_points": ["Point 1"],
    "dissenting_points": ["Point 2"],
    "recommendations": "Consider Z"
}
```"""

        result = agent.parse_verdict(content)

        assert result["verdict"] == "Option A is better"
        assert result["confidence"] == 0.85
        assert "Because of X and Y" in result["reasoning"]

    def test_parse_verdict_invalid_json(self):
        """parse_verdict should fallback for invalid JSON."""
        provider = create_mock_provider()
        agent = JudgeAgent(provider=provider)

        content = "I think option A is better because it's more efficient."

        result = agent.parse_verdict(content)

        assert result["verdict"] == content
        assert result["confidence"] == 0.5
        assert "Unable to parse" in result["reasoning"]

    def test_parse_verdict_embedded_json(self):
        """parse_verdict should extract embedded JSON."""
        provider = create_mock_provider()
        agent = JudgeAgent(provider=provider)

        content = 'Some text {"verdict": "A", "confidence": 0.9} more text'

        result = agent.parse_verdict(content)

        assert result["verdict"] == "A"
        assert result["confidence"] == 0.9


class TestModeratorAgent:
    """Tests for ModeratorAgent."""

    def test_role_is_moderator(self):
        """ModeratorAgent.role should return 'moderator'."""
        provider = create_mock_provider()
        agent = ModeratorAgent(provider=provider)
        assert agent.role == "moderator"

    def test_default_agent_id(self):
        """ModeratorAgent should default to 'moderator' id."""
        provider = create_mock_provider()
        agent = ModeratorAgent(provider=provider)
        assert agent.agent_id == "moderator"

    def test_default_consensus_threshold(self):
        """ModeratorAgent should have default consensus threshold."""
        provider = create_mock_provider()
        agent = ModeratorAgent(provider=provider)
        assert agent.consensus_threshold == 0.8

    def test_custom_consensus_threshold(self):
        """ModeratorAgent should accept custom consensus threshold."""
        provider = create_mock_provider()
        agent = ModeratorAgent(provider=provider, consensus_threshold=0.9)
        assert agent.consensus_threshold == 0.9

    def test_default_system_prompt(self):
        """ModeratorAgent should have appropriate system prompt."""
        provider = create_mock_provider()
        agent = ModeratorAgent(provider=provider)

        assert "moderator" in agent.default_system_prompt.lower()
        assert "consensus" in agent.default_system_prompt.lower()

    @pytest.mark.asyncio
    async def test_act_calls_provider(self):
        """act should call provider.generate."""
        provider = create_mock_provider("Moderation result")
        agent = ModeratorAgent(provider=provider)
        state = create_test_state()

        message = await agent.act(state)

        provider.generate.assert_called_once()
        assert message["content"] == "Moderation result"

    def test_parse_moderation_valid_json(self):
        """parse_moderation should extract JSON moderation."""
        provider = create_mock_provider()
        agent = ModeratorAgent(provider=provider)

        content = """
```json
{
    "consensus_score": 0.75,
    "should_continue": true,
    "reasoning": "Arguments are converging",
    "key_disagreements": ["Point A"],
    "key_agreements": ["Point B"],
    "quality_score": 0.8
}
```"""

        result = agent.parse_moderation(content)

        assert result["consensus_score"] == 0.75
        assert result["should_continue"] is True
        assert result["quality_score"] == 0.8

    def test_parse_moderation_invalid_json(self):
        """parse_moderation should fallback for invalid JSON."""
        provider = create_mock_provider()
        agent = ModeratorAgent(provider=provider)

        content = "The debate should continue."

        result = agent.parse_moderation(content)

        assert result["consensus_score"] == 0.0
        assert result["should_continue"] is True
        assert "Unable to parse" in result["reasoning"]

    def test_should_stop_early_high_consensus(self):
        """should_stop_early should return True for high consensus."""
        provider = create_mock_provider()
        agent = ModeratorAgent(provider=provider, consensus_threshold=0.8)

        moderation = {"consensus_score": 0.85, "should_continue": True}

        assert agent.should_stop_early(moderation) is True

    def test_should_stop_early_explicit_stop(self):
        """should_stop_early should return True when should_continue is False."""
        provider = create_mock_provider()
        agent = ModeratorAgent(provider=provider)

        moderation = {"consensus_score": 0.5, "should_continue": False}

        assert agent.should_stop_early(moderation) is True

    def test_should_not_stop_early_low_consensus(self):
        """should_stop_early should return False for low consensus."""
        provider = create_mock_provider()
        agent = ModeratorAgent(provider=provider, consensus_threshold=0.8)

        moderation = {"consensus_score": 0.6, "should_continue": True}

        assert agent.should_stop_early(moderation) is False

    def test_build_prompt_includes_round_info(self):
        """_build_prompt should include round information."""
        provider = create_mock_provider()
        agent = ModeratorAgent(provider=provider)
        state = create_test_state(current_round=2, max_rounds=3)

        messages = agent._build_prompt(state)

        assert "2/3" in messages[0]["content"]
