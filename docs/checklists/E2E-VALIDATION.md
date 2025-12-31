# Electron E2E 검증 체크리스트

**상태**: In Progress
**시작일**: 2025-12-31
**완료일**: -
**관련 파일**:
- `desktop/electron/browser/adapters/selector-config.ts`
- `desktop/tests/e2e/workflows/*.spec.ts`

---

## 개요

**목표**: Desktop App의 실제 LLM Provider 제어 검증
**핵심 문제**: 로그인한 LLM 모델(Claude, ChatGPT, Gemini)을 앱에서 제어할 수 없어 지속적 실패

### 검증 전략
- **Provider**: 3개 병렬 (Claude, ChatGPT, Gemini 동시)
- **방식**: E2E 테스트 실행 (Playwright headed 모드)

---

## Phase 1: 환경 준비

| 항목 | 상태 | 비고 |
|------|------|------|
| Desktop 빌드 확인 | - [x] | `dist/main/electron/main.js` 존재 |
| Playwright 설치 확인 | - [x] | 설치됨 |
| 테스트 파일 존재 확인 | - [x] | 6개 파일 존재 |

### 발견된 환경 문제

| 문제 | 심각도 | 상태 | 해결 방법 |
|------|--------|------|----------|
| JSON import 오류 | Critical | - [ ] | `import attribute of "type: json"` 필요 |
| claude-workflow.spec.ts 경로 오류 | High | - [ ] | `dist/main/index.js` → `dist/main/electron/main.js` |
| app.spec.ts 잘못된 앱 테스트 | High | - [ ] | localhost:5173에 다른 앱 ("현장 업로더") 실행 중 |

---

## Phase 2: 기본 E2E 테스트

| 테스트 파일 | 결과 | 비고 |
|------------|------|------|
| app.spec.ts | 3/15 통과 | 잘못된 앱 URL (현장 업로더) 테스트 중 |

**app.spec.ts 실행 결과 (2025-12-31):**
- 통과: 3개 (heading, focus, contrast)
- 실패: 12개 (UI 요소 미발견)
- 원인: localhost:5173에 다른 앱 실행 중

**실행 명령어:**
```bash
cd D:\AI\claude01\mad_framework\desktop
npm run test:e2e -- tests/e2e/app.spec.ts
```

---

## Phase 3: Claude 워크플로우 검증

### 테스트 실행 결과 (2025-12-31)

| 항목 | 결과 | 비고 |
|------|------|------|
| 테스트 파일 | claude-workflow.spec.ts | 18개 테스트 |
| 실행 결과 | **0/18 통과** | beforeAll 타임아웃 |
| 실패 원인 | Electron 앱 시작 타임아웃 (120초 초과) | |

### 셀렉터 현황

| 셀렉터 유형 | Primary | 상태 | Fallback |
|------------|---------|------|----------|
| inputTextarea | `textarea[data-testid="chat-input-ssr"]` | - [ ] 미검증 | `div.ProseMirror[contenteditable]` |
| sendButton | `button[aria-label="메시지 보내기"]` | - [ ] 미검증 | `fieldset button:not([aria-label*="Stop"])` |
| responseContainer | `div.standard-markdown` | - [ ] 미검증 | `p.font-claude-response-body` |
| typingIndicator | `button[disabled]` | - [ ] 미검증 | Stop 버튼 감지 |

### 워크플로우 테스트

| 단계 | 상태 | 에러 메시지 |
|------|------|------------|
| APP_START - Electron launch | - [x] 실패 | beforeAll hook timeout of 120000ms exceeded |
| LOGIN - `checkLogin()` | - [ ] 미도달 | |
| INPUT - `prepareInput()` | - [ ] 미도달 | |
| ENTER - `enterPrompt()` | - [ ] 미도달 | |
| SUBMIT - `submitMessage()` | - [ ] 미도달 | |
| WAIT - `awaitResponse()` | - [ ] 미도달 | |
| EXTRACT - `getResponse()` | - [ ] 미도달 | |

**실행 명령어:**
```bash
npm run test:e2e:headed -- tests/e2e/workflows/claude-workflow.spec.ts
```

---

## Phase 4: ChatGPT 워크플로우 검증

