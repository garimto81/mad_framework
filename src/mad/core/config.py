"""Configuration management for MAD Framework."""

from __future__ import annotations

from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class MADConfig(BaseSettings):
    """Global configuration for MAD Framework."""

    model_config = SettingsConfigDict(
        env_prefix="MAD_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Defaults
    default_provider: Literal["anthropic", "openai", "google"] = "anthropic"
    default_model: str = "claude-sonnet-4-20250514"
    max_rounds: int = Field(default=3, ge=1, le=10)
    log_level: str = "INFO"


class DebaterConfig(BaseSettings):
    """Configuration for a single debater agent."""

    model_config = SettingsConfigDict(extra="ignore")

    provider: Literal["anthropic", "openai", "google"] = "anthropic"
    model: str = "claude-sonnet-4-20250514"
    perspective: str | None = None
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    system_prompt: str | None = None


class JudgeConfig(BaseSettings):
    """Configuration for the judge agent."""

    model_config = SettingsConfigDict(extra="ignore")

    provider: Literal["anthropic", "openai", "google"] = "anthropic"
    model: str = "claude-sonnet-4-20250514"
    temperature: float = Field(default=0.3, ge=0.0, le=2.0)
    system_prompt: str | None = None


class DebateConfig(BaseSettings):
    """Configuration for a debate session."""

    model_config = SettingsConfigDict(extra="ignore")

    # Preset (optional)
    preset: str | None = None

    # Debaters
    debaters: list[DebaterConfig] = Field(default_factory=list)

    # Judge
    judge: JudgeConfig = Field(default_factory=JudgeConfig)

    # Debate parameters
    max_rounds: int = Field(default=3, ge=1, le=10)
    early_stop_on_consensus: bool = True
    consensus_threshold: float = Field(default=0.8, ge=0.0, le=1.0)

    # Output settings
    include_reasoning: bool = True
    include_dissenting: bool = True
