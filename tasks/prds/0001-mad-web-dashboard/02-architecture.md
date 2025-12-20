# 02. Architecture Design

**PRD**: 0001-mad-web-dashboard
**Version**: 2.0 (Browser Automation)
**Last Updated**: 2025-12-18

---

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     MAD Desktop Application (Electron)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        Renderer Process (React)                        │ │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │ │
│  │  │ Debate Form  │ │ Progress View│ │ Result Matrix│ │   History    │  │ │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  │ │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                   │ │
│  │  │   Settings   │ │ LLM Status   │ │ Browser Prev │                   │ │
│  │  └──────────────┘ └──────────────┘ └──────────────┘                   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │ IPC                                     │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        Main Process (Node.js)                          │ │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │ │
│  │  │  Debate      │ │  Session     │ │  Automation  │ │   Storage    │  │ │
│  │  │  Controller  │ │  Manager     │ │  Engine      │ │   Service    │  │ │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        BrowserView Layer                               │ │
│  │  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐       │ │
│  │  │   ChatGPT View   │ │    Claude View   │ │   Gemini View    │       │ │
│  │  │  (partition:     │ │  (partition:     │ │  (partition:     │       │ │
│  │  │   chatgpt)       │ │   claude)        │ │   gemini)        │       │ │
│  │  └────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘       │ │
│  │           │                    │                    │                  │ │
│  │  ┌────────▼─────────┐ ┌────────▼─────────┐ ┌────────▼─────────┐       │ │
│  │  │ ChatGPT Adapter  │ │  Claude Adapter  │ │  Gemini Adapter  │       │ │
│  │  └──────────────────┘ └──────────────────┘ └──────────────────┘       │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │ HTTPS
                ┌────────────────────┼────────────────────┐
                ▼                    ▼                    ▼
        ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
        │ chat.openai  │    │  claude.ai   │    │gemini.google │
        │    .com      │    │              │    │    .com      │
        └──────────────┘    └──────────────┘    └──────────────┘
```

### 1.2 Process Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Electron App                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Main Process (1)                                                           │
│  ├── Window Management                                                       │
│  ├── IPC Handler                                                             │
│  ├── Debate Controller                                                       │
│  ├── BrowserView Manager                                                     │
│  │   ├── ChatGPT BrowserView (Session: persist:chatgpt)                     │
│  │   ├── Claude BrowserView (Session: persist:claude)                       │
│  │   └── Gemini BrowserView (Session: persist:gemini)                       │
│  └── Storage Service (SQLite)                                               │
│                                                                              │
│  Renderer Process (1)                                                       │
│  ├── React Application                                                       │
│  ├── State Management (Zustand)                                             │
│  └── UI Components                                                           │
│                                                                              │
│  BrowserView Processes (3)                                                  │
│  ├── ChatGPT WebContents                                                    │
│  ├── Claude WebContents                                                     │
│  └── Gemini WebContents                                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Architecture

### 2.1 Main Process Components

```
desktop/electron/
├── main.ts                    # Entry point
├── preload.ts                 # Context bridge
│
├── core/
│   ├── window-manager.ts      # BrowserWindow 관리
│   ├── ipc-handler.ts         # IPC 핸들러 등록
│   └── app-lifecycle.ts       # 앱 생명주기
│
├── debate/
│   ├── debate-controller.ts   # 토론 오케스트레이션
│   ├── element-tracker.ts     # 요소별 점수/버전 관리
│   ├── cycle-detector.ts      # 순환 오류 감지 (Judge)
│   └── context-builder.ts     # 프롬프트 컨텍스트 구성
│
├── browser/
│   ├── browser-view-manager.ts  # BrowserView 생성/관리
│   ├── session-manager.ts       # 세션 파티션 관리
│   └── adapters/
│       ├── base-adapter.ts      # 어댑터 인터페이스
│       ├── chatgpt-adapter.ts   # ChatGPT 자동화
│       ├── claude-adapter.ts    # Claude 자동화
│       └── gemini-adapter.ts    # Gemini 자동화
│
└── storage/
    ├── database.ts            # SQLite 연결
    ├── debate-repository.ts   # 토론 저장소
    └── settings-repository.ts # 설정 저장소
