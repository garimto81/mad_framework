# src/agents/test_workflow.py
"""
테스트 전용 병렬 멀티에이전트 워크플로우

4개의 전문 테스트 에이전트가 병렬로 테스트를 수행합니다:
- Unit Tester: 단위 테스트
- Integration Tester: 통합 테스트
- E2E Tester: End-to-End 테스트
- Security Tester: 보안 테스트
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


class TestWorkflowState(TypedDict):
    """테스트 워크플로우 상태"""

    target: str  # 테스트 대상
    scope: str  # 테스트 범위 (전체/모듈/파일)
    test_plan: dict  # 테스트 계획
    unit_results: dict  # 단위 테스트 결과
    integration_results: dict  # 통합 테스트 결과
    e2e_results: dict  # E2E 테스트 결과
    security_results: dict  # 보안 테스트 결과
    results: Annotated[list[dict], operator.add]  # 에이전트 결과 (Reducer)
    final_report: str  # 최종 리포트
    metadata: dict  # 메타데이터


class TestResult(TypedDict):
    """테스트 실행 결과"""

    tester_type: str
    total: int
    passed: int
    failed: int
    skipped: int
    coverage: Optional[float]
    issues: list[dict]
    output: str
    success: bool
    error: Optional[str]


# ============================================================================
# Tester System Prompts
# ============================================================================

UNIT_TESTER_PROMPT = """당신은 단위 테스트 전문가입니다.

역할:
- 함수, 클래스, 모듈 단위 테스트 분석
- 엣지 케이스 식별
- 모킹/스터빙 전략 수립
- 테스트 커버리지 분석

출력 형식:
```json
{
    "total_tests": 50,
    "passed": 48,
    "failed": 2,
    "skipped": 0,
    "coverage": 85.5,
    "failed_tests": [
        {
            "name": "test_function_name",
            "file": "tests/test_module.py:45",
            "reason": "실패 원인",
            "fix_suggestion": "수정 제안"
        }
    ],
    "coverage_details": {
        "statements": 85,
        "branches": 80,
        "functions": 90,
        "lines": 85
    },
    "recommendations": ["권장사항 목록"]
}
```
"""

INTEGRATION_TESTER_PROMPT = """당신은 통합 테스트 전문가입니다.

역할:
- API 엔드포인트 테스트 분석
- 데이터베이스 연동 테스트
- 외부 서비스 통합 검증
- 트랜잭션 일관성 확인

출력 형식:
```json
{
    "total_tests": 20,
    "passed": 18,
    "failed": 1,
    "skipped": 1,
    "api_coverage": {
        "endpoints_tested": 15,
        "total_endpoints": 18,
        "coverage": 83.3
    },
    "failed_tests": [
        {
            "name": "test_api_endpoint",
            "endpoint": "/api/users",
            "method": "POST",
            "expected": "status 409",
            "actual": "status 500",
            "fix_suggestion": "수정 제안"
        }
    ],
    "recommendations": ["권장사항 목록"]
}
```
"""

E2E_TESTER_PROMPT = """당신은 E2E(End-to-End) 테스트 전문가입니다.

역할:
- 사용자 시나리오 테스트 분석
- UI 인터랙션 검증
- 크로스 브라우저 호환성 확인
- 성능 벤치마크

출력 형식:
```json
{
    "total_tests": 10,
    "passed": 9,
    "failed": 1,
    "skipped": 0,
    "user_flows_tested": [
        "로그인/로그아웃",
        "회원가입",
        "상품 검색"
    ],
    "failed_tests": [
        {
            "name": "test_checkout_flow",
            "scenario": "쿠폰 적용 후 결제",
            "step_failed": "쿠폰 적용 버튼 클릭",
            "reason": "타임아웃",
            "screenshot": "screenshots/checkout_error.png",
            "fix_suggestion": "수정 제안"
        }
    ],
    "performance": {
        "avg_load_time": "2.3s",
        "slowest_page": "/checkout"
    },
    "recommendations": ["권장사항 목록"]
}
```
"""

SECURITY_TESTER_PROMPT = """당신은 보안 테스트 전문가입니다.

