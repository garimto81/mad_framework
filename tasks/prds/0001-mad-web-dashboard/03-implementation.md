# 03. Implementation Plan

**PRD**: 0001-mad-web-dashboard
**Version**: 2.0 (Browser Automation)
**Last Updated**: 2025-12-18

---

## 1. Implementation Phases

### Phase Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Implementation Timeline                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Phase 1         Phase 2         Phase 3         Phase 4                   │
│  Foundation      Browser Auto    Core Features   Polish                     │
│  ───────────     ───────────     ───────────     ───────────               │
│                                                                             │
│  ┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐            │
│  │ Electron  │   │ LLM Site  │   │ Debate    │   │ UI/UX     │            │
│  │ Setup     │──►│ Adapters  │──►│ Engine    │──►│ Polish    │            │
│  │ IPC/React │   │ Session   │   │ History   │   │ Packaging │            │
│  └───────────┘   └───────────┘   └───────────┘   └───────────┘            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Phase 1: Foundation

### 2.1 Sprint Goals
- Electron 프로젝트 구조 설정
- Main/Renderer 프로세스 통신
- React + Zustand 기본 구조
- SQLite 저장소 설정

### 2.2 Tasks

#### Electron Setup

| Task ID | Description | Dependencies |
|---------|-------------|--------------|
| EL-001 | Electron + Vite 프로젝트 생성 | - |
| EL-002 | Main process 엔트리 포인트 | EL-001 |
| EL-003 | Preload script 설정 | EL-002 |
| EL-004 | Context Bridge API 정의 | EL-003 |
| EL-005 | IPC 채널 핸들러 구현 | EL-004 |
| EL-006 | 앱 생명주기 관리 | EL-002 |

#### React/Renderer Setup

| Task ID | Description | Dependencies |
|---------|-------------|--------------|
| RE-001 | React + TypeScript 설정 | EL-001 |
| RE-002 | Tailwind CSS 설정 | RE-001 |
| RE-003 | Zustand 스토어 구조 | RE-001 |
| RE-004 | IPC 클라이언트 래퍼 | EL-004 |
| RE-005 | 기본 레이아웃 컴포넌트 | RE-002 |

#### Storage Setup

| Task ID | Description | Dependencies |
|---------|-------------|--------------|
| ST-001 | better-sqlite3 연동 | EL-002 |
| ST-002 | Database 스키마 생성 | ST-001 |
| ST-003 | Repository 클래스 구현 | ST-002 |
| ST-004 | 마이그레이션 시스템 | ST-002 |

### 2.3 Deliverables

```
desktop/
├── electron/
│   ├── main.ts                    # Main process entry
│   ├── preload.ts                 # Context bridge
│   ├── core/
│   │   ├── window-manager.ts
│   │   ├── ipc-handler.ts
│   │   └── app-lifecycle.ts
│   └── storage/
│       ├── database.ts
│       └── migrations/
│
├── renderer/
│   ├── index.tsx
│   ├── App.tsx
│   ├── components/
│   │   └── layout/
│   │       ├── Header.tsx
│   │       ├── Sidebar.tsx
│   │       └── Footer.tsx
│   ├── stores/
│   │   └── settings-store.ts
│   └── lib/
│       └── ipc-client.ts
│
├── shared/
│   └── ipc-channels.ts
│
├── package.json
├── electron-builder.json
└── vite.config.ts
```

### 2.4 Acceptance Criteria
- [ ] Electron 앱이 정상 실행됨
- [ ] Renderer에서 Main으로 IPC 호출 가능
- [ ] SQLite 데이터베이스 생성 및 쿼리 동작
- [ ] 기본 레이아웃 UI 표시

### 2.5 Key Implementation

#### Main Process Entry

