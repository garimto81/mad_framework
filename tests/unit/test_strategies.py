"""Tests for debate strategies."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from mad.strategies.base import DebateStrategy
from mad.strategies.round_robin import RoundRobinStrategy


class TestDebateStrategy:
    """Tests for DebateStrategy base class."""

    def test_is_abstract(self):
        """DebateStrategy should not be directly instantiable."""
        with pytest.raises(TypeError):
            DebateStrategy()  # type: ignore[abstract]

    def test_requires_name_property(self):
        """Subclasses must implement name property."""

        class IncompleteStrategy(DebateStrategy):
            async def execute_round(self, debaters, state):
                return []

            def should_continue(self, state, round_messages):
                return False

        with pytest.raises(TypeError):
            IncompleteStrategy()  # type: ignore[abstract]

    def test_requires_execute_round(self):
        """Subclasses must implement execute_round method."""

        class IncompleteStrategy(DebateStrategy):
            @property
            def name(self):
                return "incomplete"

            def should_continue(self, state, round_messages):
                return False

        with pytest.raises(TypeError):
            IncompleteStrategy()  # type: ignore[abstract]

    def test_requires_should_continue(self):
        """Subclasses must implement should_continue method."""

        class IncompleteStrategy(DebateStrategy):
            @property
            def name(self):
                return "incomplete"

            async def execute_round(self, debaters, state):
                return []

        with pytest.raises(TypeError):
            IncompleteStrategy()  # type: ignore[abstract]


class TestRoundRobinStrategy:
    """Tests for RoundRobinStrategy."""

    def test_default_max_rounds(self):
        """RoundRobinStrategy should default to 3 max rounds."""
        strategy = RoundRobinStrategy()
        assert strategy.max_rounds == 3

    def test_custom_max_rounds(self):
        """RoundRobinStrategy should accept custom max rounds."""
        strategy = RoundRobinStrategy(max_rounds=5)
        assert strategy.max_rounds == 5

    def test_name_property(self):
        """RoundRobinStrategy.name should return 'round_robin'."""
        strategy = RoundRobinStrategy()
        assert strategy.name == "round_robin"

    def test_should_continue_before_max_rounds(self):
        """should_continue should return True before max rounds."""
        strategy = RoundRobinStrategy(max_rounds=3)
        state = {"current_round": 1, "messages": [], "topic": "test"}

        assert strategy.should_continue(state, []) is True

    def test_should_continue_at_round_2_of_3(self):
        """should_continue should return True at round 2 of 3."""
        strategy = RoundRobinStrategy(max_rounds=3)
        state = {"current_round": 2, "messages": [], "topic": "test"}

        assert strategy.should_continue(state, []) is True

    def test_should_not_continue_at_max_rounds(self):
        """should_continue should return False at max rounds."""
        strategy = RoundRobinStrategy(max_rounds=3)
        state = {"current_round": 3, "messages": [], "topic": "test"}

        assert strategy.should_continue(state, []) is False

    def test_should_continue_handles_missing_round(self):
        """should_continue should default to round 1 if missing."""
        strategy = RoundRobinStrategy(max_rounds=3)
        state = {"messages": [], "topic": "test"}

        # Default round 1, max 3 -> should continue
        assert strategy.should_continue(state, []) is True

    @pytest.mark.asyncio
    async def test_execute_round_calls_all_debaters(self):
        """execute_round should call act on all debaters."""
        strategy = RoundRobinStrategy()

        # Create mock debaters
        debater1 = MagicMock()
        debater1.act = AsyncMock(
            return_value={
                "agent_id": "debater1",
                "agent_role": "debater",
                "content": "Argument 1",
                "round": 1,
                "metadata": {},
            }
        )

        debater2 = MagicMock()
        debater2.act = AsyncMock(
            return_value={
                "agent_id": "debater2",
                "agent_role": "debater",
                "content": "Argument 2",
                "round": 1,
                "metadata": {},
            }
        )

        state = {
            "topic": "Test topic",
            "context": None,
            "messages": [],
            "current_round": 1,
            "max_rounds": 3,
            "debater_count": 2,
        }

        messages = await strategy.execute_round([debater1, debater2], state)

        assert len(messages) == 2
        debater1.act.assert_called_once()
        debater2.act.assert_called_once()

    @pytest.mark.asyncio
    async def test_execute_round_updates_state_for_later_debaters(self):
        """Later debaters should see earlier debaters' messages."""
        strategy = RoundRobinStrategy()

        captured_states = []

        async def capture_state(state):
            captured_states.append(list(state["messages"]))
            return {
                "agent_id": f"debater{len(captured_states)}",
                "agent_role": "debater",
                "content": f"Argument {len(captured_states)}",
                "round": 1,
                "metadata": {},
            }

        debater1 = MagicMock()
        debater1.act = AsyncMock(side_effect=capture_state)

        debater2 = MagicMock()
        debater2.act = AsyncMock(side_effect=capture_state)

        debater3 = MagicMock()
        debater3.act = AsyncMock(side_effect=capture_state)

        state = {
            "topic": "Test topic",
            "context": None,
            "messages": [],
            "current_round": 1,
            "max_rounds": 3,
            "debater_count": 3,
        }

        await strategy.execute_round([debater1, debater2, debater3], state)

        # First debater sees empty messages
        assert len(captured_states[0]) == 0
        # Second debater sees first debater's message
        assert len(captured_states[1]) == 1
        # Third debater sees first two messages
        assert len(captured_states[2]) == 2

    @pytest.mark.asyncio
    async def test_execute_round_returns_all_messages(self):
        """execute_round should return all debater messages."""
        strategy = RoundRobinStrategy()

        messages_to_return = [
            {
                "agent_id": "debater1",
                "agent_role": "debater",
                "content": "Point A",
                "round": 1,
                "metadata": {},
            },
            {
                "agent_id": "debater2",
                "agent_role": "debater",
                "content": "Point B",
                "round": 1,
                "metadata": {},
            },
        ]

        debater1 = MagicMock()
        debater1.act = AsyncMock(return_value=messages_to_return[0])

        debater2 = MagicMock()
        debater2.act = AsyncMock(return_value=messages_to_return[1])

        state = {
            "topic": "Test",
            "context": None,
            "messages": [],
            "current_round": 1,
            "max_rounds": 3,
            "debater_count": 2,
        }

        result = await strategy.execute_round([debater1, debater2], state)

        assert result == messages_to_return
