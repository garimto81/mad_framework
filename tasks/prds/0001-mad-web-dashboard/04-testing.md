# 04. Testing Strategy

**PRD**: 0001-mad-web-dashboard
**Version**: 2.0 (Browser Automation)
**Last Updated**: 2025-12-18

---

## 1. Testing Overview

### 1.1 Test Pyramid

```
                    ┌─────────────────┐
                    │      E2E        │  ← 15%
                    │   (Playwright/  │
                    │   Spectron)     │
                    ├─────────────────┤
                    │                 │
                    │   Integration   │  ← 25%
                    │   (IPC/Adapter) │
                    ├─────────────────┤
                    │                 │
                    │                 │
                    │      Unit       │  ← 60%
                    │    (Vitest)     │
                    │                 │
                    └─────────────────┘
```

### 1.2 Test Coverage Targets

| Layer | Target | Minimum |
|-------|--------|---------|
| Unit Tests | 80% | 70% |
| Integration | 70% | 60% |
| E2E | Critical paths | 100% critical |

### 1.3 Testing Challenges

| Challenge | Approach |
|-----------|----------|
| BrowserView 테스트 | Mock WebContents API |
| LLM 사이트 변경 | Selector 버전 관리 |
| 로그인 필요 | 테스트 전용 환경 또는 Mock |
| 응답 대기 | 타임아웃 조정 가능한 Mock |

---

## 2. Unit Testing

### 2.1 Test Structure

```
desktop/
├── electron/
│   ├── browser/
│   │   ├── adapters/
│   │   │   ├── chatgpt-adapter.ts
│   │   │   └── __tests__/
│   │   │       └── chatgpt-adapter.test.ts
│   │   └── __tests__/
│   │       └── browser-view-manager.test.ts
│   ├── debate/
│   │   ├── debate-controller.ts
│   │   ├── element-tracker.ts
│   │   ├── cycle-detector.ts
│   │   └── __tests__/
│   │       ├── debate-controller.test.ts
│   │       ├── element-tracker.test.ts
│   │       ├── cycle-detector.test.ts
│   │       └── context-builder.test.ts
│   └── storage/
│       └── __tests__/
│           └── debate-repository.test.ts
│
└── renderer/
    ├── components/
    │   ├── debate/
    │   │   └── __tests__/
    │   │       ├── DebateForm.test.tsx
    │   │       ├── ElementScorePanel.test.tsx
    │   │       └── VersionHistory.test.tsx
    │   └── browser/
    │       └── __tests__/
    │           └── LLMStatusPanel.test.tsx
    └── stores/
        └── __tests__/
            ├── debate-store.test.ts
            └── llm-store.test.ts
```

### 2.2 Main Process Unit Tests

#### Adapter Tests

```typescript
// desktop/electron/browser/adapters/__tests__/chatgpt-adapter.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatGPTAdapter } from '../chatgpt-adapter';

describe('ChatGPTAdapter', () => {
  let adapter: ChatGPTAdapter;
  let mockWebContents: any;

  beforeEach(() => {
    adapter = new ChatGPTAdapter();
    mockWebContents = {
      executeJavaScript: vi.fn()
    };
  });

  describe('isLoggedIn', () => {
    it('returns true when profile button exists', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue(true);

      const result = await adapter.isLoggedIn(mockWebContents);

      expect(result).toBe(true);
      expect(mockWebContents.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('profile-button')
      );
    });

    it('returns false when profile button not found', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue(false);

      const result = await adapter.isLoggedIn(mockWebContents);

      expect(result).toBe(false);
    });
  });

  describe('inputPrompt', () => {
    it('inputs prompt to textarea', async () => {
      const prompt = 'Test prompt';
      mockWebContents.executeJavaScript.mockResolvedValue(undefined);

      await adapter.inputPrompt(mockWebContents, prompt);

      expect(mockWebContents.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining(JSON.stringify(prompt))
      );
    });

    it('escapes special characters in prompt', async () => {
      const prompt = 'Prompt with "quotes" and \\backslashes';
      mockWebContents.executeJavaScript.mockResolvedValue(undefined);

      await adapter.inputPrompt(mockWebContents, prompt);

      // Should not throw
      expect(mockWebContents.executeJavaScript).toHaveBeenCalled();
    });
  });

  describe('extractResponse', () => {
    it('returns last message content', async () => {
      const expectedResponse = 'This is the response';
      mockWebContents.executeJavaScript.mockResolvedValue(expectedResponse);

      const result = await adapter.extractResponse(mockWebContents);

      expect(result).toBe(expectedResponse);
    });

    it('returns empty string when no messages', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue('');

      const result = await adapter.extractResponse(mockWebContents);

      expect(result).toBe('');
    });
  });
});
```