```typescript
// desktop/electron/main.ts
import { app, BrowserWindow } from 'electron';
import { WindowManager } from './core/window-manager';
import { IPCHandler } from './core/ipc-handler';
import { Database } from './storage/database';

class Application {
  private windowManager: WindowManager;
  private ipcHandler: IPCHandler;
  private database: Database;

  async initialize() {
    await app.whenReady();

    // Initialize database
    this.database = new Database();
    await this.database.initialize();

    // Create main window
    this.windowManager = new WindowManager();
    this.windowManager.createMainWindow();

    // Setup IPC handlers
    this.ipcHandler = new IPCHandler(this.database);
    this.ipcHandler.registerHandlers();
  }
}

const application = new Application();
application.initialize();
```

#### Context Bridge

```typescript
// desktop/electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels';

const electronAPI = {
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
    update: (settings: any) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_UPDATE, settings)
  },
  onReady: (callback: () => void) => {
    ipcRenderer.on('app:ready', callback);
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
```

---

## 3. Phase 2: Browser Automation

### 3.1 Sprint Goals
- BrowserView 관리 시스템
- LLM 사이트 어댑터 구현
- 세션 파티션 관리
- 로그인 상태 감지

### 3.2 Tasks

#### BrowserView System

| Task ID | Description | Dependencies |
|---------|-------------|--------------|
| BV-001 | BrowserViewManager 클래스 | EL-002 |
| BV-002 | SessionManager 클래스 | BV-001 |
| BV-003 | 뷰 생성/삭제/전환 | BV-001 |
| BV-004 | 뷰 bounds 관리 | BV-003 |
| BV-005 | 세션 파티션 격리 | BV-002 |

#### LLM Adapters

| Task ID | Description | Dependencies |
|---------|-------------|--------------|
| AD-001 | BaseAdapter 인터페이스 | BV-001 |
| AD-002 | ChatGPT Adapter | AD-001 |
| AD-003 | Claude Adapter | AD-001 |
| AD-004 | Gemini Adapter | AD-001 |
| AD-005 | 로그인 상태 감지 | AD-002, AD-003, AD-004 |
| AD-006 | 응답 대기 로직 | AD-002, AD-003, AD-004 |

#### LLM Status UI

| Task ID | Description | Dependencies |
|---------|-------------|--------------|
| LS-001 | LLM Status Store | AD-005 |
| LS-002 | LLMStatusPanel 컴포넌트 | LS-001 |
| LS-003 | Login 버튼/상태 표시 | LS-002 |
| LS-004 | BrowserPreview 컴포넌트 | BV-003 |

### 3.3 Deliverables

```
desktop/electron/
├── browser/
│   ├── browser-view-manager.ts
│   ├── session-manager.ts
│   └── adapters/
│       ├── base-adapter.ts
│       ├── chatgpt-adapter.ts
│       ├── claude-adapter.ts
│       └── gemini-adapter.ts

desktop/renderer/
├── components/
│   └── browser/
│       ├── LLMStatusPanel.tsx
│       └── BrowserPreview.tsx
└── stores/
    └── llm-store.ts
```

### 3.4 Acceptance Criteria
- [ ] 3개 LLM 사이트 BrowserView 로딩
- [ ] 각 사이트 세션 독립 유지
- [ ] 로그인 상태 실시간 감지
- [ ] 사용자가 직접 로그인 가능

### 3.5 Key Implementation

#### BrowserView Manager

