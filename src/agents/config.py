# src/agents/config.py
"""
Multi-Agent System Configuration
"""

import os
from dataclasses import dataclass, field
from typing import Optional


# Model Tiering Strategy
# 문서에서는 간략히 'sonnet', 'haiku'로 표기
AGENT_MODEL_TIERS = {
    "supervisor": "claude-sonnet-4-20250514",  # sonnet - 복잡한 의사결정
    "lead": "claude-sonnet-4-20250514",  # sonnet - 리드 에이전트
    "researcher": "claude-sonnet-4-20250514",  # sonnet - 일반 태스크
    "coder": "claude-sonnet-4-20250514",  # sonnet - 코드 생성
    "reviewer": "claude-sonnet-4-20250514",  # sonnet - 코드 리뷰
    "validator": "claude-haiku-3-20240307",  # haiku - 간단한 검증 (비용 최적화)
    "default": "claude-sonnet-4-20250514",  # sonnet
}

# Phase별 병렬 에이전트 매핑
PHASE_AGENTS = {
    "phase_0": ["requirements_agent", "stakeholder_agent"],
    "phase_0.5": ["task_decomposer", "dependency_analyzer"],
    "phase_1": ["code_agent", "test_agent", "docs_agent"],
    "phase_2": ["unit_test_runner", "integration_test_runner", "security_scanner"],
    "phase_2.5": ["code_reviewer", "design_reviewer", "security_auditor"],
    "phase_3": ["version_bumper", "changelog_updater"],
    "phase_4": ["commit_agent", "pr_creator"],
}


@dataclass
class AgentConfig:
    """에이전트 설정"""

    name: str
    role: str
    model: str = field(default_factory=lambda: AGENT_MODEL_TIERS["default"])
    system_prompt: Optional[str] = None
    tools: list[str] = field(default_factory=list)
    max_retries: int = 3
    timeout_seconds: int = 120
    context_isolation: bool = True

    def __post_init__(self):
        if self.system_prompt is None:
            self.system_prompt = (
                f"당신은 {self.role} 역할을 담당하는 AI 에이전트입니다."
            )


# 기본 에이전트 설정
DEFAULT_AGENTS = {
    "supervisor": AgentConfig(
        name="supervisor",
        role="작업 분배 및 조율",
        model=AGENT_MODEL_TIERS["supervisor"],
        system_prompt="""당신은 멀티 에이전트 시스템의 Supervisor입니다.
주어진 태스크를 분석하고 적절한 서브태스크로 분해하세요.
각 서브태스크는 독립적으로 실행 가능해야 합니다.""",
    ),
    "researcher": AgentConfig(
        name="researcher",
        role="정보 수집 및 분석",
        model=AGENT_MODEL_TIERS["researcher"],
        tools=["web_search", "read_file"],
    ),
    "coder": AgentConfig(
        name="coder",
        role="코드 작성",
        model=AGENT_MODEL_TIERS["coder"],
        tools=["write_file", "edit_file", "bash"],
    ),
    "reviewer": AgentConfig(
        name="reviewer",
        role="코드 리뷰",
        model=AGENT_MODEL_TIERS["reviewer"],
        tools=["read_file", "grep"],
    ),
    "tester": AgentConfig(
        name="tester",
        role="테스트 실행",
        model=AGENT_MODEL_TIERS["validator"],
        tools=["bash"],
    ),
}


def get_api_key() -> str:
    """Anthropic API 키 가져오기"""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError(
            "ANTHROPIC_API_KEY 환경 변수가 설정되지 않았습니다. "
            ".env 파일 또는 환경 변수로 설정하세요."
        )
    return api_key