#### Debate Controller Tests (요소 기반 무한 루프)

```typescript
// desktop/electron/debate/__tests__/debate-controller.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DebateController } from '../debate-controller';

describe('DebateController', () => {
  let controller: DebateController;
  let mockBrowserManager: any;
  let mockRepository: any;
  let mockOnProgress: any;
  let mockOnResponse: any;
  let mockOnElementScore: any;
  let mockOnElementComplete: any;
  let mockOnComplete: any;

  beforeEach(() => {
    mockBrowserManager = {
      inputPrompt: vi.fn().mockResolvedValue(undefined),
      waitForResponse: vi.fn().mockResolvedValue(
        '{"elements":[{"name":"보안","score":92,"critique":"Good"}]}'
      )
    };

    mockRepository = {
      create: vi.fn().mockResolvedValue('debate-123'),
      createElements: vi.fn().mockResolvedValue(undefined),
      getFullDebate: vi.fn().mockResolvedValue({
        id: 'debate-123',
        iterations: [],
        elements: [{ id: 'el-1', name: '보안', status: 'pending', currentScore: 0 }]
      }),
      getIncompleteElements: vi.fn()
        .mockResolvedValueOnce([{ id: 'el-1', name: '보안' }])
        .mockResolvedValueOnce([]),  // 두 번째 호출에서 빈 배열 (완료)
      updateElementScore: vi.fn().mockResolvedValue(undefined),
      markElementComplete: vi.fn().mockResolvedValue(undefined),
      getLast3Versions: vi.fn().mockResolvedValue([]),
      updateStatus: vi.fn().mockResolvedValue(undefined)
    };

    mockOnProgress = vi.fn();
    mockOnResponse = vi.fn();
    mockOnElementScore = vi.fn();
    mockOnElementComplete = vi.fn();
    mockOnComplete = vi.fn();

    controller = new DebateController(
      mockBrowserManager,
      mockRepository,
      mockOnProgress,
      mockOnResponse,
      mockOnElementScore,
      mockOnElementComplete,
      mockOnComplete
    );
  });

  it('creates debate session with elements on start', async () => {
    const config = {
      topic: 'Test topic',
      preset: 'code_review',
      completionThreshold: 90,
      participants: ['chatgpt', 'claude'],
      judgeProvider: 'gemini'
    };

    await controller.start(config);

    expect(mockRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'Test topic',
        preset: 'code_review',
        completionThreshold: 90,
        judgeProvider: 'gemini'
      })
    );
    expect(mockRepository.createElements).toHaveBeenCalled();
  });

  it('runs infinite loop until all elements complete', async () => {
    const config = {
      topic: 'Test topic',
      preset: 'general',
      completionThreshold: 90,
      participants: ['chatgpt', 'claude'],
      judgeProvider: 'gemini'
    };

    await controller.start(config);

    // Should have called getIncompleteElements to check completion
    expect(mockRepository.getIncompleteElements).toHaveBeenCalled();
    // Should complete when all elements done
    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('marks element complete when score >= threshold', async () => {
    const config = {
      topic: 'Test topic',
      preset: 'general',
      completionThreshold: 90,
      participants: ['chatgpt'],
      judgeProvider: 'gemini'
    };

    await controller.start(config);

    // Element with score 92 should be marked complete
    expect(mockRepository.markElementComplete).toHaveBeenCalledWith(
      expect.any(String),
      'threshold'
    );
    expect(mockOnElementComplete).toHaveBeenCalledWith(
      expect.any(String),
      'threshold'
    );
  });

  it('emits element score updates', async () => {
    const config = {
      topic: 'Test topic',
      preset: 'general',
      completionThreshold: 90,
      participants: ['chatgpt'],
      judgeProvider: 'gemini'
    };

    await controller.start(config);

    expect(mockOnElementScore).toHaveBeenCalledWith(
      expect.objectContaining({
        score: 92,
        iteration: expect.any(Number)
      })
    );
  });

  it('can be cancelled mid-execution', async () => {
    // Make getIncompleteElements always return elements (never completes)
    mockRepository.getIncompleteElements.mockResolvedValue([{ id: 'el-1' }]);

    mockBrowserManager.inputPrompt.mockImplementation(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    const config = {
      topic: 'Test topic',
      preset: 'general',
      completionThreshold: 90,
      participants: ['chatgpt'],
      judgeProvider: 'gemini'
    };

    const promise = controller.start(config);

    // Cancel after short delay
    setTimeout(() => controller.cancel(), 100);

    await promise;

    // Should not run forever
    expect(mockBrowserManager.inputPrompt.mock.calls.length).toBeLessThan(10);
  });
});
```

