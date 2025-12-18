# src/agents/prompt_learning/metrics.py
"""
Prompt Learning 메트릭스

시스템 성능을 측정하고 추적합니다.
"""

from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime, timedelta
from collections import defaultdict
import json


@dataclass
class PhaseMetrics:
    """Phase별 메트릭스"""

    phase: int
    attempts: int = 0
    successes: int = 0
    failures: int = 0
    avg_duration_seconds: float = 0.0
    avg_token_usage: int = 0

    @property
    def success_rate(self) -> float:
        """성공률"""
        if self.attempts == 0:
            return 0.0
        return self.successes / self.attempts

    @property
    def failure_rate(self) -> float:
        """실패율"""
        if self.attempts == 0:
            return 0.0
        return self.failures / self.attempts

    def to_dict(self) -> dict:
        """딕셔너리로 변환"""
        return {
            "phase": self.phase,
            "attempts": self.attempts,
            "successes": self.successes,
            "failures": self.failures,
            "success_rate": self.success_rate,
            "failure_rate": self.failure_rate,
            "avg_duration_seconds": self.avg_duration_seconds,
            "avg_token_usage": self.avg_token_usage,
        }


@dataclass
class SessionMetrics:
    """세션 메트릭스"""

    session_id: str
    start_time: str
    end_time: Optional[str] = None
    duration_seconds: float = 0.0
    token_usage: int = 0
    phases_attempted: list[int] = field(default_factory=list)
    phases_completed: list[int] = field(default_factory=list)
    errors_count: int = 0
    success: bool = False

    def to_dict(self) -> dict:
        """딕셔너리로 변환"""
        return {
            "session_id": self.session_id,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "duration_seconds": self.duration_seconds,
            "token_usage": self.token_usage,
            "phases_attempted": self.phases_attempted,
            "phases_completed": self.phases_completed,
            "errors_count": self.errors_count,
            "success": self.success,
        }


@dataclass
class PromptLearningMetrics:
    """전체 Prompt Learning 메트릭스"""

    total_sessions: int = 0
    successful_sessions: int = 0
    failed_sessions: int = 0
    total_tokens: int = 0
    avg_session_duration: float = 0.0
    phase_metrics: dict[int, PhaseMetrics] = field(default_factory=dict)
    period_start: Optional[str] = None
    period_end: Optional[str] = None

    @property
    def overall_success_rate(self) -> float:
        """전체 성공률"""
        if self.total_sessions == 0:
            return 0.0
        return self.successful_sessions / self.total_sessions

    def to_dict(self) -> dict:
        """딕셔너리로 변환"""
        return {
            "total_sessions": self.total_sessions,
            "successful_sessions": self.successful_sessions,
            "failed_sessions": self.failed_sessions,
            "overall_success_rate": self.overall_success_rate,
            "total_tokens": self.total_tokens,
            "avg_session_duration": self.avg_session_duration,
            "phase_metrics": {
                str(k): v.to_dict() for k, v in self.phase_metrics.items()
            },
            "period_start": self.period_start,
            "period_end": self.period_end,
        }

    def to_markdown(self) -> str:
        """마크다운 형식 리포트"""
        lines = ["# Prompt Learning 메트릭스 리포트\n"]

        if self.period_start and self.period_end:
            lines.append(f"기간: {self.period_start} ~ {self.period_end}\n")

        lines.append("## 요약\n")
        lines.append(f"- 총 세션: {self.total_sessions}개")
        lines.append(f"- 성공: {self.successful_sessions}개")
        lines.append(f"- 실패: {self.failed_sessions}개")
        lines.append(f"- 전체 성공률: {self.overall_success_rate:.1%}")
        lines.append(f"- 총 토큰 사용량: {self.total_tokens:,}")
        lines.append(f"- 평균 세션 시간: {self.avg_session_duration:.1f}초\n")

        if self.phase_metrics:
            lines.append("## Phase별 메트릭스\n")
            lines.append("| Phase | 시도 | 성공 | 실패 | 성공률 |")
            lines.append("|-------|------|------|------|--------|")
            for phase in sorted(self.phase_metrics.keys()):
                pm = self.phase_metrics[phase]
                lines.append(
                    f"| {phase} | {pm.attempts} | {pm.successes} | "
                    f"{pm.failures} | {pm.success_rate:.1%} |"
                )

        return "\n".join(lines)