```typescript
// desktop/electron/browser/browser-view-manager.ts
import { BrowserView, BrowserWindow, Rectangle } from 'electron';
import { SessionManager } from './session-manager';
import { BaseAdapter, ChatGPTAdapter, ClaudeAdapter, GeminiAdapter } from './adapters';

export class BrowserViewManager {
  private views: Map<LLMProvider, BrowserView> = new Map();
  private adapters: Map<LLMProvider, BaseAdapter> = new Map();
  private sessionManager: SessionManager;
  private mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    this.sessionManager = new SessionManager();
    this.initializeAdapters();
  }

  private initializeAdapters() {
    this.adapters.set('chatgpt', new ChatGPTAdapter());
    this.adapters.set('claude', new ClaudeAdapter());
    this.adapters.set('gemini', new GeminiAdapter());
  }

  createView(provider: LLMProvider): BrowserView {
    const session = this.sessionManager.getSession(provider);
    const adapter = this.adapters.get(provider)!;

    const view = new BrowserView({
      webPreferences: {
        session,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    });

    view.webContents.loadURL(adapter.baseUrl);

    // Monitor login status
    view.webContents.on('did-finish-load', async () => {
      const isLoggedIn = await adapter.isLoggedIn(view.webContents);
      this.emitStatusChange(provider, isLoggedIn ? 'connected' : 'disconnected');
    });

    this.views.set(provider, view);
    return view;
  }

  async inputPrompt(provider: LLMProvider, prompt: string): Promise<void> {
    const view = this.views.get(provider);
    const adapter = this.adapters.get(provider);
    if (!view || !adapter) throw new Error(`Unknown provider: ${provider}`);

    await adapter.inputPrompt(view.webContents, prompt);
    await adapter.sendMessage(view.webContents);
  }

  async waitForResponse(provider: LLMProvider, timeout: number): Promise<string> {
    const view = this.views.get(provider);
    const adapter = this.adapters.get(provider);
    if (!view || !adapter) throw new Error(`Unknown provider: ${provider}`);

    await adapter.waitForResponse(view.webContents, timeout);
    return adapter.extractResponse(view.webContents);
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

#### ChatGPT Adapter

```typescript
// desktop/electron/browser/adapters/chatgpt-adapter.ts
import { WebContents } from 'electron';
import { BaseAdapter } from './base-adapter';

export class ChatGPTAdapter extends BaseAdapter {
  readonly provider = 'chatgpt' as const;
  readonly baseUrl = 'https://chat.openai.com';

  readonly selectors = {
    inputTextarea: '#prompt-textarea',
    sendButton: '[data-testid="send-button"]',
    responseContainer: '[data-message-author-role="assistant"]',
    typingIndicator: '.result-streaming',
    loginCheck: '[data-testid="profile-button"]'
  };

  async isLoggedIn(webContents: WebContents): Promise<boolean> {
    return webContents.executeJavaScript(`
      !!document.querySelector('${this.selectors.loginCheck}')
    `);
  }

  async inputPrompt(webContents: WebContents, prompt: string): Promise<void> {
    await webContents.executeJavaScript(`
      (async () => {
        const textarea = document.querySelector('${this.selectors.inputTextarea}');
        if (!textarea) throw new Error('Textarea not found');

        // Clear and input
        textarea.value = '';
        textarea.value = ${JSON.stringify(prompt)};
        textarea.dispatchEvent(new Event('input', { bubbles: true }));

        // Wait for button to be enabled
        await new Promise(r => setTimeout(r, 500));
      })()
    `);
  }

  async sendMessage(webContents: WebContents): Promise<void> {
    await webContents.executeJavaScript(`
      const button = document.querySelector('${this.selectors.sendButton}');
      if (button && !button.disabled) {
        button.click();
      }
    `);
  }

  async waitForResponse(webContents: WebContents, timeout: number): Promise<void> {
    await webContents.executeJavaScript(`
      new Promise((resolve, reject) => {
        const startTime = Date.now();
        let hasStarted = false;

        const check = () => {
          const indicator = document.querySelector('${this.selectors.typingIndicator}');

          if (indicator) {
            hasStarted = true;
          }

          if (hasStarted && !indicator) {
            resolve();
            return;
          }

          if (Date.now() - startTime > ${timeout}) {
            reject(new Error('Response timeout'));
            return;
          }

          setTimeout(check, 500);
        };

        setTimeout(check, 1000);
      })
    `);
  }

