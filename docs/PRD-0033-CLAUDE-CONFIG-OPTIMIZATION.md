# PRD-0033: Claude Config Optimization

**버전**: 1.0.0 | **상태**: Draft | **작성일**: 2025-12-16

---

## 1. 개요

### 1.1 문제 정의

현재 Claude Code 설정의 문제점:

| 문제 | 현황 | 권장 |
|------|------|------|
| **CLAUDE.md 비대화** | 368줄 | 50-100줄 |
| **Skills 구형 스키마** | 기본 frontmatter | 2025 스키마 (triggers, capabilities) |
| **Hooks 미활용** | branch_guard만 | PreToolUse, SessionStart/End |

### 1.2 목표

| 목표 | 측정 지표 |
|------|----------|
| CLAUDE.md 경량화 | 368줄 → 80줄 |
| 점진적 공개 적용 | 상세 정보 참조 파일 분리 |
| Skills 현대화 | 13개 스킬 2025 스키마 적용 |
| Hooks 확장 | 3개 → 6개 Hook 타입 |

### 1.3 참조

- Claude Code Best Practices 2025
- Anthropic Agent Skills (Oct 2025 Public Beta)
- PRD-0031: Agent Consolidation
- PRD-0032: Command Consolidation

---

## 2. 현황 분석

### 2.1 CLAUDE.md 구조 (현재 368줄)

```
┌─────────────────────────────────────────────────────┐
│  CLAUDE.md (368줄)                                  │
├─────────────────────────────────────────────────────┤
│  기본 규칙           │ 20줄   │ 필수 유지          │
│  비개발자 응답 모드  │ 50줄   │ → 분리 가능        │
│  응답 스타일         │ 25줄   │ → 분리 가능        │
│  프로젝트 구조       │ 15줄   │ 필수 유지          │
│  빌드/테스트 명령어  │ 60줄   │ → 분리 가능        │
│  에이전트            │ 30줄   │ → 참조만           │
│  핵심 규칙 (Hook)    │ 25줄   │ 필수 유지          │
│  작업 방법           │ 20줄   │ 필수 유지          │
│  커맨드              │ 45줄   │ → 참조만           │
│  MCP 서버            │ 25줄   │ → 참조만           │
│  스킬                │ 20줄   │ → 참조만           │
│  안전 규칙           │ 10줄   │ 필수 유지          │
│  문제 해결           │ 10줄   │ 필수 유지          │
│  참조/변경 이력      │ 43줄   │ → 분리 가능        │
└─────────────────────────────────────────────────────┘
```

### 2.2 Skills 스키마 (현재)

```yaml
# 현재 형식 (기본)
---
name: tdd-workflow
description: >
  Anthropic Best Practices 기반 TDD 워크플로우
version: 1.0.0
phase: [1, 2]
auto_trigger: true
dependencies:
  - test-automator
  - debugger
token_budget: 1200
---
```

### 2.3 Hooks 현황

| Hook 타입 | 현재 | 용도 |
|-----------|------|------|
| PreEditFile | ✅ branch_guard.py | main 브랜치 보호 |
| PostEditFile | ❌ | - |
| PreToolUse | ❌ | 도구 사용 전 검증 |
| SessionStart | ❌ | 세션 초기화 |
| SessionEnd | ❌ | 세션 정리 |
| PreCommit | ❌ | 커밋 전 검증 |

---

## 3. 개선 계획

### 3.1 CLAUDE.md 분리 구조