```

### 2.2 Renderer Process Components

```
desktop/renderer/
├── index.tsx                  # React entry
├── App.tsx                    # Root component
│
├── components/
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   └── Footer.tsx
│   │
│   ├── debate/
│   │   ├── DebateForm.tsx       # 토론 설정 폼
│   │   ├── DebateProgress.tsx   # 진행 상태
│   │   └── ThreeWayMatrix.tsx   # 결과 비교 뷰
│   │
│   ├── browser/
│   │   ├── LLMStatusPanel.tsx   # 로그인 상태
│   │   └── BrowserPreview.tsx   # 브라우저 미리보기
│   │
│   ├── history/
│   │   ├── HistoryList.tsx
│   │   └── HistoryDetail.tsx
│   │
│   └── settings/
│       ├── SettingsPanel.tsx
│       └── AutomationSettings.tsx
│
├── stores/
│   ├── debate-store.ts        # 토론 상태
│   ├── llm-store.ts           # LLM 연결 상태
│   └── settings-store.ts      # 설정
│
├── hooks/
│   ├── useDebate.ts
│   ├── useLLMStatus.ts
│   └── useIPC.ts
│
└── lib/
    ├── ipc-client.ts          # IPC 래퍼
    └── utils.ts
```

---

## 3. Data Flow

### 3.1 Debate Execution Flow (무한 반복 + 요소별 점수)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   Debate Execution Flow (Element-Based)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [Renderer]                [Main Process]              [BrowserView]        │
│                                                                              │
│  User clicks               debate:start                                      │
│  "Start Debate" ──────────────────────────▶ Debate Controller               │
│       │                                           │                          │
│       │                                           ▼                          │
│       │                                    ┌──────────────┐                  │
│       │                                    │ Initial      │                  │
│       │                                    │ Output (A)   │                  │
│       │                                    └──────────────┘                  │
│       │                                           │                          │
│       │                                           ▼                          │
│       │                                    ┌──────────────┐                  │
│       │                                    │ INFINITE     │◀───────────────┐│
│       │                                    │ LOOP         │                ││
│       │                                    └──────────────┘                ││
│       │                                           │                        ││
│       │  debate:progress    ┌─────────────────────────────────────────┐   ││
│       │◀────────────────────│ 1. LLM B receives latest version        │   ││
│       │                     │ 2. Critique + Improvement per element    │   ││
│       │                     │ 3. Score each element (0-100)            │   ││
│       │  debate:element     │ 4. If score >= 90 → element COMPLETE    │   ││
│       │◀────────────────────│ 5. Store version (for cycle detection)  │   ││
│       │                     └─────────────────────────────────────────┘   ││
│       │                                           │                        ││
│       │                                           ▼                        ││
│       │                                    ┌──────────────┐                ││
│       │  debate:cycle       ────────────▶ │ Judge Model  │                ││
│       │◀────────────────────              │ (Compare 3   │                ││
│       │                                    │  versions)   │                ││
│       │                                    └──────────────┘                ││
│       │                                           │                        ││
│       │                          ┌────────────────┴────────────────┐      ││
│       │                          ▼                                 ▼      ││
│       │                   Cycle Detected?                  Element 90+?   ││
│       │                          │                                 │      ││
│       │                    YES   │   NO                      YES   │  NO  ││
│       │                     ▼    │                            ▼    │   │  ││
│       │              Mark Element│                     Mark Element│   │  ││
│       │              COMPLETE    │                     COMPLETE    │   │  ││
│       │                          │                                 │   │  ││
│       │                          └─────────────┬───────────────────┘   │  ││
│       │                                        │                       │  ││
│       │                                        ▼                       │  ││
│       │                              All Elements Complete?            │  ││
│       │                                        │                       │  ││
│       │                                   YES  │  NO                   │  ││
│       │  debate:complete                   ▼   │   └───────────────────┘──┘│
│       │◀───────────────────────────────────────┘                          │
│       ▼                                                                    │
│  Display Element Scores + Final Result                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Browser Automation Sequence (비평 + 요소별 점수)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                Browser Automation Sequence (Element Scoring)                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  For each iteration until all elements complete:                             │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ 1. Prepare Critique Prompt                                              ││
│  │    ┌──────────────────────────────────────────────────────────────────┐ ││
│  │    │ if (iteration === 1) {                                           │ ││
│  │    │   prompt = buildInitialPrompt(topic, context, preset);           │ ││
│  │    │ } else {                                                         │ ││
│  │    │   prompt = buildCritiquePrompt(latestVersion, incompleteElements);│ ││
│  │    │   // Only ask for critique on elements with score < 90           │ ││
│  │    │ }                                                                │ ││
│  │    └──────────────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                     │                                        │
│                                     ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ 2. Focus BrowserView & Input Prompt                                     ││
│  │    adapter.waitForInputReady()                                          ││
│  │    adapter.inputPrompt(prompt)                                          ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                     │                                        │
│                                     ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ 3. Wait & Extract Response                                              ││
│  │    adapter.waitForResponse() → adapter.extractResponse()                ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                     │                                        │
│                                     ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ 4. Parse Element Scores                                                 ││
│  │    ┌──────────────────────────────────────────────────────────────────┐ ││
│  │    │ for (element of response.elements) {                             │ ││
│  │    │   if (element.score >= 90) {                                     │ ││
│  │    │     markElementComplete(element, 'threshold');                   │ ││
│  │    │   }                                                              │ ││
│  │    │   storeVersion(element, iteration);  // 버전 히스토리 저장       │ ││
│  │    │ }                                                                │ ││
│  │    └──────────────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                     │                                        │
│                                     ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ 5. Judge: Cycle Detection (every N iterations)                          ││
│  │    ┌──────────────────────────────────────────────────────────────────┐ ││
│  │    │ for (element of incompleteElements) {                            │ ││
│  │    │   if (element.versionHistory.length >= 3) {                      │ ││
│  │    │     isCycle = judgeModel.detectCycle(last3Versions);             │ ││
│  │    │     if (isCycle) markElementComplete(element, 'cycle');          │ ││
│  │    │   }                                                              │ ││
│  │    │ }                                                                │ ││
│  │    └──────────────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                     │                                        │
│                                     ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ 6. Check Completion                                                     ││
│  │    if (allElementsComplete()) → END                                     ││
│  │    else → Continue to next LLM (rotate: A→B→C→A...)                     ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 상태 폴링 모니터링 (5초 간격)

실시간 스트리밍 대신 5초 간격 폴링으로 진행 상황 파악.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Status Polling Monitor (5초 간격)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  StatusPoller ──────► 5초마다 ──────► 각 LLM 브라우저 상태 체크             │
│       │                                     │                                │
│       │              ┌──────────────────────┼──────────────────────┐        │
│       │              ▼                      ▼                      ▼        │
│       │         ChatGPT                 Claude                  Gemini      │
│       │       isWriting()?            isWriting()?            isWriting()?  │
│       │       getTokens()?            getTokens()?            getTokens()?  │
│       │              │                      │                      │        │
│       │              └──────────────────────┼──────────────────────┘        │
│       │                                     ▼                                │
│       │                              로그 메시지 출력                         │
│       │                                     │                                │
│       ▼                                     ▼                                │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  [12:34:56] gpt...진행중...1,234                                    │    │
│  │  [12:35:01] gpt...진행중...2,456                                    │    │
│  │  [12:35:06] gpt...완료...3,789                                      │    │
│  │  [12:35:11] claude...진행중...512                                   │    │
│  │  [12:35:16] claude...진행중...1,024                                 │    │
│  │  [12:35:21] claude...완료...2,048                                   │    │
│  │  [12:35:26] 요소[보안] 점수: 85점                                    │    │
│  │  [12:35:31] gemini...진행중...768                                   │    │
│  │  [12:35:36] 요소[보안] 점수: 92점 ✓ 완성                            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Status Poller 구현

```typescript
// desktop/electron/debate/status-poller.ts

