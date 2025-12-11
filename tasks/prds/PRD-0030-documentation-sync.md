# PRD-0030: 전역 지침 및 워크플로우 문서 동기화

**Version**: 3.0.0 | **Date**: 2025-12-11 | **Status**: In Progress
**Priority**: P0 | **Parent**: [PRD-0025](./PRD-0025-master-workflow-optimization.md)

---

## 1. Executive Summary

### 문제 정의

전체 분석 결과, 전역 지침 문서(CLAUDE.md)와 관련 참조 문서들 간의 **버전 불일치**, **내용 누락**, **커맨드/에이전트 체계 불명확**이 확인되었습니다:

| 카테고리 | 문제 | 현재 상태 | 영향도 |
|---------|------|----------|--------|
| **버전** | AGENTS_REFERENCE.md 동기화 | v3.6.0 기준 (CLAUDE.md는 v7.3.0) | 높음 |
| **버전** | README.md 버전 | v1.0.0 표기 (실제 v7.3.0) | 중간 |
| **커맨드** | 개수 불일치 | 19개 표기 (실제 20개) | 중간 |
| **커맨드** | 선택 가이드 부재 | 20개 중 어느 것 사용할지 불명확 | 높음 |
| **커맨드** | 중복 기능 | /work vs /work-auto, /check vs /parallel review | 중간 |
| **에이전트** | 미사용 에이전트 | 21개 정의만 됨 (실제 미호출) | 높음 |
| **에이전트** | 스킬 미문서화 | 13개 스킬 존재, CLAUDE.md 미기술 | 높음 |
| **아키텍처** | src/agents/ 구조 | CLAUDE.md에 미기술 | 중간 |
| **플러그인** | .claude/plugins/ 미문서화 | 25개 카테고리, 50+ 에이전트 존재 | **최고** |

### 제안 솔루션

1. **CLAUDE.md v8.0.0 업데이트**: 커맨드 체계 재정립, src/agents/ 및 Skills 구조 추가
2. **AGENTS_REFERENCE.md v4.0.0 전면 개편**: `.claude/plugins/` 구조 기반으로 재작성
3. **커맨드 선택 가이드 신설**: docs/COMMAND_SELECTOR.md 생성
4. **에이전트 정리**: plugins 내 미활성 에이전트 → PLANNED_AGENTS.md로 이관
5. **README.md 버전 동기화**: v8.0.0
6. **플러그인 아키텍처 문서화**: 25개 카테고리, 3계층 구조 설명

### 예상 효과

| 지표 | 현재 | 목표 |
|------|------|------|
| 문서 일관성 점수 | 62% | **95%+** |
| 커맨드 선택 명확도 | 40% | **90%+** |
| 에이전트 활용률 | 28% (7/49) | **85%+** |
| 플러그인 문서화율 | 0% | **100%** |

---

## 2. 상세 분석 결과

### 2.1 커맨드 전체 분석 (20개)

#### A. 현재 커맨드 분류 체계

| 카테고리 | 커맨드 | 설명 | 의존성 |
|---------|--------|------|--------|
| **핵심 워크플로우** | `/work` | 전체 워크플로우 자동화 | `/parallel`, `/issue`, `/tdd` |
| | `/work-auto` | 완전 자동화 (최종 보고서만) | `/pre-work`, `/tdd`, `/commit` |
| | `/parallel` | 멀티에이전트 병렬 실행 | `/tdd`, `/issue` |
| | `/issue` | GitHub 이슈 생명주기 관리 | `/work` |
| **사전 작업** | `/pre-work` | 솔루션 검색 + 중복 확인 | `/parallel-research` |
| | `/research` | 코드베이스 분석 (RPI Phase 1) | `/plan` |
| **개발** | `/plan` | 구현 계획 수립 (RPI Phase 2) | `/research` |
| | `/tdd` | Red-Green-Refactor 가이드 | `/commit` |
| | `/create` | PRD/PR/문서 생성 | `/todo`, `/commit` |
| **검증** | `/check` | 코드 품질 + 보안 스캔 | 독립 |
| | `/optimize` | 성능 분석 및 최적화 | 독립 |
| | `/api-test` | API 엔드포인트 테스트 | 독립 |
| | `/final-check` | E2E 엄격 검증 | `/create-pr` |
| | `/analyze` | 코드/로그 분석 | 독립 |
| **문서 & 커밋** | `/commit` | Conventional Commits | 독립 |
| | `/changelog` | CHANGELOG 자동 생성 | 독립 |
| | `/pr` | PR 리뷰 + 자동 머지 | 독립 |
| **세션 관리** | `/todo` | 작업 목록 관리 | 독립 |
| | `/journey` | 세션 여정 기록 | `/create-pr` |
| | `/compact` | 컨텍스트 압축 | 독립 |

