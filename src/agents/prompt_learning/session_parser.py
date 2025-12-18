# src/agents/prompt_learning/session_parser.py
"""
Claude Code 세션 로그 파서

.jsonl 형식의 세션 로그를 파싱하여 분석 가능한 구조로 변환합니다.
"""

import json
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional, Iterator, Generator
from datetime import datetime
from enum import Enum
from functools import lru_cache


class EventType(Enum):
    """세션 이벤트 타입"""

    USER_MESSAGE = "user_message"
    ASSISTANT_MESSAGE = "assistant_message"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    ERROR = "error"
    UNKNOWN = "unknown"


@dataclass
class SessionEvent:
    """세션 이벤트"""

    timestamp: str
    event_type: EventType
    content: dict
    tool_name: Optional[str] = None
    success: Optional[bool] = None
    error: Optional[str] = None
    raw_data: dict = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: dict) -> "SessionEvent":
        """딕셔너리에서 SessionEvent 생성"""
        # 이벤트 타입 추론
        event_type = EventType.UNKNOWN
        if data.get("type") == "user":
            event_type = EventType.USER_MESSAGE
        elif data.get("type") == "assistant":
            event_type = EventType.ASSISTANT_MESSAGE
        elif data.get("tool"):
            if data.get("tool_result"):
                event_type = EventType.TOOL_RESULT
            else:
                event_type = EventType.TOOL_CALL
        elif data.get("error"):
            event_type = EventType.ERROR

        return cls(
            timestamp=data.get("timestamp", ""),
            event_type=event_type,
            content=data.get("content", {}),
            tool_name=(
                data.get("tool", {}).get("name")
                if isinstance(data.get("tool"), dict)
                else data.get("tool")
            ),
            success=data.get("success"),
            error=data.get("error"),
            raw_data=data,
        )


@dataclass
class SessionSummary:
    """세션 요약"""

    session_id: str
    total_events: int
    user_messages: int
    assistant_messages: int
    tool_calls: int
    errors: list[dict]
    success: bool
    duration_seconds: float
    start_time: Optional[str] = None
    end_time: Optional[str] = None

    def to_dict(self) -> dict:
        """딕셔너리로 변환"""
        return {
            "session_id": self.session_id,
            "total_events": self.total_events,
            "user_messages": self.user_messages,
            "assistant_messages": self.assistant_messages,
            "tool_calls": self.tool_calls,
            "errors": self.errors,
            "success": self.success,
            "duration_seconds": self.duration_seconds,
            "start_time": self.start_time,
            "end_time": self.end_time,
        }


