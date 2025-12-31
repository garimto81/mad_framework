"""Tests for cost tracking utilities."""

import pytest

from mad.utils.cost import CostEntry, CostSummary, CostTracker


class TestCostEntry:
    """Tests for CostEntry dataclass."""

    def test_creates_entry_with_required_fields(self):
        """CostEntry should create with all required fields."""
        entry = CostEntry(
            provider="anthropic",
            model="claude-sonnet-4-20250514",
            input_tokens=100,
            output_tokens=50,
            cost=0.001,
        )

        assert entry.provider == "anthropic"
        assert entry.model == "claude-sonnet-4-20250514"
        assert entry.input_tokens == 100
        assert entry.output_tokens == 50
        assert entry.cost == 0.001
        assert entry.timestamp  # auto-generated

    def test_timestamp_auto_generated(self):
        """Timestamp should be auto-generated in ISO format."""
        entry = CostEntry(
            provider="openai",
            model="gpt-4o",
            input_tokens=200,
            output_tokens=100,
            cost=0.005,
        )

        # Check ISO format (contains T separator)
        assert "T" in entry.timestamp


class TestCostSummary:
    """Tests for CostSummary dataclass."""

    def test_creates_summary_with_all_fields(self):
        """CostSummary should store all fields correctly."""
        entries = [
            CostEntry("anthropic", "claude-sonnet", 100, 50, 0.001),
            CostEntry("openai", "gpt-4o", 200, 100, 0.005),
        ]
        summary = CostSummary(
            total_cost=0.006,
            total_input_tokens=300,
            total_output_tokens=150,
            total_tokens=450,
            by_provider={"anthropic": 0.001, "openai": 0.005},
            by_model={"claude-sonnet": 0.001, "gpt-4o": 0.005},
            entries=entries,
        )

        assert summary.total_cost == 0.006
        assert summary.total_input_tokens == 300
        assert summary.total_output_tokens == 150
        assert summary.total_tokens == 450
        assert len(summary.entries) == 2

    def test_str_formatting(self):
        """CostSummary.__str__ should format nicely."""
        summary = CostSummary(
            total_cost=0.0123,
            total_input_tokens=1000,
            total_output_tokens=500,
            total_tokens=1500,
            by_provider={"anthropic": 0.0123},
            by_model={"claude-sonnet": 0.0123},
            entries=[],
        )

        output = str(summary)

        assert "Total Cost: $0.0123" in output
        assert "Total Tokens: 1,500" in output
        assert "Input: 1,000" in output
        assert "Output: 500" in output
        assert "By Provider:" in output
        assert "anthropic: $0.0123" in output
        assert "By Model:" in output
        assert "claude-sonnet: $0.0123" in output


class TestCostTracker:
    """Tests for CostTracker class."""

    def test_initializes_empty(self):
        """CostTracker should initialize with no entries."""
        tracker = CostTracker()

        assert tracker.total_cost == 0.0
        assert tracker.total_tokens == 0

    def test_add_entry(self):
        """CostTracker.add should add an entry."""
        tracker = CostTracker()
        tracker.add(
            provider="anthropic",
            model="claude-sonnet-4-20250514",
            input_tokens=100,
            output_tokens=50,
            cost=0.001,
        )

        assert tracker.total_cost == 0.001
        assert tracker.total_tokens == 150

    def test_add_multiple_entries(self):
        """CostTracker should accumulate multiple entries."""
        tracker = CostTracker()
        tracker.add("anthropic", "claude-sonnet", 100, 50, 0.001)
        tracker.add("openai", "gpt-4o", 200, 100, 0.005)
        tracker.add("anthropic", "claude-sonnet", 150, 75, 0.002)

        assert tracker.total_cost == pytest.approx(0.008)
        assert tracker.total_tokens == 675

    def test_get_summary(self):
        """CostTracker.get_summary should return aggregated data."""
        tracker = CostTracker()
        tracker.add("anthropic", "claude-sonnet", 100, 50, 0.001)
        tracker.add("openai", "gpt-4o", 200, 100, 0.005)
        tracker.add("anthropic", "claude-opus", 300, 150, 0.010)

        summary = tracker.get_summary()

        assert summary.total_cost == pytest.approx(0.016)
        assert summary.total_input_tokens == 600
        assert summary.total_output_tokens == 300
        assert summary.total_tokens == 900
        assert summary.by_provider["anthropic"] == pytest.approx(0.011)
        assert summary.by_provider["openai"] == pytest.approx(0.005)
        assert summary.by_model["claude-sonnet"] == pytest.approx(0.001)
        assert summary.by_model["gpt-4o"] == pytest.approx(0.005)
        assert summary.by_model["claude-opus"] == pytest.approx(0.010)
        assert len(summary.entries) == 3

    def test_reset_clears_entries(self):
        """CostTracker.reset should clear all entries."""
        tracker = CostTracker()
        tracker.add("anthropic", "claude-sonnet", 100, 50, 0.001)
        tracker.add("openai", "gpt-4o", 200, 100, 0.005)

        tracker.reset()

        assert tracker.total_cost == 0.0
        assert tracker.total_tokens == 0
        summary = tracker.get_summary()
        assert len(summary.entries) == 0

    def test_empty_summary(self):
        """CostTracker should return empty summary when no entries."""
        tracker = CostTracker()
        summary = tracker.get_summary()

        assert summary.total_cost == 0.0
        assert summary.total_input_tokens == 0
        assert summary.total_output_tokens == 0
        assert summary.total_tokens == 0
        assert summary.by_provider == {}
        assert summary.by_model == {}
        assert len(summary.entries) == 0
