# src/agents/parallel_workflow.py
"""
LangGraph 기반 병렬 멀티에이전트 워크플로우

Fan-Out / Fan-In 패턴으로 서브에이전트를 병렬 실행합니다.
"""

from typing import TypedDict, Annotated, Optional
import operator
import json
import re

from langgraph.graph import StateGraph, START, END
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from .config import AGENT_MODEL_TIERS


# ============================================================================
# State Definitions
# ============================================================================

class WorkflowState(TypedDict):
    """워크플로우 상태"""
    task: str                                          # 원본 태스크
    subtasks: list[str]                                # 분해된 서브태스크
    results: Annotated[list[dict], operator.add]       # 에이전트 결과 (Reducer)
    final_output: str                                  # 최종 출력
    error_count: int                                   # 에러 횟수
    metadata: dict                                     # 추가 메타데이터


class SubtaskResult(TypedDict):
    """서브태스크 실행 결과"""
    agent_id: str
    subtask: str
    output: str
    success: bool
    error: Optional[str]


# ============================================================================
# Model Initialization
# ============================================================================

def get_model(tier: str = "default") -> ChatAnthropic:
    """티어별 모델 인스턴스 생성"""
    model_name = AGENT_MODEL_TIERS.get(tier, AGENT_MODEL_TIERS["default"])
    return ChatAnthropic(model=model_name)


# ============================================================================
# Node Functions
# ============================================================================

def supervisor_node(state: WorkflowState) -> dict:
    """
    Supervisor Node: 태스크를 서브태스크로 분해
    """
    model = get_model("supervisor")

    system_prompt = """당신은 태스크 분해 전문가입니다.
주어진 태스크를 3개의 독립적인 서브태스크로 분해하세요.

출력 형식:
```json
{
    "subtasks": [
        "서브태스크 1 설명",
        "서브태스크 2 설명",
        "서브태스크 3 설명"
    ]
}
```

규칙:
1. 각 서브태스크는 독립적으로 실행 가능해야 함
2. 서브태스크 간 의존성 최소화
3. 명확하고 구체적인 지시사항 포함
"""

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"다음 태스크를 분해하세요:\n\n{state['task']}")
    ]

    response = model.invoke(messages)
    content = response.content

    # JSON 파싱
    try:
        # JSON 블록 추출
        json_match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
        if json_match:
            parsed = json.loads(json_match.group(1))
        else:
            parsed = json.loads(content)
        subtasks = parsed.get("subtasks", [])
    except json.JSONDecodeError:
        # 폴백: 줄바꿈으로 분리
        lines = [line.strip() for line in content.split('\n') if line.strip() and not line.startswith('#')]
        subtasks = lines[:3] if len(lines) >= 3 else lines + ["추가 분석 필요"] * (3 - len(lines))

    return {"subtasks": subtasks}


def create_subagent_node(agent_id: int):
    """
    서브에이전트 노드 팩토리

    Args:
        agent_id: 에이전트 인덱스 (0, 1, 2, ...)

    Returns:
        노드 함수
    """
    def subagent_node(state: WorkflowState) -> dict:
        model = get_model("researcher")

        # 해당 서브태스크 가져오기
        if agent_id >= len(state["subtasks"]):
            return {
                "results": [{
                    "agent_id": str(agent_id),
                    "subtask": "N/A",
                    "output": "서브태스크 없음",
                    "success": False,
                    "error": "Index out of range"
                }]
            }

        subtask = state["subtasks"][agent_id]

        system_prompt = f"""당신은 서브에이전트 #{agent_id}입니다.
주어진 서브태스크를 수행하고 결과를 보고하세요.

결과는 명확하고 구조화된 형태로 제공하세요.
"""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"서브태스크:\n{subtask}\n\n이 태스크를 수행하세요.")
        ]

        try:
            response = model.invoke(messages)
            result: SubtaskResult = {
                "agent_id": str(agent_id),
                "subtask": subtask,
                "output": response.content,
                "success": True,
                "error": None
            }
        except Exception as e:
            result: SubtaskResult = {
                "agent_id": str(agent_id),
                "subtask": subtask,
                "output": "",
                "success": False,
                "error": str(e)
            }

        return {"results": [result]}

    return subagent_node