class SessionParser:
    """
    Claude Code 세션 로그 파서

    Usage:
        parser = SessionParser()
        events = parser.parse_file("session.jsonl")
        summary = parser.summarize(events)
    """

    def __init__(self):
        self._events: list[SessionEvent] = []

    def parse_file(self, log_path: Path | str) -> list[SessionEvent]:
        """
        .jsonl 세션 로그 파일 파싱

        Args:
            log_path: 세션 로그 파일 경로

        Returns:
            SessionEvent 목록
        """
        log_path = Path(log_path)

        if not log_path.exists():
            raise FileNotFoundError(f"Session log not found: {log_path}")

        events = []

        with open(log_path, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, 1):
                if not line.strip():
                    continue

                try:
                    data = json.loads(line)
                    event = SessionEvent.from_dict(data)
                    events.append(event)
                except json.JSONDecodeError as e:
                    # JSON 파싱 실패 시 에러 이벤트로 기록
                    events.append(
                        SessionEvent(
                            timestamp="",
                            event_type=EventType.ERROR,
                            content={"line": line_num, "raw": line[:100]},
                            error=f"JSON parse error: {e}",
                        )
                    )

        self._events = events
        return events

    def parse_string(self, log_content: str) -> list[SessionEvent]:
        """
        문자열에서 세션 로그 파싱

        Args:
            log_content: .jsonl 형식 문자열

        Returns:
            SessionEvent 목록
        """
        events = []

        for line_num, line in enumerate(log_content.split("\n"), 1):
            if not line.strip():
                continue

            try:
                data = json.loads(line)
                event = SessionEvent.from_dict(data)
                events.append(event)
            except json.JSONDecodeError:
                continue

        self._events = events
        return events

    def parse_file_streaming(
        self, log_path: Path | str
    ) -> Generator[SessionEvent, None, None]:
        """
        스트리밍 방식 세션 로그 파싱 (메모리 효율적)

        Args:
            log_path: 세션 로그 파일 경로

        Yields:
            SessionEvent 객체
        """
        log_path = Path(log_path)

        if not log_path.exists():
            raise FileNotFoundError(f"Session log not found: {log_path}")

        with open(log_path, "r", encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue

                try:
                    data = json.loads(line)
                    yield SessionEvent.from_dict(data)
                except json.JSONDecodeError:
                    continue

    def summarize(self, events: Optional[list[SessionEvent]] = None) -> SessionSummary:
        """
        세션 요약 생성

        Args:
            events: SessionEvent 목록 (없으면 마지막 파싱 결과 사용)

        Returns:
            SessionSummary
        """
        if events is None:
            events = self._events

        if not events:
            return SessionSummary(
                session_id="unknown",
                total_events=0,
                user_messages=0,
                assistant_messages=0,
                tool_calls=0,
                errors=[],
                success=True,
                duration_seconds=0.0,
            )

        # 통계 계산
        user_messages = sum(1 for e in events if e.event_type == EventType.USER_MESSAGE)
        assistant_messages = sum(
            1 for e in events if e.event_type == EventType.ASSISTANT_MESSAGE
        )
        tool_calls = sum(1 for e in events if e.event_type == EventType.TOOL_CALL)

        # 에러 수집
        errors = []
        for event in events:
            if event.error:
                errors.append(
                    {
                        "timestamp": event.timestamp,
                        "tool": event.tool_name,
                        "error": event.error,
                    }
                )
            if event.event_type == EventType.ERROR:
                errors.append(
                    {
                        "timestamp": event.timestamp,
                        "tool": event.tool_name,
                        "error": str(event.content),
                    }
                )

        # 세션 ID 추출
        session_id = "unknown"
        for event in events:
            if "session_id" in event.raw_data:
                session_id = event.raw_data["session_id"]
                break

        # 시간 계산
        start_time = events[0].timestamp if events else None
        end_time = events[-1].timestamp if events else None
        duration = self._calculate_duration(start_time, end_time)

        # 성공 여부 판단
        success = len(errors) == 0

        return SessionSummary(
            session_id=session_id,
            total_events=len(events),
            user_messages=user_messages,
            assistant_messages=assistant_messages,
            tool_calls=tool_calls,
            errors=errors,
            success=success,
            duration_seconds=duration,
            start_time=start_time,
            end_time=end_time,
        )

    # 타임스탬프 파싱 형식 (클래스 레벨 상수)
    _TIMESTAMP_FORMATS = [
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
    ]

    @staticmethod
    @lru_cache(maxsize=512)
    def _parse_timestamp(ts: str) -> Optional[datetime]:
        """타임스탬프 파싱 (캐싱 적용)"""
        for fmt in SessionParser._TIMESTAMP_FORMATS:
            try:
                return datetime.strptime(ts, fmt)
            except ValueError:
                continue
        return None

    def _calculate_duration(self, start: Optional[str], end: Optional[str]) -> float:
        """시작/종료 시간에서 duration 계산"""
        if not start or not end:
            return 0.0

        try:
            start_dt = self._parse_timestamp(start)
            end_dt = self._parse_timestamp(end)

            if start_dt and end_dt:
                return (end_dt - start_dt).total_seconds()
        except Exception:
            pass

        return 0.0

    def get_tool_calls(
        self, events: Optional[list[SessionEvent]] = None
    ) -> list[SessionEvent]:
        """도구 호출 이벤트만 필터링"""
        if events is None:
            events = self._events
        return [e for e in events if e.event_type == EventType.TOOL_CALL]

    def get_errors(
        self, events: Optional[list[SessionEvent]] = None
    ) -> list[SessionEvent]:
        """에러 이벤트만 필터링"""
        if events is None:
            events = self._events
        return [e for e in events if e.error or e.event_type == EventType.ERROR]

    def get_failed_tool_calls(
        self, events: Optional[list[SessionEvent]] = None
    ) -> list[SessionEvent]:
        """실패한 도구 호출 필터링"""
        if events is None:
            events = self._events
        return [
            e
            for e in events
            if e.event_type == EventType.TOOL_RESULT and e.success is False
        ]


# ============================================================================
# 유틸리티 함수
# ============================================================================


def find_session_logs(
    directory: Path | str, pattern: str = "*.jsonl"
) -> Iterator[Path]:
    """
    디렉토리에서 세션 로그 파일 찾기

    Args:
        directory: 검색할 디렉토리
        pattern: 파일 패턴 (기본: *.jsonl)

    Yields:
        로그 파일 경로
    """
    directory = Path(directory)

    if not directory.exists():
        return

    for log_file in directory.glob(pattern):
        if log_file.is_file():
            yield log_file


def parse_multiple_sessions(log_paths: list[Path | str]) -> dict[str, SessionSummary]:
    """
    여러 세션 로그 파싱 및 요약

    Args:
        log_paths: 로그 파일 경로 목록

    Returns:
        {파일명: SessionSummary} 딕셔너리
    """
    parser = SessionParser()
    summaries = {}

    for log_path in log_paths:
        log_path = Path(log_path)
        try:
            events = parser.parse_file(log_path)
            summary = parser.summarize(events)
            summaries[log_path.name] = summary
        except Exception as e:
            summaries[log_path.name] = SessionSummary(
                session_id="error",
                total_events=0,
                user_messages=0,
                assistant_messages=0,
                tool_calls=0,
                errors=[{"error": str(e)}],
                success=False,
                duration_seconds=0.0,
            )

    return summaries
