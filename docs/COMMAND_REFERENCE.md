# Command Reference

**Version**: 1.0.0 | **Updated**: 2025-12-11

이 문서는 모든 슬래시 커맨드의 사용법을 정리합니다.

---

## 목차

| 카테고리 | 커맨드 | 설명 |
|----------|--------|------|
| **핵심** | `/work` | 전체 워크플로우 자동화 |
| | `/commit` | Conventional Commit 생성 |
| | `/check` | 코드 품질/보안 검사 |
| | `/tdd` | TDD 워크플로우 |
| **이슈/PR** | `/issue` | GitHub 이슈 관리 |
| | `/pr` | PR 리뷰/머지 |
| | `/create` | PRD/PR/문서 생성 |
| **분석** | `/research` | 코드베이스/웹 리서치 |
| | `/parallel` | 병렬 멀티에이전트 실행 |
| **관리** | `/todo` | 작업 관리 |
| | `/session` | 세션 관리 |
| | `/deploy` | 버전/Docker 배포 |
| | `/audit` | 설정 점검 및 개선 |

---

## 1. /work - 전체 워크플로우 자동화

작업 지시를 받아 **분석 → 이슈 → 구현 → 테스트 → PR**까지 자동 수행합니다.

### 사용법

```bash
/work "작업 지시 내용"
/work "API 성능 개선"
/work --auto "완전 자동화"
/work --skip-analysis "빠른 수정"
/work --no-issue "이슈 없이 작업"
/work --strict "엄격 모드 (E2E 1회 실패 시 중단)"
```

### 실행 흐름

```
Phase 1: 병렬 분석
  ├─ 문서 분석 (PRD, docs/)
  └─ 이슈 분석 (gh issue list)
     ↓
Phase 2: 이슈 생성 + 문서 업데이트
     ↓
Phase 3: Todo 작성
     ↓
Phase 4: E2E 검증 (실패 시 자동 수정 2회)
     ↓
Phase 5: TDD 검증 + 최종 보고서
```

### 예시

```bash
$ /work API 응답 캐싱 추가

🔍 Phase 1: 병렬 분석 중...
📝 Phase 2: 이슈 #67에 코멘트 추가
✅ Phase 3: Todo 작성 완료 (7개 항목)
🧪 Phase 4: E2E 검증 15/15 통과
📊 Phase 5: 커버리지 85%
📋 최종 보고서 출력...
```

---

## 2. /commit - Conventional Commit 생성

Conventional Commits 형식으로 커밋을 생성하고 푸시합니다.

### 사용법

```bash
/commit              # 커밋 + 푸시
/commit --no-push    # 커밋만, 푸시 안함
```

### 커밋 형식

```
<type>(<scope>): <subject> <emoji>

<body>

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
```

### 커밋 타입

| Type | 설명 | Emoji |
|------|------|-------|
| `feat` | 새 기능 | ✨ |
| `fix` | 버그 수정 | 🐛 |
| `docs` | 문서 | 📝 |
| `style` | 포맷팅 | 💄 |
| `refactor` | 리팩토링 | ♻️ |
| `perf` | 성능 | ⚡ |
| `test` | 테스트 | ✅ |
| `chore` | 유지보수 | 🔧 |
| `ci` | CI/CD | 👷 |
| `build` | 빌드 | 📦 |

### 예시

```bash
$ /commit

git commit -m "feat(auth): Add OAuth2 authentication ✨"
git push origin main

✅ Committed and pushed: feat(auth): Add OAuth2 authentication ✨
```

---

## 3. /check - 코드 품질/보안 검사

정적 분석, E2E 테스트, 성능 분석, 보안 검사를 수행합니다.

### 사용법

```bash
/check               # 기본 검사 (lint, type, security)
/check --fix         # 자동 수정 가능한 이슈 수정
/check --e2e         # E2E 테스트 + 자동 수정
/check --perf        # 성능 분석
/check --security    # 보안 검사 심화
/check --all         # 모든 검사
/check --e2e --fix   # 조합 사용
```

