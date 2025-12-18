# src/agents/prompt_learning/pattern_detector.py
"""
반복 패턴 감지기

실패 분석 결과에서 반복되는 패턴을 감지하여 학습 기회를 식별합니다.
"""

from dataclasses import dataclass, field
from collections import defaultdict
from datetime import datetime

from .failure_analyzer import FailureAnalysis, FailureCategory


@dataclass
class Pattern:
    """반복 패턴"""

    pattern_id: str
    category: FailureCategory
    description: str
    occurrence_count: int
    first_seen: str
    last_seen: str
    affected_sessions: list[str]
    trend: str  # "increasing", "decreasing", "stable"

    @property
    def is_critical(self) -> bool:
        """심각한 패턴 여부"""
        return self.occurrence_count >= 5 or self.category in {
            FailureCategory.PHASE_VIOLATION,
            FailureCategory.VALIDATION_SKIP,
        }

    def to_dict(self) -> dict:
        """딕셔너리로 변환"""
        return {
            "pattern_id": self.pattern_id,
            "category": self.category.value,
            "description": self.description,
            "occurrence_count": self.occurrence_count,
            "first_seen": self.first_seen,
            "last_seen": self.last_seen,
            "affected_sessions": self.affected_sessions,
            "trend": self.trend,
            "is_critical": self.is_critical,
        }


@dataclass
class PatternReport:
    """패턴 분석 리포트"""

    total_patterns: int
    critical_patterns: int
    patterns: list[Pattern]
    recommendations: list[str]
    generated_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_markdown(self) -> str:
        """마크다운 형식 리포트"""
        lines = ["# 반복 패턴 분석 리포트\n"]
        lines.append(f"생성 시각: {self.generated_at}\n")
        lines.append("## 요약\n")
        lines.append(f"- 총 패턴: {self.total_patterns}개")
        lines.append(f"- 심각 패턴: {self.critical_patterns}개\n")

        if self.patterns:
            lines.append("## 상세 패턴\n")
            lines.append("| 카테고리 | 설명 | 발생 | 추세 |")
            lines.append("|----------|------|------|------|")
            for p in sorted(self.patterns, key=lambda x: -x.occurrence_count):
                lines.append(
                    f"| {p.category.value} | {p.description} | "
                    f"{p.occurrence_count}회 | {p.trend} |"
                )

        if self.recommendations:
            lines.append("\n## 권장 사항\n")
            for i, rec in enumerate(self.recommendations, 1):
                lines.append(f"{i}. {rec}")

        return "\n".join(lines)