#### Cycle Detector Tests

```typescript
// desktop/electron/debate/__tests__/cycle-detector.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CycleDetector } from '../cycle-detector';

describe('CycleDetector', () => {
  let detector: CycleDetector;
  let mockBrowserManager: any;

  beforeEach(() => {
    mockBrowserManager = {
      inputPrompt: vi.fn().mockResolvedValue(undefined),
      waitForResponse: vi.fn()
    };

    detector = new CycleDetector(mockBrowserManager);
  });

  it('detects cycle when last 3 versions are similar', async () => {
    mockBrowserManager.waitForResponse.mockResolvedValue(
      '{"isCycle": true, "reason": "Versions are cycling between same changes"}'
    );

    const versions = [
      { iteration: 1, content: 'Version A', score: 85 },
      { iteration: 2, content: 'Version B', score: 87 },
      { iteration: 3, content: 'Version A', score: 85 }  // 순환!
    ];

    const result = await detector.detectCycle('gemini', versions);

    expect(result).toBe(true);
  });

  it('returns false when versions are progressing', async () => {
    mockBrowserManager.waitForResponse.mockResolvedValue(
      '{"isCycle": false, "reason": "Versions show progress"}'
    );

    const versions = [
      { iteration: 1, content: 'Version A', score: 75 },
      { iteration: 2, content: 'Version B', score: 82 },
      { iteration: 3, content: 'Version C', score: 88 }  // 진행 중
    ];

    const result = await detector.detectCycle('gemini', versions);

    expect(result).toBe(false);
  });

  it('sends correct prompt to Judge model', async () => {
    mockBrowserManager.waitForResponse.mockResolvedValue('{"isCycle": false}');

    const versions = [
      { iteration: 1, content: 'V1' },
      { iteration: 2, content: 'V2' },
      { iteration: 3, content: 'V3' }
    ];

    await detector.detectCycle('gemini', versions);

    expect(mockBrowserManager.inputPrompt).toHaveBeenCalledWith(
      'gemini',
      expect.stringContaining('순환')
    );
  });
});
```

### 2.3 Renderer Unit Tests

#### Component Tests

```typescript
// desktop/renderer/components/debate/__tests__/DebateForm.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DebateForm } from '../DebateForm';

// Mock IPC
vi.mock('../../../lib/ipc-client', () => ({
  electronAPI: {
    llm: {
      getStatus: vi.fn().mockResolvedValue({ status: 'connected' })
    }
  }
}));

describe('DebateForm', () => {
  it('renders topic input field', () => {
    render(<DebateForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/topic/i)).toBeInTheDocument();
  });

  it('shows LLM selection checkboxes', () => {
    render(<DebateForm onSubmit={vi.fn()} />);

    expect(screen.getByLabelText(/chatgpt/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/claude/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/gemini/i)).toBeInTheDocument();
  });

  it('validates at least 2 LLMs selected', async () => {
    render(<DebateForm onSubmit={vi.fn()} />);

    // Only select one LLM
    fireEvent.click(screen.getByLabelText(/chatgpt/i));

    fireEvent.change(screen.getByLabelText(/topic/i), {
      target: { value: 'Test topic' }
    });

    fireEvent.click(screen.getByRole('button', { name: /start/i }));

    await waitFor(() => {
      expect(screen.getByText(/at least 2 llms required/i)).toBeInTheDocument();
    });
  });

  it('calls onSubmit with form data', async () => {
    const mockSubmit = vi.fn();
    render(<DebateForm onSubmit={mockSubmit} />);

    // Fill form
    fireEvent.change(screen.getByLabelText(/topic/i), {
      target: { value: 'Test topic' }
    });

    fireEvent.click(screen.getByLabelText(/chatgpt/i));
    fireEvent.click(screen.getByLabelText(/claude/i));

    fireEvent.click(screen.getByRole('button', { name: /start/i }));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'Test topic',
          participants: expect.arrayContaining(['chatgpt', 'claude'])
        })
      );
    });
  });
});
```

