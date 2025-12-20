# MAD Framework Desktop - 에러 해결 계획

## 개요

| 분류 | 내용 |
|------|------|
| **문서** | 지속적 에러 해결 계획서 |
| **버전** | 1.0 |
| **작성일** | 2025-12-18 |
| **관련 이슈** | Script failed to execute, 무한 루프, 빈 응답 |

---

## 1. 식별된 문제 패턴

### 1.1 에러 전파 경로 (Cascading Failure)

```
inputPrompt 실패 (타이밍)
    ↓
sendMessage 무시 (Silent fail)
    ↓
waitForResponse 조기 종료 (isWriting=false)
    ↓
extractResponse 빈 값 반환
    ↓
parseElementScores 빈 배열
    ↓
점수 업데이트 없음
    ↓
무한 루프
```

### 1.2 핵심 문제 4가지

| # | 문제 | 위치 | 심각도 |
|---|------|------|--------|
| 1 | 일관성 없는 에러 핸들링 | base-adapter.ts | Critical |
| 2 | 고정된 타이밍 대기 | base-adapter.ts:145-173 | High |
| 3 | DOM 셀렉터 취약성 | all adapters | Medium |
| 4 | 테스트-프로덕션 갭 | debate-controller.test.ts | High |

---

## 2. 해결 방안

### Phase 1: Critical - 즉시 수정 (1일)

#### 2.1 sendMessage 에러 체크 추가

**파일**: `electron/browser/adapters/base-adapter.ts`

```typescript
// 변경 전 (Line 142)
await this.executeScript<boolean>(script, false);

// 변경 후
async sendMessage(): Promise<void> {
  const script = `...`;
  const success = await this.executeScript<boolean>(script, false);

  if (!success) {
    throw new Error(`Failed to send message for ${this.provider}`);
  }

  await this.sleep(500);
}
```

#### 2.2 extractResponse 빈 값 처리

**파일**: `electron/debate/debate-controller.ts`

```typescript
// 변경 전 (Line 186-190)
const response = await adapter.extractResponse();
const scores = this.parseElementScores(response);

// 변경 후
const response = await adapter.extractResponse();

if (!response || response.trim().length === 0) {
  console.error(`[Debate] Empty response from ${provider}`);
  this.eventEmitter.emit('debate:error', {
    sessionId: this.debateId,
    iteration,
    provider,
    error: 'Empty response received',
  });
  // 빈 응답은 재시도 없이 다음 provider로 넘어감
  continue;
}

const scores = this.parseElementScores(response);
```

#### 2.3 무한 루프 방지 (Circuit Breaker)

**파일**: `electron/debate/debate-controller.ts`

```typescript
// 상수 추가
const MAX_ITERATIONS = 100;
const MAX_CONSECUTIVE_EMPTY_RESPONSES = 3;

// 변경 전 (Line 93)
while (!this.cancelled) {

// 변경 후
let consecutiveEmptyResponses = 0;

while (!this.cancelled && iteration < MAX_ITERATIONS) {
  // ... iteration 로직 ...

  if (!response || response.trim().length === 0) {
    consecutiveEmptyResponses++;
    if (consecutiveEmptyResponses >= MAX_CONSECUTIVE_EMPTY_RESPONSES) {
      console.error(`[Debate] Too many empty responses, stopping`);
      break;
    }
  } else {
    consecutiveEmptyResponses = 0;
  }
}

if (iteration >= MAX_ITERATIONS) {
  console.error(`[Debate] Max iterations reached`);
  await this.repository.updateStatus(this.debateId!, 'max_iterations');
}
```

---

### Phase 2: High - 안정성 개선 (2-3일)

#### 2.4 적응형 대기 (waitForCondition)

**파일**: `electron/browser/adapters/base-adapter.ts`

```typescript
// 새 메서드 추가
protected async waitForCondition(
  checkFn: () => Promise<boolean>,
  options: {
    timeout: number;
    interval: number;
    description: string;
  }
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < options.timeout) {
    try {
      if (await checkFn()) {
        console.log(`[${this.provider}] Condition met: ${options.description}`);
        return true;
      }
    } catch (error) {
      console.warn(`[${this.provider}] Check failed:`, error);
    }
    await this.sleep(options.interval);
  }

  console.warn(`[${this.provider}] Timeout: ${options.description}`);
  return false;
}

// waitForResponse 개선
async waitForResponse(timeout: number = 120000): Promise<void> {
  console.log(`[${this.provider}] waitForResponse started, timeout: ${timeout}ms`);

  // Step 1: 타이핑 시작 대기 (최대 10초)
  const typingStarted = await this.waitForCondition(
    () => this.isWriting(),
    { timeout: 10000, interval: 300, description: 'typing to start' }
  );

  if (!typingStarted) {
    console.warn(`[${this.provider}] Typing never started, checking for response anyway`);
  }

  // Step 2: 타이핑 완료 대기
  const typingFinished = await this.waitForCondition(
    async () => !(await this.isWriting()),
    { timeout: timeout - 10000, interval: 500, description: 'typing to finish' }
  );

  if (!typingFinished) {
    throw new Error(`Response timeout for ${this.provider}`);
  }

  // Step 3: DOM 안정화 대기
  await this.sleep(1000);
  console.log(`[${this.provider}] Response complete`);
}
```