interface LLMStatus {
  provider: LLMProvider;
  isWriting: boolean;
  tokenCount: number;
  timestamp: string;
}

class StatusPoller {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL = 5000;  // 5초

  constructor(
    private browserManager: BrowserViewManager,
    private logger: ProgressLogger
  ) {}

  start(): void {
    this.intervalId = setInterval(async () => {
      await this.checkAllStatus();
    }, this.POLL_INTERVAL);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async checkAllStatus(): Promise<void> {
    const providers: LLMProvider[] = ['chatgpt', 'claude', 'gemini'];

    for (const provider of providers) {
      const status = await this.checkStatus(provider);
      this.logger.log(status);
    }
  }

  private async checkStatus(provider: LLMProvider): Promise<LLMStatus> {
    const adapter = this.browserManager.getAdapter(provider);
    const webContents = this.browserManager.getWebContents(provider);

    const isWriting = await adapter.isWriting(webContents);
    const tokenCount = await adapter.getTokenCount(webContents);

    return {
      provider,
      isWriting,
      tokenCount,
      timestamp: new Date().toISOString()
    };
  }
}
```

#### Progress Logger 구현

```typescript
// desktop/electron/debate/progress-logger.ts

class ProgressLogger {
  log(status: LLMStatus): void {
    const time = this.formatTime(status.timestamp);
    const state = status.isWriting ? '진행중' : '완료';
    const tokens = status.tokenCount.toLocaleString();

    // 로그 포맷: [시간] provider...상태...토큰수
    console.log(`[${time}] ${status.provider}...${state}...${tokens}`);
  }

