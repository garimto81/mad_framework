# src/agents/prompt_learning/textgrad_optimizer.py
"""
TextGrad 기반 프롬프트 최적화

텍스트 그래디언트를 사용하여 에이전트 프롬프트를 자동 개선합니다.
"""

from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path


class GradientType(Enum):
    """그래디언트 유형"""
    IMPROVE_CLARITY = "clarity"
    IMPROVE_SPECIFICITY = "specificity"
    IMPROVE_CONCISENESS = "conciseness"
    REDUCE_AMBIGUITY = "ambiguity"
    ADD_EXAMPLES = "examples"


@dataclass
class TextGradient:
    """텍스트 그래디언트"""
    gradient_type: GradientType
    original_text: str
    feedback: str
    suggested_change: str
    confidence: float  # 0.0 ~ 1.0

    def apply(self) -> str:
        """그래디언트 적용"""
        return self.suggested_change


@dataclass
class OptimizationStep:
    """최적화 단계"""
    step_number: int
    original_prompt: str
    optimized_prompt: str
    gradients_applied: list[TextGradient]
    score_before: float
    score_after: float

    @property
    def improvement(self) -> float:
        return self.score_after - self.score_before


@dataclass
class AgentOptimizationResult:
    """에이전트 최적화 결과"""
    agent_name: str
    original_prompt: str
    optimized_prompt: str
    steps: list[OptimizationStep]
    total_improvement: float
    iterations: int

    @property
    def final_score(self) -> float:
        if self.steps:
            return self.steps[-1].score_after
        return 0.0