  async extractResponse(webContents: WebContents): Promise<string> {
    return webContents.executeJavaScript(`
      const messages = document.querySelectorAll('${this.selectors.responseContainer}');
      const lastMessage = messages[messages.length - 1];
      return lastMessage?.innerText || '';
    `);
  }
}
```

---

## 4. Phase 3: Core Features

### 4.1 Sprint Goals
- 토론 실행 엔진 구현
- Three-Way Matrix 결과 표시
- 이력 관리 시스템
- 설정 관리

### 4.2 Tasks

#### Debate Engine (요소 기반 무한 루프)

| Task ID | Description | Dependencies |
|---------|-------------|--------------|
| DB-001 | DebateController 클래스 | BV-001, AD-001 |
| DB-002 | ElementTracker 구현 | DB-001 |
| DB-003 | CycleDetector (Judge) 구현 | DB-002 |
| DB-004 | ContextBuilder 구현 | DB-002 |
| DB-005 | 무한 루프 + 완성 조건 로직 | DB-002, DB-003 |
| DB-006 | StatusPoller (5초 폴링) | BV-001 |
| DB-007 | ProgressLogger (로그 출력) | DB-006 |
| DB-008 | 취소/일시정지 기능 | DB-001 |

#### Debate UI (요소별 점수 표시)

| Task ID | Description | Dependencies |
|---------|-------------|--------------|
| DU-001 | DebateForm 컴포넌트 | RE-005 |
| DU-002 | DebateProgress 컴포넌트 | DU-001 |
| DU-003 | ElementScorePanel 컴포넌트 | DU-002 |
| DU-004 | IterationCard 컴포넌트 | DU-003 |
| DU-005 | VersionHistory 컴포넌트 | DU-004 |
| DU-006 | 결과 복사/Export | DU-003 |

#### History & Settings

| Task ID | Description | Dependencies |
|---------|-------------|--------------|
| HS-001 | HistoryList 컴포넌트 | ST-003 |
| HS-002 | HistoryDetail 컴포넌트 | HS-001 |
| HS-003 | SettingsPanel 컴포넌트 | RE-005 |
| HS-004 | AutomationSettings | HS-003 |
| HS-005 | 세션 초기화 기능 | HS-003 |

### 4.3 Deliverables

```
desktop/electron/
├── debate/
│   ├── debate-controller.ts
│   ├── element-tracker.ts
│   ├── cycle-detector.ts
│   ├── status-poller.ts        # 5초 간격 상태 체크
│   ├── progress-logger.ts      # 로그 기반 진행 표시
│   └── context-builder.ts

desktop/renderer/
├── components/
│   ├── debate/
│   │   ├── DebateForm.tsx
│   │   ├── DebateProgress.tsx
│   │   ├── ElementScorePanel.tsx
│   │   ├── IterationCard.tsx
│   │   └── VersionHistory.tsx
│   ├── history/
│   │   ├── HistoryList.tsx
│   │   └── HistoryDetail.tsx
│   └── settings/
│       ├── SettingsPanel.tsx
│       └── AutomationSettings.tsx
└── stores/
    ├── debate-store.ts
    └── history-store.ts
```

### 4.4 Acceptance Criteria
- [ ] 요소별 점수 기반 무한 반복 토론 실행
- [ ] 90점 이상 요소 자동 완성 처리
- [ ] Judge 모델의 순환 감지 동작
- [ ] 모든 요소 완성 시 자동 종료
- [ ] 실시간 요소별 점수 표시
- [ ] 이력 저장 및 조회

### 4.5 Key Implementation

#### Debate Controller (요소 기반 무한 루프)

```typescript
// desktop/electron/debate/debate-controller.ts
import { BrowserViewManager } from '../browser/browser-view-manager';
import { DebateRepository } from '../storage/debate-repository';
import { ElementTracker } from './element-tracker';
import { CycleDetector } from './cycle-detector';
import { ContextBuilder } from './context-builder';