class PatternDetector:
    """반복 패턴 감지기"""

    def __init__(self, min_occurrences: int = 2):
        """
        Args:
            min_occurrences: 패턴으로 인식할 최소 발생 횟수
        """
        self.min_occurrences = min_occurrences
        self._pattern_counts: dict[str, dict] = defaultdict(
            lambda: {
                "count": 0,
                "sessions": [],
                "first_seen": None,
                "last_seen": None,
                "category": None,
                "description": None,
            }
        )

    def add_analysis(self, analysis: FailureAnalysis) -> None:
        """
        분석 결과 추가

        Args:
            analysis: 실패 분석 결과
        """
        timestamp = datetime.now().isoformat()

        for cause in analysis.causes:
            pattern_key = f"{cause.category.value}:{cause.description}"
            pattern_data = self._pattern_counts[pattern_key]

            pattern_data["count"] += 1
            pattern_data["sessions"].append(analysis.session_id)
            pattern_data["category"] = cause.category
            pattern_data["description"] = cause.description

            if pattern_data["first_seen"] is None:
                pattern_data["first_seen"] = timestamp
            pattern_data["last_seen"] = timestamp

    def detect_patterns(self) -> list[Pattern]:
        """
        패턴 감지

        Returns:
            감지된 패턴 목록
        """
        patterns = []

        for pattern_key, data in self._pattern_counts.items():
            if data["count"] >= self.min_occurrences:
                trend = self._calculate_trend(data["sessions"])
                pattern = Pattern(
                    pattern_id=pattern_key,
                    category=data["category"],
                    description=data["description"],
                    occurrence_count=data["count"],
                    first_seen=data["first_seen"],
                    last_seen=data["last_seen"],
                    affected_sessions=data["sessions"],
                    trend=trend,
                )
                patterns.append(pattern)

        return patterns

    def _calculate_trend(self, sessions: list[str]) -> str:
        """추세 계산"""
        if len(sessions) < 3:
            return "stable"

        # 간단한 추세: 최근 발생이 더 많으면 increasing
        mid = len(sessions) // 2
        first_half = len(sessions[:mid])
        second_half = len(sessions[mid:])

        if second_half > first_half * 1.5:
            return "increasing"
        elif first_half > second_half * 1.5:
            return "decreasing"
        return "stable"

    def generate_report(self) -> PatternReport:
        """
        패턴 리포트 생성

        Returns:
            패턴 리포트
        """
        patterns = self.detect_patterns()
        critical_count = sum(1 for p in patterns if p.is_critical)

        recommendations = self._generate_recommendations(patterns)

        return PatternReport(
            total_patterns=len(patterns),
            critical_patterns=critical_count,
            patterns=patterns,
            recommendations=recommendations,
        )

    def _generate_recommendations(self, patterns: list[Pattern]) -> list[str]:
        """권장 사항 생성"""
        recommendations = []

        # 카테고리별 권장 사항
        category_recs = {
            FailureCategory.PHASE_VIOLATION: "Phase 순서를 엄격히 따르세요. Phase 0부터 시작하여 순차적으로 진행합니다.",
            FailureCategory.PATH_ERROR: "절대 경로를 사용하고 파일 존재를 먼저 확인하세요.",
            FailureCategory.VALIDATION_SKIP: "검증을 건너뛰지 마세요. 실패한 경우 현재 Phase에서 문제를 해결하세요.",
            FailureCategory.TDD_VIOLATION: "/tdd 명령어를 사용하여 TDD 워크플로우를 따르세요.",
            FailureCategory.TOOL_ERROR: "도구 호출 전 파라미터를 검증하세요.",
            FailureCategory.TIMEOUT: "복잡한 작업을 더 작은 단위로 나누세요.",
            FailureCategory.PERMISSION_DENIED: "파일/디렉토리 권한을 확인하세요.",
        }

        seen_categories = set()
        for pattern in sorted(patterns, key=lambda p: -p.occurrence_count):
            if pattern.category not in seen_categories:
                seen_categories.add(pattern.category)
                if pattern.category in category_recs:
                    recommendations.append(category_recs[pattern.category])

        # 추세 기반 권장 사항
        increasing_patterns = [p for p in patterns if p.trend == "increasing"]
        if increasing_patterns:
            recommendations.append(
                f"주의: {len(increasing_patterns)}개 패턴이 증가 추세입니다. 즉시 조치가 필요합니다."
            )

        return recommendations[:5]

    def get_critical_patterns(self) -> list[Pattern]:
        """심각한 패턴만 반환"""
        return [p for p in self.detect_patterns() if p.is_critical]

    def reset(self) -> None:
        """패턴 데이터 초기화"""
        self._pattern_counts.clear()

    def get_pattern_by_category(self, category: FailureCategory) -> list[Pattern]:
        """카테고리별 패턴 조회"""
        return [p for p in self.detect_patterns() if p.category == category]


# 편의 함수
def detect_patterns_from_analyses(
    analyses: list[FailureAnalysis], min_occurrences: int = 2
) -> PatternReport:
    """
    여러 분석 결과에서 패턴 감지

    Args:
        analyses: 실패 분석 결과 목록
        min_occurrences: 최소 발생 횟수

    Returns:
        패턴 리포트
    """
    detector = PatternDetector(min_occurrences=min_occurrences)
    for analysis in analyses:
        detector.add_analysis(analysis)
    return detector.generate_report()
