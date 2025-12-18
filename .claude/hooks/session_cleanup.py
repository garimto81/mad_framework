#!/usr/bin/env python3
"""
세션 종료 Hook - 미완료 작업 저장, 세션 요약, 임시 파일 정리

SessionEnd 이벤트에서 실행됩니다.
"""

import json
import os
import glob
from datetime import datetime
from pathlib import Path

PROJECT_DIR = os.environ.get("CLAUDE_PROJECT_DIR", "D:/AI/claude01")
SESSION_FILE = Path(PROJECT_DIR) / ".claude" / "session_state.json"
TEMP_PATTERNS = [
    "temp_*.py",
    "temp_*.txt",
    "temp_*.md",
    "*.tmp",
    "*.bak",
]


def load_session_state() -> dict:
    """현재 세션 상태 로드"""
    if SESSION_FILE.exists():
        try:
            with open(SESSION_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def save_session_state(state: dict):
    """세션 상태 저장"""
    SESSION_FILE.parent.mkdir(parents=True, exist_ok=True)
    state["last_end"] = datetime.now().isoformat()
    with open(SESSION_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2, ensure_ascii=False)


def find_temp_files() -> list:
    """임시 파일 목록 찾기"""
    temp_files = []
    for pattern in TEMP_PATTERNS:
        matches = glob.glob(os.path.join(PROJECT_DIR, pattern))
        temp_files.extend(matches)
        # 하위 디렉토리도 검색 (1단계만)
        matches = glob.glob(os.path.join(PROJECT_DIR, "*", pattern))
        temp_files.extend(matches)
    return temp_files


def cleanup_temp_files(files: list) -> int:
    """임시 파일 삭제 (선택적)"""
    cleaned = 0
    for f in files:
        try:
            # 안전을 위해 삭제하지 않고 목록만 반환
            # os.remove(f)
            cleaned += 1
        except Exception:
            pass
    return cleaned


def main():
    try:
        # 현재 세션 상태 로드
        state = load_session_state()

        # 세션 종료 정보 수집
        session_info = []

        # 세션 시작 시간
        if state.get("last_start"):
            start_time = state["last_start"][:16]
            session_info.append(f"📍 세션 시작: {start_time}")

        # 미완료 작업 확인 (TodoWrite에서 관리하는 작업)
        pending_tasks = state.get("pending_tasks", [])
        if pending_tasks:
            session_info.append(f"📋 미완료 작업: {len(pending_tasks)}개")
            for task in pending_tasks[:3]:
                session_info.append(f"   - {task}")

        # 임시 파일 확인
        temp_files = find_temp_files()
        if temp_files:
            session_info.append(f"🗑️ 임시 파일: {len(temp_files)}개 발견")
            for f in temp_files[:3]:
                session_info.append(f"   - {os.path.basename(f)}")
            if len(temp_files) > 3:
                session_info.append(f"   ... 외 {len(temp_files) - 3}개")

        # 세션 상태 저장
        save_session_state({
            "branch": state.get("branch", "unknown"),
            "pending_tasks": pending_tasks,
            "temp_files": [os.path.basename(f) for f in temp_files],
            "last_start": state.get("last_start"),
        })

        # 결과 출력
        if session_info:
            message = "\n".join(session_info)
            print(json.dumps({
                "continue": True,
                "message": f"📍 세션 종료\n\n{message}"
            }))
        else:
            print(json.dumps({"continue": True}))

    except Exception as e:
        print(json.dumps({"continue": True, "error": str(e)}))


if __name__ == "__main__":
    main()
