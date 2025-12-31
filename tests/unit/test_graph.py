"""Tests for debate graph creation."""

from unittest.mock import MagicMock

import pytest

from mad.core.graph import create_debate_graph


def create_mock_debater(agent_id: str):
    """Create a mock debater agent."""
    debater = MagicMock()
    debater.agent_id = agent_id
    return debater


def create_mock_judge():
    """Create a mock judge agent."""
    judge = MagicMock()
    judge.agent_id = "judge"
    return judge


def create_mock_moderator():
    """Create a mock moderator agent."""
    moderator = MagicMock()
    moderator.agent_id = "moderator"
    moderator.consensus_threshold = 0.8
    return moderator


class TestCreateDebateGraph:
    """Tests for create_debate_graph function."""

    def test_creates_compiled_graph(self):
        """create_debate_graph should return a compiled StateGraph."""
        debaters = [create_mock_debater("debater1")]
        judge = create_mock_judge()

        graph = create_debate_graph(debaters, judge)

        # Graph should be compiled and have necessary attributes
        assert graph is not None
        assert hasattr(graph, "ainvoke")

    def test_creates_graph_with_single_debater(self):
        """Graph should work with a single debater."""
        debaters = [create_mock_debater("debater1")]
        judge = create_mock_judge()

        graph = create_debate_graph(debaters, judge)

        assert graph is not None

    def test_creates_graph_with_multiple_debaters(self):
        """Graph should work with multiple debaters."""
        debaters = [
            create_mock_debater("debater1"),
            create_mock_debater("debater2"),
            create_mock_debater("debater3"),
        ]
        judge = create_mock_judge()

        graph = create_debate_graph(debaters, judge)

        assert graph is not None

    def test_creates_graph_without_moderator(self):
        """Graph should work without moderator."""
        debaters = [create_mock_debater("debater1")]
        judge = create_mock_judge()

        graph = create_debate_graph(debaters, judge, moderator=None)

        assert graph is not None

    def test_creates_graph_with_moderator(self):
        """Graph should work with moderator."""
        debaters = [create_mock_debater("debater1")]
        judge = create_mock_judge()
        moderator = create_mock_moderator()

        graph = create_debate_graph(debaters, judge, moderator=moderator)

        assert graph is not None

    def test_graph_has_invoke_method(self):
        """Compiled graph should have invoke methods."""
        debaters = [create_mock_debater("debater1")]
        judge = create_mock_judge()

        graph = create_debate_graph(debaters, judge)

        # Check async invoke method exists
        assert hasattr(graph, "ainvoke")
        assert callable(graph.ainvoke)

    def test_graph_with_empty_debaters_list(self):
        """Graph should handle empty debaters list."""
        # Note: This tests the creation, not execution
        # In practice, you'd want at least one debater
        debaters: list = []
        judge = create_mock_judge()

        # This should still create a graph (execution would be meaningless)
        graph = create_debate_graph(debaters, judge)

        assert graph is not None


class TestGraphStructure:
    """Tests for graph node structure."""

    def test_graph_has_nodes(self):
        """Graph should have the expected node structure."""
        debaters = [create_mock_debater("debater1")]
        judge = create_mock_judge()

        graph = create_debate_graph(debaters, judge)

        # The compiled graph should exist
        # We can't easily inspect nodes after compilation,
        # but we can verify the graph was created successfully
        assert graph is not None

    def test_graph_with_different_configurations(self):
        """Graph should work with various configurations."""
        # Test with different numbers of debaters
        for num_debaters in [1, 2, 5]:
            debaters = [
                create_mock_debater(f"debater{i}") for i in range(num_debaters)
            ]
            judge = create_mock_judge()

            graph = create_debate_graph(debaters, judge)
            assert graph is not None

    def test_graph_moderator_optional(self):
        """Moderator should be optional."""
        debaters = [create_mock_debater("debater1")]
        judge = create_mock_judge()

        # Without moderator
        graph1 = create_debate_graph(debaters, judge, moderator=None)
        assert graph1 is not None

        # With moderator
        moderator = create_mock_moderator()
        graph2 = create_debate_graph(debaters, judge, moderator=moderator)
        assert graph2 is not None
