---
name: research
description: RPI Phase 1 - 코드베이스 분석 및 리서치
---

# /research - 통합 리서치 커맨드

코드베이스 분석, 웹 검색, 구현 계획을 수행합니다.

## Usage

```
/research [subcommand] [target] [options]

Subcommands:
  code [path]     코드베이스 분석 (기본값)
  web <keyword>   오픈소스/솔루션 웹 검색
  plan [target]   구현 계획 수립 (RPI Phase 2)

Targets:
  <issue-num>     특정 이슈 관련 리서치
  <feature>       기능 관련 코드베이스 분석
  --codebase      전체 코드베이스 구조 분석
  --deps          의존성 분석

Options:
  --save          결과를 .claude/research/에 저장
  --quick         빠른 탐색 (5분 이내)
  --thorough      철저한 분석 (15-30분)
```

---

## 서브커맨드 상세

### /research code - 코드베이스 분석 (기본값)

```bash
/research                      # = /research code . (현재 디렉토리)
/research code                 # 전체 코드베이스 분석
/research code src/api/        # 특정 경로 분석
/research code 123             # 이슈 #123 관련 코드 분석
/research code --codebase      # 전체 구조 분석
/research code --deps          # 의존성 분석
```

### /research web - 오픈소스/솔루션 검색

```bash
/research web "React state management"
/research web "Python async HTTP client"
/research web "JWT authentication best practices"
```

**수행 작업:**
1. 관련 오픈소스 라이브러리 검색
2. Make vs Buy 분석
3. 유사 구현 사례 조사
4. 기술 문서 검색

**출력 예시:**
```markdown
## 웹 리서치: React state management

### 추천 라이브러리
| 라이브러리 | 별점 | 장점 | 단점 |
|-----------|------|------|------|
| Zustand | ⭐⭐⭐⭐⭐ | 간단, 가벼움 | 대규모 앱 한계 |
| Jotai | ⭐⭐⭐⭐ | 원자적 상태 | 러닝커브 |
| Redux Toolkit | ⭐⭐⭐⭐ | 표준, 에코시스템 | 보일러플레이트 |

### Make vs Buy 분석
- **Buy 권장**: 인증된 라이브러리 사용
- **Make 시**: 커스텀 요구사항 있을 때만
```

### /research plan - 구현 계획 수립

```bash
/research plan 123             # 이슈 #123 구현 계획
/research plan "user auth"     # 기능 구현 계획
/research plan --tdd           # TDD 기반 계획
/research plan --detailed      # 상세 계획 (파일별)
```

**옵션:**
- `--tdd`: Red-Green-Refactor 사이클 계획
- `--detailed`: 파일별 변경 사항 포함
- `--save`: `.claude/plans/`에 저장

**출력 예시:**
```markdown
## 구현 계획: Issue #123

### Step 1: 데이터 모델
- [ ] src/models/user.py 생성
- [ ] tests/test_user_model.py 생성

### Step 2: 인증 로직
- [ ] src/auth/service.py 수정
- [ ] tests/test_auth_service.py 생성

### 의존성
- Step 2는 Step 1 완료 후
```

---

## RPI 워크플로우

```
┌─────────────────────────────────────────────────────────┐
│  [R] Research → [P] Plan → [I] Implement                │
│        ↑                                                │
│     현재 단계                                           │
└─────────────────────────────────────────────────────────┘
```

| Phase | 커맨드 | 목적 |
|-------|--------|------|
| **R** | `/research` | 정보 수집, 코드 분석 |
| **P** | `/plan` | 구현 계획 수립 |
| **I** | 구현 | 코드 작성, 테스트 |

---

## /research 123

이슈 #123 관련 리서치를 수행합니다.

```bash
/research 123
# Output:
# 🔍 Research: Issue #123
#
# ## 이슈 분석
# - 제목: 사용자 인증 기능 추가
# - 라벨: enhancement, priority-high
#
# ## 관련 코드
# - src/auth/ (기존 인증 모듈)
# - src/middleware/auth.py (미들웨어)
#
# ## 의존성
# - bcrypt (password hashing)
# - jwt (token management)
#
# ## 영향 범위
# - 5개 파일 수정 예상
# - API 엔드포인트 3개 추가
#
# ## 오픈소스 검토
# - python-jose (JWT, MIT)
# - passlib (hashing, BSD)
#
# → 다음: /plan 123
```

---

## /research --codebase

전체 코드베이스 구조를 분석합니다.

```bash
/research --codebase
# Output:
# 📂 Codebase Analysis
#
# ## 구조
# ├── src/           (핵심 코드)
# │   ├── agents/    (멀티에이전트)
# │   ├── api/       (API 엔드포인트)
# │   └── utils/     (유틸리티)
# ├── tests/         (테스트)
# └── .claude/       (Claude 설정)
#
# ## 기술 스택
# - Python 3.11+
# - FastAPI
# - LangGraph
#
# ## 패턴
# - Fan-Out/Fan-In (멀티에이전트)
# - Repository Pattern (데이터 접근)
```

---

## /research --deps

프로젝트 의존성을 분석합니다.

```bash
/research --deps
# Output:
# 📦 Dependency Analysis
#
# ## Core
# - anthropic (Claude API)
# - langgraph (에이전트 오케스트레이션)
#
# ## Testing
# - pytest, pytest-cov
# - playwright (E2E)
#
# ## Outdated
# - requests: 2.28.0 → 2.31.0
#
# ## Security
# - ⚠️ 취약점 없음
```

---

## 리서치 저장

`--save` 옵션으로 결과를 저장합니다.

```bash
/research 123 --save
# Output: 저장됨 → .claude/research/issue-123-research.md
```

### 저장 형식

```markdown
# Research: Issue #123

**Date**: 2025-12-07
**Issue**: 사용자 인증 기능 추가

## 관련 코드
...

## 의존성
...

## 오픈소스 후보
...

## 권장사항
...
```

---

## 저장 위치

```
.claude/
└── research/
    ├── issue-123-research.md
    ├── codebase-analysis.md
    └── deps-audit.md
```

---

## Best Practices

1. **구현 전 항상 리서치**: 코드 작성 전 `/research`
2. **오픈소스 우선**: Make vs Buy 분석
3. **영향 범위 파악**: 수정 예상 파일 목록
4. **리서치 저장**: `--save`로 기록 보존

---

## Related

- `/parallel research` - 병렬 리서치 에이전트
- `/work` - 전체 워크플로우 실행

---

## 통합 이력

| 기존 커맨드 | 통합 위치 | 날짜 |
|------------|----------|------|
| `/plan` | `/research plan` | 2025-12-11 |
| `/pre-work` | `/research web` | 2025-12-11 |
| `/analyze code` | `/research code` | 2025-12-11 |