#### B. 중복/유사 기능 분석

| 그룹 | 커맨드 A | 커맨드 B | 교집합 | 개선안 |
|------|---------|---------|--------|--------|
| 전체 워크플로우 | `/work` | `/work-auto` | 90% | `--auto` 옵션으로 통합 (현재 설계대로 유지) |
| 코드 분석 | `/analyze code` | `/research` | 70% | 용도 명확화: 시각화 vs 영향 범위 |
| 테스트 | `/api-test` | `/parallel test` | 50% | API만 vs 전체 테스트 구분 |
| 코드 품질 | `/check` | `/parallel review` | 40% | 정적 분석 vs 리뷰어 기반 구분 |

#### C. 커맨드 개선 계획

| 우선순위 | 개선 항목 | 현재 | 목표 |
|---------|----------|------|------|
| **P0** | 커맨드 선택 가이드 | 없음 | docs/COMMAND_SELECTOR.md 신설 |
| **P0** | 에러 처리 표준화 | 일부만 | 모든 커맨드에 fallback 추가 |
| **P1** | 병렬 실행 인터페이스 | 불일치 | /parallel 4가지 모드 통일 |
| **P1** | 문서화 평준화 | 수준 차이 | 모든 커맨드 동일 섹션 |
| **P2** | 컨텍스트 관리 | 불명확 | /compact + /journey 역할 정의 |

---

### 2.2 에이전트/스킬 전체 분석

#### A. src/agents/ 모듈 구조 (6개)

| 모듈 | 라인 | 목적 | 핵심 기능 |
|------|------|------|----------|
| `config.py` | 98 | 모델 티어링 | `AGENT_MODEL_TIERS`, `PHASE_AGENTS` |
| `parallel_workflow.py` | 360 | Fan-Out/Fan-In | supervisor → subagents → aggregator |
| `dev_workflow.py` | 538 | 병렬 개발 | Architect + Coder + Tester + Docs |
| `test_workflow.py` | 648 | 병렬 테스트 | Unit + Integration + E2E + Security |
| `phase_validator.py` | 259 | Phase 검증 | 비동기 Phase 0-6 검증 |
| `utils.py` | 188 | 유틸리티 | 타임아웃, 세마포어, 포맷팅 |

#### B. .claude/skills/ 스킬 목록 (13개)

| 스킬 | Phase | 자동 트리거 | 의존 에이전트 |
|------|-------|-----------|--------------|
| `tdd-workflow` | 1, 2 | true | test-automator, debugger |
| `debugging-workflow` | 1, 2, 5 | true | debugger (subagent) |
| `code-quality-checker` | 2, 2.5 | true | code-reviewer, security-auditor |
| `final-check-automation` | 5 | true | playwright-engineer, security-auditor |
| `phase-validation` | 0-6 | true | None |
| `pre-work-research` | 0 | true | context7-engineer |
| `issue-resolution` | 1, 2 | true | debugging-workflow, tdd-workflow |
| `parallel-agent-orchestration` | 1, 2 | true | debugger, code-reviewer |
| `journey-sharing` | 4 | true | None |
| `webapp-testing` | - | false | None |
| `pr-review-agent` | - | false | general-purpose |
| `command-analytics` | - | false | None |
| `skill-creator` | - | false | None |