역할:
- OWASP Top 10 취약점 검사
- SQL Injection, XSS 테스트
- 인증/인가 검증
- 민감 데이터 노출 검사

출력 형식:
```json
{
    "total_checks": 15,
    "passed": 14,
    "failed": 1,
    "severity_summary": {
        "critical": 0,
        "high": 1,
        "medium": 0,
        "low": 0
    },
    "vulnerabilities": [
        {
            "type": "SQL Injection",
            "severity": "high",
            "location": "src/api/search.ts:25",
            "description": "사용자 입력이 직접 쿼리에 삽입됨",
            "vulnerable_code": "const query = `SELECT * FROM products WHERE name LIKE '%${searchTerm}%'`",
            "fix_suggestion": "파라미터화된 쿼리 사용",
            "fixed_code": "const query = 'SELECT * FROM products WHERE name LIKE ?'"
        }
    ],
    "owasp_checklist": {
        "A01_Broken_Access_Control": "pass",
        "A02_Cryptographic_Failures": "pass",
        "A03_Injection": "fail",
        "A04_Insecure_Design": "pass",
        "A05_Security_Misconfiguration": "pass"
    },
    "recommendations": ["권장사항 목록"]
}
```
"""


# ============================================================================
# Model Initialization
# ============================================================================


def get_model(tier: str = "reviewer") -> ChatAnthropic:
    """티어별 모델 인스턴스 생성"""
    model_name = AGENT_MODEL_TIERS.get(tier, AGENT_MODEL_TIERS["default"])
    return ChatAnthropic(model=model_name)


# ============================================================================
# Node Functions
# ============================================================================


def supervisor_node(state: TestWorkflowState) -> dict:
    """
    Supervisor Node: 테스트 범위 분석 및 계획 수립
    """
    model = get_model("supervisor")

    system_prompt = """당신은 테스트 프로젝트 슈퍼바이저입니다.
주어진 테스트 대상을 분석하고 각 테스터에게 할당할 작업을 정의하세요.

출력 형식:
```json
{
    "analysis": "테스트 대상 분석",
    "unit_scope": "단위 테스트 범위",
    "integration_scope": "통합 테스트 범위",
    "e2e_scope": "E2E 테스트 범위",
    "security_scope": "보안 테스트 범위",
    "priority_order": ["우선순위 순서"]
}
```
"""

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(
            content=f"""
테스트 대상: {state['target']}
테스트 범위: {state.get('scope', '전체')}

테스트 계획을 수립하세요.
"""
        ),
    ]

    response = model.invoke(messages)

    try:
        json_match = re.search(r"```json\s*(.*?)\s*```", response.content, re.DOTALL)
        if json_match:
            test_plan = json.loads(json_match.group(1))
        else:
            test_plan = {"analysis": response.content}
    except json.JSONDecodeError:
        test_plan = {"analysis": response.content}

    return {"test_plan": test_plan}


def unit_tester_node(state: TestWorkflowState) -> dict:
    """
    Unit Tester: 단위 테스트
    """
    model = get_model("reviewer")
    test_plan = state.get("test_plan", {})

    messages = [
        SystemMessage(content=UNIT_TESTER_PROMPT),
        HumanMessage(
            content=f"""
테스트 대상: {state['target']}
단위 테스트 범위: {test_plan.get('unit_scope', '전체 함수/클래스')}

단위 테스트를 분석하고 결과를 보고하세요.
"""
        ),
    ]

    try:
        response = model.invoke(messages)
        result: TestResult = {
            "tester_type": "unit",
            "total": 0,
            "passed": 0,
            "failed": 0,
            "skipped": 0,
            "coverage": None,
            "issues": [],
            "output": response.content,
            "success": True,
            "error": None,
        }
        return {"unit_results": {"output": response.content}, "results": [result]}
    except Exception as e:
        result: TestResult = {
            "tester_type": "unit",
            "total": 0,
            "passed": 0,
            "failed": 0,
            "skipped": 0,
            "coverage": None,
            "issues": [],
            "output": "",
            "success": False,
            "error": str(e),
        }
        return {"results": [result]}


def integration_tester_node(state: TestWorkflowState) -> dict:
    """
    Integration Tester: 통합 테스트
    """
    model = get_model("reviewer")
    test_plan = state.get("test_plan", {})

    messages = [
        SystemMessage(content=INTEGRATION_TESTER_PROMPT),
        HumanMessage(
            content=f"""
