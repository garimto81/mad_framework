"""Tests for MAD Framework presets."""

from mad.presets import CodeReviewPreset, DecisionPreset, QAAccuracyPreset


class TestCodeReviewPreset:
    """Tests for CodeReviewPreset."""

    def test_name(self):
        """Should have correct name."""
        preset = CodeReviewPreset()
        assert preset.name == "code_review"

    def test_has_three_perspectives(self):
        """Should have security, performance, maintainability perspectives."""
        preset = CodeReviewPreset()
        debaters = preset.get_debater_configs()

        assert len(debaters) == 3
        perspectives = [d.perspective for d in debaters]
        assert "security" in perspectives
        assert "performance" in perspectives
        assert "maintainability" in perspectives

    def test_to_config(self):
        """Should convert to DebateConfig."""
        preset = CodeReviewPreset()
        config = preset.to_config()

        assert config.preset == "code_review"
        assert len(config.debaters) == 3
        assert config.max_rounds == 2


class TestQAAccuracyPreset:
    """Tests for QAAccuracyPreset."""

    def test_name(self):
        """Should have correct name."""
        preset = QAAccuracyPreset()
        assert preset.name == "qa_accuracy"

    def test_higher_consensus_threshold(self):
        """Should have higher consensus threshold for accuracy."""
        preset = QAAccuracyPreset()
        assert preset.get_consensus_threshold() == 0.85


class TestDecisionPreset:
    """Tests for DecisionPreset."""

    def test_name(self):
        """Should have correct name."""
        preset = DecisionPreset()
        assert preset.name == "decision"

    def test_has_strategic_perspectives(self):
        """Should have pragmatist, strategist, risk_analyst."""
        preset = DecisionPreset()
        debaters = preset.get_debater_configs()

        perspectives = [d.perspective for d in debaters]
        assert "pragmatist" in perspectives
        assert "strategist" in perspectives
        assert "risk_analyst" in perspectives