#### Store Tests (요소 기반)

```typescript
// desktop/renderer/stores/__tests__/debate-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useDebateStore } from '../debate-store';

describe('debateStore', () => {
  beforeEach(() => {
    // Reset store state
    useDebateStore.setState({
      session: null,
      status: 'idle',
      elements: [],
      iterations: [],
      currentIteration: 0,
      currentSpeaker: null,
      completionThreshold: 90
    });
  });

  it('starts with idle status', () => {
    const { status } = useDebateStore.getState();
    expect(status).toBe('idle');
  });

  it('updates progress correctly', () => {
    const { onProgress } = useDebateStore.getState();

    onProgress({
      iteration: 5,
      provider: 'chatgpt',
      status: 'inputting',
      incompleteCount: 3
    });

    const state = useDebateStore.getState();
    expect(state.currentIteration).toBe(5);
    expect(state.currentSpeaker).toBe('chatgpt');
  });

  it('updates element score correctly', () => {
    useDebateStore.setState({
      elements: [{ id: 'el-1', name: '보안', status: 'pending', currentScore: 0 }]
    });

    const { onElementScore } = useDebateStore.getState();

    onElementScore({
      elementId: 'el-1',
      elementName: '보안',
      score: 85,
      critique: 'Good progress',
      iteration: 3
    });

    const { elements } = useDebateStore.getState();
    expect(elements[0].currentScore).toBe(85);
  });

  it('marks element complete on threshold', () => {
    useDebateStore.setState({
      elements: [{ id: 'el-1', name: '보안', status: 'pending', currentScore: 89 }]
    });

    const { onElementComplete } = useDebateStore.getState();

    onElementComplete('el-1', 'threshold');

    const { elements } = useDebateStore.getState();
    expect(elements[0].status).toBe('completed');
    expect(elements[0].completionReason).toBe('threshold');
  });

  it('marks element complete on cycle detection', () => {
    useDebateStore.setState({
      elements: [{ id: 'el-1', name: '보안', status: 'in_progress', currentScore: 87 }]
    });

    const { onElementComplete } = useDebateStore.getState();

    onElementComplete('el-1', 'cycle');

    const { elements } = useDebateStore.getState();
    expect(elements[0].status).toBe('completed');
    expect(elements[0].completionReason).toBe('cycle');
  });

  it('returns incomplete elements correctly', () => {
    useDebateStore.setState({
      elements: [
        { id: 'el-1', name: '보안', status: 'completed', currentScore: 92 },
        { id: 'el-2', name: '성능', status: 'pending', currentScore: 75 },
        { id: 'el-3', name: '가독성', status: 'in_progress', currentScore: 88 }
      ]
    });

    const { getIncompleteElements } = useDebateStore.getState();

    const incomplete = getIncompleteElements();
    expect(incomplete).toHaveLength(2);
    expect(incomplete.map(e => e.name)).toEqual(['성능', '가독성']);
  });

  it('resets state correctly', () => {
    const { onProgress, reset } = useDebateStore.getState();

    onProgress({ iteration: 5, provider: 'chatgpt', status: 'inputting' });
    reset();

    const state = useDebateStore.getState();
    expect(state.status).toBe('idle');
    expect(state.elements).toEqual([]);
    expect(state.currentIteration).toBe(0);
  });
});
```

