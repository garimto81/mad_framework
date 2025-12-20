"""Tests for MAD Framework state management."""


from mad.core.state import (
    create_initial_state,
    create_message,
)


class TestCreateInitialState:
    """Tests for create_initial_state function."""

    def test_creates_state_with_required_fields(self):
        """Should create state with topic."""
        state = create_initial_state(topic="Test topic")

        assert state["topic"] == "Test topic"
        assert state["context"] is None
        assert state["preset"] is None
        assert state["max_rounds"] == 3
        assert state["current_round"] == 0
        assert state["phase"] == "init"

    def test_creates_state_with_all_fields(self):
        """Should create state with all optional fields."""
        state = create_initial_state(
            topic="Test topic",
            context="Test context",
            preset="code_review",
            max_rounds=5,
            debater_count=3,
        )

        assert state["topic"] == "Test topic"
        assert state["context"] == "Test context"
        assert state["preset"] == "code_review"
        assert state["max_rounds"] == 5
        assert state["debater_count"] == 3

    def test_initializes_empty_messages(self):
        """Should start with empty messages list."""
        state = create_initial_state(topic="Test")

        assert state["messages"] == []
        assert state["dissenting_opinions"] == []

    def test_initializes_metadata(self):
        """Should initialize metadata fields."""
        state = create_initial_state(topic="Test")

        assert state["total_tokens"] == 0
        assert state["total_cost"] == 0.0
        assert state["start_time"] is not None
        assert state["end_time"] is None


class TestCreateMessage:
    """Tests for create_message function."""

    def test_creates_message_with_required_fields(self):
        """Should create message with all required fields."""
        msg = create_message(
            agent_id="debater_1",
            agent_role="debater",
            provider="anthropic",
            model="claude-sonnet-4-20250514",
            content="Test argument",
            current_round=1,
        )

        assert msg["agent_id"] == "debater_1"
        assert msg["agent_role"] == "debater"
        assert msg["provider"] == "anthropic"
        assert msg["model"] == "claude-sonnet-4-20250514"
        assert msg["content"] == "Test argument"
        assert msg["round"] == 1
        assert msg["timestamp"] is not None

    def test_includes_metadata(self):
        """Should include additional metadata."""
        msg = create_message(
            agent_id="judge",
            agent_role="judge",
            provider="anthropic",
            model="claude-sonnet-4-20250514",
            content="Verdict",
            current_round=3,
            input_tokens=100,
            output_tokens=50,
            cost=0.01,
        )

        assert msg["metadata"]["input_tokens"] == 100
        assert msg["metadata"]["output_tokens"] == 50
        assert msg["metadata"]["cost"] == 0.01