### 테스트 실행 결과 (2025-12-31)

| 항목 | 결과 | 비고 |
|------|------|------|
| 테스트 파일 | gpt-workflow.spec.ts | 18개 테스트 |
| 실행 결과 | **0/18 통과** | __dirname 오류 (수정됨) → beforeAll 타임아웃 |
| 실패 원인 | Electron 앱 시작 타임아웃 (120초 초과) | |

### 셀렉터 현황

| 셀렉터 유형 | Primary | 상태 | Fallback |
|------------|---------|------|----------|
| inputTextarea | `#prompt-textarea` | - [ ] 미검증 | `[contenteditable="true"]` |
| sendButton | `[data-testid="send-button"]` | - [ ] 미검증 | 9개 fallback |
| responseContainer | `[data-message-author-role="assistant"]` | - [ ] 미검증 | `.markdown` 계열 |
| typingIndicator | `.result-streaming` | - [ ] 미검증 | - |

### 워크플로우 테스트

| 단계 | 상태 | 에러 메시지 |
|------|------|------------|
| APP_START - Electron launch | - [x] 실패 | beforeAll hook timeout of 120000ms exceeded |
| LOGIN - `checkLogin()` | - [ ] 미도달 | |
| INPUT - `prepareInput()` | - [ ] 미도달 | |
| ENTER - `enterPrompt()` | - [ ] 미도달 | |
| SUBMIT - `submitMessage()` | - [ ] 미도달 | |
| WAIT - `awaitResponse()` | - [ ] 미도달 | |
| EXTRACT - `getResponse()` | - [ ] 미도달 | |

**실행 명령어:**
```bash
npm run test:e2e:headed -- tests/e2e/workflows/gpt-workflow.spec.ts
```

---

## Phase 5: Gemini 워크플로우 검증

### 테스트 실행 결과 (2025-12-31)

| 항목 | 결과 | 비고 |
|------|------|------|
| 테스트 파일 | gemini-workflow.spec.ts | 16개 테스트 |
| 실행 결과 | **0/16 통과** | beforeAll 타임아웃 |
| 실패 원인 | Electron 앱 시작 타임아웃 (120초 초과) | |

### 셀렉터 현황

| 셀렉터 유형 | Primary | 상태 | Fallback |
|------------|---------|------|----------|
| inputTextarea | `.ql-editor` | - [ ] 미검증 | `[contenteditable="true"]` |
| sendButton | `.send-button` | - [ ] 미검증 | 재분석 필요 |
| responseContainer | `.response-container` | - [ ] 미검증 | 재분석 필요 |
| typingIndicator | `.loading-indicator` | - [ ] 미검증 | 재분석 필요 |

### 워크플로우 테스트

| 단계 | 상태 | 에러 메시지 |
|------|------|------------|
| APP_START - Electron launch | - [x] 실패 | beforeAll hook timeout of 120000ms exceeded |
| LOGIN - `checkLogin()` | - [ ] 미도달 | |
| INPUT - `prepareInput()` | - [ ] 미도달 | |
| ENTER - `enterPrompt()` | - [ ] 미도달 | |
| SUBMIT - `submitMessage()` | - [ ] 미도달 | |
| WAIT - `awaitResponse()` | - [ ] 미도달 | |
| EXTRACT - `getResponse()` | - [ ] 미도달 | |

**실행 명령어:**
```bash
npm run test:e2e:headed -- tests/e2e/workflows/gemini-workflow.spec.ts
```

---

## Phase 6: 스트레스 테스트

| 테스트 | 성공 기준 | 결과 | 비고 |
|--------|----------|------|------|
| 3회 연속 메시지 | 100% (3/3) | - [ ] | |
| 5회 연속 메시지 | 90% (4.5/5) | - [ ] | |
| 10회 연속 메시지 | 80% (8/10) | - [ ] | |

**실행 명령어:**
```bash
npm run test:e2e:headed -- tests/e2e/stress/consecutive-messages.spec.ts
```

---

## 테스트 결과 요약

### Provider별 성공률

