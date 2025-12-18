# src/agents/prompt_learning/failure_analyzer.py
"""
실패 분석기

세션 로그에서 실패 패턴을 분석하고 원인을 파악합니다.
"""

from dataclasses import dataclass, field
from typing import Optional
from enum import Enum
import re

from .session_parser import SessionEvent, SessionSummary, EventType


class FailureCategory(Enum):
    """실패 카테고리"""

    PHASE_VIOLATION = "phase_violation"
    PATH_ERROR = "path_error"
    VALIDATION_SKIP = "validation_skip"
    TDD_VIOLATION = "tdd_violation"
    TOOL_ERROR = "tool_error"
    TIMEOUT = "timeout"
    PERMISSION_DENIED = "permission_denied"
    UNKNOWN = "unknown"


@dataclass
class FailureCause:
    """실패 원인"""

    category: FailureCategory
    description: str
    evidence: str
    confidence: float  # 0.0 ~ 1.0
    suggestion: Optional[str] = None


@dataclass
class FailureAnalysis:
    """실패 분석 결과"""

    session_id: str
    causes: list[FailureCause]
    severity: str  # "low", "medium", "high", "critical"
    affected_phase: Optional[int] = None
    is_recoverable: bool = True
    recommendations: list[str] = field(default_factory=list)

    @property
    def primary_cause(self) -> Optional[FailureCause]:
        """가장 신뢰도 높은 원인"""
        if not self.causes:
            return None
        return max(self.causes, key=lambda c: c.confidence)

    def to_dict(self) -> dict:
        """딕셔너리로 변환"""
        return {
            "session_id": self.session_id,
            "causes": [
                {
                    "category": c.category.value,
                    "description": c.description,
                    "evidence": c.evidence,
                    "confidence": c.confidence,
                    "suggestion": c.suggestion,
                }
                for c in self.causes
            ],
            "severity": self.severity,
            "affected_phase": self.affected_phase,
            "is_recoverable": self.is_recoverable,
            "recommendations": self.recommendations,
        }