### 검사 항목

| 카테고리 | 검사 | 도구 |
|----------|------|------|
| **정적 분석** | Type checking | mypy, tsc |
| | Linting | ruff, ESLint |
| | 코드 스타일 | black, Prettier |
| **보안** | 의존성 취약점 | pip-audit, npm audit |
| | SAST | SQL injection, XSS, 시크릿 |
| **테스트** | 커버리지 | pytest --cov, jest |

### --e2e 모드 (E2E 테스트)

```bash
/check --e2e

# 수행 작업:
# 1. Playwright E2E 테스트 실행
# 2. 실패 시 자동 수정 시도 (최대 2회)
# 3. Visual regression 검사
# 4. 접근성 검사 (a11y)
```

### --perf 모드 (성능 분석)

```bash
/check --perf

# 수행 작업:
# 1. CPU/Memory 프로파일링
# 2. 병목 지점 식별
# 3. 최적화 제안 생성
```

### 출력 예시

```
🔍 Running Code Quality Checks...

✅ Static Analysis
   • Type checking: PASSED
   • Linting: PASSED (2 warnings)

⚠️  Security Scan
   • Dependency vulnerabilities: 1 MODERATE
   → Run: npm audit fix

✅ Test Coverage: 87% (target: 80%)

Summary: 1 warning, 1 moderate issue
```

---

## 4. /tdd - TDD 워크플로우

Red-Green-Refactor 사이클로 TDD를 수행합니다.

### 사용법

```bash
/tdd <feature-name>
/tdd user-authentication
```

### Red-Green-Refactor 사이클

#### 🔴 Red: 실패하는 테스트 작성

```bash
# 1. 테스트 작성
def test_login_success():
    user = login("test@example.com", "password")
    assert user.is_authenticated == True

# 2. 실행 (반드시 실패)
pytest tests/test_auth.py -v  # ❌ FAILED

# 3. 커밋
git commit -m "test: Add login success test (RED) 🔴"
```

#### 🟢 Green: 테스트 통과하는 최소 코드 작성

```bash
# 1. 최소 구현
def login(email, password):
    user = User(email=email)
    user.is_authenticated = True
    return user

# 2. 실행 (통과)
pytest tests/test_auth.py -v  # ✅ PASSED

# 3. 커밋
git commit -m "feat: Implement login function (GREEN) 🟢"
```

#### ♻️ Refactor: 코드 개선

```bash
# 1. 리팩토링
def login(email, password):
    return User.authenticate(email, password)

# 2. 테스트 여전히 통과 확인
pytest tests/test_auth.py -v  # ✅ PASSED

# 3. 커밋
git commit -m "refactor: Use User.authenticate method ♻️"
```

---

## 5. /issue - GitHub 이슈 관리

이슈의 전체 생명주기를 관리합니다.

### 사용법

```bash
/issue list              # 열린 이슈 목록
/issue list mine         # 내게 할당된 이슈
/issue list 123          # 이슈 #123 상세
/issue create "제목"     # 새 이슈 생성
/issue edit 123 --close  # 이슈 닫기
/issue fix 123           # 이슈 해결 워크플로우
/issue failed 123        # 실패 분석
```

### /issue list - 이슈 조회

```bash
/issue list              # 열린 이슈 전체
/issue list open         # 열린 이슈
/issue list closed       # 닫힌 이슈
/issue list label:bug    # 라벨별 필터
/issue list mine         # 내게 할당된 이슈
```

### /issue create - 이슈 생성

```bash
/issue create "로그인 타임아웃 버그"
/issue create "새 기능" --labels=enhancement
```

### /issue edit - 이슈 수정

```bash
/issue edit 123 --close              # 닫기
/issue edit 123 --reopen             # 재오픈
/issue edit 123 --label bug          # 라벨 추가
/issue edit 123 --assignee @me       # 담당자 할당
/issue edit 123 --milestone v1.0     # 마일스톤 설정
```