테스트 대상: {state['target']}
통합 테스트 범위: {test_plan.get('integration_scope', '전체 API')}

통합 테스트를 분석하고 결과를 보고하세요.
"""
        ),
    ]

    try:
        response = model.invoke(messages)
        result: TestResult = {
            "tester_type": "integration",
            "total": 0,
            "passed": 0,
            "failed": 0,
            "skipped": 0,
            "coverage": None,
            "issues": [],
            "output": response.content,
            "success": True,
            "error": None,
        }
        return {
            "integration_results": {"output": response.content},
            "results": [result],
        }
    except Exception as e:
        result: TestResult = {
            "tester_type": "integration",
            "total": 0,
            "passed": 0,
            "failed": 0,
            "skipped": 0,
            "coverage": None,
            "issues": [],
            "output": "",
            "success": False,
            "error": str(e),
        }
        return {"results": [result]}


def e2e_tester_node(state: TestWorkflowState) -> dict:
    """
    E2E Tester: End-to-End 테스트
    """
    model = get_model("reviewer")
    test_plan = state.get("test_plan", {})

    messages = [
        SystemMessage(content=E2E_TESTER_PROMPT),
        HumanMessage(
            content=f"""
테스트 대상: {state['target']}
E2E 테스트 범위: {test_plan.get('e2e_scope', '주요 사용자 플로우')}

E2E 테스트를 분석하고 결과를 보고하세요.
"""
        ),
    ]

    try:
        response = model.invoke(messages)
        result: TestResult = {
            "tester_type": "e2e",
            "total": 0,
            "passed": 0,
            "failed": 0,
            "skipped": 0,
            "coverage": None,
            "issues": [],
            "output": response.content,
            "success": True,
            "error": None,
        }
        return {"e2e_results": {"output": response.content}, "results": [result]}
    except Exception as e:
        result: TestResult = {
            "tester_type": "e2e",
            "total": 0,
            "passed": 0,
            "failed": 0,
            "skipped": 0,
            "coverage": None,
            "issues": [],
            "output": "",
            "success": False,
            "error": str(e),
        }
        return {"results": [result]}


def security_tester_node(state: TestWorkflowState) -> dict:
    """
    Security Tester: 보안 테스트
    """
    model = get_model("reviewer")
    test_plan = state.get("test_plan", {})

    messages = [
        SystemMessage(content=SECURITY_TESTER_PROMPT),
        HumanMessage(
            content=f"""
테스트 대상: {state['target']}
보안 테스트 범위: {test_plan.get('security_scope', 'OWASP Top 10')}

보안 테스트를 분석하고 결과를 보고하세요.
"""
        ),
    ]

    try:
        response = model.invoke(messages)
        result: TestResult = {
            "tester_type": "security",
            "total": 0,
            "passed": 0,
            "failed": 0,
            "skipped": 0,
            "coverage": None,
            "issues": [],
            "output": response.content,
            "success": True,
            "error": None,
        }
        return {"security_results": {"output": response.content}, "results": [result]}
    except Exception as e:
        result: TestResult = {
            "tester_type": "security",
            "total": 0,
            "passed": 0,
            "failed": 0,
            "skipped": 0,
            "coverage": None,
            "issues": [],
            "output": "",
            "success": False,
            "error": str(e),
        }
        return {"results": [result]}


def reporter_node(state: TestWorkflowState) -> dict:
    """
    Reporter Node: 종합 테스트 리포트 생성
    """
    model = get_model("supervisor")

    system_prompt = """당신은 테스트 리포트 작성 전문가입니다.
