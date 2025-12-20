"""Agent definitions for MAD Framework."""

from mad.agents.base import BaseAgent
from mad.agents.debater import DebaterAgent
from mad.agents.judge import JudgeAgent
from mad.agents.moderator import ModeratorAgent

__all__ = [
    "BaseAgent",
    "DebaterAgent",
    "JudgeAgent",
    "ModeratorAgent",
]
