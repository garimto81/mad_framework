# Build & Test Guide

프로젝트별 빌드 및 테스트 명령어입니다.

**참조**: `CLAUDE.md` 안전 규칙

---

## Python 프로젝트

```powershell
# 린트
ruff check src/ --fix

# 테스트 (개별 파일 권장 - 120초 타임아웃 방지)
pytest tests/test_specific.py -v

# 전체 테스트 (background 필수)
# run_in_background: true
pytest tests/ -v --cov=src
```

---

## VTC_Logger (React + Vite)

```powershell
cd D:\AI\claude01\VTC_Logger\vtc-app
npm install
npm run dev      # 개발 서버
npm run build    # 빌드
npm run lint     # ESLint
```

---

## E2E 테스트 (Playwright 필수)

### 설치 및 실행

```powershell
# Playwright 설치
npx playwright install

# E2E 테스트 실행
npx playwright test

# UI 모드
npx playwright test --ui

# 특정 테스트
npx playwright test tests/e2e/auth.spec.ts
```

### E2E 테스트 규칙

| 규칙 | 내용 |
|------|------|
| **도구** | Playwright 필수 (다른 도구 금지) |
| **범위** | 모든 기능 엄격히 테스트 |
| **결과** | 통과한 테스트 목록 명시 필수 |

### 결과 출력 형식

```
## E2E 테스트 결과

✅ 통과: 15/15 (100%)

| 테스트 | 상태 | 시간 |
|--------|------|------|
| auth.spec.ts > 로그인 성공 | ✅ | 1.2s |
| auth.spec.ts > 로그인 실패 | ✅ | 0.8s |
| dashboard.spec.ts > 메인 로드 | ✅ | 2.1s |
...
```

---

## 안전 규칙

```powershell
# 금지 (120초 초과 → 크래시)
pytest tests/ -v --cov

# 권장
pytest tests/test_a.py -v
# 또는 run_in_background: true
```

---

## 버전 이력

| 버전 | 날짜 | 변경 |
|------|------|------|
| 1.0.0 | 2025-12-16 | CLAUDE.md에서 분리 (PRD-0034) |