class FailureAnalyzer:
    """실패 분석기"""

    # 실패 패턴 정의
    FAILURE_PATTERNS = {
        FailureCategory.PHASE_VIOLATION: [
            r"phase\s*(\d+)\s*(?:건너뛰|skip)",
            r"validation\s+fail",
            r"phase\s*검증\s*실패",
        ],
        FailureCategory.PATH_ERROR: [
            r"file\s*not\s*found",
            r"no\s*such\s*file",
            r"경로.*(?:없|찾을 수 없)",
            r"FileNotFoundError",
        ],
        FailureCategory.VALIDATION_SKIP: [
            r"skip.*validation",
            r"검증.*(?:건너뛰|스킵)",
            r"--no-verify",
        ],
        FailureCategory.TDD_VIOLATION: [
            r"(?:구현|implement).*(?:먼저|first).*(?:테스트|test)",
            r"test.*(?:없이|without)",
            r"테스트\s*없이",
        ],
        FailureCategory.TOOL_ERROR: [
            r"tool.*(?:error|fail)",
            r"command.*fail",
            r"exit\s*code\s*[1-9]",
        ],
        FailureCategory.TIMEOUT: [r"timeout", r"시간\s*초과", r"timed?\s*out"],
        FailureCategory.PERMISSION_DENIED: [
            r"permission\s*denied",
            r"access\s*denied",
            r"권한.*(?:없|거부)",
        ],
    }

    def __init__(self):
        self._analysis_history: list[FailureAnalysis] = []

    def analyze_session(
        self,
        session_id: str,
        events: list[SessionEvent],
        summary: Optional[SessionSummary] = None,
    ) -> FailureAnalysis:
        """
        세션 실패 분석

        Args:
            session_id: 세션 ID
            events: 세션 이벤트 목록
            summary: 세션 요약 (선택)

        Returns:
            실패 분석 결과
        """
        causes = []

        # 에러 이벤트 분석
        for event in events:
            if event.error or event.event_type == EventType.ERROR:
                error_text = event.error or str(event.content)
                cause = self._classify_error(error_text)
                if cause:
                    causes.append(cause)

        # 도구 실패 분석
        failed_tools = [
            e
            for e in events
            if e.event_type == EventType.TOOL_RESULT and e.success is False
        ]
        for event in failed_tools:
            cause = FailureCause(
                category=FailureCategory.TOOL_ERROR,
                description=f"도구 호출 실패: {event.tool_name}",
                evidence=str(event.content)[:200],
                confidence=0.8,
                suggestion=f"{event.tool_name} 도구 호출 파라미터를 확인하세요",
            )
            causes.append(cause)

        # 중복 제거
        causes = self._deduplicate_causes(causes)

        # 심각도 결정
        severity = self._determine_severity(causes)

        # 영향받는 Phase 파악
        affected_phase = self._detect_affected_phase(events, causes)

        # 복구 가능 여부
        is_recoverable = severity != "critical"

        # 권장 사항 생성
        recommendations = self._generate_recommendations(causes)

        analysis = FailureAnalysis(
            session_id=session_id,
            causes=causes,
            severity=severity,
            affected_phase=affected_phase,
            is_recoverable=is_recoverable,
            recommendations=recommendations,
        )

        self._analysis_history.append(analysis)
        return analysis

    def _classify_error(self, error_text: str) -> Optional[FailureCause]:
        """에러 텍스트 분류"""
        for category, patterns in self.FAILURE_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, error_text, re.IGNORECASE):
                    return FailureCause(
                        category=category,
                        description=self._get_category_description(category),
                        evidence=error_text[:200],
                        confidence=0.7,
                        suggestion=self._get_category_suggestion(category),
                    )
        return None

    def _get_category_description(self, category: FailureCategory) -> str:
        """카테고리 설명"""
        descriptions = {
            FailureCategory.PHASE_VIOLATION: "Phase 순서 위반",
            FailureCategory.PATH_ERROR: "파일 경로 오류",
            FailureCategory.VALIDATION_SKIP: "검증 건너뛰기 시도",
            FailureCategory.TDD_VIOLATION: "TDD 순서 위반",
            FailureCategory.TOOL_ERROR: "도구 실행 오류",
            FailureCategory.TIMEOUT: "시간 초과",
            FailureCategory.PERMISSION_DENIED: "권한 오류",
            FailureCategory.UNKNOWN: "알 수 없는 오류",
        }
        return descriptions.get(category, "알 수 없는 오류")

    def _get_category_suggestion(self, category: FailureCategory) -> str:
        """카테고리별 제안"""
        suggestions = {
            FailureCategory.PHASE_VIOLATION: "Phase 0부터 순차적으로 진행하세요",
            FailureCategory.PATH_ERROR: "절대 경로를 사용하고 파일 존재를 확인하세요",
            FailureCategory.VALIDATION_SKIP: "검증을 건너뛰지 말고 문제를 수정하세요",
            FailureCategory.TDD_VIOLATION: "테스트를 먼저 작성하세요 (Red → Green → Refactor)",
            FailureCategory.TOOL_ERROR: "도구 파라미터와 권한을 확인하세요",
            FailureCategory.TIMEOUT: "작업을 더 작은 단위로 나누세요",
            FailureCategory.PERMISSION_DENIED: "파일/디렉토리 권한을 확인하세요",
            FailureCategory.UNKNOWN: "로그를 자세히 확인하세요",
        }
        return suggestions.get(category, "로그를 확인하세요")

    def _deduplicate_causes(self, causes: list[FailureCause]) -> list[FailureCause]:
        """중복 원인 제거"""
        seen = set()
        unique = []
        for cause in causes:
            key = (cause.category, cause.description)
            if key not in seen:
                seen.add(key)
                unique.append(cause)
        return unique

    def _determine_severity(self, causes: list[FailureCause]) -> str:
        """심각도 결정"""
        if not causes:
            return "low"

        critical_categories = {
            FailureCategory.PHASE_VIOLATION,
            FailureCategory.VALIDATION_SKIP,
        }
        high_categories = {
            FailureCategory.TDD_VIOLATION,
            FailureCategory.PERMISSION_DENIED,
        }

        for cause in causes:
            if cause.category in critical_categories:
                return "critical"
            if cause.category in high_categories:
                return "high"

        avg_confidence = sum(c.confidence for c in causes) / len(causes)
        if avg_confidence > 0.8:
            return "high"
        if avg_confidence > 0.5:
            return "medium"
        return "low"

    def _detect_affected_phase(
        self, events: list[SessionEvent], causes: list[FailureCause]
    ) -> Optional[int]:
        """영향받는 Phase 탐지"""
        for cause in causes:
            if cause.category == FailureCategory.PHASE_VIOLATION:
                # 에러 메시지에서 Phase 번호 추출
                match = re.search(r"phase\s*(\d+)", cause.evidence, re.IGNORECASE)
                if match:
                    return int(match.group(1))
        return None

    def _generate_recommendations(self, causes: list[FailureCause]) -> list[str]:
        """권장 사항 생성"""
        recommendations = []

        for cause in causes:
            if cause.suggestion and cause.suggestion not in recommendations:
                recommendations.append(cause.suggestion)

        # 일반적인 권장 사항 추가
        if any(c.category == FailureCategory.PATH_ERROR for c in causes):
            recommendations.append("CLAUDE.md의 경로 규칙을 다시 확인하세요")

        if any(c.category == FailureCategory.TDD_VIOLATION for c in causes):
            recommendations.append("/tdd 명령어를 사용하여 TDD 워크플로우를 따르세요")

        return recommendations[:5]  # 최대 5개

    def get_analysis_history(self) -> list[FailureAnalysis]:
        """분석 히스토리 반환"""
        return self._analysis_history.copy()

    def get_common_failures(self) -> dict[FailureCategory, int]:
        """공통 실패 패턴 집계"""
        counts: dict[FailureCategory, int] = {}
        for analysis in self._analysis_history:
            for cause in analysis.causes:
                counts[cause.category] = counts.get(cause.category, 0) + 1
        return counts