#### C. 에이전트 분류 현황

| 분류 | 개수 | 상태 | 개선안 |
|------|------|------|--------|
| 내장 Subagent | 4개 | 활성 | 유지 |
| 로컬 - 활성 | 7개 | Commands에서 직접 참조 | 유지 |
| 로컬 - 대기 | 21개 | CLAUDE.md 언급, 미호출 | PLANNED_AGENTS.md로 이관 |
| 로컬 - 미사용 | 21개 | 정의만 존재 | 아카이브 또는 삭제 |
| 아카이브 | 6개 | .claude/plugins.archive/ | 유지 |

#### D. 에이전트 개선 계획

| 우선순위 | 개선 항목 | 현재 | 목표 |
|---------|----------|------|------|
| **P0** | 미사용 에이전트 정리 | 21개 방치 | PLANNED_AGENTS.md 이관 |
| **P0** | AGENTS_REFERENCE.md 재작성 | v3.6.0 동기화 | 실제 구현 기준 (v7.4.0+) |
| **P1** | 스킬 문서화 | 미기술 | CLAUDE.md에 13개 스킬 추가 |
| **P1** | Phase별 스킬 매핑 | 불명확 | 명시적 Phase → 스킬 표 |
| **P2** | 모듈 최적화 | PowerShell 의존 | Python 단독 실행 |

---

### 2.3 .claude/plugins/ 구조 분석 (신규 발견)

#### A. 플러그인 아키텍처 개요

```
.claude/plugins/
├── {category}/              # 25개 카테고리
│   ├── agents/              # 에이전트 정의 (.md)
│   ├── commands/            # 커맨드 정의 (.md)
│   └── skills/              # 스킬 정의 (SKILL.md)
```

#### B. 카테고리 목록 (25개)

| 분류 | 카테고리 |
|------|----------|
| **Phase별** | phase-0-planning, phase-1-development, phase-2-testing, phase-3-architecture, phase-6-deployment |
| **언어별** | python-development, javascript-typescript |
| **도메인별** | backend-development, database-tools, cloud-infrastructure |
| **인프라** | cicd-automation, kubernetes-operations, security-scanning |
| **품질** | code-refactoring, debugging-toolkit, application-performance |
| **워크플로우** | agent-orchestration, workflow-reviews, git-pr-workflows |
| **기타** | meta-development, ai-ml-tools, specialized-tools, full-stack-orchestration, code-documentation, api-testing-observability |

#### C. 3계층 구조 상세

##### 1. Agent (에이전트)
**역할**: 특정 분야의 전문가
**파일 형식**: YAML 프론트매터 + Markdown

```yaml
# 예: .claude/plugins/phase-0-planning/agents/context7-engineer.md
name: context7-engineer
description: 기술 스택 검증 전문가
model: sonnet

## Expert Purpose
## Capabilities (세부 카테고리별)
## Behavioral Traits
## Knowledge Base
## Response Approach (1-10단계)
## Example Interactions
```

##### 2. Skill (스킬)
**역할**: 재사용 가능한 지식/패턴
**파일 형식**: SKILL.md

```yaml
# 예: .claude/plugins/backend-development/skills/api-design-principles/SKILL.md
name: api-design-principles
description: REST/GraphQL API 설계 원칙

## When to Use This Skill
## Core Concepts (이론)
## Design Patterns (구현 패턴 + 코드)
## Best Practices
## Common Pitfalls
## Resources
```

##### 3. Command (커맨드)
**역할**: 멀티 에이전트 워크플로우 오케스트레이션
**파일 형식**: Markdown (프론트매터 없음)