export class DebateController {
  private currentDebate: DebateSession | null = null;
  private elementTracker: ElementTracker;
  private cycleDetector: CycleDetector;
  private cancelled = false;

  constructor(
    private browserManager: BrowserViewManager,
    private repository: DebateRepository,
    private onProgress: (data: DebateProgress) => void,
    private onResponse: (data: DebateResponse) => void,
    private onElementScore: (data: ElementScoreUpdate) => void,
    private onElementComplete: (elementId: string, reason: 'threshold' | 'cycle') => void,
    private onComplete: (result: DebateResult) => void
  ) {
    this.elementTracker = new ElementTracker(repository);
    this.cycleDetector = new CycleDetector(browserManager);
  }

  async start(config: DebateConfig): Promise<void> {
    this.cancelled = false;

    // Create debate session
    const debateId = await this.repository.create({
      topic: config.topic,
      context: config.context,
      preset: config.preset,
      completionThreshold: config.completionThreshold || 90,
      participants: config.participants,
      judgeProvider: config.judgeProvider
    });

    // Initialize elements based on preset
    const elementNames = this.getElementNames(config.preset);
    await this.repository.createElements(debateId, elementNames);

    this.currentDebate = await this.repository.getFullDebate(debateId);

    try {
      let iteration = 0;
      let participantIndex = 0;

      // INFINITE LOOP until all elements complete
      while (!this.cancelled) {
        iteration++;
        const provider = config.participants[participantIndex % config.participants.length];

        await this.executeIteration(iteration, provider, config);

        // Check if all elements are complete
        const incompleteElements = await this.repository.getIncompleteElements(debateId);
        if (incompleteElements.length === 0) {
          break; // All elements complete → End debate
        }

        // Rotate to next participant
        participantIndex++;
      }

      // Complete
      await this.repository.updateStatus(debateId, 'completed');
      const result = await this.buildResult();
      this.onComplete(result);

    } catch (error) {
      await this.repository.updateStatus(debateId, 'error');
      throw error;
    }
  }

  private async executeIteration(
    iterationNumber: number,
    provider: LLMProvider,
    config: DebateConfig
  ): Promise<void> {
    const contextBuilder = new ContextBuilder(config.preset);

    // Get incomplete elements only
    const incompleteElements = await this.repository.getIncompleteElements(
      this.currentDebate!.id
    );

    this.onProgress({
      iteration: iterationNumber,
      provider,
      status: 'inputting',
      incompleteCount: incompleteElements.length
    });

    // Build critique prompt for latest version + incomplete elements
    const prompt = contextBuilder.buildCritiquePrompt(
      config.topic,
      config.context,
      this.currentDebate!.latestVersion,
      incompleteElements
    );

    // Input to LLM
    await this.browserManager.inputPrompt(provider, prompt);

    this.onProgress({ iteration: iterationNumber, provider, status: 'waiting' });

    // Wait for and extract response
    const response = await this.browserManager.waitForResponse(
      provider,
      config.automation?.waitTimeout || 120000
    );

    // Parse element scores from response
    const elementScores = this.parseElementScores(response);

    // Update each element's score
    for (const { elementId, score, critique, content } of elementScores) {
      await this.repository.updateElementScore(
        elementId, score, iterationNumber, content, provider
      );

      this.onElementScore({ elementId, score, critique, iteration: iterationNumber });

      // Check if element reached threshold (90+)
      if (score >= config.completionThreshold) {
        await this.repository.markElementComplete(elementId, 'threshold');
        this.onElementComplete(elementId, 'threshold');
      }
    }

    // Judge: Check for cycle detection (every 3 iterations)
    if (iterationNumber >= 3 && iterationNumber % 3 === 0) {
      await this.checkCycleDetection(config, incompleteElements);
    }

    // Refresh current debate data
    this.currentDebate = await this.repository.getFullDebate(this.currentDebate!.id);
  }