### /issue fix - 이슈 해결

```bash
/issue fix 123

# 워크플로우:
# 1. 이슈 정보 조회
# 2. 컨텍스트 분석
# 3. 브랜치 생성: fix/issue-123-description
# 4. 구현 + 테스트
# 5. PR 생성 (Fixes #123 참조)
```

### /issue failed - 실패 분석

```bash
/issue failed 123

# 이전 해결 시도 실패 시:
# 1. 실패 원인 분석
# 2. 새 솔루션 제안
# 3. GitHub에 분석 코멘트 추가
```

---

## 6. /pr - PR 리뷰/머지

PR 리뷰, 개선 제안, 자동 머지를 수행합니다.

### 사용법

```bash
/pr review           # 현재 브랜치 PR 리뷰
/pr review #42       # 특정 PR 리뷰
/pr merge            # 조건 확인 후 머지
/pr merge #42        # 특정 PR 머지
/pr auto             # 리뷰 + 자동 머지
/pr list             # 리뷰 대기 PR 목록
```

### /pr review - PR 리뷰

```bash
/pr review #42
/pr review --strict   # 엄격 모드 (경고도 블로커)
```

**리뷰 체크리스트:**

| 카테고리 | 검사 | 심각도 |
|----------|------|--------|
| 코드 품질 | Lint/Type 오류 | High |
| 테스트 | 테스트 실패 | High |
| 보안 | 하드코딩 시크릿 | Critical |
| 스타일 | 포맷팅 오류 | Low |

### /pr merge - PR 머지

```bash
/pr merge            # 기본: squash merge
/pr merge --force    # 조건 무시 (위험)
```

**머지 조건:**
- CI 통과
- 충돌 없음
- Critical/High 이슈 없음

### /pr auto - 자동 리뷰 + 머지

```bash
/pr auto             # 리뷰 후 머지
/pr auto --auto-approve  # 블로커 없으면 자동 머지
```

### 예시 출력

```bash
$ /pr auto

🔍 PR #42 정보 확인...
🔬 리뷰 실행 중...
   [1/3] 코드 품질 검사... ✅
   [2/3] 테스트 검증... ✅
   [3/3] 보안 검사... ✅

✅ 머지 조건 충족
머지를 진행할까요? (Y/N): Y

🎉 PR #42 머지 완료!
```

---

## 7. /create - PRD/PR/문서 생성

PRD, PR, 문서를 생성합니다.

### 사용법

```bash
/create prd <name>       # PRD 생성
/create pr [base]        # PR 생성
/create docs [path]      # 문서 생성
```

### /create prd - PRD 생성

```bash
/create prd user-authentication
/create prd "검색 기능" --template=minimal
/create prd --template=deep
```

**템플릿 옵션:**

| 템플릿 | 소요 시간 | 대상 |
|--------|----------|------|
| `minimal` | 10분 | 숙련 개발자 |
| `standard` | 20-30분 | 일반 프로젝트 |
| `junior` | 40-60분 | 초보자 |
| `deep` | 60+분 | 완벽한 기획서 |

**대화형 워크플로우:**

```
/create prd user-authentication

A. Target Users
   A) End users only
   B) Admins only
   C) Both

B. Authentication Method
   A) Email/Password
   B) OAuth2
   C) SSO
...
```

### /create pr - PR 생성

```bash
/create pr              # main 대상
/create pr develop      # develop 대상
/create pr --draft      # Draft PR
```

### /create docs - 문서 생성

```bash
/create docs                   # 전체 프로젝트
/create docs src/auth/         # 특정 경로
/create docs --format=sphinx   # Sphinx 형식
```

---

## 8. /research - 리서치

코드베이스 분석, 웹 검색, 구현 계획을 수행합니다.

### 사용법

```bash
/research                     # 코드베이스 분석 (기본)
/research code [path]         # 특정 경로 분석
/research web "keyword"       # 웹 검색
/research plan [target]       # 구현 계획 수립
/research --codebase          # 전체 구조 분석
/research --deps              # 의존성 분석
```