```markdown
# 예: .claude/plugins/backend-development/commands/feature-development.md

## Phase 1: Discovery
Task: Use Task tool with subagent_type="context7-engineer"

## Phase 2: Implementation
Task: Use Task tool with subagent_type="backend-architect"

## Phase 3: Testing
Task: Use Task tool with subagent_type="test-automator"
```

#### D. 사용 흐름

```
사용자 요청
    │
    ▼
┌─────────────────┐
│   Command       │ ← 워크플로우 정의
│ (오케스트레이터) │
└────────┬────────┘
         │
    ┌────┴────┬────────┐
    ▼         ▼        ▼
┌───────┐ ┌───────┐ ┌───────┐
│Agent 1│ │Agent 2│ │Agent 3│  ← 전문가 실행
└───┬───┘ └───┬───┘ └───┬───┘
    │         │        │
    ▼         ▼        ▼
┌───────┐ ┌───────┐ ┌───────┐
│Skill A│ │Skill B│ │Skill C│  ← 지식/패턴 참조
└───────┘ └───────┘ └───────┘
```

#### E. plugins vs .claude/skills 비교

| 항목 | `.claude/skills/` | `.claude/plugins/` |
|------|-------------------|-------------------|
| **위치** | 루트 스킬 | 카테고리별 플러그인 |
| **개수** | 13개 | 25개 카테고리, 50+ 에이전트 |
| **활성화** | 자동/수동 트리거 | 명시적 호출 필요 |
| **문서화** | CLAUDE.md 기술 | 미문서화 |

#### F. 플러그인 개선 계획

| 우선순위 | 개선 항목 | 현재 | 목표 |
|---------|----------|------|------|
| **P0** | 플러그인 아키텍처 문서화 | 0% | AGENTS_REFERENCE.md v4.0.0 |
| **P0** | 활성 에이전트 식별 | 불명확 | Phase별 활성 에이전트 매핑 |
| **P1** | plugins vs skills 관계 정리 | 중복 혼란 | 역할 명확화 문서 |
| **P2** | 미사용 플러그인 정리 | 50+ 방치 | 아카이브 또는 활성화 |

---

## 3. 상세 구현 계획

### Phase 1: CLAUDE.md v8.0.0 업데이트 (60분)

#### Task 1.1: 버전 및 헤더 수정
```markdown
변경 전: **Version**: 7.3.0
변경 후: **Version**: 8.0.0
```

#### Task 1.2: 커맨드 섹션 전면 개편

```markdown
## 커맨드 (20개)

### 핵심 워크플로우 (4개)

| 커맨드 | 용도 | 옵션 |
|--------|------|------|
| `/work "내용"` | 전체 워크플로우 | `--auto`, `--skip-analysis`, `--no-issue`, `--strict` |
| `/work-auto "내용"` | 완전 자동화 | 최종 보고서만 확인 |
| `/parallel <mode>` | 병렬 실행 | `dev`, `test`, `review`, `research`, `check` |
| `/issue <action>` | 이슈 관리 | `list`, `create`, `edit`, `fix`, `failed` |

### 사전 작업 (2개)

| 커맨드 | 용도 |
|--------|------|
| `/pre-work` | 솔루션 검색 + 중복 확인 + Make vs Buy |
| `/research` | 코드베이스 분석 (RPI Phase 1) |

### 개발 (3개)

| 커맨드 | 용도 |
|--------|------|
| `/plan` | 구현 계획 수립 (RPI Phase 2) |
| `/tdd` | Red-Green-Refactor 가이드 |
| `/create <type>` | PRD/PR/문서 생성 (`prd`, `pr`, `docs`) |

### 검증 (5개)

| 커맨드 | 용도 |
|--------|------|
| `/check` | 린트 + 타입 + 보안 |
| `/optimize` | 성능 분석 |
| `/api-test` | API 엔드포인트 테스트 |
| `/final-check` | E2E 엄격 검증 |
| `/analyze <type>` | 코드/로그 분석 (`code`, `logs`) |

### 문서 & 커밋 (3개)

| 커맨드 | 용도 |
|--------|------|
| `/commit` | Conventional Commits |
| `/changelog` | CHANGELOG 자동 생성 |
| `/pr <action>` | PR 리뷰/머지 (`review`, `improve`, `auto`) |

### 세션 관리 (3개)

| 커맨드 | 용도 |
|--------|------|
| `/todo <action>` | 작업 관리 (`list`, `add`, `done`, `clear`) |
| `/journey <action>` | 세션 여정 (`save`, `load`, `link`) |
| `/compact` | 컨텍스트 압축 |
```

