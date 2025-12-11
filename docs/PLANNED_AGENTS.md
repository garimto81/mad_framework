# 플러그인 에이전트 활성화 로드맵

**목적**: 정의된 에이전트 중 미활성화 상태인 에이전트 활성화 계획

**버전**: 2.0.0 | **업데이트**: 2025-12-11 | **동기화**: AGENTS_REFERENCE.md v4.0.0

---

## 현황 요약

| 구분 | 개수 | 상태 |
|------|------|------|
| 플러그인 에이전트 총계 | 56개 | `.claude/plugins/` |
| 현재 활성 | 7개 | Commands/Skills에서 참조 |
| 미활성 (정의만 존재) | 49개 | 활성화 필요 |

---

## 현재 활성 에이전트 (7개)

Commands/Skills에서 직접 참조되어 실제 사용 중:

| Agent | 참조 위치 | Phase |
|-------|----------|-------|
| `context7-engineer` | pre-work, research | 0 |
| `debugger` | analyze, fix-issue, tdd | 1, 2, 5 |
| `backend-architect` | api-test | 1 |
| `code-reviewer` | check, optimize, tdd | 2, 2.5 |
| `test-automator` | fix-issue, tdd | 2 |
| `security-auditor` | check, api-test, final-check | 5 |
| `playwright-engineer` | final-check | 2, 5 |

---

## 활성화 로드맵

### P0: 즉시 활성화 (6개)

자주 사용되는 시나리오에 필요한 에이전트:

| Agent | 카테고리 | 연동 커맨드 | 우선 이유 |
|-------|----------|------------|----------|
| `frontend-developer` | phase-1 | `/work`, `/parallel dev` | 프론트엔드 작업 빈번 |
| `python-pro` | python-development | `/work`, `/tdd` | Python 프로젝트 주력 |
| `fastapi-pro` | python-development | `/api-test` | FastAPI 백엔드 |
| `database-architect` | database-tools | `/work` | DB 설계 필요 |
| `deployment-engineer` | phase-6 | `/work` | 배포 자동화 |
| `github-engineer` | specialized-tools | `/commit`, `/pr` | Git 워크플로우 |

### P1: 단기 활성화 (12개)

커맨드 기능 확장에 필요:

| Agent | 카테고리 | 연동 커맨드 |
|-------|----------|------------|
| `fullstack-developer` | phase-1 | `/work` |
| `typescript-expert` | phase-1 | `/check` |
| `architect-reviewer` | phase-3 | `/parallel review` |
| `cloud-architect` | phase-6 | `/work` |
| `devops-troubleshooter` | phase-6 | `/analyze logs` |
| `graphql-architect` | backend | `/api-test` |
| `tdd-orchestrator` | backend | `/tdd` |
| `database-optimizer` | database-tools | `/optimize` |
| `kubernetes-architect` | cicd | `/work` |
| `terraform-specialist` | cicd | `/work` |
| `observability-engineer` | performance | `/analyze logs` |
| `performance-engineer` | performance | `/optimize` |

### P2: 중기 활성화 (15개)

특화 기능 확장:

| Agent | 카테고리 | 용도 |
|-------|----------|------|
| `exa-search-specialist` | phase-0 | 고급 웹 검색 |
| `seq-engineer` | phase-0 | 복잡한 추론 |
| `task-decomposition-expert` | phase-0 | 작업 분해 |
| `taskmanager-planner` | phase-0 | 작업 계획 |
| `mobile-developer` | phase-1 | 모바일 앱 |
| `ai-engineer` | ai-ml | LLM 앱 |
| `data-engineer` | ai-ml | ETL 파이프라인 |
| `data-scientist` | ai-ml | 데이터 분석 |
| `ml-engineer` | ai-ml | ML 파이프라인 |
| `prompt-engineer` | ai-ml | 프롬프트 최적화 |
| `javascript-pro` | javascript | JS 전문 |
| `typescript-pro` | javascript | TS 전문 |
| `network-engineer` | cloud | 네트워킹 |
| `supabase-engineer` | specialized | Supabase |
| `legacy-modernizer` | refactoring | 레거시 이전 |

### P3: 장기 활성화 (16개)

필요 시 활성화:

| Agent | 카테고리 | 용도 |
|-------|----------|------|
| `context-manager` | orchestration | 컨텍스트 관리 |
| `api-documenter` | api-testing | API 문서화 |
| `docs-architect` | documentation | 기술 문서 |
| `dx-optimizer` | debugging | DX 최적화 |
| `design-review` | workflow | 디자인 리뷰 |
| `pragmatic-code-review` | workflow | 실용적 리뷰 |
| `ui-ux-designer` | specialized | UI/UX 설계 |
| `agent-expert` | meta | 에이전트 생성 |
| `command-expert` | meta | 커맨드 설계 |
| `mcp-expert` | meta | MCP 설정 |

---

## 활성화 방법

### 1. 커맨드에서 직접 참조

```markdown
# .claude/commands/work.md

## Phase 1: 개발
Task: Use Task tool with subagent_type="frontend-developer"
프롬프트: React 컴포넌트 구현
```

### 2. 스킬에서 연동

```markdown
# .claude/skills/tdd-workflow/SKILL.md

연동 에이전트:
- test-automator
- tdd-orchestrator (신규 활성화)
```

### 3. 병렬 실행 패턴 추가

```markdown
# .claude/commands/parallel.md

## /parallel dev 확장

Task 1: frontend-developer (신규)
Task 2: backend-architect (기존)
Task 3: debugger (기존)
```

---

## 아카이브 에이전트 (6개)

`.claude/plugins.archive/`로 이동됨 (사용 빈도 낮음):

```
cli-ui-designer
django-pro
docusaurus-expert
hybrid-cloud-architect
temporal-python-pro
tutorial-engineer
```

복구 필요 시: `plugins.archive/` → `plugins/` 이동

---

## 참조

- [AGENTS_REFERENCE.md](./AGENTS_REFERENCE.md) - 전체 에이전트 목록
- [CLAUDE.md](../CLAUDE.md) - 핵심 워크플로우
- `.claude/plugins/` - 에이전트 정의 파일

---

**관리**: Claude Code
**업데이트**: 2025-12-11
**버전**: 2.0.0
