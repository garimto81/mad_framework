# src/agents/prompt_learning/ab_test.py
"""
A/B 테스트 프레임워크

프롬프트 변형 간 성능을 비교 테스트합니다.
"""

from dataclasses import dataclass, field
from typing import Optional
from enum import Enum
from datetime import datetime
import hashlib


class Variant(Enum):
    """테스트 변형"""
    CONTROL = "control"
    TREATMENT = "treatment"


@dataclass
class ABTestConfig:
    """A/B 테스트 설정"""
    test_id: str
    control_prompt: str
    treatment_prompt: str
    traffic_split: float = 0.5  # treatment에 할당할 트래픽 비율
    min_samples: int = 100
    confidence_level: float = 0.95

    def __post_init__(self):
        if not 0 < self.traffic_split < 1:
            raise ValueError("traffic_split must be between 0 and 1")
        if self.min_samples < 10:
            raise ValueError("min_samples must be at least 10")


@dataclass
class ABTestResult:
    """A/B 테스트 결과"""
    test_id: str
    control_samples: int
    treatment_samples: int
    control_success_rate: float
    treatment_success_rate: float
    lift: float  # (treatment - control) / control
    is_significant: bool
    p_value: float
    winner: Optional[Variant] = None

    @property
    def total_samples(self) -> int:
        return self.control_samples + self.treatment_samples


@dataclass
class TestSample:
    """테스트 샘플"""
    sample_id: str
    variant: Variant
    input_data: dict
    success: bool
    latency_ms: float
    timestamp: datetime = field(default_factory=datetime.now)