---

## 3. Integration Testing

### 3.1 IPC Integration Tests

```typescript
// desktop/__tests__/integration/ipc.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ipcMain, ipcRenderer } from 'electron';
import { IPCHandler } from '../../electron/core/ipc-handler';

describe('IPC Integration', () => {
  let ipcHandler: IPCHandler;
  let mockDatabase: any;

  beforeAll(() => {
    mockDatabase = createMockDatabase();
    ipcHandler = new IPCHandler(mockDatabase);
    ipcHandler.registerHandlers();
  });

  afterAll(() => {
    ipcHandler.cleanup();
  });

  it('handles settings:get request', async () => {
    const result = await ipcRenderer.invoke('settings:get');

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it('handles debate:start request', async () => {
    const config = {
      topic: 'Test',
      preset: 'general',
      maxRounds: 1,
      participants: ['chatgpt', 'claude']
    };

    const result = await ipcRenderer.invoke('debate:start', config);

    expect(result.success).toBe(true);
    expect(result.data.sessionId).toBeDefined();
  });

  it('returns error for invalid config', async () => {
    const invalidConfig = {
      topic: '',  // Invalid: empty topic
      participants: ['chatgpt']  // Invalid: only one participant
    };

    const result = await ipcRenderer.invoke('debate:start', invalidConfig);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

### 3.2 Adapter Integration Tests

```typescript
// desktop/__tests__/integration/adapters.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { BrowserViewManager } from '../../electron/browser/browser-view-manager';

describe('Adapter Integration', () => {
  let manager: BrowserViewManager;
  let mockMainWindow: any;

  beforeEach(() => {
    mockMainWindow = createMockBrowserWindow();
    manager = new BrowserViewManager(mockMainWindow);
  });

  describe('ChatGPT flow', () => {
    it('creates view with correct partition', () => {
      const view = manager.createView('chatgpt');

      expect(view.webContents.session.partition).toBe('persist:chatgpt');
    });

    it('loads correct URL', () => {
      const view = manager.createView('chatgpt');

      expect(view.webContents.getURL()).toBe('https://chat.openai.com');
    });
  });

  describe('Session isolation', () => {
    it('maintains separate sessions for each provider', () => {
      const chatgptView = manager.createView('chatgpt');
      const claudeView = manager.createView('claude');

      expect(chatgptView.webContents.session)
        .not.toBe(claudeView.webContents.session);
    });
  });
});
```

### 3.3 Database Integration Tests

```typescript
// desktop/__tests__/integration/database.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../../electron/storage/database';
import { DebateRepository } from '../../electron/storage/debate-repository';
import fs from 'fs';
import path from 'path';