#### 2.5 ChatGPT ProseMirror 입력 강화

**파일**: `electron/browser/adapters/chatgpt-adapter.ts`

```typescript
async inputPrompt(prompt: string): Promise<void> {
  const escapedPrompt = JSON.stringify(prompt);
  console.log(`[chatgpt] inputPrompt called, length: ${prompt.length}`);

  const script = `
    (() => {
      try {
        const textarea = document.querySelector('#prompt-textarea');
        if (!textarea) {
          return { success: false, error: 'textarea not found' };
        }

        textarea.focus();

        // Method 1: ProseMirror (contenteditable)
        if (textarea.contentEditable === 'true' || textarea.getAttribute('contenteditable')) {
          textarea.innerHTML = '';
          const p = document.createElement('p');
          p.textContent = ${escapedPrompt};
          textarea.appendChild(p);

          // 여러 이벤트 발생으로 React 감지 보장
          ['input', 'change', 'keyup'].forEach(eventType => {
            textarea.dispatchEvent(new Event(eventType, { bubbles: true }));
          });

          return { success: true, method: 'contenteditable' };
        }

        // Method 2: Regular textarea
        if (textarea.tagName === 'TEXTAREA') {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, 'value'
          ).set;
          nativeInputValueSetter.call(textarea, ${escapedPrompt});
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          return { success: true, method: 'textarea' };
        }

        return { success: false, error: 'unknown input type' };
      } catch (e) {
        return { success: false, error: e.message };
      }
    })()
  `;

  const result = await this.executeScript<{success: boolean; error?: string; method?: string}>(
    script,
    { success: false, error: 'script failed' }
  );

  console.log(`[chatgpt] inputPrompt result:`, result);

  if (!result.success) {
    throw new Error(`ChatGPT inputPrompt failed: ${result.error}`);
  }

  // React 처리 시간 증가
  await this.sleep(1000);

  // 입력 검증
  const verifyScript = `
    (() => {
      const textarea = document.querySelector('#prompt-textarea');
      const content = textarea?.innerText || textarea?.value || '';
      return content.length > 0;
    })()
  `;

  const verified = await this.executeScript<boolean>(verifyScript, false);
  if (!verified) {
    throw new Error('ChatGPT inputPrompt verification failed: input is empty');
  }
}
```

---

### Phase 3: Medium - 유지보수성 (1주)

#### 2.6 에러 타입 표준화

**파일**: `shared/types.ts` (새로 추가)

```typescript
// 어댑터 결과 타입
export interface AdapterResult<T = void> {
  success: boolean;
  data?: T;
  error?: AdapterError;
}

export interface AdapterError {
  code: AdapterErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type AdapterErrorCode =
  | 'SELECTOR_NOT_FOUND'
  | 'INPUT_FAILED'
  | 'SEND_FAILED'
  | 'RESPONSE_TIMEOUT'
  | 'EXTRACT_FAILED'
  | 'NOT_LOGGED_IN'
  | 'UNKNOWN';

// 토론 상태 추가
export type DebateStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'cancelled'
  | 'max_iterations'
  | 'error';
```

#### 2.7 셀렉터 Fallback 시스템

**파일**: `electron/browser/adapters/base-adapter.ts`

```typescript
interface SelectorSet {
  primary: string;
  fallbacks: string[];
}

interface ProviderSelectors {
  inputTextarea: SelectorSet;
  sendButton: SelectorSet;
  responseContainer: SelectorSet;
  typingIndicator: SelectorSet;
  loginCheck: SelectorSet;
}

private readonly selectorSets: Record<LLMProvider, ProviderSelectors> = {
  chatgpt: {
    inputTextarea: {
      primary: '#prompt-textarea',
      fallbacks: ['[contenteditable="true"]', 'textarea[placeholder*="Message"]']
    },
    sendButton: {
      primary: '[data-testid="send-button"]',
      fallbacks: ['button[aria-label*="Send"]', 'form button:not([disabled])']
    },
    responseContainer: {
      primary: '[data-message-author-role="assistant"]',
      fallbacks: ['.markdown.prose', '.agent-turn .markdown']
    },
    typingIndicator: {
      primary: '.result-streaming',
      fallbacks: ['.agent-turn', '[data-message-author-role="assistant"]:empty']
    },
    loginCheck: {
      primary: '[data-testid="profile-button"]',
      fallbacks: ['button[aria-label*="Account"]', '#prompt-textarea']
    }
  },
  // claude, gemini도 동일 패턴...
};

protected async findElement(selectorSet: SelectorSet): Promise<string | null> {
  const allSelectors = [selectorSet.primary, ...selectorSet.fallbacks];

  for (const selector of allSelectors) {
    const exists = await this.executeScript<boolean>(
      `!!document.querySelector('${selector}')`,
      false
    );

    if (exists) {
      console.log(`[${this.provider}] Found element: ${selector}`);
      return selector;
    }
  }

  console.error(`[${this.provider}] No element found for:`, selectorSet);
  return null;
}
```

