# src/agents/benchmark.py
"""
병렬 워크플로우 성능 벤치마크

Sequential vs Parallel 실행 시간 비교
"""

import asyncio
import time
from dataclasses import dataclass
from typing import Callable
import statistics


@dataclass
class BenchmarkResult:
    """벤치마크 결과"""
    name: str
    execution_mode: str  # "sequential" | "parallel"
    total_time_seconds: float
    individual_times: list[float]
    success_count: int
    failure_count: int


def benchmark_sequential(tasks: list[Callable], task_names: list[str] = None) -> BenchmarkResult:
    """
    순차 실행 벤치마크

    Args:
        tasks: 실행할 함수 리스트
        task_names: 태스크 이름 리스트

    Returns:
        BenchmarkResult
    """
    task_names = task_names or [f"task_{i}" for i in range(len(tasks))]

    start_total = time.time()
    individual_times = []
    success_count = 0
    failure_count = 0

    for i, task in enumerate(tasks):
        start = time.time()
        try:
            task()
            success_count += 1
        except Exception:
            failure_count += 1
        individual_times.append(time.time() - start)

    return BenchmarkResult(
        name="Sequential Execution",
        execution_mode="sequential",
        total_time_seconds=time.time() - start_total,
        individual_times=individual_times,
        success_count=success_count,
        failure_count=failure_count
    )


async def benchmark_parallel(tasks: list[Callable], task_names: list[str] = None) -> BenchmarkResult:
    """
    병렬 실행 벤치마크

    Args:
        tasks: 실행할 코루틴 리스트
        task_names: 태스크 이름 리스트

    Returns:
        BenchmarkResult
    """
    task_names = task_names or [f"task_{i}" for i in range(len(tasks))]

    async def timed_task(task, index):
        start = time.time()
        try:
            if asyncio.iscoroutinefunction(task):
                await task()
            else:
                task()
            return (time.time() - start, True)
        except Exception:
            return (time.time() - start, False)

    start_total = time.time()
    results = await asyncio.gather(*[
        timed_task(task, i) for i, task in enumerate(tasks)
    ])

    individual_times = [r[0] for r in results]
    success_count = sum(1 for r in results if r[1])
    failure_count = len(results) - success_count

    return BenchmarkResult(
        name="Parallel Execution",
        execution_mode="parallel",
        total_time_seconds=time.time() - start_total,
        individual_times=individual_times,
        success_count=success_count,
        failure_count=failure_count
    )


def compare_results(sequential: BenchmarkResult, parallel: BenchmarkResult) -> str:
    """
    Sequential vs Parallel 결과 비교

    Args:
        sequential: 순차 실행 결과
        parallel: 병렬 실행 결과

    Returns:
        비교 보고서 문자열
    """
    speedup = sequential.total_time_seconds / parallel.total_time_seconds if parallel.total_time_seconds > 0 else 0
    time_saved = sequential.total_time_seconds - parallel.total_time_seconds
    time_saved_pct = (time_saved / sequential.total_time_seconds) * 100 if sequential.total_time_seconds > 0 else 0

    report = f"""
{'=' * 60}
성능 벤치마크 비교 보고서
{'=' * 60}

## Sequential Execution
- 총 소요 시간: {sequential.total_time_seconds:.2f}초
- 개별 태스크 평균: {statistics.mean(sequential.individual_times):.2f}초
- 성공/실패: {sequential.success_count}/{sequential.failure_count}

## Parallel Execution
- 총 소요 시간: {parallel.total_time_seconds:.2f}초
- 개별 태스크 평균: {statistics.mean(parallel.individual_times):.2f}초
- 성공/실패: {parallel.success_count}/{parallel.failure_count}

## 비교 결과
- 속도 향상: {speedup:.2f}x
- 시간 절약: {time_saved:.2f}초 ({time_saved_pct:.1f}%)

## 결론
{'✅ 병렬 실행이 ' + f'{speedup:.1f}배 빠릅니다!' if speedup > 1 else '⚠️ 병렬화 효과가 제한적입니다.'}
{'=' * 60}
"""
    return report


# ============================================================================
# 시뮬레이션 태스크 (테스트용)
# ============================================================================

def simulate_task(duration: float = 1.0):
    """시뮬레이션 태스크 (동기)"""
    time.sleep(duration)
    return f"Task completed in {duration}s"


async def simulate_task_async(duration: float = 1.0):
    """시뮬레이션 태스크 (비동기)"""
    await asyncio.sleep(duration)
    return f"Task completed in {duration}s"


async def run_benchmark_demo():
    """벤치마크 데모 실행"""
    print("병렬 워크플로우 성능 벤치마크")
    print("-" * 40)

    # 테스트 태스크 (각 1초)
    num_tasks = 5
    task_duration = 1.0

    print(f"\n테스트 조건: {num_tasks}개 태스크, 각 {task_duration}초")

    # Sequential
    print("\n[1/2] Sequential 실행 중...")
    seq_tasks = [lambda d=task_duration: simulate_task(d) for _ in range(num_tasks)]
    seq_result = benchmark_sequential(seq_tasks)

    # Parallel
    print("[2/2] Parallel 실행 중...")
    async_tasks = [lambda d=task_duration: simulate_task_async(d) for _ in range(num_tasks)]
    par_result = await benchmark_parallel(async_tasks)

    # 비교
    report = compare_results(seq_result, par_result)
    print(report)


# ============================================================================
# CLI Entry Point
# ============================================================================

if __name__ == "__main__":
    asyncio.run(run_benchmark_demo())