  private async checkCycleDetection(
    config: DebateConfig,
    incompleteElements: DebateElement[]
  ): Promise<void> {
    for (const element of incompleteElements) {
      const last3Versions = await this.repository.getLast3Versions(element.id);

      if (last3Versions.length >= 3) {
        const isCycle = await this.cycleDetector.detectCycle(
          config.judgeProvider,
          last3Versions
        );

        if (isCycle) {
          // Cycle detected → Mark as complete (no more improvement possible)
          await this.repository.markElementComplete(element.id, 'cycle');
          this.onElementComplete(element.id, 'cycle');
        }
      }
    }
  }

  private getElementNames(preset: string): string[] {
    switch (preset) {
      case 'code_review':
        return ['보안', '성능', '가독성', '유지보수성', '테스트 커버리지'];
      case 'qa_accuracy':
        return ['정확성', '완전성', '명확성', '근거'];
      case 'decision':
        return ['실현가능성', '비용효율성', '리스크', '영향력'];
      default:
        return ['품질', '완성도', '적합성'];
    }
  }

  cancel(): void {
    this.cancelled = true;
  }
}
```

#### Element Score Panel Component

```typescript
// desktop/renderer/components/debate/ElementScorePanel.tsx
import React from 'react';
import { useDebateStore } from '../../stores/debate-store';

