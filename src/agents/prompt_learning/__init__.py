# src/agents/prompt_learning/__init__.py
"""
Prompt Learning 피드백 루프 시스템

강화 학습(RL) 기반 CLAUDE.md 자동 개선 시스템
"""

from .session_parser import SessionParser, SessionEvent, SessionSummary
from .failure_analyzer import FailureAnalyzer, FailureAnalysis, FailureCategory
from .pattern_detector import PatternDetector, Pattern, PatternReport
from .claude_md_updater import ClaudeMDUpdater, UpdateProposal, UpdateResult
from .dspy_optimizer import DSPyOptimizer, PhaseSignature, OptimizationResult
from .textgrad_optimizer import TextGradOptimizer, TextGradient, AgentOptimizationResult
from .ab_test import ABTestFramework, ABTestConfig, ABTestResult, Variant
from .metrics import (
    MetricsCollector,
    PhaseMetrics,
    SessionMetrics,
    PromptLearningMetrics,
)

__all__ = [
    # Session Parser
    "SessionParser",
    "SessionEvent",
    "SessionSummary",
    # Failure Analyzer
    "FailureAnalyzer",
    "FailureAnalysis",
    "FailureCategory",
    # Pattern Detector
    "PatternDetector",
    "Pattern",
    "PatternReport",
    # CLAUDE.md Updater
    "ClaudeMDUpdater",
    "UpdateProposal",
    "UpdateResult",
    # DSPy Optimizer
    "DSPyOptimizer",
    "PhaseSignature",
    "OptimizationResult",
    # TextGrad Optimizer
    "TextGradOptimizer",
    "TextGradient",
    "AgentOptimizationResult",
    # A/B Test
    "ABTestFramework",
    "ABTestConfig",
    "ABTestResult",
    "Variant",
    # Metrics
    "MetricsCollector",
    "PhaseMetrics",
    "SessionMetrics",
    "PromptLearningMetrics",
]

__version__ = "1.0.0"
