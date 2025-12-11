# PRD-0032: Command Consolidation (20개 → 12개)

**버전**: 1.0.0 | **상태**: Draft | **작성일**: 2025-12-11

---

## 1. 개요

### 1.1 문제 정의

현재 `.claude/commands/` 디렉토리에 **20개 커맨드**가 존재하나:
- 기능 중복 다수 (research vs pre-work vs analyze)
- 유사 커맨드 분산 (check vs final-check vs optimize)
- 서브커맨드로 통합 가능한 항목 다수
- 사용자 혼란 유발

### 1.2 목표

| 목표 | 측정 지표 |
|------|----------|
| 커맨드 수 최적화 | 20개 → 12개 |
| 서브커맨드 체계화 | 관련 기능 그룹핑 |
| 사용성 향상 | 명확한 역할 분리 |

### 1.3 참조

- PRD-0031: Agent Consolidation (50개 → 18개)

---

## 2. 현황 분석

### 2.1 현재 커맨드 (20개)

| 카테고리 | 커맨드 | 중복/유사 |
|----------|--------|----------|
| **워크플로우** | work, work-auto, parallel | work-auto → work --auto |
| **리서치** | research, plan, pre-work, analyze | 통합 가능 |
| **개발** | tdd, create, commit | 유지 |
| **검증** | check, api-test, final-check, optimize | 통합 가능 |
| **협업** | issue, pr, journey | journey 분리 |
| **관리** | todo, changelog, compact | 통합 가능 |

### 2.2 중복 패턴

```
research ─┬─ 코드베이스 분석
pre-work ─┼─ 오픈소스 검색      → /research [code|web|plan]
analyze  ─┼─ 코드/로그 분석
plan     ─┴─ 구현 계획

check ────┬─ 정적 분석
final-check┼─ E2E 검증          → /check [--fix|--e2e|--perf]
optimize ─┴─ 성능 분석

compact ──┬─ 컨텍스트 압축
journey ──┼─ 세션 기록          → /session [compact|journey|changelog]
changelog─┴─ 변경 로그
```

---

## 3. 통합 계획

### 3.1 최종 커맨드 구조 (12개)

```
┌─────────────────────────────────────────────────────────────┐
│                    CORE WORKFLOW (2개)                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  /work [--auto] [--skip-analysis] [--no-issue] [--strict]   │
│  └─ 전체 워크플로우 (work-auto 흡수)                         │
│                                                              │
│  /parallel [dev|test|review|research|check]                 │
│  └─ 병렬 멀티에이전트 실행                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   DEVELOPMENT (4개)                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  /research [code|web|plan]                                  │
│  ├─ code: 코드베이스 분석 (analyze 흡수)                     │
│  ├─ web: 오픈소스/솔루션 검색 (pre-work 흡수)                │
│  └─ plan: 구현 계획 수립 (plan 흡수)                         │
│                                                              │
│  /tdd [red|green|refactor]                                  │
│  └─ TDD 워크플로우                                          │
│                                                              │
│  /create [prd|pr|docs]                                      │
│  └─ PRD/PR/문서 생성                                        │
│                                                              │
│  /commit [--no-push]                                        │
│  └─ 커밋 생성                                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   VALIDATION (2개)                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  /check [--fix] [--e2e] [--perf] [--security]               │
│  ├─ 기본: 정적 분석 + 린트                                   │
│  ├─ --e2e: E2E 테스트 + 자동 수정 (final-check 흡수)         │
│  ├─ --perf: 성능 분석 (optimize 흡수)                        │
│  └─ --security: 보안 검사                                    │
│                                                              │
│  /api-test [endpoint]                                       │
│  └─ API 엔드포인트 테스트 (특수 목적)                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   COLLABORATION (2개)                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  /issue [list|create|fix|failed]                            │
│  ├─ list: 이슈 목록 조회                                     │
│  ├─ create: 새 이슈 생성                                     │
│  ├─ fix #N: 이슈 해결 워크플로우                             │
│  └─ failed #N: 해결 실패 기록 + 해결책 제안                  │
│                                                              │
│  /pr [review|merge|create]                                  │
│  ├─ review: PR 코드 리뷰                                     │
│  ├─ merge: 자동 머지                                         │
│  └─ create: PR 생성 (/create pr 연동)                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   MANAGEMENT (2개)                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  /todo [add|list|done|clear]                                │
│  └─ 작업 목록 관리                                          │
│                                                              │
│  /session [compact|journey|changelog]                       │
│  ├─ compact: 컨텍스트 압축 (compact 흡수)                    │
│  ├─ journey: 세션 여정 기록 (journey 흡수)                   │
│  └─ changelog: 변경 로그 생성 (changelog 흡수)               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 변환 맵

| 기존 커맨드 | 통합 후 | 액션 |
|------------|--------|------|
| `/work` | `/work` | 유지 (확장) |
| `/work-auto` | `/work --auto` | **삭제** → 옵션 |
| `/parallel` | `/parallel` | 유지 |
| `/research` | `/research code` | 유지 (확장) |
| `/plan` | `/research plan` | **삭제** → 서브커맨드 |
| `/pre-work` | `/research web` | **삭제** → 서브커맨드 |
| `/analyze` | `/research code` | **삭제** → 서브커맨드 |
| `/tdd` | `/tdd` | 유지 |
| `/create` | `/create` | 유지 |
| `/commit` | `/commit` | 유지 |
| `/check` | `/check` | 유지 (확장) |
| `/final-check` | `/check --e2e` | **삭제** → 옵션 |
| `/optimize` | `/check --perf` | **삭제** → 옵션 |
| `/api-test` | `/api-test` | 유지 |
| `/issue` | `/issue` | 유지 (확장) |
| `/pr` | `/pr` | 유지 |
| `/journey` | `/session journey` | **삭제** → 서브커맨드 |
| `/todo` | `/todo` | 유지 |
| `/changelog` | `/session changelog` | **삭제** → 서브커맨드 |
| `/compact` | `/session compact` | **삭제** → 서브커맨드 |

### 3.3 최종 결과

| 카테고리 | 변경 전 | 변경 후 |
|----------|--------|--------|
| Workflow | 3개 | **2개** |
| Development | 4개 | **4개** |
| Validation | 4개 | **2개** |
| Collaboration | 3개 | **2개** |
| Management | 3개 | **2개** |
| **총계** | **20개** | **12개** |

---

## 4. 상세 설계

### 4.1 /work (확장)

```markdown
# /work - 통합 워크플로우