| Provider | 테스트 수 | 통과 | 실패 | 성공률 | 목표 |
|----------|----------|------|------|--------|------|
| Claude | 18 | 0 | 18 | **0%** | 90% |
| ChatGPT | 18 | 0 | 18 | **0%** | 90% |
| Gemini | 16 | 0 | 16 | **0%** | 80% |

### 공통 실패 원인

| 문제 | 상태 | 설명 |
|------|------|------|
| Electron 앱 시작 타임아웃 | - [x] 발견 | beforeAll hook timeout of 120000ms exceeded |
| __dirname 미정의 (ESM) | - [x] 수정됨 | gpt-workflow.spec.ts |
| JSON import 오류 | - [x] 수정됨 | 모든 workflow 파일 |
| 경로 오류 | - [x] 수정됨 | dist/main/index.js → dist/main/electron/main.js |

### 단계별 통과율

| 단계 | Claude | ChatGPT | Gemini |
|------|--------|---------|--------|
| APP_START | - [x] 실패 | - [x] 실패 | - [x] 실패 |
| LOGIN | 미도달 | 미도달 | 미도달 |
| INPUT | 미도달 | 미도달 | 미도달 |
| ENTER | 미도달 | 미도달 | 미도달 |
| SUBMIT | 미도달 | 미도달 | 미도달 |
| WAIT | 미도달 | 미도달 | 미도달 |
| EXTRACT | 미도달 | 미도달 | 미도달 |

---

## 실패 항목 분석

### Claude 실패 항목

| 단계 | 시도한 셀렉터 | 에러 메시지 | 조치 필요 |
|------|--------------|------------|----------|
| | | | |

### ChatGPT 실패 항목

| 단계 | 시도한 셀렉터 | 에러 메시지 | 조치 필요 |
|------|--------------|------------|----------|
| | | | |

### Gemini 실패 항목

| 단계 | 시도한 셀렉터 | 에러 메시지 | 조치 필요 |
|------|--------------|------------|----------|
| | | | |

---

## 참조

### 관련 파일

| 파일 | 설명 |
|------|------|
| `desktop/electron/browser/adapters/selector-config.ts` | 셀렉터 설정 |
| `desktop/electron/debate/debate-controller.ts` | 토론 진행 로직 |
| `desktop/electron/browser/adapters/base-adapter.ts` | 공통 어댑터 |
| `desktop/electron/browser/adapters/claude-adapter.ts` | Claude 어댑터 |
| `desktop/electron/browser/adapters/chatgpt-adapter.ts` | ChatGPT 어댑터 |
| `desktop/electron/browser/adapters/gemini-adapter.ts` | Gemini 어댑터 |

### 관련 문서

- `docs/checklists/CLAUDE-VALIDATION.md` - 기존 Claude 검증 체크리스트
- `desktop/docs/ERROR_RESOLUTION_PLAN.md` - 에러 해결 로드맵

---

## 검증 실행 방법

```bash
# 1. Desktop 디렉토리로 이동
cd D:\AI\claude01\mad_framework\desktop

# 2. 의존성 설치
npm install

# 3. 빌드
npm run build

# 4. 기본 UI 테스트
npm run test:e2e -- tests/e2e/app.spec.ts

# 5. 워크플로우 테스트 (headed 모드)
npm run test:e2e:headed -- tests/e2e/workflows/claude-workflow.spec.ts
npm run test:e2e:headed -- tests/e2e/workflows/gpt-workflow.spec.ts
npm run test:e2e:headed -- tests/e2e/workflows/gemini-workflow.spec.ts

# 6. 스트레스 테스트
npm run test:e2e:headed -- tests/e2e/stress/consecutive-messages.spec.ts

# 7. Playwright UI 모드 (디버깅)
npm run test:e2e:ui
```

---

## 변경 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2025-12-31 | 최초 작성 | Claude Code |
| 2025-12-31 | JSON import 오류 수정 (claude/gpt/gemini workflow) | Claude Code |
| 2025-12-31 | 경로 오류 수정 (dist/main/index.js → dist/main/electron/main.js) | Claude Code |
| 2025-12-31 | __dirname ESM 정의 추가 (gpt-workflow.spec.ts) | Claude Code |
| 2025-12-31 | E2E 테스트 실행 결과 기록 (0/52 통과, Electron 타임아웃) | Claude Code |
