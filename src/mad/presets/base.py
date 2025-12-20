"""Base preset class for MAD Framework."""

from __future__ import annotations

from abc import ABC, abstractmethod

from mad.core.config import DebateConfig, DebaterConfig, JudgeConfig


class Preset(ABC):
    """Abstract base class for debate presets.

    Presets provide pre-configured debate settings for common use cases.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Return the preset name."""
        ...

    @property
    @abstractmethod
    def description(self) -> str:
        """Return a description of the preset."""
        ...

    @abstractmethod
    def get_debater_configs(self) -> list[DebaterConfig]:
        """Return the debater configurations for this preset."""
        ...

    @abstractmethod
    def get_judge_config(self) -> JudgeConfig:
        """Return the judge configuration for this preset."""
        ...

    def get_max_rounds(self) -> int:
        """Return the recommended max rounds for this preset."""
        return 3

    def get_consensus_threshold(self) -> float:
        """Return the consensus threshold for early stopping."""
        return 0.8

    def to_config(self) -> DebateConfig:
        """Convert preset to a DebateConfig.

        Returns:
            DebateConfig with preset settings applied.
        """
        return DebateConfig(
            preset=self.name,
            debaters=self.get_debater_configs(),
            judge=self.get_judge_config(),
            max_rounds=self.get_max_rounds(),
            early_stop_on_consensus=True,
            consensus_threshold=self.get_consensus_threshold(),
        )
