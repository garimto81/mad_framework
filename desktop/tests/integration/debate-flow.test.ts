/**
 * Debate Flow Integration Tests
 *
 * TDD RED Phase: 브라우저 로그인 인증 후 토론 전체 플로우 테스트
 * - 로그인 상태 확인
 * - 토론 시작
 * - 요소별 점수 업데이트
 * - 순환 감지
 * - 토론 완료
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DebateController } from '../../electron/debate/debate-controller';
import { BrowserViewManager } from '../../electron/browser/browser-view-manager';
import { SessionManager } from '../../electron/browser/session-manager';
import { StatusPoller } from '../../electron/debate/status-poller';
import { ProgressLogger } from '../../electron/debate/progress-logger';
import { CycleDetector } from '../../electron/debate/cycle-detector';
import type { DebateConfig, LLMProvider } from '../../shared/types';

// Mock Electron
vi.mock('electron', () => ({
  BrowserView: vi.fn().mockImplementation(() => ({
    webContents: {
      loadURL: vi.fn(),
      executeJavaScript: vi.fn().mockResolvedValue(''),
      on: vi.fn(),
      getURL: vi.fn(),
    },
    setBounds: vi.fn(),
    destroy: vi.fn(),
  })),
  session: {
    fromPartition: vi.fn().mockReturnValue({
      clearStorageData: vi.fn().mockResolvedValue(undefined),
      clearCache: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

describe('Debate Flow Integration', () => {
  let controller: DebateController;
  let browserManager: BrowserViewManager;
  let sessionManager: SessionManager;
  let statusPoller: StatusPoller;
  let logger: ProgressLogger;
  let cycleDetector: CycleDetector;
  let mockMainWindow: any;
  let mockRepository: any;
  let mockEventEmitter: any;

  const defaultConfig: DebateConfig = {
    topic: 'Review this code for security issues',
    context: 'def process(data): eval(data["cmd"])',
    preset: 'code_review',
    participants: ['chatgpt', 'claude'],
    judgeProvider: 'gemini',
    completionThreshold: 90,
  };

  beforeEach(() => {
    vi.useFakeTimers();

    mockMainWindow = {
      setBrowserView: vi.fn(),
      getBounds: vi.fn().mockReturnValue({ x: 0, y: 0, width: 1200, height: 800 }),
    };

    mockRepository = {
      create: vi.fn().mockResolvedValue('debate-integration-test'),
      createElements: vi.fn().mockResolvedValue(undefined),
      updateElementScore: vi.fn().mockResolvedValue(undefined),
      markElementComplete: vi.fn().mockResolvedValue(undefined),
      getLast3Versions: vi.fn().mockResolvedValue([]),
      getIncompleteElements: vi.fn().mockResolvedValue([]),
      updateIteration: vi.fn().mockResolvedValue(undefined),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    };

    mockEventEmitter = {
      emit: vi.fn(),
      on: vi.fn(),
    };

    sessionManager = new SessionManager();
    browserManager = new BrowserViewManager(mockMainWindow);
    logger = new ProgressLogger();
    cycleDetector = new CycleDetector(browserManager);
    statusPoller = new StatusPoller(browserManager, logger);

    controller = new DebateController(
      browserManager,
      mockRepository,
      cycleDetector,
      mockEventEmitter
    );
  });

  afterEach(() => {
    statusPoller.stop();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Full Debate Flow', () => {
    it('should verify login status before starting debate', async () => {
      // Create browser views
      browserManager.createView('chatgpt');
      browserManager.createView('claude');
      browserManager.createView('gemini');

      // Mock checkLoginStatus directly on browserManager
      const checkLoginSpy = vi.spyOn(browserManager, 'checkLoginStatus').mockResolvedValue({
        chatgpt: { provider: 'chatgpt', isLoggedIn: true, lastChecked: new Date().toISOString() },
        claude: { provider: 'claude', isLoggedIn: true, lastChecked: new Date().toISOString() },
        gemini: { provider: 'gemini', isLoggedIn: true, lastChecked: new Date().toISOString() },
      });

      // Mock all adapter methods for quick execution
      const providers: LLMProvider[] = ['chatgpt', 'claude', 'gemini'];
      providers.forEach(provider => {
        const adapter = browserManager.getAdapter(provider);
        vi.spyOn(adapter, 'isLoggedIn').mockResolvedValue(true);
        vi.spyOn(adapter, 'waitForInputReady').mockResolvedValue(undefined);
        vi.spyOn(adapter, 'inputPrompt').mockResolvedValue(undefined);
        vi.spyOn(adapter, 'sendMessage').mockResolvedValue(undefined);
        vi.spyOn(adapter, 'waitForResponse').mockResolvedValue(undefined);
        vi.spyOn(adapter, 'extractResponse').mockResolvedValue('{}');
      });

      // Return empty elements to complete immediately after first iteration
      mockRepository.getIncompleteElements.mockResolvedValue([]);

      await controller.start(defaultConfig);

      expect(checkLoginSpy).toHaveBeenCalled();
    });

    it('should fail if any participant is not logged in', async () => {
      browserManager.createView('chatgpt');
      browserManager.createView('claude');
      browserManager.createView('gemini');

      const chatgptAdapter = browserManager.getAdapter('chatgpt');
      vi.spyOn(chatgptAdapter, 'isLoggedIn').mockResolvedValue(false); // Not logged in

      await expect(controller.start(defaultConfig)).rejects.toThrow();
    });

    it('should start status poller during debate', async () => {
      browserManager.createView('chatgpt');
      browserManager.createView('claude');
      browserManager.createView('gemini');

      // Mock all logged in
      const mockAdapters = ['chatgpt', 'claude', 'gemini'].map(provider => {
        const adapter = browserManager.getAdapter(provider as LLMProvider);
        vi.spyOn(adapter, 'isLoggedIn').mockResolvedValue(true);
        vi.spyOn(adapter, 'isWriting').mockResolvedValue(false);
        vi.spyOn(adapter, 'getTokenCount').mockResolvedValue(0);
        return adapter;
      });

      mockRepository.getIncompleteElements.mockResolvedValue([]);

      const logSpy = vi.spyOn(logger, 'log');

      statusPoller.start();
      await vi.advanceTimersByTimeAsync(5000);

      expect(logSpy).toHaveBeenCalled();
      statusPoller.stop();
    });

    it('should complete debate when all elements reach threshold', async () => {
      browserManager.createView('chatgpt');
      browserManager.createView('claude');
      browserManager.createView('gemini');

      const providers: LLMProvider[] = ['chatgpt', 'claude', 'gemini'];
      providers.forEach(provider => {
        const adapter = browserManager.getAdapter(provider);
        vi.spyOn(adapter, 'isLoggedIn').mockResolvedValue(true);
        vi.spyOn(adapter, 'waitForInputReady').mockResolvedValue(undefined);
        vi.spyOn(adapter, 'inputPrompt').mockResolvedValue(undefined);
        vi.spyOn(adapter, 'sendMessage').mockResolvedValue(undefined);
        vi.spyOn(adapter, 'waitForResponse').mockResolvedValue(undefined);
        vi.spyOn(adapter, 'extractResponse').mockResolvedValue(
          JSON.stringify({
            elements: [
              { name: '보안', score: 92, critique: 'Good security' },
              { name: '성능', score: 91, critique: 'Good performance' },
            ],
          })
        );
      });

      const incompleteElement = {
        id: 'elem-1',
        name: '보안',
        status: 'pending' as const,
        currentScore: 92,
        scoreHistory: [],
        versionHistory: [],
      };

      mockRepository.getIncompleteElements
        .mockResolvedValueOnce([incompleteElement])
        .mockResolvedValueOnce([]);

      await controller.start(defaultConfig);

      expect(mockRepository.markElementComplete).toHaveBeenCalledWith(
        expect.any(String),
        'threshold'
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'debate:complete',
        expect.any(Object)
      );
    });

    it('should detect cycle and mark element complete', async () => {
      browserManager.createView('chatgpt');
      browserManager.createView('claude');
      browserManager.createView('gemini');

      // Mock checkLoginStatus
      vi.spyOn(browserManager, 'checkLoginStatus').mockResolvedValue({
        chatgpt: { provider: 'chatgpt', isLoggedIn: true, lastChecked: new Date().toISOString() },
        claude: { provider: 'claude', isLoggedIn: true, lastChecked: new Date().toISOString() },
        gemini: { provider: 'gemini', isLoggedIn: true, lastChecked: new Date().toISOString() },
      });

      const providers: LLMProvider[] = ['chatgpt', 'claude', 'gemini'];
      providers.forEach(provider => {
        const adapter = browserManager.getAdapter(provider);
        vi.spyOn(adapter, 'isLoggedIn').mockResolvedValue(true);
        vi.spyOn(adapter, 'waitForInputReady').mockResolvedValue(undefined);
        vi.spyOn(adapter, 'inputPrompt').mockResolvedValue(undefined);
        vi.spyOn(adapter, 'sendMessage').mockResolvedValue(undefined);
        vi.spyOn(adapter, 'waitForResponse').mockResolvedValue(undefined);

        if (provider === 'gemini') {
          // Judge response indicating cycle - use JSON code block format
          vi.spyOn(adapter, 'extractResponse').mockResolvedValue(
            '```json\n{"isCycle": true, "reason": "Versions are repeating"}\n```'
          );
        } else {
          vi.spyOn(adapter, 'extractResponse').mockResolvedValue(
            JSON.stringify({
              elements: [{ name: '보안', score: 85, critique: 'Review' }],
            })
          );
        }
      });

      const elementWith3Versions = {
        id: 'elem-1',
        name: '보안',
        status: 'in_progress' as const,
        currentScore: 85,
        scoreHistory: [80, 82, 85],
        versionHistory: [
          { iteration: 1, content: 'V1', score: 80, timestamp: '', provider: 'chatgpt' as const },
          { iteration: 2, content: 'V2', score: 82, timestamp: '', provider: 'claude' as const },
          { iteration: 3, content: 'V1', score: 80, timestamp: '', provider: 'chatgpt' as const },
        ],
      };

      // getIncompleteElements is called:
      // 1. in executeIteration (needs element)
      // 2. in while loop check (needs element for cycle detection)
      // 3. after cycle detection (empty to end loop)
      mockRepository.getIncompleteElements
        .mockResolvedValueOnce([elementWith3Versions])  // executeIteration
        .mockResolvedValueOnce([elementWith3Versions])  // while loop check
        .mockResolvedValueOnce([]);                     // after cycle detection

      mockRepository.getLast3Versions.mockResolvedValue(elementWith3Versions.versionHistory);

      await controller.start(defaultConfig);

      expect(mockRepository.markElementComplete).toHaveBeenCalledWith(
        'elem-1',
        'cycle'
      );
    });
  });

  describe('Status Polling Integration', () => {
    it('should poll all active providers every 5 seconds', async () => {
      browserManager.createView('chatgpt');
      browserManager.createView('claude');

      const chatgptAdapter = browserManager.getAdapter('chatgpt');
      const claudeAdapter = browserManager.getAdapter('claude');

      vi.spyOn(chatgptAdapter, 'isWriting').mockResolvedValue(true);
      vi.spyOn(chatgptAdapter, 'getTokenCount').mockResolvedValue(500);
      vi.spyOn(claudeAdapter, 'isWriting').mockResolvedValue(false);
      vi.spyOn(claudeAdapter, 'getTokenCount').mockResolvedValue(1000);

      statusPoller.setActiveProviders(['chatgpt', 'claude']);
      statusPoller.start();

      await vi.advanceTimersByTimeAsync(5000);

      expect(chatgptAdapter.isWriting).toHaveBeenCalled();
      expect(claudeAdapter.isWriting).toHaveBeenCalled();
    });

    it('should log status in correct format', async () => {
      browserManager.createView('chatgpt');

      const adapter = browserManager.getAdapter('chatgpt');
      vi.spyOn(adapter, 'isWriting').mockResolvedValue(true);
      vi.spyOn(adapter, 'getTokenCount').mockResolvedValue(2456);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      statusPoller.setActiveProviders(['chatgpt']);
      statusPoller.start();

      await vi.advanceTimersByTimeAsync(5000);

      const output = consoleSpy.mock.calls.find(call =>
        call[0].includes('chatgpt')
      );

      expect(output).toBeDefined();
      expect(output![0]).toContain('진행중');
      expect(output![0]).toMatch(/2,456|2\.456/);
    });
  });

  describe('Session Management Integration', () => {
    it('should use separate sessions for each provider', () => {
      const chatgptSession = sessionManager.getSession('chatgpt');
      const claudeSession = sessionManager.getSession('claude');
      const geminiSession = sessionManager.getSession('gemini');

      expect(chatgptSession.partition).toBe('persist:chatgpt');
      expect(claudeSession.partition).toBe('persist:claude');
      expect(geminiSession.partition).toBe('persist:gemini');
    });

    it('should preserve sessions across browser view recreations', () => {
      const session1 = sessionManager.getSession('chatgpt');
      const session2 = sessionManager.getSession('chatgpt');

      expect(session1).toBe(session2);
    });
  });
});
