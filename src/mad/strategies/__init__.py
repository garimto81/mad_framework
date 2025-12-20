"""Debate strategies for MAD Framework."""

from mad.strategies.base import DebateStrategy
from mad.strategies.round_robin import RoundRobinStrategy

__all__ = [
    "DebateStrategy",
    "RoundRobinStrategy",
]
