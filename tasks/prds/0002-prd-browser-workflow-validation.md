# PRD: Browser Workflow Validation Test Model

**Version**: 1.0
**Date**: 2025-12-22
**Status**: Draft
**PRD Number**: 0002

---

## 1. Purpose

MAD Framework Desktop App의 각 LLM 어댑터(ChatGPT, Claude, Gemini)에 대한 실제 브라우저 E2E 검증 테스트 모델을 개발합니다. 단일 LLM 워크플로우 검증부터 다중 LLM 심판 기능까지 단계별로 구현하여 브라우저 자동화의 안정성을 보장합니다.

## 2. Target Users

- **Primary**: MAD Framework 개발자 (CI/CD 통합)
- **Secondary**: 품질 보증 엔지니어

## 3. Core Features

### 3.1 Phase 1: LLM별 브라우저 워크플로우 완성
**Priority**: High | **Effort**: Medium

#### 현재 어댑터 구현 상태 (실제 브라우저 검증 기준)

| Provider | 로그인 | 입력 | 전송 | 응답대기 | 응답추출 | 진행상태 |
|----------|--------|------|------|----------|----------|----------|
| ChatGPT  | ❌     | ❌   | ❌   | ❌       | ❌       | ❌       |
| Claude   | ❌     | ❌   | ❌   | ❌       | ❌       | ❌       |
| Gemini   | ❌     | ❌   | ❌   | ❌       | ❌       | ❌       |

> **참고**: ❌ = 실제 브라우저 미검증 (Mock 테스트만 통과)
> - 단위 테스트 56개, 통합 테스트 4개 → 모두 `vi.mock('electron')` 사용
> - E2E 테스트 1개 (`app.spec.ts`) → 레이아웃/접근성만 검증

#### 알려진 위험 요소

| 문제 | 위치 | 심각도 |
|------|------|--------|
| Gemini enterPrompt innerHTML 직접 설정 (XSS 위험) | gemini-adapter.ts:61 | Critical |
| Gemini `.send-button` 셀렉터 불확실 | selector-config.ts:190 | Critical |
| checkLogin() Override가 fallback 미사용 | 각 adapter | High |
| Claude contentStableThreshold 2초 고정 | claude-adapter.ts:315 | Medium |

**완성 기준**:
- 셀렉터 fallback 시스템 100% 적용
- 진행상태 모니터링 (isWriting, tokenCount, responseProgress) 안정화
- 에러 복구 로직 검증
- **실제 브라우저 E2E 테스트 통과**

---

## Appendix A: 브라우저 검증 체크리스트

### A.1 ChatGPT Adapter 검증

#### 로그인 확인 (`checkLogin`)
- [ ] `[data-testid="profile-button"]` 셀렉터 존재 확인
- [ ] Fallback: `button[aria-label="Open profile dropdown"]`
- [ ] Fallback: `.group\\/profile`
- [ ] 비로그인 상태에서 false 반환 확인

#### 입력 준비 (`prepareInput`)
- [ ] `#prompt-textarea` 셀렉터 존재 확인
- [ ] Fallback: `textarea[data-id="root"]`
- [ ] Fallback: `[contenteditable="true"]`
- [ ] 10초 타임아웃 내 준비 완료

#### 프롬프트 입력 (`enterPrompt`)
- [ ] ProseMirror contenteditable 방식 동작
- [ ] Native textarea setter 방식 동작
- [ ] 1000ms React 처리 대기 후 입력 확인
- [ ] 한글 입력 정상 동작
- [ ] 특수문자 포함 입력

#### 메시지 전송 (`submitMessage`)
- [ ] `[data-testid="send-button"]` 클릭
- [ ] Fallback: 6개 셀렉터 순차 시도
- [ ] Fallback: Enter 키 전송
- [ ] 전송 후 버튼 비활성화 확인

#### 응답 대기 (`awaitResponse`)
- [ ] `.result-streaming` 타이핑 상태 감지
- [ ] 타이핑 시작 대기 (10초 내)
- [ ] 타이핑 완료 대기 (120초 내)
- [ ] DOM 안정화 1000ms 대기

