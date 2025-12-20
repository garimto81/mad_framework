"""Tests for MAD Framework configuration."""

import pytest

from mad.core.config import DebateConfig, DebaterConfig, JudgeConfig, MADConfig


class TestMADConfig:
    """Tests for MADConfig."""

    def test_default_values(self):
        """Should have sensible defaults."""
        config = MADConfig()

        assert config.default_provider == "anthropic"
        assert config.default_model == "claude-sonnet-4-20250514"
        assert config.max_rounds == 3
        assert config.log_level == "INFO"


class TestDebaterConfig:
    """Tests for DebaterConfig."""

    def test_default_values(self):
        """Should have sensible defaults."""
        config = DebaterConfig()

        assert config.provider == "anthropic"
        assert config.model == "claude-sonnet-4-20250514"
        assert config.temperature == 0.7
        assert config.perspective is None

    def test_custom_values(self):
        """Should accept custom values."""
        config = DebaterConfig(
            provider="openai",
            model="gpt-4o",
            perspective="security",
            temperature=0.5,
        )

        assert config.provider == "openai"
        assert config.model == "gpt-4o"
        assert config.perspective == "security"
        assert config.temperature == 0.5


class TestJudgeConfig:
    """Tests for JudgeConfig."""

    def test_default_temperature_is_lower(self):
        """Judge should have lower temperature by default."""
        config = JudgeConfig()

        assert config.temperature == 0.3


class TestDebateConfig:
    """Tests for DebateConfig."""

    def test_default_values(self):
        """Should have sensible defaults."""
        config = DebateConfig()

        assert config.max_rounds == 3
        assert config.early_stop_on_consensus is True
        assert config.consensus_threshold == 0.8
        assert config.debaters == []

    def test_with_debaters(self):
        """Should accept debater configurations."""
        config = DebateConfig(
            debaters=[
                DebaterConfig(perspective="security"),
                DebaterConfig(perspective="performance"),
            ],
            max_rounds=5,
        )

        assert len(config.debaters) == 2
        assert config.max_rounds == 5
