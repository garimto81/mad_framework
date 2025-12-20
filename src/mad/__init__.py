"""MAD (Multi-Agent Debate) Framework.

A framework for conducting debates between multiple LLM agents
to improve answer quality through structured argumentation.
"""

from mad.core.config import MADConfig, DebateConfig
from mad.core.orchestrator import MAD
from mad.core.state import DebateState, DebateMessage

__version__ = "0.1.0"

__all__ = [
    "MAD",
    "MADConfig",
    "DebateConfig",
    "DebateState",
    "DebateMessage",
]