#### Task 1.3: 프로젝트 구조 확장

```markdown
## 프로젝트 구조

Claude Code 전역 워크플로우 설정 저장소:

```
D:\AI\claude01\
├── .claude/
│   ├── commands/        # 커스텀 슬래시 커맨드 (20개)
│   └── skills/          # 커스텀 스킬 (13개)
│       ├── tdd-workflow/
│       ├── debugging-workflow/
│       ├── code-quality-checker/
│       ├── final-check-automation/
│       ├── phase-validation/
│       ├── pre-work-research/
│       ├── issue-resolution/
│       ├── parallel-agent-orchestration/
│       ├── journey-sharing/
│       ├── webapp-testing/
│       ├── pr-review-agent/
│       ├── command-analytics/
│       └── skill-creator/
├── docs/                # 워크플로우 문서
├── src/agents/          # AI 워크플로우 에이전트 (Python)
│   ├── config.py              # 모델 티어링 (Sonnet/Haiku)
│   ├── parallel_workflow.py   # Fan-Out/Fan-In 병렬 실행
│   ├── dev_workflow.py        # 4-에이전트 병렬 개발
│   ├── test_workflow.py       # 4-에이전트 병렬 테스트
│   ├── phase_validator.py     # Phase 0-6 검증
│   └── utils.py               # 유틸리티
└── tasks/prds/          # PRD 문서
```
```

#### Task 1.4: 스킬 섹션 신설

```markdown
## 스킬 (13개)

자동 트리거되는 스킬 목록:

| 스킬 | Phase | 트리거 조건 |
|------|-------|-----------|
| `tdd-workflow` | 1, 2 | "TDD", "테스트 먼저" |
| `debugging-workflow` | 1, 2, 5 | "debug", "3회 실패" |
| `code-quality-checker` | 2, 2.5 | "린트", "품질 검사" |
| `final-check-automation` | 5 | "E2E", "최종 검증" |
| `phase-validation` | 0-6 | "Phase 검증" |
| `pre-work-research` | 0 | "신규 기능", "오픈소스" |
| `issue-resolution` | 1, 2 | "이슈 해결" |
| `parallel-agent-orchestration` | 1, 2 | "병렬 개발" |
| `journey-sharing` | 4 | "여정 저장" |

수동 호출 스킬: `webapp-testing`, `pr-review-agent`, `command-analytics`, `skill-creator`
```

#### Task 1.5: 커맨드 선택 가이드 추가

```markdown
## 커맨드 선택 가이드

| 작업 유형 | 추천 커맨드 | 순서 |
|----------|------------|------|
| 신규 기능 추가 | `/work` | pre-work → 구현 → E2E → PR |
| 버그 수정 | `/issue fix #N` | 분석 → 수정 → 테스트 |
| 성능 최적화 | `/optimize` → `/tdd` | 병목 분석 → TDD 구현 |
| 코드 리팩토링 | `/parallel review` → `/check` | 리뷰 → 품질 검사 |
| PR 리뷰 | `/pr review` → `/pr auto` | 리뷰 → 자동 머지 |
| E2E 검증 | `/final-check` | 테스트 → 자동 수정 |
```

---

### Phase 2: AGENTS_REFERENCE.md 전면 개편 (45분)

#### Task 2.1: 버전 및 동기화 표기 수정

```markdown
변경 전: **버전**: 2.1.0 | **동기화**: CLAUDE.md v3.6.0
변경 후: **버전**: 3.0.0 | **동기화**: CLAUDE.md v8.0.0
```

#### Task 2.2: 에이전트 분류 재정립

```markdown
## 에이전트 분류 (v3.0.0)

