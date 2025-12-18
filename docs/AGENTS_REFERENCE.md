# Agent 참조 가이드

**목적**: 에이전트 분류 및 활용법

**버전**: 6.4.0 | **업데이트**: 2025-12-17 | **PRD**: PRD-0031

---

## 에이전트 구조

| 계층 | 위치 | 개수 | 역할 |
|------|------|------|------|
| **내장** | Claude Code | 4개 | 기본 subagent |
| **커스텀** | `.claude/agents/` | 19개 | 전문 에이전트 |
| **스킬** | `.claude/skills/` | 15개 | 자동/수동 트리거 |
| **MCP** | `.claude.json` | 1개 | 외부 도구 연동 |

---

## 1. 내장 Subagent (4개)

| Agent | 용도 | 호출 |
|-------|------|------|
| `general-purpose` | 복잡한 다단계 작업 | `Task(subagent_type="general-purpose")` |
| `Explore` | 코드베이스 빠른 탐색 | `Task(subagent_type="Explore")` |
| `Plan` | 구현 계획 설계 | 자동 (Plan Mode) |
| `debugger` | 버그 분석/수정 | `Task(subagent_type="debugger")` |

---

## 2. 커스텀 에이전트 (19개)

### Tier 1: CORE (6개) - 필수

| Agent | 용도 | 모델 |
|-------|------|------|
| `code-reviewer` | 코드 리뷰, 품질 검사 | sonnet |
| `architect` | 설계, 아키텍처 결정 | opus |
| `debugger` | 버그 분석, 트러블슈팅 | sonnet |
| `test-engineer` | 테스트 (TDD, E2E, 단위) | sonnet |
| `security-auditor` | 보안 취약점 분석 | sonnet |
| `docs-writer` | API/시스템 문서화 | sonnet |

### Tier 2: DOMAIN (8개) - 도메인별 전문

| Agent | 용도 | 모델 |
|-------|------|------|
| `frontend-dev` | 프론트엔드, UI/UX | sonnet |
| `backend-dev` | 백엔드, API 개발 | sonnet |
| `fullstack-dev` | 풀스택 개발 | opus |
| `devops-engineer` | CI/CD, 인프라, K8s | sonnet |
| `cloud-architect` | 클라우드, 네트워크 | sonnet |
| `database-specialist` | DB 설계, 최적화 | sonnet |
| `data-specialist` | 데이터, ML 파이프라인 | sonnet |
| `ai-engineer` | LLM, RAG 시스템 | sonnet |

### Tier 3: LANGUAGE (2개) - 언어 전문

| Agent | 용도 | 모델 |
|-------|------|------|
| `typescript-dev` | TypeScript 고급 패턴 | sonnet |
| `python-dev` | Python 고급 패턴 | sonnet |

### Tier 4: TOOLING (3개) - 도구 전문

| Agent | 용도 | 모델 |
|-------|------|------|
| `github-engineer` | GitHub 워크플로우 | sonnet |
| `claude-expert` | Claude Code, MCP, 에이전트 | opus |
| `catalog-engineer` | WSOPTV 카탈로그/제목 생성 (Block F/G) | sonnet |

---

## 3. MCP 서버 (1개)

### 설치된 MCP

| MCP | 패키지 | 용도 |
|-----|--------|------|
| `code-reviewer` | `@vibesnipe/code-review-mcp` | AI 코드 리뷰 |

### 내장 기능으로 대체됨

| 기존 MCP | 대체 내장 기능 |
|----------|---------------|
| `context7` (기술 문서) | `WebSearch` + `WebFetch` |
| `sequential-thinking` (추론) | `Extended Thinking` (Claude 4 내장) |
| `taskmanager` (작업 관리) | `TodoWrite` / `TodoRead` |
| `exa` (웹 검색) | `WebSearch` |

### 추가 권장

| MCP | 패키지 | 용도 |
|-----|--------|------|
| `github` | `@anthropic/mcp-server-github` | GitHub API 통합 |