#### 응답 추출 (`getResponse`)
- [ ] 16개 응답 셀렉터 중 하나 성공
- [ ] 마지막 메시지만 추출
- [ ] "코드 복사"/"Copy code" 텍스트 제거 (Issue #9)

#### 진행상태 모니터링
- [ ] `isWriting()`: 스트리밍 상태 정확 감지
- [ ] `getTokenCount()`: 응답 길이 추적
- [ ] `responseProgress`: 0-100% 계산

---

### A.2 Claude Adapter 검증

#### 로그인 확인 (`checkLogin`)
- [ ] `button[data-testid="user-menu-button"]` 존재 확인
- [ ] Fallback: 6개 셀렉터 순차 시도
- [ ] 비로그인 상태 감지

#### 프롬프트 입력 (`enterPrompt`)
- [ ] `textarea[data-testid="chat-input-ssr"]` (Issue #11)
- [ ] Fallback: contenteditable div
- [ ] input 이벤트 정상 발생

#### 메시지 전송 (`submitMessage`)
- [ ] PointerEvent → MouseEvent 시퀀스 동작
- [ ] `button[aria-label="메시지 보내기"]` (한국어)
- [ ] `button[aria-label="Send message"]` (영어)
- [ ] Fallback: Enter 키

#### 응답 대기 (`awaitResponse`)
- [ ] Stop 버튼 존재 = 응답 중
- [ ] Send 버튼 disabled = 응답 중
- [ ] contentStableThreshold (2초) 동작

#### 응답 추출 (`getResponse`)
- [ ] TreeWalker 기반 DOM 분석 동작
- [ ] 50자 이상 텍스트 노드 검색
- [ ] Fallback: 6개 응답 셀렉터

#### 진행상태 모니터링
- [ ] `isWriting()`: Stop/Send 버튼 상태 기반
- [ ] 콘텐츠 변화 추적 동작
- [ ] `resetContentTracking()` 호출 확인

---

### A.3 Gemini Adapter 검증

#### 로그인 확인 (`checkLogin`)
- [ ] `[data-user-email]` 속성 존재 확인
- [ ] Fallback: 5개 셀렉터 순차 시도

#### 프롬프트 입력 (`enterPrompt`)
- [ ] `.ql-editor` Quill Editor 존재 확인
- [ ] innerHTML 설정 동작 검증
- [ ] input 이벤트 발생 확인

#### 메시지 전송 (`submitMessage`)
- [ ] `.send-button` 셀렉터 존재 확인
- [ ] Fallback: `button[aria-label*="Send"]`
- [ ] Fallback: Enter 키

#### 응답 대기 (`awaitResponse`)
- [ ] 로딩 인디케이터 감지
- [ ] aria-busy="true" 감지
- [ ] stop button 존재 감지

#### 응답 추출 (`getResponse`)
- [ ] 7개 셀렉터 fallback (Issue #33)
- [ ] 마지막 응답만 추출

#### 진행상태 모니터링
- [ ] 6가지 isWriting 감지 방식 동작

---

### A.4 심판(Judge) 검증

#### Judge 입력 검증
- [ ] 두 참여자 응답을 Judge에게 전달
- [ ] 올바른 프롬프트 형식 (JSON 요청)
- [ ] 평가 요소 목록 포함

#### Judge 응답 파싱
- [ ] JSON 코드블록 파싱
- [ ] 직접 JSON 객체 파싱
- [ ] 배열 형식 파싱
- [ ] 한글 텍스트 폴백 파싱

#### 점수 기반 평가
- [ ] 각 요소 점수 0-100 범위
- [ ] `completionThreshold` (기본 90) 도달 확인
- [ ] 점수 히스토리 누적

#### 완료 조건
- [ ] 모든 요소 임계값 도달 → 완료
- [ ] 순환 감지 → 조기 완료
- [ ] 최대 iteration (100) 도달 → 강제 종료

---

### 3.2 Phase 2: GPT 단일 워크플로우 검증 테스트
**Priority**: High | **Effort**: Medium

```
tests/e2e/workflows/
├── gpt-workflow.spec.ts    # GPT 전체 플로우 E2E
└── fixtures/
    └── gpt-test-prompts.json
```

**테스트 범위**:
1. 로그인 상태 확인 (`checkLogin`)
2. 입력창 준비 대기 (`prepareInput`)
3. 프롬프트 입력 (`enterPrompt`)
4. 메시지 전송 (`submitMessage`)
5. 진행상태 모니터링
   - `isWriting`: 응답 생성 중 여부
   - `getTokenCount`: 토큰 수 증가 추적
   - `responseProgress`: 0-100% 진행률
6. 응답 추출 (`getResponse`)

**성공 기준**:
- 응답 길이 > 50자
- 응답 시간 < 120초
- 진행상태 콜백 최소 3회 호출

### 3.3 Phase 3: Claude 단일 워크플로우 검증 테스트
**Priority**: High | **Effort**: Medium

```
tests/e2e/workflows/
└── claude-workflow.spec.ts
```

GPT와 동일한 검증 범위, Claude 어댑터 특화 검증 추가:
- `[contenteditable]` 입력 방식 검증
- 응답 컨테이너 셀렉터 fallback 검증

### 3.4 Phase 4: Gemini 단일 워크플로우 검증 테스트
**Priority**: High | **Effort**: Medium

```
tests/e2e/workflows/
└── gemini-workflow.spec.ts
```

GPT와 동일한 검증 범위, Gemini 어댑터 특화 검증 추가:
- 심판(Judge) 역할 시 JSON 파싱 검증
- 순환 감지 응답 형식 검증

### 3.5 Phase 5: 다중 LLM 심판 검증 테스트
**Priority**: High | **Effort**: High

```
tests/e2e/workflows/
├── judge-validation.spec.ts   # 심판 기능 검증
└── multi-llm-debate.spec.ts   # 전체 토론 플로우
```

**심판 평가 기준 (점수 기반)**:
- 각 요소별 점수 (0-100)
- `completionThreshold` 도달 여부 (기본 90점)
- 점수 히스토리 추적

**테스트 시나리오**:
```typescript
interface JudgeTestCase {
  topic: string;
  context: string;
  preset: 'code_review' | 'qa_accuracy' | 'decision';
  participants: LLMProvider[];
  judgeProvider: LLMProvider;
  expectedElements: string[];
  completionThreshold: number;
}
```

**검증 항목**:
1. Judge가 각 참여자 응답 수신 확인
2. 요소별 점수 파싱 정확성
3. 임계값 도달 시 완료 처리
4. 결과 리포트 생성

## 4. Technical Requirements

### 4.1 E2E 테스트 프레임워크

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './tests/e2e/workflows',
  timeout: 180000, // 3분 (LLM 응답 대기)
  retries: 1,
  reporter: [
    ['html', { outputFolder: 'tests/reports/html' }]
  ],
  use: {
    headless: false, // 브라우저 UI 표시
    viewport: { width: 1280, height: 720 },
  },
});
```

### 4.2 테스트 실행 전 로그인 요구사항

```
⚠️ 사전 조건: 각 LLM 웹사이트에 수동 로그인 필요
- https://chat.openai.com (ChatGPT)
- https://claude.ai (Claude)
- https://gemini.google.com (Gemini)
```

세션 영속성을 위해 `persist:{provider}` 파티션 사용

### 4.3 HTML 리포트 구조

```
tests/reports/
├── html/
│   └── index.html          # Playwright HTML Reporter
├── workflow-results.json   # 상세 결과 데이터
└── summary.html            # 커스텀 요약 리포트
```

**리포트 내용**:
- 각 LLM별 워크플로우 성공/실패
- 응답 시간 통계
- 진행상태 모니터링 로그
- 스크린샷 (실패 시)

### 4.4 진행상태 모니터링 인터페이스

```typescript
interface WorkflowProgress {
  provider: LLMProvider;
  stage: 'login' | 'input' | 'send' | 'waiting' | 'extracting' | 'complete';
  isWriting: boolean;
  tokenCount: number;
  responseProgress: number; // 0-100
  elapsedMs: number;
}
```

## 5. Success Metrics

| 메트릭 | 목표 |
|--------|------|
| GPT 워크플로우 성공률 | ≥ 95% |
| Claude 워크플로우 성공률 | ≥ 95% |
| Gemini 워크플로우 성공률 | ≥ 95% |
| 심판 점수 파싱 정확도 | ≥ 99% |
| 평균 응답 시간 | < 60초 |
| 테스트 전체 실행 시간 | < 15분 |

## 6. Implementation Plan

### Phase 순서

```
Phase 1: 어댑터 완성도 검증 (기존 코드 리뷰)
    ↓
Phase 2: GPT 단일 워크플로우 E2E
    ↓
Phase 3: Claude 단일 워크플로우 E2E
    ↓
Phase 4: Gemini 단일 워크플로우 E2E
    ↓
Phase 5: 다중 LLM 심판 검증
```

### 파일 구조

```
desktop/
├── tests/
│   ├── e2e/
│   │   ├── workflows/
│   │   │   ├── gpt-workflow.spec.ts
│   │   │   ├── claude-workflow.spec.ts
│   │   │   ├── gemini-workflow.spec.ts
│   │   │   ├── judge-validation.spec.ts
│   │   │   └── multi-llm-debate.spec.ts
│   │   └── fixtures/
│   │       ├── test-prompts.json
│   │       └── expected-responses.json
│   └── reports/
│       └── html/
├── playwright.config.ts (업데이트)
└── package.json (scripts 추가)
```

### npm scripts

```json
{
  "scripts": {
    "test:e2e:gpt": "playwright test tests/e2e/workflows/gpt-workflow.spec.ts",
    "test:e2e:claude": "playwright test tests/e2e/workflows/claude-workflow.spec.ts",
    "test:e2e:gemini": "playwright test tests/e2e/workflows/gemini-workflow.spec.ts",
    "test:e2e:judge": "playwright test tests/e2e/workflows/judge-validation.spec.ts",
    "test:e2e:all": "playwright test tests/e2e/workflows/",
    "test:e2e:report": "playwright show-report tests/reports/html"
  }
}
```

## 7. Risks & Mitigations

| 리스크 | 영향 | 완화 방안 |
|--------|------|----------|
| LLM 웹사이트 UI 변경 | High | 셀렉터 fallback 시스템 활용, 주기적 셀렉터 업데이트 |
| 로그인 세션 만료 | Medium | persist 파티션 사용, 테스트 전 로그인 상태 확인 |
| 네트워크 불안정 | Medium | 재시도 로직, 타임아웃 설정 |
| LLM 응답 지연 | Medium | 충분한 타임아웃 (120초), 진행상태 모니터링 |

## 8. Dependencies

- Playwright v1.40+
- Electron v28+
- Vitest v1.0+ (단위 테스트)
- 기존 어댑터 구현 (`electron/browser/adapters/`)

## 9. Out of Scope

- API 기반 테스트 (Desktop App은 웹 자동화만)
- 모바일 브라우저 지원
- 자동 로그인 구현 (보안 이슈)

---

**Next Steps**: `/work` 또는 `/tdd`로 구현 시작
