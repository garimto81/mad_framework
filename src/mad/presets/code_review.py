"""Code review preset for MAD Framework."""

from __future__ import annotations

from mad.core.config import DebaterConfig, JudgeConfig
from mad.presets.base import Preset

CODE_REVIEW_DEBATER_PROMPT = """You are an expert code reviewer participating in a multi-agent code review.

Your role is to analyze code from the perspective of {perspective}.

When reviewing code:
1. Identify specific issues with line references when possible
2. Explain WHY something is problematic, not just WHAT
3. Suggest concrete improvements with code examples
4. Prioritize issues by severity (critical, major, minor)
5. Acknowledge good practices when you see them

Be constructive and specific. Avoid vague criticisms.
Support your points with reasoning and best practices."""

CODE_REVIEW_JUDGE_PROMPT = """You are a senior code reviewer synthesizing feedback from multiple reviewers.

Your responsibilities:
1. Consolidate duplicate issues from different reviewers
2. Prioritize issues by impact and severity
3. Resolve conflicting recommendations
4. Provide actionable final recommendations

Output a clear, prioritized list of improvements with:
- Severity level (critical/major/minor)
- Specific location (file, function, line if available)
- Clear description of the issue
- Recommended fix or improvement"""


class CodeReviewPreset(Preset):
    """Preset for multi-perspective code review.

    Uses three reviewers focusing on:
    - Security vulnerabilities
    - Performance optimization
    - Code maintainability

    Example:
        ```python
        from mad import MAD
        from mad.presets import CodeReviewPreset

        preset = CodeReviewPreset()
        mad = MAD(preset.to_config())

        result = await mad.debate(
            topic="Review this Python function",
            context='''
            def process_user_input(data):
                query = f"SELECT * FROM users WHERE id = {data['id']}"
                return db.execute(query)
            '''
        )
        ```
    """

    @property
    def name(self) -> str:
        return "code_review"

    @property
    def description(self) -> str:
        return "Multi-perspective code review (security, performance, maintainability)"

    def get_debater_configs(self) -> list[DebaterConfig]:
        perspectives = [
            ("security", "security vulnerabilities, injection attacks, data exposure"),
            ("performance", "algorithmic efficiency, memory usage, scalability"),
            ("maintainability", "readability, SOLID principles, testability"),
        ]

        return [
            DebaterConfig(
                provider="anthropic",
                model="claude-sonnet-4-20250514",
                perspective=name,
                temperature=0.5,
                system_prompt=CODE_REVIEW_DEBATER_PROMPT.format(perspective=desc),
            )
            for name, desc in perspectives
        ]

    def get_judge_config(self) -> JudgeConfig:
        return JudgeConfig(
            provider="anthropic",
            model="claude-sonnet-4-20250514",
            temperature=0.3,
            system_prompt=CODE_REVIEW_JUDGE_PROMPT,
        )

    def get_max_rounds(self) -> int:
        return 2  # Code review usually converges quickly

    def get_consensus_threshold(self) -> float:
        return 0.7  # Allow some disagreement on minor issues
