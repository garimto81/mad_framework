#!/usr/bin/env python3
"""
커밋 검증 Hook - Conventional Commits 형식 검증, 민감 정보 확인

PreCommit 이벤트에서 실행됩니다.
"""

import json
import re
import sys
import subprocess
import os

PROJECT_DIR = os.environ.get("CLAUDE_PROJECT_DIR", "D:/AI/claude01")

# Conventional Commits 패턴
COMMIT_PATTERN = r"^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: .+"

# 민감 정보 패턴
SENSITIVE_PATTERNS = [
    (r"password\s*=\s*['\"][^'\"]+['\"]", "하드코딩된 패스워드"),
    (r"api[_-]?key\s*=\s*['\"][^'\"]+['\"]", "API 키 노출"),
    (r"secret\s*=\s*['\"][^'\"]+['\"]", "시크릿 노출"),
    (r"sk-[a-zA-Z0-9]{20,}", "OpenAI API 키"),
    (r"ghp_[a-zA-Z0-9]{36}", "GitHub 토큰"),
    (r"-----BEGIN (RSA|PRIVATE|OPENSSH) PRIVATE KEY-----", "프라이빗 키"),
    (r"aws_access_key_id\s*=", "AWS 액세스 키"),
    (r"aws_secret_access_key\s*=", "AWS 시크릿 키"),
]

# 검사 제외 파일 패턴
EXCLUDE_PATTERNS = [
    r"\.env\.template$",
    r"\.env\.example$",
    r"\.env\.sample$",
    r"\.md$",  # 문서 파일 제외
    r"test_.*\.py$",  # 테스트 파일 제외
    r".*\.test\.(js|ts)$",
]


def validate_commit_message(message: str) -> tuple[bool, str]:
    """Conventional Commits 형식 검증"""
    # 첫 줄만 검사
    first_line = message.split("\n")[0].strip()

    if re.match(COMMIT_PATTERN, first_line, re.IGNORECASE):
        return True, ""

    return False, f"커밋 메시지 형식 오류: '{first_line[:50]}...'\n권장: feat|fix|docs|... : 설명"


def get_staged_files() -> list:
    """스테이징된 파일 목록"""
    try:
        result = subprocess.run(
            ["git", "diff", "--cached", "--name-only"],
            capture_output=True,
            text=True,
            cwd=PROJECT_DIR
        )
        return [f for f in result.stdout.strip().split("\n") if f]
    except Exception:
        return []


def check_sensitive_content(file_path: str) -> list:
    """파일 내 민감 정보 검사"""
    # 제외 패턴 확인
    for pattern in EXCLUDE_PATTERNS:
        if re.search(pattern, file_path, re.IGNORECASE):
            return []

    issues = []
    full_path = os.path.join(PROJECT_DIR, file_path)

    try:
        with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()

        for pattern, desc in SENSITIVE_PATTERNS:
            if re.search(pattern, content, re.IGNORECASE):
                issues.append(f"{file_path}: {desc}")

    except Exception:
        pass

    return issues


def main():
    try:
        input_data = sys.stdin.read()
        if not input_data.strip():
            print(json.dumps({"decision": "approve"}))
            return

        data = json.loads(input_data)

        # 커밋 메시지 검증 (있는 경우)
        commit_message = data.get("commit_message", "")
        if commit_message:
            is_valid, error = validate_commit_message(commit_message)
            if not is_valid:
                print(json.dumps({
                    "decision": "block",
                    "reason": f"🚫 커밋 메시지 형식 오류\n\n"
                              f"📌 {error}\n\n"
                              f"💡 Conventional Commits 형식을 사용하세요:\n"
                              f"   feat: 새 기능\n"
                              f"   fix: 버그 수정\n"
                              f"   docs: 문서 변경\n"
                              f"   refactor: 코드 리팩토링"
                }))
                return

        # 스테이징된 파일 민감 정보 검사
        staged_files = get_staged_files()
        all_issues = []

        for file_path in staged_files:
            issues = check_sensitive_content(file_path)
            all_issues.extend(issues)

        if all_issues:
            issue_list = "\n".join(f"  - {issue}" for issue in all_issues[:5])
            if len(all_issues) > 5:
                issue_list += f"\n  ... 외 {len(all_issues) - 5}개"

            print(json.dumps({
                "decision": "block",
                "reason": f"🚫 민감 정보 감지\n\n"
                          f"📌 발견된 문제:\n{issue_list}\n\n"
                          f"💡 민감 정보를 환경 변수로 이동하세요.\n"
                          f"   .env 파일 사용 후 .gitignore에 추가"
            }))
            return

        print(json.dumps({"decision": "approve"}))

    except Exception as e:
        # 에러 시 허용 (Hook 실패로 커밋 차단 방지)
        print(json.dumps({"decision": "approve", "error": str(e)}))


if __name__ == "__main__":
    main()