  logElementScore(elementName: string, score: number, isComplete: boolean): void {
    const time = this.formatTime(new Date().toISOString());
    const completeMark = isComplete ? ' ✓ 완성' : '';

    console.log(`[${time}] 요소[${elementName}] 점수: ${score}점${completeMark}`);
  }

  logCycleDetected(elementName: string): void {
    const time = this.formatTime(new Date().toISOString());
    console.log(`[${time}] 요소[${elementName}] 순환 감지 → 완성 처리`);
  }

  logIteration(iteration: number, provider: LLMProvider): void {
    const time = this.formatTime(new Date().toISOString());
    console.log(`[${time}] === 반복 #${iteration} (${provider}) ===`);
  }

  private formatTime(isoString: string): string {
    return new Date(isoString).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
}
```

#### Adapter 확장 (상태 체크용)

```typescript
// desktop/electron/browser/adapters/base-adapter.ts (추가 메서드)

interface LLMAdapter {
  // 기존 메서드...

  // 상태 체크용 (5초 폴링)
  isWriting(webContents: WebContents): Promise<boolean>;
  getTokenCount(webContents: WebContents): Promise<number>;
}

// ChatGPT Adapter 예시
class ChatGPTAdapter implements LLMAdapter {
  // ...기존 코드...

  async isWriting(webContents: WebContents): Promise<boolean> {
    return webContents.executeJavaScript(`
      !!document.querySelector('.result-streaming')
    `);
  }

  async getTokenCount(webContents: WebContents): Promise<number> {
    return webContents.executeJavaScript(`
      const lastMsg = document.querySelectorAll('[data-message-author-role="assistant"]');
      const text = lastMsg[lastMsg.length - 1]?.innerText || '';
      return text.length;  // 대략적인 토큰 추정 (문자수)
    `);
  }
}
```

---

## 4. LLM Site Adapters

### 4.1 Adapter Interface

```typescript
// desktop/electron/browser/adapters/base-adapter.ts

interface LLMAdapter {
  // Site identification
  readonly provider: LLMProvider;
  readonly baseUrl: string;

  // Selectors (사이트별 다름)
  readonly selectors: {
    inputTextarea: string;
    sendButton: string;
    responseContainer: string;
    typingIndicator: string;
    loginCheck: string;
  };

  // Core methods
  isLoggedIn(): Promise<boolean>;
  waitForInputReady(): Promise<void>;
  inputPrompt(prompt: string): Promise<void>;
  sendMessage(): Promise<void>;
  waitForResponse(timeout: number): Promise<void>;
  extractResponse(): Promise<string>;

  // Utilities
  clearInput(): Promise<void>;
  scrollToBottom(): Promise<void>;
}
```

### 4.2 ChatGPT Adapter

```typescript
// desktop/electron/browser/adapters/chatgpt-adapter.ts

class ChatGPTAdapter implements LLMAdapter {
  readonly provider = 'chatgpt';
  readonly baseUrl = 'https://chat.openai.com';

  readonly selectors = {
    inputTextarea: '#prompt-textarea',
    sendButton: '[data-testid="send-button"]',
    responseContainer: '[data-message-author-role="assistant"]',
    typingIndicator: '.result-streaming',
    loginCheck: '[data-testid="profile-button"]'
  };