#### 2.8 테스트 실패 시나리오 추가

**파일**: `tests/unit/debate/debate-controller.test.ts`

```typescript
describe('error scenarios', () => {
  it('should handle empty response from extractResponse', async () => {
    // 빈 응답 시뮬레이션
    mockBrowserManager.getAdapter().extractResponse.mockResolvedValue('');

    // 3회 빈 응답 후 중단
    mockRepository.getIncompleteElements
      .mockResolvedValueOnce([element])
      .mockResolvedValueOnce([element])
      .mockResolvedValueOnce([element])
      .mockResolvedValueOnce([element])
      .mockResolvedValueOnce([element])
      .mockResolvedValueOnce([element])
      .mockResolvedValue([]);

    await controller.start(defaultConfig);

    // 에러 이벤트 발생 확인
    const errorCalls = mockEventEmitter.emit.mock.calls.filter(
      ([event]) => event === 'debate:error'
    );
    expect(errorCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('should stop after MAX_ITERATIONS', async () => {
    // 항상 incomplete 반환
    mockRepository.getIncompleteElements.mockResolvedValue([element]);

    await controller.start(defaultConfig);

    // max_iterations 상태로 업데이트 확인
    expect(mockRepository.updateStatus).toHaveBeenCalledWith(
      expect.any(String),
      'max_iterations'
    );
  });

  it('should throw when inputPrompt fails', async () => {
    mockBrowserManager.getAdapter().inputPrompt.mockRejectedValue(
      new Error('Input failed: textarea not found')
    );

    await expect(controller.start(defaultConfig)).rejects.toThrow('Input failed');
  });

  it('should throw when sendMessage fails', async () => {
    mockBrowserManager.getAdapter().sendMessage.mockRejectedValue(
      new Error('Send failed: button disabled')
    );

    await expect(controller.start(defaultConfig)).rejects.toThrow('Send failed');
  });
});
```

---

## 3. 구현 일정

| Phase | 작업 | 예상 소요 | 우선순위 |
|-------|------|-----------|----------|
| **1** | sendMessage 에러 체크 | 0.5일 | P0 |
| **1** | extractResponse 빈 값 처리 | 0.5일 | P0 |
| **1** | 무한 루프 방지 | 0.5일 | P0 |
| **2** | waitForCondition 구현 | 1일 | P1 |
| **2** | ChatGPT 입력 강화 | 1일 | P1 |
| **3** | 에러 타입 표준화 | 2일 | P2 |
| **3** | 셀렉터 Fallback | 2일 | P2 |
| **3** | 테스트 추가 | 2일 | P2 |

**총 예상**: 9.5일

---

## 4. 검증 체크리스트

### Phase 1 완료 조건
- [ ] `sendMessage` 실패 시 에러 throw
- [ ] `extractResponse` 빈 값 시 에러 이벤트 발생
- [ ] 100회 iteration 도달 시 자동 중단
- [ ] 3회 연속 빈 응답 시 자동 중단

### Phase 2 완료 조건
- [ ] `waitForCondition` 메서드 동작 확인
- [ ] ChatGPT 타이핑 시작 10초 내 감지
- [ ] ProseMirror 입력 후 검증 통과

### Phase 3 완료 조건
- [ ] `AdapterResult<T>` 타입 적용
- [ ] 모든 adapter에 fallback 셀렉터 적용
- [ ] 실패 시나리오 테스트 4개 이상 추가

---

## 5. 관련 이슈 생성

이 계획에 따라 다음 GitHub Issues를 생성:

1. **#N: [Critical] sendMessage 에러 핸들링 추가**
2. **#N: [Critical] extractResponse 빈 값 처리**
3. **#N: [Critical] 무한 루프 방지 (Circuit Breaker)**
4. **#N: [High] 적응형 대기 (waitForCondition)**
5. **#N: [High] ChatGPT ProseMirror 입력 강화**
6. **#N: [Medium] 에러 타입 표준화**
7. **#N: [Medium] 셀렉터 Fallback 시스템**
8. **#N: [Medium] 실패 시나리오 테스트 추가**

---

## 6. 참고 자료

- [Electron executeJavaScript API](https://www.electronjs.org/docs/latest/api/web-contents#contentsexecutejavascriptcode-usergesture)
- [ProseMirror Input Handling](https://prosemirror.net/docs/guide/#view.input)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