## 사용법
/work <작업 지시>
/work --auto <작업 지시>        # 완전 자동화
/work --skip-analysis <지시>    # Phase 1 스킵
/work --no-issue <지시>         # 이슈 생성 안함
/work --strict <지시>           # E2E 1회 실패 시 중단

## 흡수된 기능
- work-auto → --auto 옵션
```

### 4.2 /research (통합)

```markdown
# /research - 리서치 통합

## 서브커맨드
/research code [경로]     # 코드베이스 분석 (analyze 흡수)
/research web <키워드>    # 오픈소스/솔루션 검색 (pre-work 흡수)
/research plan            # 구현 계획 수립 (plan 흡수)

## 기본 동작
/research                 # = /research code .
```

### 4.3 /check (통합)

```markdown
# /check - 검증 통합

## 옵션
/check                    # 정적 분석 + 린트
/check --fix              # 자동 수정
/check --e2e              # E2E 테스트 + 자동 수정 (final-check 흡수)
/check --perf             # 성능 분석 (optimize 흡수)
/check --security         # 보안 검사
/check --all              # 모든 검사

## 조합 가능
/check --e2e --fix        # E2E + 자동 수정
```

### 4.4 /issue (확장)

```markdown
# /issue - 이슈 관리

## 서브커맨드
/issue list               # 이슈 목록
/issue create <제목>      # 새 이슈 생성
/issue fix #N             # 이슈 해결 워크플로우
/issue failed #N          # 해결 실패 기록 + 해결책 제안 ⭐ 신규

## /issue failed 동작
1. 이슈 내용 업데이트 (시도한 방법, 실패 원인)
2. 관련 코드/로그 첨부
3. 해결책 제안 (AI 분석 기반)
4. 라벨 추가: `needs-help`, `blocked`
5. 다음 단계 권장사항 코멘트
```

### 4.5 /session (신규)

```markdown
# /session - 세션 관리 통합

## 서브커맨드
/session compact          # 컨텍스트 압축 (compact 흡수)
/session journey          # 세션 여정 기록 (journey 흡수)
/session changelog        # 변경 로그 생성 (changelog 흡수)

## 기본 동작
/session                  # = /session journey (현재 세션 기록)
```

---

## 5. 구현 계획

### Phase 1: 커맨드 확장 (신규 옵션/서브커맨드)

1. `/work` - `--auto` 옵션 추가
2. `/research` - `code`, `web`, `plan` 서브커맨드 추가
3. `/check` - `--e2e`, `--perf` 옵션 추가
4. `/issue` - `failed` 서브커맨드 추가

### Phase 2: 신규 커맨드 생성

1. `/session` - compact, journey, changelog 통합

### Phase 3: 기존 커맨드 삭제

1. `work-auto.md` 삭제
2. `plan.md` 삭제
3. `pre-work.md` 삭제
4. `analyze.md` 삭제
5. `final-check.md` 삭제
6. `optimize.md` 삭제
7. `journey.md` 삭제
8. `changelog.md` 삭제
9. `compact.md` 삭제

### Phase 4: 문서 업데이트

1. CLAUDE.md 커맨드 섹션 업데이트
2. 커맨드 참조 문서 생성

---

## 6. 수락 기준

- [ ] 커맨드 수 20개 → 12개
- [ ] 모든 기존 기능 커버 확인
- [ ] 서브커맨드 동작 테스트
- [ ] `/issue failed` 동작 확인
- [ ] CLAUDE.md 업데이트 완료

---

## 7. 위험 요소 및 완화

| 위험 | 영향 | 완화 방안 |
|------|------|----------|
| 기존 습관 | 중간 | 기존 커맨드 alias 제공 고려 |
| 기능 손실 | 낮음 | 통합 시 모든 기능 유지 확인 |

---

**작성자**: Claude Code
**검토자**: (사용자 승인 대기)
**다음 단계**: 승인 후 Phase 1 시작
