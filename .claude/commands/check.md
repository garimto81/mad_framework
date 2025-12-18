---
name: check
description: Comprehensive code quality and security checks
---

# /check - 통합 검증 커맨드

정적 분석, E2E 테스트, 성능 분석, 보안 검사를 수행합니다.

## Usage

```
/check [options]

Options:
  --fix           자동 수정 가능한 이슈 수정
  --e2e           E2E 테스트 + 자동 수정 (final-check 흡수)
  --perf          성능 분석 (optimize 흡수)
  --security      보안 검사 심화
  --api           API 엔드포인트 테스트 (api-test 흡수)
  --all           모든 검사 수행

조합 사용:
  /check --e2e --fix    E2E + 자동 수정
  /check --perf --fix   성능 분석 + 자동 수정
  /check --api          REST/GraphQL API 테스트
```

## Check Categories

### 1. Static Analysis

**Python**:
```bash
# Type checking
mypy src/

# Linting
ruff check src/

# Code style
black --check src/
```

**JavaScript/TypeScript**:
```bash
# ESLint
npm run lint

# TypeScript
npx tsc --noEmit

# Prettier
npm run format:check
```

### 2. Security Scanning

**Dependency Vulnerabilities**:
```bash
# Python
pip-audit

# Node.js
npm audit

# Severity: CRITICAL, HIGH, MODERATE, LOW
```

**SAST (Static Application Security Testing)**:
```bash
# Check for:
- SQL injection vulnerabilities
- XSS vulnerabilities
- Hardcoded secrets
- Insecure configurations
```

### 3. Code Smells

- Duplicate code
- Long functions (>50 lines)
- High complexity (cyclomatic > 10)
- Too many parameters (>5)
- Deep nesting (>4 levels)

### 4. Test Coverage

```bash
# Python
pytest --cov=src --cov-report=term-missing

# JavaScript
npm run test:coverage

# Minimum: 80%
```

## Phase Integration

### Phase 1: Implementation
- Run `/check` before committing
- Fix issues before moving to Phase 2

### Phase 2: Testing
- `/check` validates test quality
- Coverage threshold: 80%

### Phase 5: E2E & Security
- Security scan mandatory
- No CRITICAL vulnerabilities allowed

### Phase 6: Deployment
- Final `/check` before deploy
- All checks must pass

## Output Format

```
🔍 Running Code Quality Checks...

✅ Static Analysis
   • Type checking: PASSED
   • Linting: PASSED (2 warnings)
   • Code style: PASSED

⚠️  Security Scan
   • Dependency vulnerabilities: 1 MODERATE
   • SAST: PASSED
   → Run: npm audit fix

✅ Code Smells
   • No critical issues found

✅ Test Coverage
   • Coverage: 87% (target: 80%)

Summary: 1 warning, 1 moderate issue
Action: Fix npm vulnerabilities before deploy
```

## Auto-Fix Mode

```bash
/check --fix

# Automatically fixes:
- Code formatting
- Import sorting
- Simple linting issues
- Moderate vulnerabilities (safe updates)

# Manual review needed:
- Breaking changes
- Major version updates
- Complex refactoring
```

## --e2e 모드 (E2E 테스트)

`/check --e2e`는 기존 `/final-check` 기능을 통합:

```bash
/check --e2e

# 수행 작업:
# 1. Playwright E2E 테스트 실행
# 2. 실패 시 자동 수정 시도 (최대 2회)
# 3. Visual regression 검사
# 4. 접근성 검사 (a11y)
```

### E2E 검증 기준

| 항목 | 기준 | 실패 시 |
|------|------|---------|
| Functional | 100% 통과 | 자동 수정 |
| Visual | Diff < 100px | 스냅샷 업데이트 |
| Accessibility | Violations = 0 | ARIA 추가 |
| Performance | LCP < 2.5s | 경고 |

---

## --perf 모드 (성능 분석)

`/check --perf`는 기존 `/optimize` 기능을 통합:

```bash
/check --perf

# 수행 작업:
# 1. CPU/Memory 프로파일링
# 2. 병목 지점 식별
# 3. 최적화 제안 생성
```

### 성능 기준

| 항목 | 목표 | 중요도 |
|------|------|--------|
| API 응답 | < 500ms (p95) | HIGH |
| DB 쿼리 | < 100ms | HIGH |
| 페이지 로드 | < 3s | MEDIUM |
| 메모리 사용 | < 512MB | MEDIUM |

### 최적화 제안 예시

```
⚡ Performance Analysis

🔍 Identified Issues:
   1. [CRITICAL] N+1 query in src/api/users.py:45
      → Suggestion: Use joinedload()
      → Impact: -80% query time

   2. [HIGH] Blocking I/O in src/services/fetch.py:12
      → Suggestion: Use async/await
      → Impact: -60% response time
```

---

## Integration with Agents

| 옵션 | 연동 에이전트 | 역할 |
|------|--------------|------|
| 기본 | `code-reviewer` | 코드 품질 리뷰 |
| `--security` | `security-auditor` | 보안 취약점 심층 분석 |
| `--e2e` | `test-engineer` | E2E 테스트 실행 |
| `--perf` | `devops-engineer` | 성능 분석 |

## Related

- `/tdd` - Test-driven development
- `/work` - 전체 워크플로우

---

## --api 모드 (API 테스트)

`/check --api`는 기존 `/api-test` 기능을 통합:

```bash
/check --api                    # 전체 API 테스트
/check --api /api/users         # 특정 엔드포인트
/check --api --security         # API 보안 테스트 포함
```

### API 테스트 항목

| 카테고리 | 검사 항목 |
|----------|-----------|
| **상태 코드** | 200, 201, 400, 401, 404, 500 |
| **응답 형식** | JSON 구조, 필수 필드 |
| **인증** | 토큰 검증, 권한 확인 |
| **입력 검증** | 필수 파라미터, 타입 체크 |
| **성능** | 응답 시간 < 200ms |

### API 보안 테스트 (--api --security)

```bash
# SQL Injection 테스트
# XSS 테스트
# 인증 우회 테스트
```

---

## 통합 이력

| 기존 커맨드 | 통합 위치 | 날짜 |
|------------|----------|------|
| `/final-check` | `/check --e2e` | 2025-12-11 |
| `/optimize` | `/check --perf` | 2025-12-11 |
| `/api-test` | `/check --api` | 2025-12-15 |
