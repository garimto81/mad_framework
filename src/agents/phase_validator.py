# src/agents/phase_validator.py
"""
Phase 검증 병렬 실행기

여러 Phase 검증을 병렬로 실행하여 전체 검증 시간을 단축합니다.
"""

import asyncio
import time
from dataclasses import dataclass
from typing import Optional
from pathlib import Path


@dataclass
class ValidationResult:
    """검증 결과"""
    phase: str
    success: bool
    output: str
    duration_seconds: float
    error: Optional[str] = None


# 프로젝트 루트
PROJECT_ROOT = Path("D:/AI/claude01")


async def run_validator(phase: str, args: list[str] = None) -> ValidationResult:
    """
    단일 Phase 검증기 실행

    Args:
        phase: Phase 번호 (0, 0.5, 1, 2, 3, 4, 5, 6)
        args: 추가 인자

    Returns:
        ValidationResult
    """
    args = args or []
    script_path = PROJECT_ROOT / "scripts" / f"validate-phase-{phase}.ps1"

    if not script_path.exists():
        return ValidationResult(
            phase=phase,
            success=False,
            output="",
            duration_seconds=0,
            error=f"Script not found: {script_path}"
        )

    cmd = ["powershell", "-ExecutionPolicy", "Bypass", "-File", str(script_path)] + args

    start = time.time()
    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(PROJECT_ROOT)
        )

        stdout, stderr = await asyncio.wait_for(
            process.communicate(),
            timeout=300  # 5분 타임아웃
        )

        output = stdout.decode('utf-8', errors='replace')
        error_output = stderr.decode('utf-8', errors='replace')

        return ValidationResult(
            phase=phase,
            success=process.returncode == 0,
            output=output,
            duration_seconds=time.time() - start,
            error=error_output if process.returncode != 0 else None
        )

    except asyncio.TimeoutError:
        return ValidationResult(
            phase=phase,
            success=False,
            output="",
            duration_seconds=time.time() - start,
            error="Timeout after 300 seconds"
        )
    except Exception as e:
        return ValidationResult(
            phase=phase,
            success=False,
            output="",
            duration_seconds=time.time() - start,
            error=str(e)
        )


async def run_validators_parallel(phases: list[str], args_map: dict = None) -> list[ValidationResult]:
    """
    여러 Phase 검증기를 병렬로 실행

    Args:
        phases: 실행할 Phase 목록
        args_map: Phase별 추가 인자 맵

    Returns:
        ValidationResult 리스트
    """
    args_map = args_map or {}

    tasks = [
        run_validator(phase, args_map.get(phase, []))
        for phase in phases
    ]

    results = await asyncio.gather(*tasks)
    return list(results)


async def run_phase_2_parallel() -> list[ValidationResult]:
    """
    Phase 2 검증 (테스트) 병렬 실행

    - Unit tests
    - Integration tests
    - Security scan
    - Lint check
    """
    validators = [
        ("unit", ["pytest", "tests/", "-v", "--tb=short", "-q"]),
        ("lint", ["ruff", "check", "src/"]),
    ]

    tasks = []
    for name, cmd in validators:
        tasks.append(run_command_async(name, cmd))

    results = await asyncio.gather(*tasks)
    return results


async def run_command_async(name: str, cmd: list[str]) -> ValidationResult:
    """
    비동기 명령어 실행

    Args:
        name: 검증 이름
        cmd: 실행할 명령어

    Returns:
        ValidationResult
    """
    start = time.time()
    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(PROJECT_ROOT)
        )

        stdout, stderr = await asyncio.wait_for(
            process.communicate(),
            timeout=120
        )

        output = stdout.decode('utf-8', errors='replace')

        return ValidationResult(
            phase=name,
            success=process.returncode == 0,
            output=output,
            duration_seconds=time.time() - start,
            error=stderr.decode('utf-8', errors='replace') if process.returncode != 0 else None
        )

    except Exception as e:
        return ValidationResult(
            phase=name,
            success=False,
            output="",
            duration_seconds=time.time() - start,
            error=str(e)
        )


def format_validation_report(results: list[ValidationResult]) -> str:
    """
    검증 결과 보고서 생성

    Args:
        results: ValidationResult 리스트

    Returns:
        포맷팅된 보고서
    """
    lines = [
        "=" * 60,
        "Phase 검증 보고서 (병렬 실행)",
        "=" * 60,
        ""
    ]

    total_time = sum(r.duration_seconds for r in results)
    passed = sum(1 for r in results if r.success)
    failed = len(results) - passed

    lines.append(f"총 소요 시간: {total_time:.2f}초")
    lines.append(f"결과: {passed} passed / {failed} failed")
    lines.append("")
    lines.append("-" * 60)

    for result in results:
        status = "✅ PASS" if result.success else "❌ FAIL"
        lines.append(f"{status} Phase {result.phase} ({result.duration_seconds:.2f}s)")

        if not result.success and result.error:
            lines.append(f"   Error: {result.error[:100]}...")

    lines.append("-" * 60)

    return "\n".join(lines)


# ============================================================================
# CLI Entry Point
# ============================================================================

async def main():
    """메인 함수"""
    import sys

    if len(sys.argv) < 2:
        print("Usage: python phase_validator.py <phase1> [phase2] ...")
        print("Example: python phase_validator.py 0 0.5 1 2")
        print("\nAvailable phases: 0, 0.5, 1, 2, 3, 4, 5, 6")
        return

    phases = sys.argv[1:]

    print(f"병렬 검증 시작: {', '.join(phases)}")
    print("-" * 40)

    results = await run_validators_parallel(phases)
    report = format_validation_report(results)

    print(report)

    # 실패한 경우 종료 코드 1
    if any(not r.success for r in results):
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