  async inputPrompt(prompt: string): Promise<void> {
    await this.webContents.executeJavaScript(`
      const textarea = document.querySelector('${this.selectors.inputTextarea}');
      textarea.value = ${JSON.stringify(prompt)};
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    `);
  }

  async waitForResponse(timeout: number): Promise<void> {
    // Poll until typing indicator disappears
    await this.webContents.executeJavaScript(`
      new Promise((resolve, reject) => {
        const startTime = Date.now();
        const check = () => {
          const indicator = document.querySelector('${this.selectors.typingIndicator}');
          if (!indicator) {
            resolve();
          } else if (Date.now() - startTime > ${timeout}) {
            reject(new Error('Response timeout'));
          } else {
            setTimeout(check, 500);
          }
        };
        setTimeout(check, 2000); // Initial wait
      });
    `);
  }

  async extractResponse(): Promise<string> {
    return await this.webContents.executeJavaScript(`
      const messages = document.querySelectorAll('${this.selectors.responseContainer}');
      const lastMessage = messages[messages.length - 1];
      return lastMessage?.innerText || '';
    `);
  }
}
```

### 4.3 Claude Adapter

```typescript
// desktop/electron/browser/adapters/claude-adapter.ts

class ClaudeAdapter implements LLMAdapter {
  readonly provider = 'claude';
  readonly baseUrl = 'https://claude.ai';

  readonly selectors = {
    inputTextarea: '[contenteditable="true"]',
    sendButton: '[aria-label="Send message"]',
    responseContainer: '[data-is-streaming="false"]',
    typingIndicator: '[data-is-streaming="true"]',
    loginCheck: '[data-testid="user-menu"]'
  };

  // Claude uses contenteditable div
  async inputPrompt(prompt: string): Promise<void> {
    await this.webContents.executeJavaScript(`
      const editor = document.querySelector('${this.selectors.inputTextarea}');
      editor.innerHTML = '';
      editor.innerText = ${JSON.stringify(prompt)};
      editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
    `);
  }
}
```

### 4.4 Gemini Adapter

```typescript
// desktop/electron/browser/adapters/gemini-adapter.ts

class GeminiAdapter implements LLMAdapter {
  readonly provider = 'gemini';
  readonly baseUrl = 'https://gemini.google.com';

  readonly selectors = {
    inputTextarea: '.ql-editor',
    sendButton: '.send-button',
    responseContainer: '.response-container',
    typingIndicator: '.loading-indicator',
    loginCheck: '[data-user-email]'
  };
}
```

---

## 5. Session Management

### 5.1 Session Partitions

```typescript
// desktop/electron/browser/session-manager.ts

const SESSION_PARTITIONS = {
  chatgpt: 'persist:chatgpt',
  claude: 'persist:claude',
  gemini: 'persist:gemini'
} as const;

class SessionManager {
  private sessions: Map<LLMProvider, Session> = new Map();

  getSession(provider: LLMProvider): Session {
    if (!this.sessions.has(provider)) {
      const partition = SESSION_PARTITIONS[provider];
      const ses = session.fromPartition(partition);
      this.sessions.set(provider, ses);
    }
    return this.sessions.get(provider)!;
  }

  async clearSession(provider: LLMProvider): Promise<void> {
    const ses = this.getSession(provider);
    await ses.clearStorageData();
    await ses.clearCache();
  }

  async clearAllSessions(): Promise<void> {
    await Promise.all(
      Object.keys(SESSION_PARTITIONS).map(p =>
        this.clearSession(p as LLMProvider)
      )
    );
  }
}
```

### 5.2 BrowserView Management

```typescript
// desktop/electron/browser/browser-view-manager.ts

class BrowserViewManager {
  private views: Map<LLMProvider, BrowserView> = new Map();
  private sessionManager: SessionManager;

