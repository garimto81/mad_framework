# src/agents/dev_workflow.py
"""
개발 전용 병렬 멀티에이전트 워크플로우

4개의 전문 에이전트가 병렬로 개발 작업을 수행합니다:
- Architect Agent: 설계 및 구조
- Coder Agent: 구현
- Tester Agent: 테스트 작성
- Docs Agent: 문서화
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


class DevWorkflowState(TypedDict):
    """개발 워크플로우 상태"""

    task: str  # 개발 태스크
    context: dict  # 코드베이스 컨텍스트
    architecture: str  # 아키텍처 설계
    implementation: str  # 구현 코드
    tests: str  # 테스트 코드
    documentation: str  # 문서
    results: Annotated[list[dict], operator.add]  # 에이전트 결과 (Reducer)
    final_output: str  # 최종 통합 결과
    metadata: dict  # 메타데이터


class DevAgentResult(TypedDict):
    """에이전트 실행 결과"""

    agent_type: str
    output: str
    files_created: list[str]
    success: bool
    error: Optional[str]


# ============================================================================
# Agent System Prompts
# ============================================================================

ARCHITECT_PROMPT = """당신은 소프트웨어 아키텍트 에이전트입니다.

역할:
- 컴포넌트 구조 설계
- 인터페이스/타입 정의
- 의존성 분석 및 그래프 작성
- 디자인 패턴 적용

출력 형식:
```json
{
    "architecture": {
        "components": ["컴포넌트1", "컴포넌트2"],
        "interfaces": "타입 정의 코드",
        "dependencies": {"컴포넌트1": ["의존성1"]},
        "patterns": ["적용된 패턴"]
    },
    "diagram": "Mermaid 다이어그램",
    "notes": "설계 노트"
}
```
"""

CODER_PROMPT = """당신은 코더 에이전트입니다.

역할:
- 핵심 기능 구현
- 에러 핸들링
- 성능 최적화
- 클린 코드 작성

출력 형식:
```json
{
    "files": [
        {
            "path": "src/module.ts",
            "content": "코드 내용",
            "description": "파일 설명"
        }
    ],
    "implementation_notes": "구현 노트"
}
```
"""

TESTER_PROMPT = """당신은 테스터 에이전트입니다.

역할:
- 테스트 케이스 설계
- 유닛 테스트 작성
- 통합 테스트 작성
- 엣지 케이스 검증

출력 형식:
```json
{
    "test_files": [
        {
            "path": "tests/test_module.py",
            "content": "테스트 코드",
            "test_count": 10,
            "coverage_target": "90%"
        }
    ],
    "test_plan": "테스트 계획"
}
```
"""

DOCS_PROMPT = """당신은 문서화 에이전트입니다.

역할:
- API 문서 작성
- 사용 가이드 작성
- 인라인 주석 제안
- README 업데이트

출력 형식:
```json
{
    "api_docs": "API 문서 내용",
    "usage_guide": "사용 가이드",
    "readme_section": "README에 추가할 섹션",
    "inline_comments": ["주석 제안 목록"]
}
```
"""


# ============================================================================
# Model Initialization
# ============================================================================


def get_model(tier: str = "coder") -> ChatAnthropic:
    """티어별 모델 인스턴스 생성"""
    model_name = AGENT_MODEL_TIERS.get(tier, AGENT_MODEL_TIERS["default"])
    return ChatAnthropic(model=model_name)


# ============================================================================
# Node Functions
# ============================================================================


def supervisor_node(state: DevWorkflowState) -> dict:
    """
    Supervisor Node: 개발 태스크 분석 및 컨텍스트 수집
    """
    model = get_model("supervisor")

    system_prompt = """당신은 개발 프로젝트 슈퍼바이저입니다.
주어진 개발 태스크를 분석하고 각 에이전트에게 할당할 작업을 정의하세요.