### /research code - 코드베이스 분석

```bash
/research code                 # 전체 분석
/research code src/api/        # 특정 경로
/research code 123             # 이슈 #123 관련
/research code --codebase      # 구조 분석
/research code --deps          # 의존성 분석
```

### /research web - 오픈소스/솔루션 검색

```bash
/research web "React state management"
/research web "Python async HTTP client"
```

**수행 작업:**
1. 관련 오픈소스 라이브러리 검색
2. Make vs Buy 분석
3. 유사 구현 사례 조사

### /research plan - 구현 계획 수립

```bash
/research plan 123             # 이슈 #123 구현 계획
/research plan "user auth"     # 기능 구현 계획
/research plan --tdd           # TDD 기반 계획
```

### 옵션

| 옵션 | 설명 |
|------|------|
| `--save` | `.claude/research/`에 저장 |
| `--quick` | 빠른 탐색 (5분 이내) |
| `--thorough` | 철저한 분석 (15-30분) |

---

## 9. /parallel - 병렬 멀티에이전트 실행

4개의 전문 에이전트가 병렬로 작업합니다.

### 사용법

```bash
/parallel dev "작업 설명"      # 병렬 개발
/parallel test                 # 병렬 테스트
/parallel review               # 병렬 코드 리뷰
/parallel research "주제"      # 병렬 리서치
/parallel check "A, B, C"      # 충돌 검사
/parallel dev --branch         # 브랜치 기반 병렬 개발
```

### /parallel check - 충돌 검사

병렬 작업 전 파일 충돌 가능성을 사전 분석합니다.

```bash
/parallel check "Task A, Task B, Task C"

# 출력: 충돌 매트릭스
┌──────────┬────┬────┬─────────┐
│ 파일     │ A  │ B  │ 충돌    │
├──────────┼────┼────┼─────────┤
│ user.ts  │ W  │ W  │ ⚠️ A-B │
└──────────┴────┴────┴─────────┘
```

### /parallel dev - 병렬 개발

```bash
/parallel dev "인증 기능 추가"
/parallel dev --branch "인증 + API + UI"  # 브랜치 격리
```

**에이전트 역할:**

| 에이전트 | 역할 |
|----------|------|
| Architect | 설계, 인터페이스 정의 |
| Coder | 핵심 로직 구현 |
| Tester | 테스트 작성 |
| Docs | 문서화 |

### /parallel test - 병렬 테스트

```bash
/parallel test
/parallel test --module auth
```

**테스터 역할:**

| 에이전트 | 테스트 범위 |
|----------|-------------|
| Unit | 함수, 클래스, 모듈 |
| Integration | API, DB 연동 |
| E2E | 전체 사용자 플로우 |
| Security | OWASP Top 10 |

### /parallel review - 병렬 코드 리뷰

```bash
/parallel review
/parallel review src/auth/
```

**리뷰어 역할:**

| 에이전트 | 검토 항목 |
|----------|-----------|
| Security | SQL Injection, XSS |
| Logic | 알고리즘, 비즈니스 로직 |
| Style | 명명 규칙, 가독성 |
| Performance | 시간 복잡도, N+1 쿼리 |

### /parallel research - 병렬 리서치

```bash
/parallel research "React vs Vue 비교"
```

---

## 10. /todo - 작업 관리

프로젝트 작업을 관리합니다.

### 사용법

```bash
/todo list                     # 목록 조회
/todo add "작업" --priority=high  # 작업 추가
/todo status 1 completed       # 상태 변경
/todo priority 2 high          # 우선순위 변경
/todo depends 3 on 1,2         # 의존성 설정
/todo progress                 # 진행률 확인
/todo --log "작업 내용"        # 작업 로그 기록
```

### 상태 옵션

| 상태 | 마커 | 설명 |
|------|------|------|
| pending | `[ ]` | 미시작 |
| in_progress | `[→]` | 진행 중 |
| completed | `[x]` | 완료 |
| failed | `[!]` | 실패 |
| blocked | `[⏸]` | 블락 |