  createView(provider: LLMProvider): BrowserView {
    const ses = this.sessionManager.getSession(provider);

    const view = new BrowserView({
      webPreferences: {
        session: ses,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    });

    // Load LLM site
    const adapter = this.getAdapter(provider);
    view.webContents.loadURL(adapter.baseUrl);

    this.views.set(provider, view);
    return view;
  }

  showView(provider: LLMProvider, bounds: Rectangle): void {
    const view = this.views.get(provider);
    if (view) {
      this.mainWindow.setBrowserView(view);
      view.setBounds(bounds);
    }
  }

  hideAllViews(): void {
    this.mainWindow.setBrowserView(null);
  }
}
```

---

## 6. IPC Architecture

### 6.1 Channel Definitions

```typescript
// shared/ipc-channels.ts

export const IPC_CHANNELS = {
  // LLM Control
  LLM_LOGIN: 'llm:login',
  LLM_LOGOUT: 'llm:logout',
  LLM_STATUS: 'llm:status',
  LLM_STATUS_CHANGED: 'llm:status-changed',

  // Debate Control
  DEBATE_START: 'debate:start',
  DEBATE_CANCEL: 'debate:cancel',
  DEBATE_PAUSE: 'debate:pause',
  DEBATE_RESUME: 'debate:resume',

  // Debate Events (Element-Based)
  DEBATE_PROGRESS: 'debate:progress',
  DEBATE_RESPONSE: 'debate:response',
  DEBATE_ELEMENT_SCORE: 'debate:element-score',    // 요소별 점수 업데이트
  DEBATE_ELEMENT_COMPLETE: 'debate:element-complete', // 요소 완성
  DEBATE_CYCLE_DETECTED: 'debate:cycle-detected',  // 순환 감지
  DEBATE_COMPLETE: 'debate:complete',
  DEBATE_ERROR: 'debate:error',

  // Storage
  HISTORY_LIST: 'history:list',
  HISTORY_GET: 'history:get',
  HISTORY_DELETE: 'history:delete',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',
  SETTINGS_RESET: 'settings:reset'
} as const;
```

### 6.2 Preload Script

```typescript
// desktop/electron/preload.ts

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // LLM Control
  llm: {
    login: (provider: LLMProvider) =>
      ipcRenderer.invoke(IPC_CHANNELS.LLM_LOGIN, provider),
    logout: (provider: LLMProvider) =>
      ipcRenderer.invoke(IPC_CHANNELS.LLM_LOGOUT, provider),
    getStatus: (provider: LLMProvider) =>
      ipcRenderer.invoke(IPC_CHANNELS.LLM_STATUS, provider),
    onStatusChanged: (callback: (status: LLMStatus) => void) =>
      ipcRenderer.on(IPC_CHANNELS.LLM_STATUS_CHANGED, (_, status) => callback(status))
  },

  // Debate
  debate: {
    start: (config: DebateConfig) =>
      ipcRenderer.invoke(IPC_CHANNELS.DEBATE_START, config),
    cancel: (sessionId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.DEBATE_CANCEL, sessionId),
    onProgress: (callback: (data: DebateProgress) => void) =>
      ipcRenderer.on(IPC_CHANNELS.DEBATE_PROGRESS, (_, data) => callback(data)),
    onResponse: (callback: (data: DebateResponse) => void) =>
      ipcRenderer.on(IPC_CHANNELS.DEBATE_RESPONSE, (_, data) => callback(data)),
    onComplete: (callback: (result: DebateResult) => void) =>
      ipcRenderer.on(IPC_CHANNELS.DEBATE_COMPLETE, (_, result) => callback(result))
  },

  // History
  history: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_LIST),
    get: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_GET, id),
    delete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_DELETE, id)
  },

  // Settings
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
    update: (settings: Partial<AppSettings>) =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_UPDATE, settings),
    reset: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_RESET)
  }
});
```

---

## 7. Storage Architecture

### 7.1 SQLite Schema (요소 기반)

```sql
-- debates table
CREATE TABLE debates (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  topic TEXT NOT NULL,
  context TEXT,
  preset TEXT NOT NULL,
  completion_threshold INTEGER NOT NULL DEFAULT 90,
  participants TEXT NOT NULL,    -- JSON array
  judge_provider TEXT NOT NULL,  -- Judge용 LLM
  current_iteration INTEGER DEFAULT 0
);

-- elements table (평가 요소)
CREATE TABLE elements (
  id TEXT PRIMARY KEY,
  debate_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending/in_progress/completed/cycle_detected
  current_score INTEGER DEFAULT 0,
  completed_at TEXT,
  completion_reason TEXT,  -- 'threshold' or 'cycle'
  FOREIGN KEY (debate_id) REFERENCES debates(id)
);