출력 형식:
```json
{
    "task_analysis": "태스크 분석 결과",
    "architect_task": "아키텍트에게 할당할 작업",
    "coder_task": "코더에게 할당할 작업",
    "tester_task": "테스터에게 할당할 작업",
    "docs_task": "문서화 에이전트에게 할당할 작업"
}
```
"""

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"다음 개발 태스크를 분석하세요:\n\n{state['task']}"),
    ]

    response = model.invoke(messages)

    # 컨텍스트 파싱
    try:
        json_match = re.search(r"```json\s*(.*?)\s*```", response.content, re.DOTALL)
        if json_match:
            context = json.loads(json_match.group(1))
        else:
            context = {"task_analysis": response.content}
    except json.JSONDecodeError:
        context = {"task_analysis": response.content}

    return {"context": context}


def architect_node(state: DevWorkflowState) -> dict:
    """
    Architect Agent: 설계 및 구조
    """
    model = get_model("lead")
    context = state.get("context", {})

    messages = [
        SystemMessage(content=ARCHITECT_PROMPT),
        HumanMessage(
            content=f"""
태스크: {state['task']}

컨텍스트: {json.dumps(context, ensure_ascii=False, indent=2)}

이 태스크에 대한 아키텍처를 설계하세요.
"""
        ),
    ]

    try:
        response = model.invoke(messages)
        result: DevAgentResult = {
            "agent_type": "architect",
            "output": response.content,
            "files_created": [],
            "success": True,
            "error": None,
        }
        return {"architecture": response.content, "results": [result]}
    except Exception as e:
        result: DevAgentResult = {
            "agent_type": "architect",
            "output": "",
            "files_created": [],
            "success": False,
            "error": str(e),
        }
        return {"results": [result]}


def coder_node(state: DevWorkflowState) -> dict:
    """
    Coder Agent: 구현
    """
    model = get_model("coder")
    context = state.get("context", {})

    messages = [
        SystemMessage(content=CODER_PROMPT),
        HumanMessage(
            content=f"""
태스크: {state['task']}

컨텍스트: {json.dumps(context, ensure_ascii=False, indent=2)}

이 태스크를 구현하세요.
"""
        ),
    ]

    try:
        response = model.invoke(messages)
        result: DevAgentResult = {
            "agent_type": "coder",
            "output": response.content,
            "files_created": [],
            "success": True,
            "error": None,
        }
        return {"implementation": response.content, "results": [result]}
    except Exception as e:
        result: DevAgentResult = {
            "agent_type": "coder",
            "output": "",
            "files_created": [],
            "success": False,
            "error": str(e),
        }
        return {"results": [result]}


def tester_node(state: DevWorkflowState) -> dict:
    """
    Tester Agent: 테스트 작성
    """
    model = get_model("reviewer")
    context = state.get("context", {})

    messages = [
        SystemMessage(content=TESTER_PROMPT),
        HumanMessage(
            content=f"""
태스크: {state['task']}

컨텍스트: {json.dumps(context, ensure_ascii=False, indent=2)}

이 태스크에 대한 테스트를 작성하세요.
"""
        ),
    ]

    try:
        response = model.invoke(messages)
        result: DevAgentResult = {
            "agent_type": "tester",
            "output": response.content,
            "files_created": [],
            "success": True,
            "error": None,
        }
        return {"tests": response.content, "results": [result]}
    except Exception as e:
        result: DevAgentResult = {
            "agent_type": "tester",
            "output": "",
            "files_created": [],
            "success": False,
            "error": str(e),
        }
        return {"results": [result]}


def docs_node(state: DevWorkflowState) -> dict:
    """
    Docs Agent: 문서화
    """
    model = get_model("researcher")
    context = state.get("context", {})

    messages = [
        SystemMessage(content=DOCS_PROMPT),
        HumanMessage(
            content=f"""
태스크: {state['task']}

컨텍스트: {json.dumps(context, ensure_ascii=False, indent=2)}

이 태스크에 대한 문서를 작성하세요.
"""
        ),
    ]

    try:
        response = model.invoke(messages)
        result: DevAgentResult = {
            "agent_type": "docs",
            "output": response.content,
            "files_created": [],
            "success": True,
            "error": None,
        }
        return {"documentation": response.content, "results": [result]}
    except Exception as e:
        result: DevAgentResult = {
            "agent_type": "docs",
            "output": "",
            "files_created": [],
            "success": False,
            "error": str(e),
        }
        return {"results": [result]}


def integrator_node(state: DevWorkflowState) -> dict:
    """
    Integrator Node: 모든 결과 통합 및 검증
    """
    model = get_model("supervisor")

    # 각 에이전트 결과 수집
    results_by_type = {}
    for result in state.get("results", []):
        results_by_type[result["agent_type"]] = result

    system_prompt = """당신은 개발 결과 통합 전문가입니다.