class ABTestFramework:
    """A/B 테스트 프레임워크"""

    def __init__(self):
        self.tests: dict[str, ABTestConfig] = {}
        self.samples: dict[str, list[TestSample]] = {}

    def create_test(self, config: ABTestConfig) -> str:
        """
        새 A/B 테스트 생성

        Args:
            config: 테스트 설정

        Returns:
            테스트 ID
        """
        self.tests[config.test_id] = config
        self.samples[config.test_id] = []
        return config.test_id

    def get_variant(self, test_id: str, user_id: str) -> Variant:
        """
        사용자에게 변형 할당

        Args:
            test_id: 테스트 ID
            user_id: 사용자 ID

        Returns:
            할당된 변형
        """
        if test_id not in self.tests:
            raise ValueError(f"Unknown test: {test_id}")

        config = self.tests[test_id]

        # 결정적 해시를 사용하여 일관된 할당
        hash_input = f"{test_id}:{user_id}"
        hash_value = int(hashlib.md5(hash_input.encode()).hexdigest(), 16)
        normalized = (hash_value % 10000) / 10000

        if normalized < config.traffic_split:
            return Variant.TREATMENT
        return Variant.CONTROL

    def get_prompt(self, test_id: str, variant: Variant) -> str:
        """
        변형에 해당하는 프롬프트 반환

        Args:
            test_id: 테스트 ID
            variant: 변형

        Returns:
            프롬프트
        """
        if test_id not in self.tests:
            raise ValueError(f"Unknown test: {test_id}")

        config = self.tests[test_id]
        if variant == Variant.CONTROL:
            return config.control_prompt
        return config.treatment_prompt

    def record_sample(
        self,
        test_id: str,
        user_id: str,
        input_data: dict,
        success: bool,
        latency_ms: float
    ) -> TestSample:
        """
        테스트 샘플 기록

        Args:
            test_id: 테스트 ID
            user_id: 사용자 ID
            input_data: 입력 데이터
            success: 성공 여부
            latency_ms: 레이턴시 (밀리초)

        Returns:
            기록된 샘플
        """
        if test_id not in self.tests:
            raise ValueError(f"Unknown test: {test_id}")

        variant = self.get_variant(test_id, user_id)
        sample = TestSample(
            sample_id=f"{test_id}:{user_id}:{datetime.now().timestamp()}",
            variant=variant,
            input_data=input_data,
            success=success,
            latency_ms=latency_ms
        )
        self.samples[test_id].append(sample)
        return sample

    def get_results(self, test_id: str) -> ABTestResult:
        """
        테스트 결과 계산

        Args:
            test_id: 테스트 ID

        Returns:
            테스트 결과
        """
        if test_id not in self.tests:
            raise ValueError(f"Unknown test: {test_id}")

        samples = self.samples[test_id]
        config = self.tests[test_id]

        control_samples = [s for s in samples if s.variant == Variant.CONTROL]
        treatment_samples = [s for s in samples if s.variant == Variant.TREATMENT]

        control_count = len(control_samples)
        treatment_count = len(treatment_samples)

        if control_count == 0 or treatment_count == 0:
            return ABTestResult(
                test_id=test_id,
                control_samples=control_count,
                treatment_samples=treatment_count,
                control_success_rate=0.0,
                treatment_success_rate=0.0,
                lift=0.0,
                is_significant=False,
                p_value=1.0
            )

        control_success = sum(1 for s in control_samples if s.success)
        treatment_success = sum(1 for s in treatment_samples if s.success)

        control_rate = control_success / control_count
        treatment_rate = treatment_success / treatment_count

        # Lift 계산
        if control_rate > 0:
            lift = (treatment_rate - control_rate) / control_rate
        else:
            lift = 0.0 if treatment_rate == 0 else float('inf')

        # 통계적 유의성 계산 (간단한 z-test)
        p_value, is_significant = self._calculate_significance(
            control_count, control_success,
            treatment_count, treatment_success,
            config.confidence_level
        )

        # 승자 결정
        winner = None
        total = control_count + treatment_count
        if is_significant and total >= config.min_samples:
            winner = Variant.TREATMENT if treatment_rate > control_rate else Variant.CONTROL

        return ABTestResult(
            test_id=test_id,
            control_samples=control_count,
            treatment_samples=treatment_count,
            control_success_rate=control_rate,
            treatment_success_rate=treatment_rate,
            lift=lift,
            is_significant=is_significant,
            p_value=p_value,
            winner=winner
        )

    def _calculate_significance(
        self,
        n1: int, x1: int,
        n2: int, x2: int,
        confidence_level: float
    ) -> tuple[float, bool]:
        """통계적 유의성 계산"""
        import math

        p1 = x1 / n1 if n1 > 0 else 0
        p2 = x2 / n2 if n2 > 0 else 0

        # Pooled proportion
        p_pool = (x1 + x2) / (n1 + n2) if (n1 + n2) > 0 else 0

        # Standard error
        if p_pool == 0 or p_pool == 1:
            return 1.0, False

        se = math.sqrt(p_pool * (1 - p_pool) * (1/n1 + 1/n2))

        if se == 0:
            return 1.0, False

        # Z-score
        z = abs(p2 - p1) / se

        # P-value (two-tailed) - approximation
        # Using standard normal approximation
        p_value = 2 * (1 - self._normal_cdf(z))

        # Significance threshold
        alpha = 1 - confidence_level
        is_significant = p_value < alpha

        return p_value, is_significant

    def _normal_cdf(self, x: float) -> float:
        """표준 정규 분포 CDF 근사"""
        import math
        return 0.5 * (1 + math.erf(x / math.sqrt(2)))

    def is_test_complete(self, test_id: str) -> bool:
        """테스트 완료 여부"""
        if test_id not in self.tests:
            return False

        result = self.get_results(test_id)
        config = self.tests[test_id]

        return result.total_samples >= config.min_samples and result.is_significant

    def export_results(self, test_id: str) -> dict:
        """결과를 딕셔너리로 내보내기"""
        result = self.get_results(test_id)
        return {
            "test_id": result.test_id,
            "control_samples": result.control_samples,
            "treatment_samples": result.treatment_samples,
            "control_success_rate": result.control_success_rate,
            "treatment_success_rate": result.treatment_success_rate,
            "lift": result.lift,
            "is_significant": result.is_significant,
            "p_value": result.p_value,
            "winner": result.winner.value if result.winner else None,
            "total_samples": result.total_samples
        }


# 편의 함수
def create_ab_test(
    test_id: str,
    control_prompt: str,
    treatment_prompt: str,
    traffic_split: float = 0.5
) -> ABTestFramework:
    """A/B 테스트 생성"""
    framework = ABTestFramework()
    config = ABTestConfig(
        test_id=test_id,
        control_prompt=control_prompt,
        treatment_prompt=treatment_prompt,
        traffic_split=traffic_split
    )
    framework.create_test(config)
    return framework