```
┌─────────────────────────────────────────────────────────────┐
│  CLAUDE.md (목표: ~80줄)                                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ## 기본 규칙 (20줄)                                         │
│  - 언어, 경로, 충돌 처리                                     │
│                                                              │
│  ## 핵심 원칙 (15줄)                                         │
│  - main 브랜치 금지, TDD 강제, 절대 경로                     │
│                                                              │
│  ## 프로젝트 구조 (15줄)                                     │
│  - 디렉토리 트리                                             │
│                                                              │
│  ## 빠른 참조 (20줄)                                         │
│  - 주요 커맨드/에이전트 요약 (5개씩)                         │
│  - 상세: @docs/COMMAND_REFERENCE.md                         │
│  - 상세: @docs/AGENTS_REFERENCE.md                          │
│                                                              │
│  ## 안전 규칙 (10줄)                                         │
│  - 타임아웃, 백그라운드 실행                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘

분리될 파일:
├── docs/RESPONSE_STYLE.md      # 비개발자 응답 모드 + 응답 스타일
├── docs/BUILD_TEST.md          # 빌드/테스트 명령어 상세
├── docs/COMMAND_REFERENCE.md   # 기존 (커맨드 상세)
├── docs/AGENTS_REFERENCE.md    # 기존 (에이전트 상세)
└── docs/CHANGELOG.md           # 변경 이력 분리
```

### 3.2 Skills 2025 스키마 업그레이드

```yaml
# 2025 형식 (업그레이드)
---
name: tdd-workflow
description: >
  Anthropic Best Practices 기반 TDD 워크플로우
version: 2.0.0

# NEW: 자동 트리거 조건
triggers:
  keywords: ["TDD", "테스트 먼저", "Red-Green", "테스트 주도"]
  file_patterns: ["tests/**/*.py", "**/*.spec.ts"]
  context: ["테스트 작성 요청", "TDD 사이클"]

# NEW: 스킬 기능 선언
capabilities:
  - validate_red_phase
  - run_tdd_cycle
  - generate_test_template

# NEW: 모델 선호도
model_preference: sonnet

# 기존 필드 유지
dependencies:
  - debugger
token_budget: 1200
---
```

### 3.3 Hooks 확장 계획

```
┌─────────────────────────────────────────────────────────────┐
│  Hooks 확장                                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  PreEditFile (기존)                                          │
│  └─ branch_guard.py: main 브랜치 보호                        │
│                                                              │
│  PreToolUse (신규)                                           │
│  └─ tool_validator.py                                        │
│     - Bash: 위험 명령 차단 (rm -rf, format 등)               │
│     - Write: 민감 파일 보호 (.env, credentials)              │
│                                                              │
│  SessionStart (신규)                                         │
│  └─ session_init.py                                          │
│     - 이전 세션 컨텍스트 로드                                │
│     - 작업 중 브랜치 확인                                    │
│     - TODO 목록 표시                                         │
│                                                              │
│  SessionEnd (신규)                                           │
│  └─ session_cleanup.py                                       │
│     - 미완료 작업 저장                                       │
│     - 세션 요약 생성                                         │
│     - 임시 파일 정리                                         │
│                                                              │
│  PreCommit (신규)                                            │
│  └─ commit_validator.py                                      │
│     - Conventional Commits 형식 검증                         │
│     - 민감 정보 포함 여부 확인                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. 구현 단계

### Phase 1: CLAUDE.md 분리 (우선순위: 높음)

| 단계 | 작업 | 산출물 |
|------|------|--------|
| 1.1 | 응답 스타일 분리 | docs/RESPONSE_STYLE.md |
| 1.2 | 빌드/테스트 분리 | docs/BUILD_TEST.md |
| 1.3 | 변경 이력 분리 | docs/CHANGELOG.md |
| 1.4 | CLAUDE.md 경량화 | CLAUDE.md (~80줄) |
| 1.5 | 참조 링크 추가 | @docs/... 형식 |

### Phase 2: Skills 업그레이드 (우선순위: 중간)

| 단계 | 작업 | 산출물 |
|------|------|--------|
| 2.1 | 스키마 템플릿 생성 | .claude/skills/SKILL_TEMPLATE.md |
| 2.2 | tdd-workflow 업그레이드 | triggers, capabilities 추가 |
| 2.3 | debugging-workflow 업그레이드 | triggers, capabilities 추가 |
| 2.4 | 나머지 11개 스킬 업그레이드 | 일괄 적용 |
| 2.5 | 스킬 로더 검증 | 동작 테스트 |

### Phase 3: Hooks 확장 (우선순위: 낮음)

| 단계 | 작업 | 산출물 |
|------|------|--------|
| 3.1 | PreToolUse Hook 구현 | tool_validator.py |
| 3.2 | SessionStart Hook 구현 | session_init.py |
| 3.3 | SessionEnd Hook 구현 | session_cleanup.py |
| 3.4 | PreCommit Hook 구현 | commit_validator.py |
| 3.5 | settings.json 업데이트 | Hook 등록 |

---

## 5. 예상 효과

### 5.1 정량적 효과

| 지표 | 현재 | 목표 | 개선율 |
|------|------|------|--------|
| CLAUDE.md 줄 수 | 368줄 | 80줄 | -78% |
| 초기 로딩 토큰 | ~3,000 | ~800 | -73% |
| Skills 자동 트리거 정확도 | 60% | 90% | +50% |
| Hook 커버리지 | 1개 | 5개 | +400% |

### 5.2 정성적 효과

```
┌─────────────────────────────────────────────────────────────┐
│  개선 전                        개선 후                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ❌ 모든 정보 한 파일에         ✅ 핵심만 CLAUDE.md          │
│     → 초기 로딩 느림               → 빠른 시작                │
│                                                              │
│  ❌ Skills 키워드 매칭만        ✅ 파일 패턴 + 컨텍스트       │
│     → 부정확한 트리거              → 정확한 자동 활성화       │
│                                                              │
│  ❌ 브랜치 보호만               ✅ 세션/도구/커밋 전체 보호   │
│     → 제한적 안전망               → 다층 방어                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 분리 후 참조 누락 | 정보 접근 실패 | `@docs/` 링크 검증 스크립트 |
| Skills 2025 스키마 호환성 | 기존 스킬 동작 안함 | 기존 필드 유지, 점진적 추가 |
| Hooks 오작동 | 작업 차단 | 각 Hook에 bypass 옵션 제공 |
| 하위 프로젝트 영향 | 설정 불일치 | 계층적 로딩 테스트 |

