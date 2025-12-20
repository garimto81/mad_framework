"""Preset configurations for common debate scenarios."""

from mad.presets.base import Preset
from mad.presets.code_review import CodeReviewPreset
from mad.presets.decision import DecisionPreset
from mad.presets.qa_accuracy import QAAccuracyPreset

__all__ = [
    "Preset",
    "CodeReviewPreset",
    "QAAccuracyPreset",
    "DecisionPreset",
]
