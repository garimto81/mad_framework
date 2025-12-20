"""MAD (Multi-Agent Debate) Framework.

A framework for conducting debates between multiple LLM agents
to improve answer quality through structured argumentation.
"""

from mad.core.config import DebateConfig, MADConfig
from mad.core.orchestrator import MAD
from mad.core.state import DebateMessage, DebateState

__version__ = "0.1.0"

__all__ = [
    "MAD",
    "MADConfig",
    "DebateConfig",
    "DebateState",
    "DebateMessage",
]