def aggregator_node(state: WorkflowState) -> dict:
    """
    Aggregator Node: 모든 서브에이전트 결과를 종합
    """
    model = get_model("supervisor")

    # 결과 수집
    successful_results = [r for r in state["results"] if r.get("success", False)]
    failed_results = [r for r in state["results"] if not r.get("success", False)]

    results_text = "\n\n".join([
        f"## 에이전트 #{r['agent_id']} 결과\n**서브태스크**: {r['subtask']}\n**출력**:\n{r['output']}"
        for r in successful_results
    ])

    if failed_results:
        results_text += "\n\n## 실패한 태스크\n"
        results_text += "\n".join([
            f"- 에이전트 #{r['agent_id']}: {r.get('error', 'Unknown error')}"
            for r in failed_results
        ])

    system_prompt = """당신은 결과 종합 전문가입니다.
여러 서브에이전트의 결과를 분석하고 종합적인 최종 보고서를 작성하세요.

보고서 형식:
1. 요약 (Executive Summary)
2. 세부 분석 결과
3. 결론 및 권장사항
"""

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"원본 태스크: {state['task']}\n\n서브에이전트 결과:\n{results_text}")
    ]

    response = model.invoke(messages)

    return {"final_output": response.content}


def error_handler_node(state: WorkflowState) -> dict:
    """
    에러 핸들러 노드: 재시도 또는 폴백 결정
    """
    error_count = state.get("error_count", 0) + 1
    return {"error_count": error_count}


# ============================================================================
# Graph Builder
# ============================================================================

def build_parallel_workflow(num_agents: int = 3) -> StateGraph:
    """
    병렬 워크플로우 그래프 생성

    Args:
        num_agents: 병렬 실행할 서브에이전트 수

    Returns:
        컴파일된 StateGraph
    """
    builder = StateGraph(WorkflowState)

    # 노드 추가
    builder.add_node("supervisor", supervisor_node)

    agent_names = []
    for i in range(num_agents):
        agent_name = f"agent_{i}"
        agent_names.append(agent_name)
        builder.add_node(agent_name, create_subagent_node(i))

    builder.add_node("aggregator", aggregator_node)

    # 엣지 정의
    # START -> supervisor
    builder.add_edge(START, "supervisor")

    # supervisor -> [agent_0, agent_1, agent_2] (Fan-out: 병렬 실행)
    builder.add_edge("supervisor", agent_names)

    # [agent_0, agent_1, agent_2] -> aggregator (Fan-in: 결과 집계)
    builder.add_edge(agent_names, "aggregator")

    # aggregator -> END
    builder.add_edge("aggregator", END)

    return builder.compile()


# ============================================================================
# Execution Functions
# ============================================================================

def run_parallel_task(task: str, num_agents: int = 3) -> dict:
    """
    병렬 태스크 실행

    Args:
        task: 실행할 태스크 설명
        num_agents: 병렬 에이전트 수

    Returns:
        실행 결과
    """
    workflow = build_parallel_workflow(num_agents)

    initial_state: WorkflowState = {
        "task": task,
        "subtasks": [],
        "results": [],
        "final_output": "",
        "error_count": 0,
        "metadata": {}
    }

    result = workflow.invoke(initial_state)
    return result


async def run_parallel_task_async(task: str, num_agents: int = 3) -> dict:
    """
    병렬 태스크 비동기 실행

    Args:
        task: 실행할 태스크 설명
        num_agents: 병렬 에이전트 수

    Returns:
        실행 결과
    """
    workflow = build_parallel_workflow(num_agents)

    initial_state: WorkflowState = {
        "task": task,
        "subtasks": [],
        "results": [],
        "final_output": "",
        "error_count": 0,
        "metadata": {}
    }

    result = await workflow.ainvoke(initial_state)
    return result


# ============================================================================
# Specialized Workflows
# ============================================================================

def build_research_workflow() -> StateGraph:
    """리서치 전용 워크플로우"""
    return build_parallel_workflow(num_agents=5)


def build_code_review_workflow() -> StateGraph:
    """코드 리뷰 전용 워크플로우 (Security, Logic, Style, Performance)"""
    return build_parallel_workflow(num_agents=4)


def build_validation_workflow() -> StateGraph:
    """Phase 검증 전용 워크플로우"""
    return build_parallel_workflow(num_agents=4)


# ============================================================================
# CLI Entry Point
# ============================================================================

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python parallel_workflow.py '<task>'")
        print("Example: python parallel_workflow.py '프로젝트 구조 분석 및 개선안 제시'")
        sys.exit(1)

    task = sys.argv[1]
    print(f"\n{'='*60}")
    print(f"태스크: {task}")
    print(f"{'='*60}\n")

    result = run_parallel_task(task)

    print(f"\n{'='*60}")
    print("최종 결과:")
    print(f"{'='*60}\n")
    print(result.get("final_output", "결과 없음"))