### PRD에서 Task 생성

```bash
/todo generate tasks/prds/0001-prd-auth.md

# 자동 생성:
# - Task 0.0: Setup
# - Task 1.0: Implementation
# - Task 2.0: Testing
```

### --log 모드

```bash
/todo --log "API 인증 구현 완료"

# 자동 생성: logs/work-log-2025-01-20.md
```

---

## 11. /session - 세션 관리

컨텍스트 압축, 여정 기록, 변경 로그, 세션 이어가기를 관리합니다.

### 사용법

```bash
/session                       # 현재 세션 여정 (기본)
/session compact               # 컨텍스트 압축
/session journey               # 세션 여정 기록
/session changelog [version]   # 변경 로그 생성
/session save                  # 세션 상태 저장
/session resume                # 이전 세션 이어가기
```

### /session save - 세션 상태 저장 ⭐

세션 종료 전 현재 작업 상태를 저장합니다.

```bash
/session save
/session save "인증 기능 70% 완료"
```

### /session resume - 세션 이어가기 ⭐

```bash
/session resume               # 최근 세션 로드
/session resume list          # 저장된 세션 목록
/session resume [date]        # 특정 날짜 세션
```

### /session compact - 컨텍스트 압축

```bash
/session compact              # 즉시 압축
/session compact save         # 압축 결과 저장
/session compact status       # 현재 상태 확인
```

**컨텍스트 임계값:**

| 사용량 | 상태 | 권장 조치 |
|--------|------|-----------|
| 0-40% | 🟢 Safe | 정상 |
| 40-60% | 🟡 DUMB | 주의 |
| 60-80% | 🟠 COMPRESS | 압축 권장 |
| 80%+ | 🚨 CRITICAL | 즉시 압축 |

### /session journey - 세션 여정 기록

```bash
/session journey              # 현재 세션 표시
/session journey save         # 세션 저장
/session journey export       # PR용 마크다운
```

### /session changelog - 변경 로그 생성

```bash
/session changelog            # Unreleased에 추가
/session changelog 1.2.0      # 특정 버전으로 릴리즈
```

### 권장 워크플로우

```
[세션 시작]
/session resume              # 이전 작업 불러오기
     ↓
[작업 진행]
... 코드 작성 ...
     ↓
[세션 종료 전]
/session save "인증 기능 70% 완료"
     ↓
[다음 세션]
/session resume              # 자동으로 이어서 시작
```

---

## 12. /deploy - 버전/Docker 배포

버전 업데이트와 Docker 재빌드를 수행합니다.

### 사용법

```bash
/deploy                        # 대화형 모드
/deploy patch                  # 패치 버전 + 리빌드
/deploy minor                  # 마이너 버전 + 리빌드
/deploy major                  # 메이저 버전 + 리빌드
/deploy 2.3.4                  # 특정 버전 설정
/deploy --docker-only          # Docker만 리빌드
/deploy --version-only         # 버전만 업데이트
/deploy patch --no-cache       # 캐시 없이 리빌드
```

### Semantic Versioning

| Bump | 사용 시점 | 예시 |
|------|----------|------|
| `patch` | 버그 수정 | 1.0.0 → 1.0.1 |
| `minor` | 새 기능 | 1.0.0 → 1.1.0 |
| `major` | Breaking changes | 1.0.0 → 2.0.0 |

### 예시

```bash
$ /deploy minor

=== DEPLOY WORKFLOW ===

[1/2] Version Update
Current: 1.2.3 → New: 1.3.0
Updated: package.json, CLAUDE.md
Committed: chore(release): bump version to 1.3.0

[2/2] Docker Rebuild
Stopping containers... done
Rebuilding images... done
Starting containers... done

=== DEPLOY COMPLETE ===
Version: 1.2.3 → 1.3.0
```

---

## 13. /audit - 설정 점검