-- element_versions table (순환 감지용 버전 히스토리)
CREATE TABLE element_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  element_id TEXT NOT NULL,
  iteration INTEGER NOT NULL,
  content TEXT NOT NULL,
  score INTEGER NOT NULL,
  provider TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (element_id) REFERENCES elements(id)
);

-- iterations table
CREATE TABLE iterations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  debate_id TEXT NOT NULL,
  iteration_number INTEGER NOT NULL,
  FOREIGN KEY (debate_id) REFERENCES debates(id)
);

-- responses table
CREATE TABLE responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  iteration_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  content TEXT NOT NULL,
  input_prompt TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (iteration_id) REFERENCES iterations(id)
);

-- element_scores table (반복별 요소 점수)
CREATE TABLE element_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  response_id INTEGER NOT NULL,
  element_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  critique TEXT,
  FOREIGN KEY (response_id) REFERENCES responses(id),
  FOREIGN KEY (element_id) REFERENCES elements(id)
);

-- settings table
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- automation_logs table
CREATE TABLE automation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  debate_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  type TEXT NOT NULL,  -- input/wait/extract/score/cycle_check/error
  provider TEXT NOT NULL,
  details TEXT,
  FOREIGN KEY (debate_id) REFERENCES debates(id)
);
```

### 7.2 Repository Pattern (요소 기반)

```typescript
// desktop/electron/storage/debate-repository.ts

class DebateRepository {
  constructor(private db: Database) {}

  async create(debate: Omit<DebateSession, 'id'>): Promise<string> {
    const id = uuidv4();
    await this.db.run(`
      INSERT INTO debates (id, created_at, status, topic, context, preset,
                           completion_threshold, participants, judge_provider)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, new Date().toISOString(), 'pending', debate.topic, debate.context,
        debate.preset, debate.completionThreshold,
        JSON.stringify(debate.participants), debate.judgeProvider]);
    return id;
  }

  async createElements(debateId: string, elementNames: string[]): Promise<void> {
    for (const name of elementNames) {
      await this.db.run(`
        INSERT INTO elements (id, debate_id, name, status) VALUES (?, ?, ?, 'pending')
      `, [uuidv4(), debateId, name]);
    }
  }

  async updateElementScore(
    elementId: string,
    score: number,
    iteration: number,
    content: string,
    provider: string
  ): Promise<void> {
    // Update current score
    await this.db.run(`UPDATE elements SET current_score = ? WHERE id = ?`, [score, elementId]);

    // Store version for cycle detection
    await this.db.run(`
      INSERT INTO element_versions (element_id, iteration, content, score, provider, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [elementId, iteration, content, score, provider, new Date().toISOString()]);
  }

  async markElementComplete(elementId: string, reason: 'threshold' | 'cycle'): Promise<void> {
    await this.db.run(`
      UPDATE elements SET status = 'completed', completion_reason = ?, completed_at = ?
      WHERE id = ?
    `, [reason, new Date().toISOString(), elementId]);
  }

  async getLast3Versions(elementId: string): Promise<ElementVersion[]> {
    return await this.db.all(`
      SELECT * FROM element_versions
      WHERE element_id = ?
      ORDER BY iteration DESC LIMIT 3
    `, [elementId]);
  }

  async getIncompleteElements(debateId: string): Promise<DebateElement[]> {
    return await this.db.all(`
      SELECT * FROM elements WHERE debate_id = ? AND status != 'completed'
    `, [debateId]);
  }
}
```

---

## 8. Error Handling

### 8.1 Error Types

```typescript
// shared/errors.ts

export class MADError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly provider?: LLMProvider,
    public readonly recoverable: boolean = false
  ) {
    super(message);
    this.name = 'MADError';
  }
}

export class LoginRequiredError extends MADError {
  constructor(provider: LLMProvider) {
    super(`${provider} 로그인이 필요합니다`, 'LOGIN_REQUIRED', provider, true);
  }
}

export class ResponseTimeoutError extends MADError {
  constructor(provider: LLMProvider, timeout: number) {
    super(`${provider} 응답 시간 초과 (${timeout}ms)`, 'RESPONSE_TIMEOUT', provider, true);
  }
}