export function ElementScorePanel() {
  const { elements, currentIteration, completionThreshold } = useDebateStore();

  const completedCount = elements.filter(e => e.status === 'completed').length;

  return (
    <div className="space-y-4">
      {/* Progress Header */}
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-500">Iteration #{currentIteration}</span>
        <span className="text-sm font-medium">
          {completedCount}/{elements.length} 요소 완성
        </span>
      </div>

      {/* Element Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {elements.map(element => (
          <ElementCard
            key={element.id}
            element={element}
            threshold={completionThreshold}
          />
        ))}
      </div>
    </div>
  );
}

interface ElementCardProps {
  element: DebateElement;
  threshold: number;
}

function ElementCard({ element, threshold }: ElementCardProps) {
  const isComplete = element.status === 'completed';
  const isCycle = element.completionReason === 'cycle';

  return (
    <div className={`
      border rounded-lg p-4
      ${isComplete ? 'bg-green-50 border-green-200' : 'bg-white'}
    `}>
      <div className="flex justify-between items-center mb-2">
        <span className="font-medium">{element.name}</span>
        {isComplete && (
          <span className={`text-xs px-2 py-1 rounded ${
            isCycle ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
          }`}>
            {isCycle ? '순환 완료' : '기준 달성'}
          </span>
        )}
      </div>

      {/* Score Bar */}
      <div className="relative h-2 bg-gray-200 rounded overflow-hidden">
        <div
          className={`h-full transition-all ${
            element.currentScore >= threshold ? 'bg-green-500' : 'bg-blue-500'
          }`}
          style={{ width: `${element.currentScore}%` }}
        />
        {/* Threshold Line */}
        <div
          className="absolute top-0 h-full w-0.5 bg-red-500"
          style={{ left: `${threshold}%` }}
        />
      </div>

      <div className="flex justify-between mt-1 text-sm">
        <span>{element.currentScore}/100</span>
        <span className="text-gray-400">기준: {threshold}</span>
      </div>

      {/* Version History (for cycle detection) */}
      {element.versionHistory && element.versionHistory.length > 0 && (
        <div className="mt-3 pt-3 border-t">
          <span className="text-xs text-gray-500">최근 버전:</span>
          <div className="flex gap-1 mt-1">
            {element.versionHistory.slice(-3).map((v, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 bg-gray-100 rounded"
                title={`v${v.iteration}: ${v.score}점`}
              >
                v{v.iteration}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 5. Phase 4: Polish

### 5.1 Sprint Goals
- UI/UX 개선
- 에러 핸들링 강화
- Electron 패키징
- 문서화

### 5.2 Tasks

#### UI/UX Polish

| Task ID | Description | Dependencies |
|---------|-------------|--------------|
| PL-001 | 다크 모드 구현 | RE-002 |
| PL-002 | 애니메이션 추가 | PL-001 |
| PL-003 | 로딩 상태 개선 | DU-002 |
| PL-004 | 온보딩 튜토리얼 | PL-003 |
| PL-005 | 키보드 단축키 | PL-001 |

#### Error Handling

| Task ID | Description | Dependencies |
|---------|-------------|--------------|
| EH-001 | 에러 타입 정의 | DB-001 |
| EH-002 | Retry 전략 구현 | EH-001 |
| EH-003 | 에러 UI 컴포넌트 | EH-001 |
| EH-004 | 로깅 시스템 | EH-001 |

#### Packaging

| Task ID | Description | Dependencies |
|---------|-------------|--------------|
| PK-001 | electron-builder 설정 | EL-001 |
| PK-002 | Windows 빌드 | PK-001 |
| PK-003 | macOS 빌드 | PK-001 |
| PK-004 | Linux 빌드 | PK-001 |
| PK-005 | 자동 업데이트 설정 | PK-001 |

### 5.3 Acceptance Criteria
- [ ] 다크/라이트 테마 전환
- [ ] 에러 발생 시 사용자 친화적 메시지
- [ ] Windows/macOS/Linux 설치 파일 생성
- [ ] README 및 사용 가이드 완성

---

## 6. Technical Guidelines

### 6.1 Coding Standards

```typescript
// 파일 네이밍
// - 컴포넌트: PascalCase.tsx (e.g., DebateForm.tsx)
// - 유틸리티: kebab-case.ts (e.g., ipc-client.ts)
// - 타입: types.ts 또는 파일명.types.ts

// 컴포넌트 구조
export function ComponentName({ prop1, prop2 }: Props) {
  // 1. Hooks
  const store = useStore();

  // 2. Derived state
  const computed = useMemo(() => ..., []);

  // 3. Effects
  useEffect(() => { ... }, []);

  // 4. Handlers
  const handleClick = () => { ... };

  // 5. Render
  return <div>...</div>;
}
```

### 6.2 Error Handling Pattern

```typescript
// Main Process
try {
  await adapter.inputPrompt(webContents, prompt);
} catch (error) {
  if (error instanceof SiteChangedError) {
    // 사이트 변경 - 어댑터 업데이트 필요
    this.notifyAdapterUpdateRequired(provider);
  } else if (error instanceof LoginRequiredError) {
    // 로그인 필요
    this.showLoginView(provider);
  } else {
    // 재시도 가능한 에러
    await this.retryWithBackoff(operation, maxRetries);
  }
}
```

### 6.3 IPC Pattern

```typescript
// Main Process Handler
ipcMain.handle('debate:start', async (event, config) => {
  try {
    const result = await debateController.start(config);
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message
      }
    };
  }
});

// Renderer Usage
const result = await window.electronAPI.debate.start(config);
if (!result.success) {
  showError(result.error.message);
}
```

---

## 7. Dependencies

### 7.1 Main Dependencies

```json
{
  "dependencies": {
    "electron": "^28.0.0",
    "better-sqlite3": "^9.2.0"
  },
  "devDependencies": {
    "electron-builder": "^24.9.0",
    "vite": "^5.0.0",
    "react": "^18.2.0",
    "typescript": "^5.3.0",
    "tailwindcss": "^3.4.0",
    "zustand": "^4.4.0"
  }
}
```

### 7.2 Version Requirements
- Node.js: 20.x LTS
- Electron: 28+
- TypeScript: 5.3+

---

## References

- [Electron Documentation](https://www.electronjs.org/docs)
- [Electron Builder](https://www.electron.build/)
- [Vite Electron Plugin](https://electron-vite.org/)
- [Zustand](https://docs.pmnd.rs/zustand/)