각 에이전트의 결과를 검토하고 통합된 개발 보고서를 작성하세요.

보고서 형식:
1. 요약
2. 아키텍처 설계 결과
3. 구현 결과
4. 테스트 결과
5. 문서화 결과
6. 통합 검증
7. 다음 단계 권장사항
"""

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(
            content=f"""
원본 태스크: {state['task']}

아키텍처:
{state.get('architecture', 'N/A')}

구현:
{state.get('implementation', 'N/A')}

테스트:
{state.get('tests', 'N/A')}

문서:
{state.get('documentation', 'N/A')}

위 결과를 통합하고 최종 보고서를 작성하세요.
"""
        ),
    ]

    response = model.invoke(messages)
    return {"final_output": response.content}


# ============================================================================
# Graph Builder
# ============================================================================


def build_dev_workflow() -> StateGraph:
    """
    개발 워크플로우 그래프 생성

    구조:
    START -> supervisor -> [architect, coder, tester, docs] (병렬) -> integrator -> END
    """
    builder = StateGraph(DevWorkflowState)

    # 노드 추가
    builder.add_node("supervisor", supervisor_node)
    builder.add_node("architect", architect_node)
    builder.add_node("coder", coder_node)
    builder.add_node("tester", tester_node)
    builder.add_node("docs", docs_node)
    builder.add_node("integrator", integrator_node)

    # 엣지 정의
    builder.add_edge(START, "supervisor")

    # supervisor -> [architect, coder, tester, docs] (Fan-out: 병렬 실행)
    parallel_agents = ["architect", "coder", "tester", "docs"]
    builder.add_edge("supervisor", parallel_agents)

    # [architect, coder, tester, docs] -> integrator (Fan-in: 결과 집계)
    builder.add_edge(parallel_agents, "integrator")

    # integrator -> END
    builder.add_edge("integrator", END)

    return builder.compile()


# ============================================================================
# Execution Functions
# ============================================================================


def run_dev_workflow(task: str, context: dict = None) -> dict:
    """
    개발 워크플로우 실행

    Args:
        task: 개발 태스크 설명
        context: 추가 컨텍스트 (선택)

    Returns:
        실행 결과
    """
    workflow = build_dev_workflow()

    initial_state: DevWorkflowState = {
        "task": task,
        "context": context or {},
        "architecture": "",
        "implementation": "",
        "tests": "",
        "documentation": "",
        "results": [],
        "final_output": "",
        "metadata": {},
    }

    result = workflow.invoke(initial_state)
    return result


async def run_dev_workflow_async(task: str, context: dict = None) -> dict:
    """
    개발 워크플로우 비동기 실행

    Args:
        task: 개발 태스크 설명
        context: 추가 컨텍스트 (선택)

    Returns:
        실행 결과
    """
    workflow = build_dev_workflow()

    initial_state: DevWorkflowState = {
        "task": task,
        "context": context or {},
        "architecture": "",
        "implementation": "",
        "tests": "",
        "documentation": "",
        "results": [],
        "final_output": "",
        "metadata": {},
    }

    result = await workflow.ainvoke(initial_state)
    return result


# ============================================================================
# CLI Entry Point
# ============================================================================

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python dev_workflow.py '<task>'")
        print("Example: python dev_workflow.py '사용자 인증 기능 구현'")
        sys.exit(1)

    task = sys.argv[1]
    print(f"\n{'='*60}")
    print(f"개발 태스크: {task}")
    print(f"{'='*60}\n")

    result = run_dev_workflow(task)

    print(f"\n{'='*60}")
    print("최종 결과:")
    print(f"{'='*60}\n")
    print(result.get("final_output", "결과 없음"))