CLAUDE.md, 커맨드, 에이전트, 스킬의 일관성을 점검합니다.

### 사용법

```bash
/audit              # 전체 점검
/audit quick        # 빠른 점검 (버전/개수만)
/audit deep         # 심층 점검 (내용 분석 포함)
/audit fix          # 발견된 문제 자동 수정
/audit baseline     # 현재 상태를 기준으로 저장

# 솔루션 추천 (신규)
/audit suggest              # 전체 영역 솔루션 추천
/audit suggest security     # 보안 도구 추천
/audit suggest ci-cd        # CI/CD 도구 추천
/audit suggest code-review  # 코드 리뷰 도구 추천
/audit suggest mcp          # MCP 서버 추천
/audit suggest deps         # 의존성 관리 도구 추천
```

### 점검 항목

| 영역 | 검사 내용 |
|------|----------|
| CLAUDE.md | 버전, 개수 일치 |
| 커맨드 | frontmatter, Usage 섹션 |
| 에이전트 | 역할, 도구 정의 |
| 스킬 | SKILL.md, 트리거 조건 |
| 문서 동기화 | REFERENCE 문서 일치 |

### 출력 예시

```
🔍 Configuration Audit - 2025-12-12

[1/5] CLAUDE.md 점검...
  ✅ 버전: 10.2.0
  ✅ 커맨드: 14개 일치

[2/5] 커맨드 점검...
  ✅ 14개 파일 검사 완료

[3/5] 에이전트 점검...
  ✅ 18개 파일 검사 완료

[4/5] 스킬 점검...
  ✅ 13개 디렉토리 검사 완료

[5/5] 문서 동기화 점검...
  ✅ 모든 문서 동기화됨

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 모든 점검 통과
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 권장 사용 시점

| 시점 | 권장 명령 |
|------|----------|
| 매일 작업 시작 | `/audit quick` |
| 설정 수정 후 | `/audit` |
| 주간/릴리즈 전 | `/audit deep` |
| 새 도구 탐색 | `/audit suggest` |

### /audit suggest - 솔루션 추천

웹과 GitHub를 검색하여 최신 도구/솔루션을 추천합니다.

| 영역 | 추천 내용 |
|------|----------|
| `security` | Snyk, Semgrep, Gitleaks (SAST, 취약점) |
| `ci-cd` | Spacelift, Harness (GitOps, 파이프라인) |
| `code-review` | Qodo Merge, CodeRabbit (AI 코드 리뷰) |
| `mcp` | github-mcp, postgres-mcp (MCP 서버) |
| `deps` | Dependabot, Renovate (의존성 자동화) |

**추천 흐름:**
1. 현재 설정 분석 (MCP, package.json 등)
2. GitHub 트렌드 검색 (스타 수, 업데이트)
3. 웹 검색 (Exa MCP 활용)
4. Make vs Buy 분석 + 설치 가이드

---

## Quick Reference

### 일상 워크플로우

```bash
# 작업 시작
/session resume              # 이전 세션 이어가기
/research 123                # 이슈 분석

# 개발
/tdd user-auth               # TDD로 개발
/check --fix                 # 품질 검사 + 자동 수정

# 완료
/commit                      # 커밋 + 푸시
/create pr                   # PR 생성
/pr auto                     # 리뷰 + 머지

# 세션 종료
/session save "작업 설명"     # 상태 저장
```

### 전체 자동화

```bash
/work --auto "기능 구현"      # 분석~PR까지 완전 자동화
```

### 병렬 작업

```bash
/parallel dev --branch "대규모 기능"  # 브랜치 격리 병렬 개발
/parallel review                      # 병렬 코드 리뷰
```

---

## 관련 문서

| 문서 | 설명 |
|------|------|
| `CLAUDE.md` | 프로젝트 전체 지침 |
| `docs/AGENTS_REFERENCE.md` | 에이전트 상세 |
| `.claude/commands/` | 커맨드 원본 파일 |
| `.claude/skills/` | 스킬 상세 |