export class SiteChangedError extends MADError {
  constructor(provider: LLMProvider, selector: string) {
    super(`${provider} 사이트 구조가 변경되었습니다`, 'SITE_CHANGED', provider, false);
  }
}

export class AutomationError extends MADError {
  constructor(provider: LLMProvider, action: string, cause: string) {
    super(`${provider} ${action} 실패: ${cause}`, 'AUTOMATION_ERROR', provider, true);
  }
}
```

### 8.2 Retry Strategy

```typescript
// desktop/electron/debate/retry-strategy.ts

class RetryStrategy {
  constructor(
    private maxAttempts: number = 3,
    private baseDelay: number = 1000
  ) {}

  async execute<T>(
    operation: () => Promise<T>,
    context: { provider: LLMProvider; action: string }
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Non-recoverable errors
        if (error instanceof SiteChangedError ||
            error instanceof LoginRequiredError) {
          throw error;
        }

        if (attempt < this.maxAttempts) {
          const delay = this.baseDelay * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    throw new AutomationError(
      context.provider,
      context.action,
      lastError?.message || 'Unknown error'
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## 9. Security Considerations

### 9.1 Context Isolation

```typescript
// BrowserView는 완전히 격리됨
const view = new BrowserView({
  webPreferences: {
    nodeIntegration: false,      // Node.js 비활성화
    contextIsolation: true,      // 컨텍스트 격리
    sandbox: true,               // 샌드박스 모드
    webSecurity: true            // 웹 보안 활성화
  }
});
```

### 9.2 IPC Security

```typescript
// Main process에서 IPC 핸들러 등록
ipcMain.handle(IPC_CHANNELS.DEBATE_START, async (event, config) => {
  // Validate sender
  if (event.senderFrame.url !== expectedUrl) {
    throw new Error('Unauthorized IPC call');
  }

  // Validate config
  const validatedConfig = debateConfigSchema.parse(config);

  return await debateController.start(validatedConfig);
});
```

### 9.3 Data Privacy

- 모든 데이터는 로컬 SQLite에만 저장
- API 키 불필요 (사용자의 기존 구독 활용)
- 네트워크 요청은 LLM 사이트로만 발생
- 세션 쿠키는 Electron 파티션에 격리 저장

---

## 10. State Management

### 10.1 Zustand Stores (요소 기반)

```typescript
// desktop/renderer/stores/debate-store.ts

interface DebateState {
  // Current debate
  session: DebateSession | null;
  status: 'idle' | 'configuring' | 'running' | 'completed' | 'error';
  currentIteration: number;
  currentSpeaker: LLMProvider | null;

  // Element Tracking
  elements: DebateElement[];
  completionThreshold: number;  // 기본값 90

  // Results
  iterations: DebateIteration[];

  // Actions
  startDebate: (config: DebateConfig) => Promise<void>;
  cancelDebate: () => Promise<void>;
  onProgress: (data: DebateProgress) => void;
  onResponse: (data: DebateResponse) => void;
  onElementScore: (data: ElementScoreUpdate) => void;  // 요소 점수 업데이트
  onElementComplete: (elementId: string, reason: 'threshold' | 'cycle') => void;
  onCycleDetected: (elementId: string) => void;  // 순환 감지
  onComplete: (result: DebateResult) => void;
  getIncompleteElements: () => DebateElement[];
  reset: () => void;
}

interface ElementScoreUpdate {
  elementId: string;
  elementName: string;
  score: number;
  critique: string;
  iteration: number;
}

// desktop/renderer/stores/llm-store.ts

interface LLMState {
  sessions: {
    chatgpt: LLMSession;
    claude: LLMSession;
    gemini: LLMSession;
  };

  // Actions
  login: (provider: LLMProvider) => Promise<void>;
  logout: (provider: LLMProvider) => Promise<void>;
  updateStatus: (provider: LLMProvider, status: LLMStatus) => void;
  isAllLoggedIn: () => boolean;
}
```

---

## References

- [Electron Documentation](https://www.electronjs.org/docs)
- [Electron BrowserView](https://www.electronjs.org/docs/latest/api/browser-view)
- [Electron Session](https://www.electronjs.org/docs/latest/api/session)
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- [Zustand](https://docs.pmnd.rs/zustand/)