class TextGradOptimizer:
    """TextGrad 기반 프롬프트 최적화기"""

    def __init__(self, model: str = "claude-sonnet-4"):
        """
        Args:
            model: 사용할 LLM 모델
        """
        self.model = model
        self._optimization_history: list[AgentOptimizationResult] = []

    def analyze_prompt(self, prompt: str) -> list[TextGradient]:
        """
        프롬프트 분석 및 개선점 식별

        Args:
            prompt: 분석할 프롬프트

        Returns:
            텍스트 그래디언트 목록
        """
        gradients = []

        # 명확성 분석
        if len(prompt) > 500 and prompt.count('.') < 3:
            gradients.append(TextGradient(
                gradient_type=GradientType.IMPROVE_CLARITY,
                original_text=prompt[:100] + "...",
                feedback="긴 문장이 구분 없이 이어짐",
                suggested_change=self._add_structure(prompt),
                confidence=0.8
            ))

        # 구체성 분석
        vague_words = ['것', '등', '기타', '여러']
        vague_count = sum(prompt.count(w) for w in vague_words)
        if vague_count > 3:
            gradients.append(TextGradient(
                gradient_type=GradientType.IMPROVE_SPECIFICITY,
                original_text=prompt[:100] + "...",
                feedback=f"모호한 표현 {vague_count}개 발견",
                suggested_change=self._make_specific(prompt),
                confidence=0.7
            ))

        # 간결성 분석
        if len(prompt) > 1000:
            gradients.append(TextGradient(
                gradient_type=GradientType.IMPROVE_CONCISENESS,
                original_text=prompt[:100] + "...",
                feedback="프롬프트가 너무 김",
                suggested_change=self._make_concise(prompt),
                confidence=0.6
            ))

        # 예시 부족 분석
        if "예:" not in prompt and "예시" not in prompt and "example" not in prompt.lower():
            gradients.append(TextGradient(
                gradient_type=GradientType.ADD_EXAMPLES,
                original_text=prompt[:100] + "...",
                feedback="예시가 없음",
                suggested_change=self._add_examples(prompt),
                confidence=0.75
            ))

        return gradients

    def _add_structure(self, prompt: str) -> str:
        """구조 추가"""
        # 시뮬레이션: 마침표 추가
        sentences = prompt.split('. ')
        return '.\n'.join(sentences)

    def _make_specific(self, prompt: str) -> str:
        """구체적으로 변경"""
        replacements = {
            '것': '항목',
            '등': '',
            '기타': '',
            '여러': '다수의'
        }
        result = prompt
        for old, new in replacements.items():
            result = result.replace(old, new)
        return result

    def _make_concise(self, prompt: str) -> str:
        """간결하게 변경"""
        # 시뮬레이션: 앞 800자만 유지
        if len(prompt) > 800:
            return prompt[:800] + "..."
        return prompt

    def _add_examples(self, prompt: str) -> str:
        """예시 추가"""
        return prompt + "\n\n예시:\n- 입력: 샘플 입력\n- 출력: 샘플 출력"

    def optimize_prompt(
        self,
        prompt: str,
        max_iterations: int = 5,
        score_threshold: float = 0.9
    ) -> tuple[str, list[OptimizationStep]]:
        """
        프롬프트 최적화

        Args:
            prompt: 최적화할 프롬프트
            max_iterations: 최대 반복 횟수
            score_threshold: 목표 점수

        Returns:
            (최적화된 프롬프트, 최적화 단계 목록)
        """
        current_prompt = prompt
        steps = []
        current_score = self._evaluate_prompt(current_prompt)

        for i in range(max_iterations):
            if current_score >= score_threshold:
                break

            gradients = self.analyze_prompt(current_prompt)
            if not gradients:
                break

            # 가장 신뢰도 높은 그래디언트 적용
            best_gradient = max(gradients, key=lambda g: g.confidence)
            new_prompt = best_gradient.apply()
            new_score = self._evaluate_prompt(new_prompt)

            step = OptimizationStep(
                step_number=i + 1,
                original_prompt=current_prompt,
                optimized_prompt=new_prompt,
                gradients_applied=[best_gradient],
                score_before=current_score,
                score_after=new_score
            )
            steps.append(step)

            if new_score > current_score:
                current_prompt = new_prompt
                current_score = new_score
            else:
                break

        return current_prompt, steps

    def _evaluate_prompt(self, prompt: str) -> float:
        """프롬프트 점수 평가"""
        score = 0.5

        # 길이 점수
        if 200 <= len(prompt) <= 800:
            score += 0.1

        # 구조 점수
        if prompt.count('\n') >= 2:
            score += 0.1

        # 예시 점수
        if '예:' in prompt or '예시' in prompt or 'example' in prompt.lower():
            score += 0.15

        # 명확성 점수
        if prompt.count('.') >= 3:
            score += 0.1

        return min(score, 1.0)

    def optimize_agent(
        self,
        agent_name: str,
        agent_prompt: str,
        max_iterations: int = 5
    ) -> AgentOptimizationResult:
        """
        에이전트 프롬프트 최적화

        Args:
            agent_name: 에이전트 이름
            agent_prompt: 에이전트 프롬프트
            max_iterations: 최대 반복 횟수

        Returns:
            최적화 결과
        """
        optimized_prompt, steps = self.optimize_prompt(
            agent_prompt, max_iterations
        )

        total_improvement = sum(s.improvement for s in steps)

        result = AgentOptimizationResult(
            agent_name=agent_name,
            original_prompt=agent_prompt,
            optimized_prompt=optimized_prompt,
            steps=steps,
            total_improvement=total_improvement,
            iterations=len(steps)
        )

        self._optimization_history.append(result)
        return result

    def optimize_all_agents(
        self,
        agents_dir: str,
        max_iterations: int = 5
    ) -> list[AgentOptimizationResult]:
        """
        모든 에이전트 프롬프트 최적화

        Args:
            agents_dir: 에이전트 디렉토리 경로
            max_iterations: 최대 반복 횟수

        Returns:
            최적화 결과 목록
        """
        results = []
        agents_path = Path(agents_dir)

        if not agents_path.exists():
            return results

        for agent_file in agents_path.glob("*.md"):
            agent_name = agent_file.stem
            agent_prompt = agent_file.read_text(encoding="utf-8")

            result = self.optimize_agent(
                agent_name, agent_prompt, max_iterations
            )
            results.append(result)

        return results

    def get_optimization_history(self) -> list[AgentOptimizationResult]:
        """최적화 히스토리 반환"""
        return self._optimization_history.copy()

    def generate_report(self, results: list[AgentOptimizationResult]) -> str:
        """
        최적화 리포트 생성

        Args:
            results: 최적화 결과 목록

        Returns:
            마크다운 형식 리포트
        """
        lines = ["# TextGrad 최적화 리포트\n"]

        total_agents = len(results)
        improved_agents = sum(1 for r in results if r.total_improvement > 0)
        avg_improvement = sum(r.total_improvement for r in results) / total_agents if total_agents > 0 else 0

        lines.append("## 요약\n")
        lines.append(f"- 분석된 에이전트: {total_agents}개")
        lines.append(f"- 개선된 에이전트: {improved_agents}개")
        lines.append(f"- 평균 개선율: {avg_improvement:.2%}\n")

        lines.append("## 상세 결과\n")
        lines.append("| 에이전트 | 반복 | 개선율 | 최종 점수 |")
        lines.append("|----------|------|--------|-----------|")

        for r in sorted(results, key=lambda x: -x.total_improvement):
            lines.append(
                f"| {r.agent_name} | {r.iterations} | "
                f"{r.total_improvement:.2%} | {r.final_score:.2f} |"
            )

        return "\n".join(lines)


# 편의 함수
def create_textgrad_optimizer(model: str = "claude-sonnet-4") -> TextGradOptimizer:
    """TextGrad 옵티마이저 생성"""
    return TextGradOptimizer(model=model)


def optimize_single_prompt(prompt: str, max_iterations: int = 5) -> str:
    """단일 프롬프트 최적화"""
    optimizer = create_textgrad_optimizer()
    optimized, _ = optimizer.optimize_prompt(prompt, max_iterations)
    return optimized