### 실제 활성 에이전트 (11개)

| 분류 | 에이전트 | 호출 위치 |
|------|---------|----------|
| 내장 Subagent | `general-purpose`, `Explore`, `Plan`, `debugger` | Task() 직접 호출 |
| 로컬 활성 | `code-reviewer`, `test-automator`, `security-auditor`, `playwright-engineer`, `context7-engineer`, `backend-architect` | Commands/Skills |

### 계획 에이전트 (21개) → docs/PLANNED_AGENTS.md 참조

미구현 에이전트는 별도 문서로 관리:
- python-pro, frontend-developer, database-architect 등
```

#### Task 2.3: 스킬 ↔ 에이전트 매핑 추가

```markdown
## 스킬-에이전트 매핑

| 스킬 | 사용 에이전트 |
|------|-------------|
| tdd-workflow | test-automator, debugger |
| debugging-workflow | debugger (subagent) |
| code-quality-checker | code-reviewer, security-auditor |
| final-check-automation | playwright-engineer, security-auditor |
| pre-work-research | context7-engineer |
| issue-resolution | debugging-workflow, tdd-workflow |
| pr-review-agent | general-purpose |
```

---

### Phase 3: 신규 문서 생성 (30분)

#### Task 3.1: docs/COMMAND_SELECTOR.md 생성

```markdown
# 커맨드 선택 가이드

## 시나리오별 추천

### 시나리오 1: 신규 기능 추가
1. `/pre-work "기능 설명"` - 솔루션 검색, 중복 확인
2. `/work "기능 설명"` - 분석 + 구현 + E2E
3. `/pr auto` - 리뷰 + 자동 머지

### 시나리오 2: 버그 수정
1. `/issue list` - 버그 이슈 확인
2. `/issue fix #N` - 이슈 기반 구현
3. `/final-check` - E2E 검증
4. `/pr auto` - 머지

### 시나리오 3: 성능 최적화
1. `/analyze logs` - 병목 지점 식별
2. `/optimize` - 최적화 제안
3. `/tdd "최적화"` - TDD 기반 구현
4. `/parallel test` - 전체 테스트

### 시나리오 4: 대규모 리팩토링
1. `/research --codebase` - 영향 범위 분석
2. `/plan --detailed` - 단계별 계획
3. `/work-auto "리팩토링"` - 완전 자동화
```

#### Task 3.2: docs/PLANNED_AGENTS.md 생성

```markdown
# 계획 에이전트 목록 (미구현)

## 개발 에이전트 (6개)
| 에이전트 | 용도 | 구현 우선순위 |
|---------|------|-------------|
| python-pro | Python 고급 구현 | P2 |
| frontend-developer | React/Next.js | P1 |
| database-architect | DB 스키마 설계 | P1 |
| typescript-expert | TypeScript 타입 시스템 | P2 |
| mobile-developer | React Native/Flutter | P3 |
| graphql-architect | GraphQL 스키마 | P3 |

## 인프라 에이전트 (4개)
(...)

