# src/agents/prompt_learning/claude_md_updater.py
"""
CLAUDE.md 자동 업데이터

실패 분석 결과를 바탕으로 CLAUDE.md 개선 제안을 생성합니다.
"""

from dataclasses import dataclass, field
from typing import Optional
from pathlib import Path
from datetime import datetime
import re
import shutil

from .failure_analyzer import FailureCategory
from .pattern_detector import Pattern, PatternReport


@dataclass
class UpdateProposal:
    """CLAUDE.md 업데이트 제안"""

    proposal_id: str
    section: str
    original_content: str
    proposed_content: str
    reason: str
    confidence: float
    source_patterns: list[str] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    @property
    def is_high_confidence(self) -> bool:
        """높은 신뢰도 여부"""
        return self.confidence >= 0.8

    def to_dict(self) -> dict:
        """딕셔너리로 변환"""
        return {
            "proposal_id": self.proposal_id,
            "section": self.section,
            "original_content": self.original_content,
            "proposed_content": self.proposed_content,
            "reason": self.reason,
            "confidence": self.confidence,
            "source_patterns": self.source_patterns,
            "created_at": self.created_at,
            "is_high_confidence": self.is_high_confidence,
        }


@dataclass
class UpdateResult:
    """업데이트 결과"""

    success: bool
    proposals_applied: int
    backup_path: Optional[str] = None
    error_message: Optional[str] = None


