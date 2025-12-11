# Agent 완전 참조 가이드

**목적**: 에이전트 분류 및 활용법

**버전**: 4.0.0 | **업데이트**: 2025-12-11 | **동기화**: CLAUDE.md v8.0.0

---

## 에이전트 소스 3계층

| 계층 | 위치 | 개수 | 역할 |
|------|------|------|------|
| **내장** | Claude Code | 4개 | 기본 subagent (직접 호출) |
| **루트 스킬** | `.claude/skills/` | 13개 | 자동/수동 트리거 스킬 |
| **플러그인** | `.claude/plugins/` | 56개 | 전문 에이전트 (25개 카테고리) |

---

## 1. 내장 Subagent (4개)

Claude Code 공식 내장, 직접 호출 가능:

| Agent | 용도 | 도구 | 호출 |
|-------|------|------|------|
| `general-purpose` | 복잡한 다단계 작업 | 모든 도구 | `Task(subagent_type="general-purpose")` |
| `Explore` | 코드베이스 빠른 탐색 | Glob, Grep, Read | `Task(subagent_type="Explore")` |
| `Plan` | 구현 계획 설계 | 읽기 도구만 | 자동 (Plan Mode) |
| `debugger` | 버그 분석/수정 | Read, Edit, Bash, Grep | `Task(subagent_type="debugger")` |

---

## 2. 플러그인 아키텍처 (56개 에이전트)

### 구조

```
.claude/plugins/
├── {category}/              # 25개 카테고리
│   ├── agents/              # 에이전트 정의 (.md)
│   ├── commands/            # 커맨드 정의 (.md)
│   └── skills/              # 스킬 정의 (SKILL.md)
```

### Phase별 에이전트 (19개)

#### Phase 0: 계획 (5개)

| Agent | 용도 |
|-------|------|
| `context7-engineer` | Context7 MCP로 최신 기술 문서 검증 |
| `exa-search-specialist` | Exasearch MCP로 고급 웹 검색 |
| `seq-engineer` | Sequential thinking으로 단계별 추론 |
| `task-decomposition-expert` | ChromaDB 기반 작업 분해 |
| `taskmanager-planner` | 작업 계획 및 WBS 설계 |

#### Phase 1: 개발 (6개)

| Agent | 용도 |
|-------|------|
| `backend-architect` | RESTful API, 마이크로서비스, DB 스키마 |
| `debugger` | 오류 분석, 테스트 실패, 근본 원인 분석 |
| `frontend-developer` | React, 반응형 디자인, 상태 관리 |
| `fullstack-developer` | 프론트엔드 + 백엔드 + DB 통합 |
| `mobile-developer` | React Native, Flutter |
| `typescript-expert` | 고급 타입 시스템, 타입 안전 패턴 |

#### Phase 2: 테스팅 (4개)

| Agent | 용도 |
|-------|------|
| `code-reviewer` | 코드 품질, 보안, 유지보수성 리뷰 |
| `playwright-engineer` | E2E 테스트 자동화 |
| `security-auditor` | OWASP 준수, 취약점 평가 |
| `test-automator` | 단위/통합/E2E 테스트 스위트 |

#### Phase 3: 아키텍처 (1개)

| Agent | 용도 |
|-------|------|
| `architect-reviewer` | SOLID 원칙, 아키텍처 일관성 리뷰 |

#### Phase 6: 배포 (3개)

| Agent | 용도 |
|-------|------|
| `cloud-architect` | 클라우드 인프라, 비용 최적화 |
| `deployment-engineer` | CI/CD 파이프라인, Docker |
| `devops-troubleshooter` | 프로덕션 이슈, 로그 분석 |

---

### 도메인별 에이전트 (37개)

#### AI/ML (5개)
| Agent | 용도 |
|-------|------|
| `ai-engineer` | LLM 애플리케이션, RAG 시스템 |
| `data-engineer` | ETL 파이프라인, 데이터 웨어하우스 |
| `data-scientist` | SQL, BigQuery, 통계 분석 |
| `ml-engineer` | ML 파이프라인, 모델 배포, MLOps |
| `prompt-engineer` | LLM 프롬프트 최적화 |

#### 백엔드 (2개)
| Agent | 용도 |
|-------|------|
| `graphql-architect` | GraphQL Federation, 성능 최적화 |
| `tdd-orchestrator` | Red-Green-Refactor, 멀티 에이전트 TDD |

#### 인프라 (5개)
| Agent | 용도 |
|-------|------|
| `kubernetes-architect` | 클라우드 네이티브, GitOps |
| `terraform-specialist` | IaC 자동화, 상태 관리 |
| `network-engineer` | 클라우드 네트워킹, 보안 아키텍처 |
| `database-architect` | DB 설계, 데이터 모델링 |
| `database-optimizer` | 쿼리 최적화, 마이그레이션 |

#### 언어별 (4개)
| Agent | 용도 |
|-------|------|
| `python-pro` | Python 3.12+, 비동기 프로그래밍 |
| `fastapi-pro` | FastAPI, SQLAlchemy, Pydantic |
| `javascript-pro` | ES6+, 비동기 패턴, Node.js |
| `typescript-pro` | 고급 타입, 제네릭, 엔터프라이즈 패턴 |

