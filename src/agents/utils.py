# src/agents/utils.py
"""
병렬 워크플로우 유틸리티 함수
"""

import asyncio
import time
from typing import Callable, Any, Optional
from functools import wraps
from dataclasses import dataclass


@dataclass
class ExecutionResult:
    """실행 결과"""

    success: bool
    output: Any
    duration_seconds: float
    error: Optional[str] = None


def timer(func: Callable) -> Callable:
    """함수 실행 시간 측정 데코레이터"""

    @wraps(func)
    def wrapper(*args, **kwargs):
        start = time.time()
        result = func(*args, **kwargs)
        duration = time.time() - start
        print(f"[Timer] {func.__name__}: {duration:.2f}초")
        return result

    return wrapper


async def timer_async(func: Callable) -> Callable:
    """비동기 함수 실행 시간 측정 데코레이터"""

    @wraps(func)
    async def wrapper(*args, **kwargs):
        start = time.time()
        result = await func(*args, **kwargs)
        duration = time.time() - start
        print(f"[Timer] {func.__name__}: {duration:.2f}초")
        return result

    return wrapper


async def run_with_timeout(
    coro, timeout_seconds: int = 120, fallback_value: Any = None
) -> ExecutionResult:
    """
    타임아웃과 함께 코루틴 실행

    Args:
        coro: 실행할 코루틴
        timeout_seconds: 타임아웃 (초)
        fallback_value: 타임아웃 시 반환할 기본값

    Returns:
        ExecutionResult
    """
    start = time.time()
    try:
        result = await asyncio.wait_for(coro, timeout=timeout_seconds)
        return ExecutionResult(
            success=True, output=result, duration_seconds=time.time() - start
        )
    except asyncio.TimeoutError:
        return ExecutionResult(
            success=False,
            output=fallback_value,
            duration_seconds=timeout_seconds,
            error=f"Timeout after {timeout_seconds}s",
        )
    except Exception as e:
        return ExecutionResult(
            success=False,
            output=fallback_value,
            duration_seconds=time.time() - start,
            error=str(e),
        )


async def run_parallel_with_semaphore(tasks: list, max_concurrent: int = 5) -> list:
    """
    세마포어로 동시 실행 수 제한하며 병렬 실행

    Args:
        tasks: 실행할 코루틴 리스트
        max_concurrent: 최대 동시 실행 수

    Returns:
        결과 리스트
    """
    semaphore = asyncio.Semaphore(max_concurrent)

    async def run_with_sem(task):
        async with semaphore:
            return await task

    return await asyncio.gather(*[run_with_sem(t) for t in tasks])


def format_result_report(results: list[dict]) -> str:
    """
    결과를 보고서 형식으로 포맷팅

    Args:
        results: 에이전트 결과 리스트

    Returns:
        포맷팅된 보고서 문자열
    """
    report_lines = ["=" * 60, "멀티 에이전트 실행 결과", "=" * 60, ""]

    successful = [r for r in results if r.get("success", False)]
    failed = [r for r in results if not r.get("success", False)]

    report_lines.append(
        f"성공: {len(successful)} / 실패: {len(failed)} / 총: {len(results)}"
    )
    report_lines.append("")

    for i, result in enumerate(successful):
        report_lines.extend(
            [
                f"## 에이전트 #{result.get('agent_id', i)}",
                f"서브태스크: {result.get('subtask', 'N/A')}",
                "-" * 40,
                result.get("output", "No output"),
                "",
            ]
        )

    if failed:
        report_lines.extend(["## 실패한 태스크", "-" * 40])
        for result in failed:
            report_lines.append(
                f"- 에이전트 #{result.get('agent_id', '?')}: {result.get('error', 'Unknown error')}"
            )

    return "\n".join(report_lines)


def parse_subtasks_from_text(text: str) -> list[str]:
    """
    텍스트에서 서브태스크 추출

    Args:
        text: 파싱할 텍스트

    Returns:
        서브태스크 리스트
    """
    import re

    # 번호 매긴 리스트 패턴 (1. 2. 3. 또는 - )
    patterns = [
        r"^\d+\.\s*(.+)$",  # 1. task
        r"^[-*]\s*(.+)$",  # - task or * task
        r"^•\s*(.+)$",  # • task
    ]

    lines = text.strip().split("\n")
    subtasks = []

    for line in lines:
        line = line.strip()
        if not line:
            continue

        for pattern in patterns:
            match = re.match(pattern, line)
            if match:
                subtasks.append(match.group(1).strip())
                break

    return subtasks if subtasks else lines[:3]  # 폴백: 처음 3줄
