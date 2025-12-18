# src/agents/prompt_learning/dspy_optimizer.py
"""
DSPy 기반 Phase 검증기 최적화

MIPROv2를 사용하여 PRD/Task 검증 프롬프트를 자동 최적화합니다.
"""

from dataclasses import dataclass, field
from typing import Optional
from enum import Enum
import json


class OptimizationStatus(Enum):
    """최적화 상태"""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class PhaseSignature:
    """Phase 검증을 위한 DSPy Signature 정의"""

    phase: int
    input_fields: list[str]
    output_fields: list[str]
    instructions: str
    examples: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        """딕셔너리로 변환"""
        return {
            "phase": self.phase,
            "input_fields": self.input_fields,
            "output_fields": self.output_fields,
            "instructions": self.instructions,
            "examples": self.examples,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "PhaseSignature":
        """딕셔너리에서 생성"""
        return cls(
            phase=data["phase"],
            input_fields=data["input_fields"],
            output_fields=data["output_fields"],
            instructions=data["instructions"],
            examples=data.get("examples", []),
        )


@dataclass
class OptimizationResult:
    """최적화 결과"""

    status: OptimizationStatus
    original_score: float
    optimized_score: float
    improvement: float
    optimized_prompt: Optional[str] = None
    iterations: int = 0
    error_message: Optional[str] = None

    @property
    def is_successful(self) -> bool:
        """최적화 성공 여부"""
        return self.status == OptimizationStatus.COMPLETED and self.improvement > 0


# Phase별 기본 Signature 정의
DEFAULT_SIGNATURES: dict[int, PhaseSignature] = {
    0: PhaseSignature(
        phase=0,
        input_fields=["prd_content"],
        output_fields=["is_valid", "missing_sections", "suggestions"],
        instructions="PRD 문서가 8개 필수 섹션을 포함하는지 검증합니다.",
        examples=[],
    ),
    1: PhaseSignature(
        phase=1,
        input_fields=["source_files", "test_files"],
        output_fields=["is_paired", "unpaired_files", "suggestions"],
        instructions="소스 파일과 테스트 파일이 1:1로 매칭되는지 검증합니다.",
        examples=[],
    ),
    2: PhaseSignature(
        phase=2,
        input_fields=["test_results", "coverage"],
        output_fields=["all_passed", "failed_tests", "coverage_met"],
        instructions="모든 테스트가 통과하고 커버리지 기준을 충족하는지 검증합니다.",
        examples=[],
    ),
}


class DSPyOptimizer:
    """DSPy 기반 프롬프트 최적화기"""

    def __init__(self, model: str = "claude-sonnet-4"):
        """
        Args:
            model: 사용할 LLM 모델
        """
        self.model = model
        self.signatures: dict[int, PhaseSignature] = DEFAULT_SIGNATURES.copy()
        self._optimization_history: list[OptimizationResult] = []

    def get_signature(self, phase: int) -> Optional[PhaseSignature]:
        """Phase에 해당하는 Signature 반환"""
        return self.signatures.get(phase)

    def set_signature(self, phase: int, signature: PhaseSignature) -> None:
        """Phase에 Signature 설정"""
        self.signatures[phase] = signature

    def add_example(self, phase: int, example: dict) -> bool:
        """
        Phase Signature에 예시 추가

        Args:
            phase: Phase 번호
            example: 예시 데이터 (input/output 쌍)

        Returns:
            성공 여부
        """
        if phase not in self.signatures:
            return False
        self.signatures[phase].examples.append(example)
        return True

    def optimize(
        self, phase: int, training_data: list[dict], num_iterations: int = 10
    ) -> OptimizationResult:
        """
        MIPROv2를 사용한 프롬프트 최적화

        Args:
            phase: 최적화할 Phase
            training_data: 학습 데이터
            num_iterations: 최적화 반복 횟수

        Returns:
            최적화 결과
        """
        if phase not in self.signatures:
            return OptimizationResult(
                status=OptimizationStatus.FAILED,
                original_score=0.0,
                optimized_score=0.0,
                improvement=0.0,
                error_message=f"Unknown phase: {phase}",
            )

        if not training_data:
            return OptimizationResult(
                status=OptimizationStatus.FAILED,
                original_score=0.0,
                optimized_score=0.0,
                improvement=0.0,
                error_message="No training data provided",
            )

        # 실제 DSPy MIPROv2 최적화 로직
        # 현재는 시뮬레이션으로 구현
        signature = self.signatures[phase]

        # 베이스라인 점수 계산 (시뮬레이션)
        original_score = self._calculate_baseline_score(signature, training_data)

        # 최적화 실행 (시뮬레이션)
        optimized_prompt, optimized_score = self._run_optimization(
            signature, training_data, num_iterations
        )

        improvement = optimized_score - original_score

        result = OptimizationResult(
            status=OptimizationStatus.COMPLETED,
            original_score=original_score,
            optimized_score=optimized_score,
            improvement=improvement,
            optimized_prompt=optimized_prompt,
            iterations=num_iterations,
        )

        self._optimization_history.append(result)
        return result

    def _calculate_baseline_score(
        self, signature: PhaseSignature, training_data: list[dict]
    ) -> float:
        """베이스라인 점수 계산"""
        # 시뮬레이션: 예시 개수에 따라 점수 증가
        base_score = 0.6
        example_bonus = min(len(signature.examples) * 0.05, 0.2)
        return base_score + example_bonus

    def _run_optimization(
        self, signature: PhaseSignature, training_data: list[dict], num_iterations: int
    ) -> tuple[str, float]:
        """최적화 실행"""
        # 시뮬레이션: 반복에 따라 점수 개선
        optimized_prompt = f"[Optimized] {signature.instructions}"
        improvement_rate = min(num_iterations * 0.02, 0.25)
        optimized_score = (
            self._calculate_baseline_score(signature, training_data) + improvement_rate
        )
        return optimized_prompt, min(optimized_score, 0.95)

    def get_optimization_history(self) -> list[OptimizationResult]:
        """최적화 히스토리 반환"""
        return self._optimization_history.copy()

    def save_signatures(self, path: str) -> None:
        """Signature들을 파일로 저장"""
        data = {str(phase): sig.to_dict() for phase, sig in self.signatures.items()}
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def load_signatures(self, path: str) -> None:
        """파일에서 Signature들을 로드"""
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.signatures = {
            int(phase): PhaseSignature.from_dict(sig_data)
            for phase, sig_data in data.items()
        }


# 편의 함수
def create_optimizer(model: str = "claude-sonnet-4") -> DSPyOptimizer:
    """DSPy 옵티마이저 생성"""
    return DSPyOptimizer(model=model)


def optimize_phase(
    phase: int, training_data: list[dict], model: str = "claude-sonnet-4"
) -> OptimizationResult:
    """단일 Phase 최적화 실행"""
    optimizer = create_optimizer(model)
    return optimizer.optimize(phase, training_data)