#### 특화 도구 (6개)
| Agent | 용도 |
|-------|------|
| `github-engineer` | 저장소 관리, Git 워크플로우, Actions |
| `supabase-engineer` | Supabase DB, RLS 정책 |
| `ui-ux-designer` | 사용자 중심 디자인, 인터페이스 시스템 |
| `api-documenter` | OpenAPI 3.1, API 문서화 |
| `docs-architect` | 기술 문서, 아키텍처 가이드 |
| `legacy-modernizer` | 레거시 마이그레이션, 프레임워크 업그레이드 |

#### 성능/모니터링 (2개)
| Agent | 용도 |
|-------|------|
| `observability-engineer` | 모니터링, 로깅, 트레이싱 |
| `performance-engineer` | 애플리케이션 최적화, 확장성 |

#### 워크플로우 (4개)
| Agent | 용도 |
|-------|------|
| `context-manager` | 동적 컨텍스트 관리, 메모리 시스템 |
| `dx-optimizer` | 개발자 경험 최적화, 툴링 개선 |
| `design-review` | UI/UX 리뷰, 접근성 테스트 |
| `pragmatic-code-review` | 실용적 코드 리뷰, 품질 균형 |

#### 메타 개발 (3개)
| Agent | 용도 |
|-------|------|
| `agent-expert` | Claude Code 에이전트 생성 |
| `command-expert` | CLI 커맨드 설계 |
| `mcp-expert` | MCP 서버 설정, 통합 |

---

## 3. 루트 스킬 (13개)

`.claude/skills/`의 자동/수동 트리거 스킬:

### 자동 트리거 (9개)

| 스킬 | Phase | 트리거 조건 | 연동 에이전트 |
|------|-------|------------|--------------|
| `tdd-workflow` | 1, 2 | "TDD", "테스트 먼저" | test-automator, debugger |
| `debugging-workflow` | 1, 2, 5 | "debug", "3회 실패" | debugger |
| `code-quality-checker` | 2, 2.5 | "린트", "품질 검사" | code-reviewer, security-auditor |
| `final-check-automation` | 5 | "E2E", "최종 검증" | playwright-engineer, security-auditor |
| `phase-validation` | 0-6 | "Phase 검증" | (내장 로직) |
| `pre-work-research` | 0 | "신규 기능", "오픈소스" | context7-engineer |
| `issue-resolution` | 1, 2 | "이슈 해결" | debugging-workflow, tdd-workflow |
| `parallel-agent-orchestration` | 1, 2 | "병렬 개발" | debugger, code-reviewer |
| `journey-sharing` | 4 | "여정 저장" | (내장 로직) |

### 수동 호출 (4개)

| 스킬 | 용도 |
|------|------|
| `webapp-testing` | 웹앱 테스트 가이드 |
| `pr-review-agent` | PR 리뷰 자동화 |
| `command-analytics` | 커맨드 사용 분석 |
| `skill-creator` | 스킬 생성 가이드 |

---

## 4. 활성 vs 비활성 에이전트

### Commands/Skills에서 직접 참조 (활성)

| Agent | 참조 위치 | Phase |
|-------|----------|-------|
| `context7-engineer` | pre-work, research | 0 |
| `debugger` | analyze, fix-issue, tdd | 1, 2, 5 |
| `backend-architect` | api-test | 1 |
| `code-reviewer` | check, optimize, tdd | 2, 2.5 |
| `test-automator` | fix-issue, tdd | 2 |
| `security-auditor` | check, api-test, final-check | 5 |
| `playwright-engineer` | final-check | 2, 5 |

### 활성화 예정 (P1)

상세: [PLANNED_AGENTS.md](./PLANNED_AGENTS.md)

---

## 5. 병렬 실행 패턴

### 패턴 1: Phase 0 병렬 분석
```
context7-engineer (기술 스택 검증)
  ∥
exa-search-specialist (웹 검색)
  ∥
Explore (코드베이스 탐색)
```

### 패턴 2: Phase 1 병렬 개발
```
backend-architect (API 설계)
  ∥
frontend-developer (UI 구현)
  ∥
debugger (버그 수정)
```

### 패턴 3: Phase 2 병렬 테스트
```
test-automator (단위 테스트)
  ∥
playwright-engineer (E2E 테스트)
  ∥
security-auditor (보안 스캔)
```

---

## 6. Agent 선택 가이드

| 작업 | 추천 Agent | Phase |
|------|-----------|-------|
| 기술 검증 | `context7-engineer` | 0 |
| 작업 분해 | `task-decomposition-expert` | 0 |
| 버그 분석 | `debugger` | 1 |
| API 설계 | `backend-architect` | 1 |
| 프론트엔드 | `frontend-developer` | 1 |
| 테스트 작성 | `test-automator` | 2 |
| 코드 리뷰 | `code-reviewer` | 2 |
| 보안 검사 | `security-auditor` | 2, 5 |
| E2E 테스트 | `playwright-engineer` | 2, 5 |
| 아키텍처 리뷰 | `architect-reviewer` | 3 |
| 배포 | `deployment-engineer` | 6 |

---

## 참조

- [CLAUDE.md](../CLAUDE.md) - 핵심 워크플로우 (v8.0.0)
- [PLANNED_AGENTS.md](./PLANNED_AGENTS.md) - 활성화 예정 에이전트
- [COMMAND_SELECTOR.md](./COMMAND_SELECTOR.md) - 커맨드 선택 가이드
- `.claude/plugins/` - 플러그인 상세

---

**관리**: Claude Code
**업데이트**: 2025-12-11
**버전**: 4.0.0