describe('Database Integration', () => {
  let database: Database;
  let repository: DebateRepository;
  const testDbPath = path.join(__dirname, 'test.db');

  beforeEach(async () => {
    database = new Database(testDbPath);
    await database.initialize();
    repository = new DebateRepository(database);
  });

  afterEach(async () => {
    await database.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('creates and retrieves debate', async () => {
    const debateId = await repository.create({
      topic: 'Test topic',
      context: 'Test context',
      preset: 'general',
      maxRounds: 3,
      participants: ['chatgpt', 'claude']
    });

    const debate = await repository.getFullDebate(debateId);

    expect(debate).not.toBeNull();
    expect(debate!.topic).toBe('Test topic');
  });

  it('stores round responses', async () => {
    const debateId = await repository.create({
      topic: 'Test',
      preset: 'general',
      maxRounds: 1,
      participants: ['chatgpt']
    });

    await repository.addRoundResponse(debateId, 1, {
      provider: 'chatgpt',
      content: 'Response content',
      inputPrompt: 'Input prompt',
      timestamp: new Date().toISOString()
    });

    const debate = await repository.getFullDebate(debateId);
    expect(debate!.rounds[0].responses).toHaveLength(1);
  });
});
```

---

## 4. E2E Testing

### 4.1 Spectron/Playwright Setup

```typescript
// desktop/__tests__/e2e/setup.ts
import { Application } from 'spectron';
import path from 'path';

export async function createApp(): Promise<Application> {
  const app = new Application({
    path: require('electron'),
    args: [path.join(__dirname, '../../dist/main.js')],
    env: {
      NODE_ENV: 'test',
      TEST_MODE: 'true'
    }
  });

  await app.start();
  await app.client.waitUntilWindowLoaded();

  return app;
}

export async function cleanup(app: Application) {
  if (app && app.isRunning()) {
    await app.stop();
  }
}
```

### 4.2 E2E Test Cases

```typescript
// desktop/__tests__/e2e/app.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Application } from 'spectron';
import { createApp, cleanup } from './setup';

describe('MAD Desktop App E2E', () => {
  let app: Application;

  beforeAll(async () => {
    app = await createApp();
  }, 30000);

  afterAll(async () => {
    await cleanup(app);
  });

  describe('Application Launch', () => {
    it('opens a window', async () => {
      const count = await app.client.getWindowCount();
      expect(count).toBe(1);
    });

    it('has correct title', async () => {
      const title = await app.browserWindow.getTitle();
      expect(title).toContain('MAD');
    });
  });

  describe('LLM Status Panel', () => {
    it('shows all 3 LLM status', async () => {
      await app.client.waitForExist('[data-testid="llm-status-chatgpt"]');

      const chatgpt = await app.client.$('[data-testid="llm-status-chatgpt"]');
      const claude = await app.client.$('[data-testid="llm-status-claude"]');
      const gemini = await app.client.$('[data-testid="llm-status-gemini"]');

      expect(await chatgpt.isExisting()).toBe(true);
      expect(await claude.isExisting()).toBe(true);
      expect(await gemini.isExisting()).toBe(true);
    });

    it('shows disconnected status initially', async () => {
      const status = await app.client.$('[data-testid="llm-status-chatgpt"] .status');
      const text = await status.getText();

      expect(text).toContain('Disconnected');
    });
  });

  describe('Debate Form', () => {
    it('shows form when New Debate clicked', async () => {
      await app.client.click('[data-testid="new-debate-btn"]');
      await app.client.waitForExist('[data-testid="debate-form"]');

      const form = await app.client.$('[data-testid="debate-form"]');
      expect(await form.isExisting()).toBe(true);
    });

    it('disables start button when not all fields filled', async () => {
      const startBtn = await app.client.$('[data-testid="start-debate-btn"]');
      const isDisabled = await startBtn.getAttribute('disabled');

      expect(isDisabled).toBe('true');
    });
  });
});
```

### 4.3 Mock LLM Site Tests

```typescript
// desktop/__tests__/e2e/mock-llm.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Application } from 'spectron';
import { createApp, cleanup } from './setup';
import { startMockLLMServer, stopMockLLMServer } from './mock-llm-server';

describe('Mock LLM Integration', () => {
  let app: Application;

  beforeAll(async () => {
    // Start mock LLM servers
    await startMockLLMServer('chatgpt', 3001);
    await startMockLLMServer('claude', 3002);

    app = await createApp({
      env: {
        MOCK_LLM_URLS: JSON.stringify({
          chatgpt: 'http://localhost:3001',
          claude: 'http://localhost:3002'
        })
      }
    });
  }, 60000);

  afterAll(async () => {
    await cleanup(app);
    await stopMockLLMServer('chatgpt');
    await stopMockLLMServer('claude');
  });

  it('completes full debate flow with mocks', async () => {
    // Fill debate form
    await app.client.setValue('[data-testid="topic-input"]', 'Test topic');
    await app.client.click('[data-testid="llm-checkbox-chatgpt"]');
    await app.client.click('[data-testid="llm-checkbox-claude"]');

    // Start debate
    await app.client.click('[data-testid="start-debate-btn"]');

    // Wait for completion
    await app.client.waitForExist('[data-testid="debate-complete"]', 30000);

    // Verify results
    const matrix = await app.client.$('[data-testid="three-way-matrix"]');
    expect(await matrix.isExisting()).toBe(true);

    const chatgptResponse = await app.client.$('[data-testid="response-chatgpt"]');
    expect(await chatgptResponse.getText()).toContain('Mock response');
  });
});
```

---

## 5. Test Commands

### 5.1 package.json Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run --dir desktop/electron desktop/renderer",
    "test:integration": "vitest run --dir desktop/__tests__/integration",
    "test:e2e": "vitest run --dir desktop/__tests__/e2e",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest watch"
  }
}
```

### 5.2 Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./desktop/__tests__/setup.ts'],
    include: [
      'desktop/**/*.test.{ts,tsx}',
      'desktop/**/__tests__/**/*.{ts,tsx}'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules',
        'desktop/__tests__'
      ]
    }
  }
});
```

---

## 6. CI/CD Integration

### 6.1 GitHub Actions

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node: [20]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit

      - name: Run integration tests
        run: npm run test:integration

      - name: Build app
        run: npm run build

      - name: Run E2E tests
        run: npm run test:e2e
        if: matrix.os == 'ubuntu-latest'

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        if: matrix.os == 'ubuntu-latest'
```