class MetricsCollector:
    """메트릭스 수집기"""

    def __init__(self):
        self._sessions: dict[str, SessionMetrics] = {}
        self._phase_data: dict[int, list[dict]] = defaultdict(list)
        # 증분 집계용 (Quick Win: 실시간 집계)
        self._total_tokens: int = 0
        self._successful_sessions: int = 0
        self._failed_sessions: int = 0
        self._total_duration: float = 0.0

    def start_session(self, session_id: str) -> SessionMetrics:
        """
        세션 시작

        Args:
            session_id: 세션 ID

        Returns:
            세션 메트릭스
        """
        session = SessionMetrics(
            session_id=session_id, start_time=datetime.now().isoformat()
        )
        self._sessions[session_id] = session
        return session

    def end_session(
        self, session_id: str, success: bool, token_usage: int = 0
    ) -> Optional[SessionMetrics]:
        """
        세션 종료

        Args:
            session_id: 세션 ID
            success: 성공 여부
            token_usage: 토큰 사용량

        Returns:
            세션 메트릭스
        """
        if session_id not in self._sessions:
            return None

        session = self._sessions[session_id]
        session.end_time = datetime.now().isoformat()
        session.success = success
        session.token_usage = token_usage

        # duration 계산
        try:
            start = datetime.fromisoformat(session.start_time)
            end = datetime.fromisoformat(session.end_time)
            session.duration_seconds = (end - start).total_seconds()
        except Exception:
            session.duration_seconds = 0.0

        # 증분 집계 업데이트 (Quick Win: 실시간 반영)
        self._total_tokens += token_usage
        self._total_duration += session.duration_seconds
        if success:
            self._successful_sessions += 1
        else:
            self._failed_sessions += 1

        return session

    def record_phase_attempt(
        self,
        session_id: str,
        phase: int,
        success: bool,
        duration_seconds: float = 0.0,
        token_usage: int = 0,
    ) -> None:
        """
        Phase 시도 기록

        Args:
            session_id: 세션 ID
            phase: Phase 번호
            success: 성공 여부
            duration_seconds: 소요 시간
            token_usage: 토큰 사용량
        """
        self._phase_data[phase].append(
            {
                "session_id": session_id,
                "success": success,
                "duration_seconds": duration_seconds,
                "token_usage": token_usage,
                "timestamp": datetime.now().isoformat(),
            }
        )

        if session_id in self._sessions:
            session = self._sessions[session_id]
            if phase not in session.phases_attempted:
                session.phases_attempted.append(phase)
            if success and phase not in session.phases_completed:
                session.phases_completed.append(phase)
            if not success:
                session.errors_count += 1

    def record_error(self, session_id: str) -> None:
        """에러 기록"""
        if session_id in self._sessions:
            self._sessions[session_id].errors_count += 1

    def get_metrics(self, period_days: Optional[int] = None) -> PromptLearningMetrics:
        """
        메트릭스 조회

        Args:
            period_days: 기간 (일) - None이면 전체

        Returns:
            Prompt Learning 메트릭스
        """
        # 기간 필터링
        if period_days:
            cutoff = datetime.now() - timedelta(days=period_days)
            sessions = {
                k: v
                for k, v in self._sessions.items()
                if datetime.fromisoformat(v.start_time) >= cutoff
            }
        else:
            sessions = self._sessions

        # 세션 통계
        total = len(sessions)
        successful = sum(1 for s in sessions.values() if s.success)
        failed = total - successful
        total_tokens = sum(s.token_usage for s in sessions.values())
        durations = [
            s.duration_seconds for s in sessions.values() if s.duration_seconds > 0
        ]
        avg_duration = sum(durations) / len(durations) if durations else 0.0

        # Phase별 통계
        phase_metrics = {}
        for phase, data in self._phase_data.items():
            attempts = len(data)
            successes = sum(1 for d in data if d["success"])
            failures = attempts - successes
            avg_dur = (
                sum(d["duration_seconds"] for d in data) / attempts if attempts else 0.0
            )
            avg_tokens = (
                sum(d["token_usage"] for d in data) // attempts if attempts else 0
            )

            phase_metrics[phase] = PhaseMetrics(
                phase=phase,
                attempts=attempts,
                successes=successes,
                failures=failures,
                avg_duration_seconds=avg_dur,
                avg_token_usage=avg_tokens,
            )

        # 기간 설정
        period_start = None
        period_end = None
        if sessions:
            times = [s.start_time for s in sessions.values()]
            period_start = min(times)
            period_end = max(times)

        return PromptLearningMetrics(
            total_sessions=total,
            successful_sessions=successful,
            failed_sessions=failed,
            total_tokens=total_tokens,
            avg_session_duration=avg_duration,
            phase_metrics=phase_metrics,
            period_start=period_start,
            period_end=period_end,
        )

    def get_session(self, session_id: str) -> Optional[SessionMetrics]:
        """세션 메트릭스 조회"""
        return self._sessions.get(session_id)

    def get_phase_metrics(self, phase: int) -> Optional[PhaseMetrics]:
        """Phase 메트릭스 조회"""
        metrics = self.get_metrics()
        return metrics.phase_metrics.get(phase)

    def export_json(self, path: str) -> None:
        """JSON으로 내보내기"""
        data = {
            "sessions": {k: v.to_dict() for k, v in self._sessions.items()},
            "metrics": self.get_metrics().to_dict(),
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def reset(self) -> None:
        """데이터 초기화"""
        self._sessions.clear()
        self._phase_data.clear()
        # 증분 집계도 초기화
        self._total_tokens = 0
        self._successful_sessions = 0
        self._failed_sessions = 0
        self._total_duration = 0.0


# 전역 수집기 인스턴스
_collector: Optional[MetricsCollector] = None


def get_collector() -> MetricsCollector:
    """전역 수집기 반환"""
    global _collector
    if _collector is None:
        _collector = MetricsCollector()
    return _collector


def reset_collector() -> None:
    """전역 수집기 초기화"""
    global _collector
    _collector = None