## 데이터 에이전트 (3개)
(...)
```

---

### Phase 4: README.md 및 정리 (20분)

#### Task 4.1: README.md 버전 수정

```markdown
![Version](https://img.shields.io/badge/version-8.0.0-blue)
![Last Updated](https://img.shields.io/badge/updated-2025--12--11-green)
```

#### Task 4.2: 삭제 대기 커맨드 처리

```bash
git add -A .claude/commands/
git commit -m "chore(commands): 삭제 대기 커맨드 6개 정리

삭제된 파일:
- autopilot.md
- create-docs.md
- create-pr.md
- create-prd.md
- parallel-research.md
- parallel-review.md

Refs: PRD-0030, #59"
```

#### Task 4.3: 전체 문서 일관성 검증

```bash
# 검증 스크립트 실행
python scripts/doc_sync_check.py

# 예상 결과
✅ CLAUDE.md v8.0.0
✅ AGENTS_REFERENCE.md v3.0.0 (동기화: v8.0.0)
✅ README.md v8.0.0
✅ 커맨드 개수: 20개 (문서 = 실제)
✅ 스킬 개수: 13개 (문서 = 실제)
```

---

## 4. 성공 지표

| 지표 | 현재 | 목표 | 측정 방법 |
|------|------|------|----------|
| 문서 일관성 | 62% | 95%+ | 자동화 스크립트 |
| 버전 불일치 | 4개 | 0개 | grep 검증 |
| 커맨드 정확도 | 95% | 100% | 파일 개수 vs 문서 |
| 커맨드 선택 명확도 | 40% | 90%+ | 가이드 문서 완성 |
| 에이전트 활용률 | 28% | 85%+ | 활성 vs 전체 비율 |
| 스킬 문서화율 | 0% | 100% | CLAUDE.md 포함 여부 |

---

## 5. 마일스톤

| Phase | 내용 | 예상 소요 | 완료 조건 |
|-------|------|----------|----------|
| 1 | CLAUDE.md v8.0.0 | 60분 | 5개 Task 완료 |
| 2 | AGENTS_REFERENCE.md v3.0.0 | 45분 | 3개 Task 완료 |
| 3 | 신규 문서 생성 | 30분 | 2개 문서 생성 |
| 4 | README.md 및 정리 | 20분 | 3개 Task 완료 |

**총 예상 소요**: ~155분 (약 2.5시간)

---

## 6. 리스크

| 리스크 | 영향 | 완화 방안 |
|--------|------|----------|
| 버전 점프 (7.3.0 → 8.0.0) | 낮음 | MAJOR 변경 근거 문서화 |
| 문서 수정 중 정보 손실 | 중간 | git commit 전 백업 |
| 미사용 에이전트 이관 혼란 | 낮음 | PLANNED_AGENTS.md 명확한 설명 |
| 커맨드 분류 변경 적응 | 중간 | 기존 사용법 호환 유지 |

---

## 7. 첨부 자료

### A. 커맨드 의존성 매트릭스

```
             /work /parallel /issue /pre-work /tdd /commit /check /pr
/work          -      ✅       ✅      ✅      ✅    ✅      ✅    ✅
/work-auto   alias     ✅       ✅      ✅      ✅    ✅      ✅    ✅
/parallel    direct     -       ✅      ✅      ✅    ✅      ✅    ✅
/issue       direct    ✅        -      ✅      ✅    ✅      ✅    ✅
/pre-work     ✅       ✅       ✅       -       -     -       -     -
/tdd          ✅       ✅        -       -       -    ✅      ✅    -
/commit       ✅       ✅       ✅       -      ✅     -       -    ✅
/check        ✅       ✅        -       -      ✅     -       -     -
/pr           ✅       ✅       ✅       -       -    ✅       -     -
```

### B. Phase별 스킬 활성화 매트릭스

```
Phase | pre-work | tdd | debug | quality | phase | final | issue | parallel
------+----------+-----+-------+---------+-------+-------+-------+---------
  0   |    ✅    |  -  |   -   |    -    |   ✅  |   -   |   -   |    -
  1   |    -     | ✅  |  ✅   |    -    |   ✅  |   -   |  ✅   |   ✅
  2   |    -     | ✅  |  ✅   |   ✅    |   ✅  |   -   |  ✅   |   ✅
 2.5  |    -     |  -  |   -   |   ✅    |   ✅  |   -   |   -   |    -
  3   |    -     |  -  |   -   |    -    |   ✅  |   -   |   -   |    -
  4   |    -     |  -  |   -   |    -    |   ✅  |   -   |   -   |    -
  5   |    -     |  -  |  ✅   |   ✅    |   ✅  |  ✅   |   -   |    -
  6   |    -     |  -  |   -   |    -    |   ✅  |   -   |   -   |    -
```

### C. 변경 대상 파일 목록

| 파일 | 변경 유형 | 우선순위 | 예상 변경량 |
|------|----------|---------|-----------|
| `CLAUDE.md` | 대폭 수정 | P0 | +150줄 |
| `docs/AGENTS_REFERENCE.md` | 전면 개편 | P0 | -200줄/+100줄 |
| `README.md` | 버전 수정 | P0 | +2줄 |
| `docs/COMMAND_SELECTOR.md` | 신규 생성 | P0 | +100줄 |
| `docs/PLANNED_AGENTS.md` | 신규 생성 | P1 | +80줄 |
| `.claude/commands/*.md` (6개) | 삭제 확정 | P1 | -6파일 |

---

**Dependencies**: PRD-0025 (전역 워크플로우 최적화)
**Related Issue**: [#1](https://github.com/garimto81/claude/issues/1)
**Related PR**: [#2](https://github.com/garimto81/claude/pull/2)
**Next**: v3.0.0 수정 → PR 업데이트 → 머지

---

## 8. 수정 계획 (v3.0.0)

### 발견된 문제

PRD v2.0.0 작성 시 `.claude/plugins/` 구조가 완전히 누락됨:

| 항목 | v2.0.0 분석 | 실제 |
|------|------------|------|
| 에이전트 위치 | src/agents/, .claude/skills/ | **.claude/plugins/** 25개 카테고리 |
| 에이전트 수 | 21개 (계획) | **50+ 에이전트** 정의 완료 |
| 스킬 수 | 13개 | plugins 내 **30+ 스킬** 추가 존재 |

### 수정 방향

#### 1. AGENTS_REFERENCE.md v4.0.0 재작성

```markdown
# Agent 완전 참조 가이드 v4.0.0

## 1. 에이전트 소스 3계층

| 계층 | 위치 | 개수 | 역할 |
|------|------|------|------|
| 내장 | Claude Code | 4개 | 기본 subagent |
| 루트 스킬 | .claude/skills/ | 13개 | 자동 트리거 스킬 |
| 플러그인 | .claude/plugins/ | 25개 카테고리 | 전문 에이전트/스킬/커맨드 |

## 2. 플러그인 아키텍처

### 2.1 카테고리별 구조
(25개 카테고리 테이블)

### 2.2 Phase별 활성 에이전트
(Phase 0-6 매핑)

### 2.3 사용법
(Task() 호출 예시)
```

#### 2. PLANNED_AGENTS.md 재작성

기존: 21개 "미구현" 에이전트
변경: plugins에서 **미활성화된** 에이전트 목록

```markdown
# 플러그인 에이전트 활성화 로드맵

## 현재 활성 (Commands/Skills에서 참조)
- context7-engineer, debugger, code-reviewer...

## 활성화 예정 (P1)
- python-pro, frontend-developer...

## 검토 필요 (P2)
- 사용 빈도 낮은 에이전트들
```

#### 3. CLAUDE.md v8.1.0 수정

플러그인 참조 섹션 추가:

```markdown
## 플러그인 시스템

`.claude/plugins/`에 25개 카테고리의 전문 에이전트/스킬/커맨드 정의:

| 카테고리 | 용도 |
|----------|------|
| phase-0-planning | 사전 조사 에이전트 |
| phase-1-development | 개발 에이전트 |
| phase-2-testing | 테스트 에이전트 |
| ... | ... |

상세: `docs/AGENTS_REFERENCE.md`
```

### 작업 순서

1. **AGENTS_REFERENCE.md v4.0.0** 재작성 (plugins 구조 반영)
2. **PLANNED_AGENTS.md** 재작성 (실제 미활성 에이전트 기준)
3. **CLAUDE.md v8.1.0** 플러그인 참조 추가
4. PR #2 업데이트
5. 머지