---

## 7. Test Data Management

### 7.1 Fixtures (요소 기반)

```typescript
// desktop/__tests__/fixtures/debates.ts
export const mockDebate = {
  id: 'debate-123',
  topic: 'Test topic',
  context: 'Test context',
  preset: 'code_review',
  completionThreshold: 90,
  participants: ['chatgpt', 'claude', 'gemini'],
  judgeProvider: 'gemini',
  status: 'completed',
  currentIteration: 15,
  elements: [
    {
      id: 'el-1',
      name: '보안',
      status: 'completed',
      currentScore: 92,
      completionReason: 'threshold',
      versionHistory: [
        { iteration: 13, content: 'v13', score: 88 },
        { iteration: 14, content: 'v14', score: 90 },
        { iteration: 15, content: 'v15', score: 92 }
      ]
    },
    {
      id: 'el-2',
      name: '성능',
      status: 'completed',
      currentScore: 87,
      completionReason: 'cycle',  // 순환 감지로 완료
      versionHistory: [
        { iteration: 10, content: 'v10', score: 85 },
        { iteration: 11, content: 'v11', score: 87 },
        { iteration: 12, content: 'v10', score: 85 }  // 순환!
      ]
    },
    {
      id: 'el-3',
      name: '가독성',
      status: 'completed',
      currentScore: 95,
      completionReason: 'threshold'
    }
  ],
  iterations: [
    {
      iterationNumber: 1,
      responses: [
        { provider: 'chatgpt', content: 'Initial output' }
      ]
    },
    {
      iterationNumber: 2,
      responses: [
        { provider: 'claude', content: 'Critique and improvement' }
      ]
    }
  ]
};

export const mockSettings = {
  automation: {
    inputDelay: 50,
    waitTimeout: 120000,
    retryAttempts: 3
  },
  defaults: {
    completionThreshold: 90,
    judgeProvider: 'gemini',
    participants: ['chatgpt', 'claude']
  },
  ui: {
    theme: 'dark',
    showBrowserPreview: true
  }
};
```

### 7.2 Mock Factories (요소 기반)

```typescript
// desktop/__tests__/factories/index.ts
import { Factory } from 'fishery';

export const debateFactory = Factory.define<DebateSession>(({ sequence }) => ({
  id: `debate-${sequence}`,
  topic: `Test topic ${sequence}`,
  context: null,
  preset: 'general',
  completionThreshold: 90,
  participants: ['chatgpt', 'claude'],
  judgeProvider: 'gemini',
  status: 'pending',
  currentIteration: 0,
  elements: [],
  iterations: [],
  createdAt: new Date().toISOString()
}));

export const elementFactory = Factory.define<DebateElement>(({ sequence }) => ({
  id: `el-${sequence}`,
  name: `Element ${sequence}`,
  status: 'pending',
  currentScore: 0,
  versionHistory: [],
  completionReason: null
}));

export const elementVersionFactory = Factory.define<ElementVersion>(({ sequence }) => ({
  iteration: sequence,
  content: `Version content ${sequence}`,
  score: 70 + sequence * 5,
  provider: 'chatgpt',
  timestamp: new Date().toISOString()
}));
```

---

## References

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Spectron (Electron Testing)](https://github.com/electron-userland/spectron)
- [Playwright for Electron](https://playwright.dev/docs/api/class-electron)