---

## 7. 검증 계획

### 7.1 Phase 1 검증

```bash
# CLAUDE.md 줄 수 확인
wc -l CLAUDE.md  # 목표: < 100줄

# 분리 파일 존재 확인
ls docs/RESPONSE_STYLE.md docs/BUILD_TEST.md docs/CHANGELOG.md

# 하위 프로젝트 적용 확인
cat VTC_Logger/CLAUDE.md  # 상속 확인
```

### 7.2 Phase 2 검증

```bash
# Skills 스키마 검증
python -c "import yaml; yaml.safe_load(open('.claude/skills/tdd-workflow/SKILL.md'))"

# 트리거 테스트
# "TDD로 로그인 기능 구현해줘" → tdd-workflow 활성화 확인
```

### 7.3 Phase 3 검증

```bash
# Hooks 등록 확인
cat .claude/settings.json | grep -A 20 "hooks"

# PreToolUse 테스트
# rm -rf / 명령 시도 → 차단 확인

# SessionStart 테스트
# 새 세션 시작 → 이전 TODO 표시 확인
```

---

## 8. 일정

| Phase | 기간 | 담당 |
|-------|------|------|
| Phase 1: CLAUDE.md 분리 | 1일 | Claude |
| Phase 2: Skills 업그레이드 | 2일 | Claude |
| Phase 3: Hooks 확장 | 2일 | Claude |
| 통합 테스트 | 1일 | 사용자 |

**총 예상 기간**: 6일

---

## 버전 이력

| 버전 | 날짜 | 변경 |
|------|------|------|
| 1.2.0 | 2025-12-16 | Phase 3 완료: Hooks 확장 (4개 신규 Hook + settings.json) |
| 1.1.0 | 2025-12-16 | Phase 2 완료: 13개 Skills 2025 스키마 업그레이드 |
| 1.0.0 | 2025-12-16 | 초안 작성 |