### 설치 방법

```bash
# 설치
claude mcp add <name> -- npx -y <package>

# 목록 확인
claude mcp list

# 제거
claude mcp remove <name>
```

---

## 4. 에이전트 사용 가이드

### 호출 방법

```
"Use the [agent-name] agent to [task]"

예:
- "Use the code-reviewer agent to review this PR"
- "Use the architect agent to design the API"
- "Use the test-engineer agent to write E2E tests"
```

### 선택 기준

| 상황 | 추천 에이전트 |
|------|--------------|
| 코드 작성 후 리뷰 | `code-reviewer` |
| 설계 결정 필요 | `architect` |
| 버그 분석 | `debugger` |
| 테스트 작성 | `test-engineer` |
| 보안 점검 | `security-auditor` |
| 문서 작성 | `docs-writer` |
| React/UI 개발 | `frontend-dev` |
| API 개발 | `backend-dev` |
| 전체 기능 개발 | `fullstack-dev` |
| CI/CD, K8s | `devops-engineer` |
| AWS/Azure/GCP | `cloud-architect` |
| DB 설계/최적화 | `database-specialist` |
| 데이터/ML | `data-specialist` |
| LLM/RAG | `ai-engineer` |
| TS 고급 타입 | `typescript-dev` |
| Python 고급 | `python-dev` |
| GitHub 워크플로우 | `github-engineer` |
| Claude Code 설정 | `claude-expert` |
| WSOPTV 카탈로그 | `catalog-engineer` |

---

## 5. 통합 이력 (PRD-0031)

### 삭제된 에이전트 (→ 내장 기능 대체)

| 에이전트 | 대체 기능 |
|---------|---------|
| `context7-engineer` | `WebSearch` / `WebFetch` 내장 |
| `exa-search-specialist` | `WebSearch` 내장 |
| `seq-engineer` | `Extended Thinking` 내장 |
| `taskmanager-planner` | `TodoWrite` 내장 |

### 통합된 에이전트

| 삭제 | 통합 대상 |
|------|----------|
| `typescript-pro`, `typescript-expert` | → `typescript-dev` |
| `database-architect`, `database-optimizer`, `supabase-engineer` | → `database-specialist` |
| `data-scientist`, `data-engineer`, `ml-engineer` | → `data-specialist` |
| `deployment-engineer`, `devops-troubleshooter`, `kubernetes-architect`, `terraform-specialist` | → `devops-engineer` |
| `frontend-developer`, `UI_UX-Designer`, `design-review` | → `frontend-dev` |
| `backend-architect`, `architect-reviewer`, `graphql-architect` | → `architect` |
| `test-automator`, `playwright-engineer`, `tdd-orchestrator` | → `test-engineer` |
| `pragmatic-code-review` | → `code-reviewer` |
| `api-documenter`, `docs-architect` | → `docs-writer` |
| `cloud-architect`, `network-engineer` | → `cloud-architect` |
| `agent-expert`, `command-expert`, `mcp-expert`, `prompt-engineer` | → `claude-expert` |

### 백업 위치

삭제된 에이전트: `.claude/agents.backup/`

---

## 버전 이력

| 버전 | 날짜 | 변경 |
|------|------|------|
| 6.4.0 | 2025-12-17 | 스킬 개수 수정 (13개 → 15개: supabase-integration, vercel-deployment 추가) |
| 6.3.0 | 2025-12-16 | MCP 정리 (5개 → 1개), 내장 기능 대체 문서화 |
| 6.2.0 | 2025-12-16 | MCP 5개로 업데이트 (exa, code-reviewer 추가) |
| 6.1.0 | 2025-12-12 | `catalog-engineer` 추가 (18 → 19개) |
| 6.0.0 | 2025-12-11 | PRD-0031 적용: 50개 → 18개 통합, MCP 분리 |
| 5.0.0 | 2025-12-11 | plugins/ → agents/ 이동, 구조 개편 |