각 테스터의 결과를 종합하여 상세한 테스트 리포트를 작성하세요.

리포트 형식:
1. 요약 대시보드
2. 단위 테스트 결과
3. 통합 테스트 결과
4. E2E 테스트 결과
5. 보안 테스트 결과
6. 권장 조치사항 (우선순위별)
7. 실행 명령어
"""

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(
            content=f"""
테스트 대상: {state['target']}

단위 테스트:
{state.get('unit_results', {}).get('output', 'N/A')}

통합 테스트:
{state.get('integration_results', {}).get('output', 'N/A')}

E2E 테스트:
{state.get('e2e_results', {}).get('output', 'N/A')}

보안 테스트:
{state.get('security_results', {}).get('output', 'N/A')}

위 결과를 종합하여 최종 테스트 리포트를 작성하세요.
"""
        ),
    ]

    response = model.invoke(messages)
    return {"final_report": response.content}


# ============================================================================
# Graph Builder
# ============================================================================


def build_test_workflow() -> StateGraph:
    """
    테스트 워크플로우 그래프 생성

    구조:
    START -> supervisor -> [unit, integration, e2e, security] (병렬) -> reporter -> END
    """
    builder = StateGraph(TestWorkflowState)

    # 노드 추가
    builder.add_node("supervisor", supervisor_node)
    builder.add_node("unit_tester", unit_tester_node)
    builder.add_node("integration_tester", integration_tester_node)
    builder.add_node("e2e_tester", e2e_tester_node)
    builder.add_node("security_tester", security_tester_node)
    builder.add_node("reporter", reporter_node)

    # 엣지 정의
    builder.add_edge(START, "supervisor")

    # supervisor -> [testers] (Fan-out: 병렬 실행)
    parallel_testers = [
        "unit_tester",
        "integration_tester",
        "e2e_tester",
        "security_tester",
    ]
    builder.add_edge("supervisor", parallel_testers)

    # [testers] -> reporter (Fan-in: 결과 집계)
    builder.add_edge(parallel_testers, "reporter")

    # reporter -> END
    builder.add_edge("reporter", END)

    return builder.compile()


# ============================================================================
# Execution Functions
# ============================================================================


def run_test_workflow(target: str, scope: str = "전체") -> dict:
    """
    테스트 워크플로우 실행

    Args:
        target: 테스트 대상 (파일, 모듈, 프로젝트)
        scope: 테스트 범위

    Returns:
        실행 결과
    """
    workflow = build_test_workflow()

    initial_state: TestWorkflowState = {
        "target": target,
        "scope": scope,
        "test_plan": {},
        "unit_results": {},
        "integration_results": {},
        "e2e_results": {},
        "security_results": {},
        "results": [],
        "final_report": "",
        "metadata": {},
    }

    result = workflow.invoke(initial_state)
    return result


async def run_test_workflow_async(target: str, scope: str = "전체") -> dict:
    """
    테스트 워크플로우 비동기 실행

    Args:
        target: 테스트 대상
        scope: 테스트 범위

    Returns:
        실행 결과
    """
    workflow = build_test_workflow()

    initial_state: TestWorkflowState = {
        "target": target,
        "scope": scope,
        "test_plan": {},
        "unit_results": {},
        "integration_results": {},
        "e2e_results": {},
        "security_results": {},
        "results": [],
        "final_report": "",
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
        print("Usage: python test_workflow.py '<target>' [scope]")
        print("Example: python test_workflow.py 'src/auth' '전체'")
        sys.exit(1)

    target = sys.argv[1]
    scope = sys.argv[2] if len(sys.argv) > 2 else "전체"

    print(f"\n{'='*60}")
    print(f"테스트 대상: {target}")
    print(f"테스트 범위: {scope}")
    print(f"{'='*60}\n")

    result = run_test_workflow(target, scope)

    print(f"\n{'='*60}")
    print("테스트 리포트:")
    print(f"{'='*60}\n")
    print(result.get("final_report", "결과 없음"))
