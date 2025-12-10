# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Version**: 7.3.0 | **Context**: Windows, PowerShell, Root: `D:\AI\claude01`

**GitHub**: `garimto81/claude-code-config`

---

## 기본 규칙

| 규칙 | 내용 |
|------|------|
| **언어** | 한글 출력. 기술 용어(code, GitHub)는 영어 |
| **경로** | 절대 경로만. `D:\AI\claude01\...` |
| **충돌** | 지침 충돌 시 → **사용자에게 질문** (임의 판단 금지) |

---

## 프로젝트 구조

Claude Code 전역 워크플로우 설정 저장소:

```
D:\AI\claude01\
├── .claude/commands/    # 커스텀 슬래시 커맨드
├── .claude/skills/      # 커스텀 스킬
├── docs/                # 워크플로우 문서
└── src/agents/          # AI 워크플로우 에이전트 (Python)
```

---

## 핵심 규칙 (Hook 강제)

| 규칙 | 위반 시 | 해결 |
|------|---------|------|
| main 브랜치 수정 금지 | **차단** | `git checkout -b feat/issue-N-desc` |
| 테스트 먼저 (TDD) | 경고 | Red → Green → Refactor |
| 상대 경로 금지 | 경고 | 절대 경로 사용 |

---

## 작업 방법

```
사용자 요청 → /work "요청 내용" → 자동 완료
```

| 요청 유형 | 처리 |
|-----------|------|
| 기능/리팩토링 | `/work` → 이슈 → 브랜치 → TDD → PR |
| 버그 수정 | `/issue fix #N` |
| 문서 수정 | 직접 수정 (브랜치 불필요) |
| 질문 | 직접 응답 |

---

## 커맨드 (19개)

### 핵심 (자주 사용)

| 커맨드 | 용도 |
|--------|------|
| `/work "내용"` | 전체 워크플로우 (`--auto` 완전 자동화) |
| `/issue` | 이슈 관리 (`list`, `create`, `fix`, `failed`) |
| `/commit` | 커밋 생성 |
| `/check` | 린트 + 테스트 |
| `/tdd` | TDD 워크플로우 |

### 병렬 실행

| 커맨드 | 용도 |
|--------|------|
| `/parallel dev` | 병렬 개발 (`--branch` 브랜치 격리) |
| `/parallel test` | 병렬 테스트 |
| `/parallel review` | 병렬 코드 리뷰 |
| `/parallel research` | 병렬 리서치 |
| `/parallel check` | 충돌 검사 |

### 생성/분석

| 커맨드 | 용도 |
|--------|------|
| `/create` | PRD/PR/문서 생성 (`prd`, `pr`, `docs`) |
| `/research` | 코드베이스 분석 (RPI Phase 1) |
| `/plan` | 구현 계획 (RPI Phase 2) |
| `/analyze` | 코드/로그 분석 |

### 기타

| 커맨드 | 용도 |
|--------|------|
| `/todo` | 작업 관리 |
| `/pre-work` | 사전 조사 |
| `/final-check` | 최종 E2E 검증 |
| `/changelog` | 체인지로그 생성 |
| `/optimize` | 성능 분석 |

전체: `.claude/commands/`

---

## 안전 규칙

### Crash Prevention (필수)

```powershell
# ❌ 금지 (120초 초과 → 크래시)
pytest tests/ -v --cov                # 대규모 테스트
npm install && npm run build          # 체인 명령

# ✅ 권장
pytest tests/test_a.py -v             # 개별 실행
# 또는 run_in_background: true
```

---

## 문제 해결

```
문제 → WHY(원인) → WHERE(영향 범위) → HOW(해결) → 수정
```

**즉시 수정 금지.** 원인 파악 → 유사 패턴 검색 → 구조적 해결.

---

## 버전 관리 (필수)

### PR/Issue 생성·업데이트 시 필수 항목

| 항목 | 형식 | 예시 |
|------|------|------|
| **버전** | Semantic Versioning | `v1.2.3` |
| **커밋 해시** | 7자리 short hash | `abc1234` |
| **이슈/PR 태그** | `#번호` 또는 `Closes #번호` | `#181`, `Closes #179` |

### 버전 업데이트 규칙

```
MAJOR.MINOR.PATCH (Semantic Versioning)
├── MAJOR: 호환성 깨지는 변경
├── MINOR: 새 기능 추가 (하위 호환)
└── PATCH: 버그 수정
```

### 워크플로우

```
1. Issue 생성 → 이슈 번호 발급 (#N)
2. 브랜치 생성 → feat/issue-N-desc
3. 작업 완료 → 커밋 (해시 생성)
4. PR 생성 → 이슈 태그 연결 (Closes #N)
5. 머지 전 → /changelog 실행, 버전 범프
6. 머지 후 → git tag vX.Y.Z
```

### 커밋 메시지 형식

```
<type>(<scope>): <subject> (#issue)

- 변경 내용 설명

Refs: #issue1, #issue2
Closes #issue (PR에서 이슈 자동 종료 시)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

### 코멘트 태깅 규칙

| 상황 | 태그 형식 |
|------|-----------|
| 이슈 참조 | `Refs: #123` |
| 이슈 종료 | `Closes #123`, `Fixes #123` |
| PR 참조 | `PR #456` |
| 커밋 참조 | `abc1234` (7자리 해시) |

---

## 참조

| 문서 | 용도 |
|------|------|
| `docs/WORKFLOW_REFERENCE.md` | 상세 워크플로우 |
| `docs/AGENTS_REFERENCE.md` | 에이전트 목록 |
| `docs/SUBREPO_ANALYSIS_REPORT.md` | 서브레포 분석 보고서 |
| `docs/templates/` | 에이전트 템플릿 |
| `.claude/commands/` | 커맨드 상세 |