class ClaudeMDUpdater:
    """CLAUDE.md 자동 업데이터"""

    # 섹션 매핑
    SECTION_MAP = {
        FailureCategory.PHASE_VIOLATION: "3. Workflow Pipeline",
        FailureCategory.PATH_ERROR: "1. Critical Instructions",
        FailureCategory.VALIDATION_SKIP: "1. Critical Instructions",
        FailureCategory.TDD_VIOLATION: "9. Complex Feature Protocol",
        FailureCategory.TOOL_ERROR: "2. Build & Test Commands",
        FailureCategory.PERMISSION_DENIED: "1. Critical Instructions",
    }

    def __init__(self, claude_md_path: Optional[str] = None):
        """
        Args:
            claude_md_path: CLAUDE.md 파일 경로
        """
        self.claude_md_path = Path(claude_md_path) if claude_md_path else None
        self._proposals: list[UpdateProposal] = []
        self._applied_proposals: list[str] = []

    def set_path(self, path: str) -> None:
        """CLAUDE.md 경로 설정"""
        self.claude_md_path = Path(path)

    def generate_proposal(
        self, pattern: Pattern, analysis_summary: Optional[str] = None
    ) -> Optional[UpdateProposal]:
        """
        패턴에서 업데이트 제안 생성

        Args:
            pattern: 감지된 패턴
            analysis_summary: 분석 요약

        Returns:
            업데이트 제안 (또는 None)
        """
        section = self.SECTION_MAP.get(pattern.category)
        if not section:
            return None

        # 제안 내용 생성
        proposed_content = self._generate_content(pattern)
        if not proposed_content:
            return None

        proposal = UpdateProposal(
            proposal_id=f"prop-{pattern.pattern_id}-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            section=section,
            original_content="",  # 원본은 apply 시 채움
            proposed_content=proposed_content,
            reason=f"{pattern.description} 패턴이 {pattern.occurrence_count}회 발생",
            confidence=min(0.5 + (pattern.occurrence_count * 0.1), 0.95),
            source_patterns=[pattern.pattern_id],
        )

        self._proposals.append(proposal)
        return proposal

    def _generate_content(self, pattern: Pattern) -> Optional[str]:
        """패턴에서 추가할 내용 생성"""
        templates = {
            FailureCategory.PHASE_VIOLATION: (
                "**경고**: Phase {count}회 위반 감지됨. "
                "Phase는 반드시 순차적으로 진행하세요 (0 → 0.5 → 1 → ...)."
            ),
            FailureCategory.PATH_ERROR: (
                "**주의**: 경로 오류 {count}회 발생. "
                "항상 절대 경로를 사용하고 파일 존재 여부를 먼저 확인하세요."
            ),
            FailureCategory.VALIDATION_SKIP: (
                "**금지**: 검증 건너뛰기 시도 {count}회 감지. "
                "검증 실패 시 현재 Phase에서 문제를 수정하세요."
            ),
            FailureCategory.TDD_VIOLATION: (
                "**TDD 필수**: TDD 위반 {count}회 감지. "
                "테스트를 먼저 작성하세요 (Red → Green → Refactor)."
            ),
            FailureCategory.TOOL_ERROR: (
                "**도구 사용**: 도구 오류 {count}회 발생. "
                "도구 호출 전 파라미터를 검증하세요."
            ),
            FailureCategory.PERMISSION_DENIED: (
                "**권한**: 권한 오류 {count}회 발생. "
                "파일/디렉토리 권한을 먼저 확인하세요."
            ),
        }

        template = templates.get(pattern.category)
        if template:
            return template.format(count=pattern.occurrence_count)
        return None

    def generate_proposals_from_report(
        self, report: PatternReport
    ) -> list[UpdateProposal]:
        """
        패턴 리포트에서 제안 일괄 생성

        Args:
            report: 패턴 분석 리포트

        Returns:
            생성된 제안 목록
        """
        proposals = []
        for pattern in report.patterns:
            proposal = self.generate_proposal(pattern)
            if proposal:
                proposals.append(proposal)
        return proposals

    def preview_changes(self) -> str:
        """
        변경 사항 미리보기

        Returns:
            마크다운 형식 미리보기
        """
        if not self._proposals:
            return "적용할 제안이 없습니다."

        lines = ["# CLAUDE.md 변경 제안 미리보기\n"]

        for proposal in self._proposals:
            lines.append(f"## {proposal.section}\n")
            lines.append(f"**이유**: {proposal.reason}\n")
            lines.append(f"**신뢰도**: {proposal.confidence:.0%}\n")
            lines.append("**추가 내용**:")
            lines.append(f"```\n{proposal.proposed_content}\n```\n")

        return "\n".join(lines)

    def apply_proposals(
        self, proposals: Optional[list[UpdateProposal]] = None, backup: bool = True
    ) -> UpdateResult:
        """
        제안 적용

        Args:
            proposals: 적용할 제안 목록 (없으면 모든 제안)
            backup: 백업 생성 여부

        Returns:
            업데이트 결과
        """
        if not self.claude_md_path:
            return UpdateResult(
                success=False,
                proposals_applied=0,
                error_message="CLAUDE.md 경로가 설정되지 않았습니다",
            )

        if not self.claude_md_path.exists():
            return UpdateResult(
                success=False,
                proposals_applied=0,
                error_message=f"파일을 찾을 수 없습니다: {self.claude_md_path}",
            )

        proposals = proposals or self._proposals
        if not proposals:
            return UpdateResult(success=True, proposals_applied=0)

        # 백업 생성
        backup_path = None
        if backup:
            backup_path = (
                str(self.claude_md_path)
                + f".backup.{datetime.now().strftime('%Y%m%d%H%M%S')}"
            )
            shutil.copy(self.claude_md_path, backup_path)

        try:
            content = self.claude_md_path.read_text(encoding="utf-8")

            applied_count = 0
            for proposal in proposals:
                if proposal.is_high_confidence:
                    content = self._apply_single_proposal(content, proposal)
                    applied_count += 1
                    self._applied_proposals.append(proposal.proposal_id)

            self.claude_md_path.write_text(content, encoding="utf-8")

            return UpdateResult(
                success=True, proposals_applied=applied_count, backup_path=backup_path
            )

        except Exception as e:
            return UpdateResult(
                success=False, proposals_applied=0, error_message=str(e)
            )

    def _apply_single_proposal(self, content: str, proposal: UpdateProposal) -> str:
        """단일 제안 적용"""
        # 섹션 찾기
        section_pattern = rf"(## {re.escape(proposal.section)}.*?)(?=\n## |\Z)"
        match = re.search(section_pattern, content, re.DOTALL)

        if match:
            section_content = match.group(1)
            # 섹션 끝에 내용 추가
            new_section = (
                section_content.rstrip() + f"\n\n{proposal.proposed_content}\n"
            )
            content = content[: match.start()] + new_section + content[match.end() :]

        return content

    def rollback(self, backup_path: str) -> bool:
        """
        백업에서 롤백

        Args:
            backup_path: 백업 파일 경로

        Returns:
            성공 여부
        """
        if not self.claude_md_path:
            return False

        backup = Path(backup_path)
        if not backup.exists():
            return False

        try:
            shutil.copy(backup, self.claude_md_path)
            return True
        except Exception:
            return False

    def get_proposals(self) -> list[UpdateProposal]:
        """현재 제안 목록 반환"""
        return self._proposals.copy()

    def get_applied_proposals(self) -> list[str]:
        """적용된 제안 ID 목록 반환"""
        return self._applied_proposals.copy()

    def clear_proposals(self) -> None:
        """제안 목록 초기화"""
        self._proposals.clear()


# 편의 함수
def create_updater(claude_md_path: str) -> ClaudeMDUpdater:
    """업데이터 생성"""
    return ClaudeMDUpdater(claude_md_path)


def propose_update(pattern: Pattern, claude_md_path: str) -> Optional[UpdateProposal]:
    """단일 패턴에서 제안 생성"""
    updater = create_updater(claude_md_path)
    return updater.generate_proposal(pattern)
