# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Version**: 11.3.0 | **Context**: Windows, PowerShell, Root: `D:\AI\claude01`

**GitHub**: `garimto81/claude`

---

## 기본 규칙

| 규칙 | 내용 |
|------|------|
| **언어** | 한글 출력. 기술 용어(code, GitHub)는 영어 |
| **경로** | 절대 경로만. `D:\AI\claude01\...` |
| **충돌** | 사용자에게 질문 (임의 판단 금지) |
| **응답** | 상세: `docs/RESPONSE_STYLE.md` |

---

## 핵심 규칙 (Hook 강제)

| 규칙 | 위반 시 | 해결 |
|------|---------|------|
| main 브랜치 수정 금지 | **차단** | `git checkout -b feat/issue-N-desc` |
| 테스트 먼저 (TDD) | 경고 | Red → Green → Refactor |
| 상대 경로 금지 | 경고 | 절대 경로 사용 |
| **전체 프로세스 종료 금지** | **차단** | 해당 프로젝트 node만 종료 |
| **100줄 이상 수정 시 자동 커밋** | 자동 | `/commit` 실행 |

⚠️ `taskkill /F /IM node.exe` 등 전체 종료 명령 **절대 금지**. 다른 프로젝트 영향.

main 허용: `CLAUDE.md`, `README.md`, `.claude/`, `docs/`

---

## 빌드/테스트 명령

### Python

```powershell
ruff check src/ --fix                    # 린트
pytest tests/test_specific.py -v         # 개별 테스트 (권장)
# pytest tests/ -v --cov=src             # 전체 (background 필수)
```

### VTC_Logger (React + Vite)

```powershell
cd D:\AI\claude01\VTC_Logger\vtc-app
npm install && npm run dev               # 개발 서버
npm run build                            # 빌드
npm run lint                             # ESLint
```

### E2E (Playwright 필수)

```powershell
npx playwright test                       # 전체 E2E
npx playwright test tests/e2e/auth.spec.ts  # 개별 테스트
```

**안전 규칙**: `pytest tests/ -v --cov` → 120초 초과 → 크래시. 개별 파일 실행 권장.

---

## 작업 방법

```
사용자 요청 → /work "요청 내용" → 자동 완료
```

| 요청 유형 | 처리 |
|-----------|------|
| 기능/리팩토링 | `/work` → 이슈 → 브랜치 → TDD → PR |
| 버그 수정 | `/issue fix #N` |
| 문서 수정 | 직접 수정 |
| 질문 | 직접 응답 |

---

## 빠른 참조

### 커맨드 (13개)

| 커맨드 | 용도 |
|--------|------|
| `/work` | 전체 워크플로우 |
| `/issue` | 이슈 관리 |
| `/commit` | 커밋 생성 |
| `/check` | 린트/테스트 |

전체: `docs/COMMAND_REFERENCE.md`

### 에이전트 (19개)

| Agent | 용도 |
|-------|------|
| `code-reviewer` | 코드 리뷰 |
| `architect` | 설계 |
| `debugger` | 버그 분석 |
| `test-engineer` | 테스트 |

전체: `docs/AGENTS_REFERENCE.md`

### 스킬 (15개)

- 자동 트리거: 4개
- 수동 트리거: 11개

---

## 문제 해결

```
문제 → WHY(원인) → WHERE(영향) → HOW(해결) → 수정
```

**즉시 수정 금지.** 원인 파악 → 유사 패턴 검색 → 구조적 해결.

---

## 문서 작업 규칙

### 시각화 필수

| 단계 | 작업 | 산출물 |
|------|------|--------|
| 1 | HTML 목업 생성 | `docs/mockups/*.html` |
| 2 | 스크린샷 캡처 | `docs/images/*.png` |
| 3 | 문서에 이미지 첨부 | PRD, 설계 문서 |

### 시각화 흐름

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  HTML 목업  │────▶│  스크린샷   │────▶│  문서 첨부  │
│  작성       │     │  캡처       │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
```

### HTML 목업 생성

```powershell
# 목업 파일 생성
Write docs/mockups/feature-name.html

# Playwright로 스크린샷 캡처
npx playwright screenshot docs/mockups/feature-name.html docs/images/feature-name.png
```

### 적용 대상

| 문서 유형 | 시각화 필수 여부 |
|-----------|-----------------|
| PRD (기능 명세) | ✅ 필수 |
| 아키텍처 설계 | ✅ 필수 |
| API 문서 | ⚠️ 권장 |
| 변경 로그 | ❌ 선택 |

---

## 참조

| 문서 | 용도 |
|------|------|
| `docs/RESPONSE_STYLE.md` | 응답 스타일 상세 |
| `docs/BUILD_TEST.md` | 빌드/테스트 명령어 |
| `docs/COMMAND_REFERENCE.md` | 커맨드 상세 |
| `docs/AGENTS_REFERENCE.md` | 에이전트 상세 |
| `docs/CHANGELOG-CLAUDE.md` | 변경 이력 |
