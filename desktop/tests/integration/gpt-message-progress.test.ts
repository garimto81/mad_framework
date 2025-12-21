/**
 * GPT Message Send and Progress Monitoring Integration Tests
 *
 * ChatGPT 어댑터를 통한 메시지 전송 및 진행상태 모니터링 통합 테스트
 *
 * 테스트 범위:
 * - Message Input and Send: 메시지 입력 및 전송 기능
 * - Progress Monitoring: 응답 진행상태 (isWriting, tokenCount) 모니터링
 * - StatusPoller: 5초 간격 폴링 및 콜백 동작
 * - Response Extraction: 응답 완료 후 텍스트 추출
 * - Error Handling: 오류 상황 복구
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChatGPTAdapter } from '../../electron/browser/adapters/chatgpt-adapter';
import { StatusPoller } from '../../electron/debate/status-poller';
import { ProgressLogger } from '../../electron/debate/progress-logger';
import { BrowserViewManager } from '../../electron/browser/browser-view-manager';
import type { DetailedStatus } from '../../shared/types';

// Mock Electron
vi.mock('electron', () => ({
  BrowserView: vi.fn().mockImplementation(() => ({
    webContents: {
      loadURL: vi.fn(),
      executeJavaScript: vi.fn().mockResolvedValue(''),
      on: vi.fn(),
      getURL: vi.fn().mockReturnValue('https://chat.openai.com'),
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

describe('GPT Message Send and Progress Monitoring', () => {
  let mockWebContents: any;
  let adapter: ChatGPTAdapter;
  let browserManager: BrowserViewManager;
  let statusPoller: StatusPoller;
  let logger: ProgressLogger;
  let mockMainWindow: any;

  beforeEach(() => {
    // Use fake timers for StatusPoller tests
    vi.useFakeTimers();

    mockWebContents = {
      executeJavaScript: vi.fn(),
      loadURL: vi.fn(),
      getURL: vi.fn().mockReturnValue('https://chat.openai.com'),
      on: vi.fn(),
    };

    mockMainWindow = {
      setBrowserView: vi.fn(),
      getBounds: vi.fn().mockReturnValue({ x: 0, y: 0, width: 1200, height: 800 }),
    };

    adapter = new ChatGPTAdapter(mockWebContents);
    browserManager = new BrowserViewManager(mockMainWindow);
    logger = new ProgressLogger();
    statusPoller = new StatusPoller(browserManager, logger);
  });

  afterEach(() => {
    statusPoller.stop();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Message Input and Send', () => {
    it('should successfully input a test message', async () => {
      const testMessage = '안녕하세요, 테스트 메시지입니다.';

      mockWebContents.executeJavaScript
        .mockResolvedValueOnce({ success: true, method: 'contenteditable' })
        .mockResolvedValueOnce(true); // verifyInput

      // enterPrompt has 1000ms sleep, need to advance timer
      const resultPromise = adapter.enterPrompt(testMessage);
      await vi.advanceTimersByTimeAsync(1000);
      const result = await resultPromise;

      expect(result.success).toBe(true);
      const inputScript = mockWebContents.executeJavaScript.mock.calls[0][0];
      expect(inputScript).toContain('#prompt-textarea');
      expect(inputScript).toContain(testMessage);
    });

    it('should successfully send the message', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({
        success: true,
        selector: '[data-testid="send-button"]',
      });

      // submitMessage has 1000ms sleep
      const resultPromise = adapter.submitMessage();
      await vi.advanceTimersByTimeAsync(1000);
      const result = await resultPromise;

      expect(result.success).toBe(true);
      const sendScript = mockWebContents.executeJavaScript.mock.calls[0][0];
      expect(sendScript).toContain('send-button');
    });

    it('should handle input failure gracefully', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({
        success: false,
        error: 'textarea not found',
      });

      const result = await adapter.enterPrompt('Test');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INPUT_FAILED');
    });

    it('should handle send failure gracefully', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({
        success: false,
        error: 'no send method found',
      });

      // submitMessage has 1000ms sleep even on failure
      const resultPromise = adapter.submitMessage();
      await vi.advanceTimersByTimeAsync(1000);
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SEND_FAILED');
    });
  });

  describe('Progress Monitoring After Message Send', () => {
    it('should detect writing state after message send', async () => {
      // Simulate sending a message
      mockWebContents.executeJavaScript.mockResolvedValue({
        writing: true,
        reason: 'resultStreaming',
        debug: { streaming: true },
      });

      const isWriting = await adapter.isWriting();

      expect(isWriting).toBe(true);
    });

    it('should track token count growth during response', async () => {
      // ChatGPT adapter uses base-adapter's getTokenCount which calls:
      // 1. findElement (which calls executeJavaScript to check if selector exists)
      // 2. then executeJavaScript to get token count
      // So each getTokenCount call requires 2 mock values

      mockWebContents.executeJavaScript
        // First getTokenCount: findElement check + count
        .mockResolvedValueOnce(true)  // findElement returns true (selector exists)
        .mockResolvedValueOnce(100)   // actual token count
        // Second getTokenCount: findElement check + count
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(500)
        // Third getTokenCount: findElement check + count
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(1000);

      const count1 = await adapter.getTokenCount();
      const count2 = await adapter.getTokenCount();
      const count3 = await adapter.getTokenCount();

      expect(count1).toBe(100);
      expect(count2).toBe(500);
      expect(count3).toBe(1000);
      expect(count3).toBeGreaterThan(count1);
    });

    it('should detect response completion when writing stops', async () => {
      // First: writing
      mockWebContents.executeJavaScript.mockResolvedValueOnce({
        writing: true,
        debug: { streaming: true },
      });

      // Second: not writing (completed)
      mockWebContents.executeJavaScript.mockResolvedValueOnce({
        writing: false,
        debug: { streaming: false },
      });

      const isWriting1 = await adapter.isWriting();
      const isWriting2 = await adapter.isWriting();

      expect(isWriting1).toBe(true);
      expect(isWriting2).toBe(false);
    });
  });

  describe('StatusPoller Progress Monitoring', () => {
    it('should poll GPT status at configured interval', async () => {
      browserManager.createView('chatgpt');
      const chatgptAdapter = browserManager.getAdapter('chatgpt');

      vi.spyOn(chatgptAdapter, 'isWriting').mockResolvedValue(true);
      vi.spyOn(chatgptAdapter, 'getTokenCount').mockResolvedValue(500);

      statusPoller.setActiveProviders(['chatgpt']);
      statusPoller.setPollInterval(500);
      statusPoller.start();

      // After 500ms - first poll
      await vi.advanceTimersByTimeAsync(500);
      expect(chatgptAdapter.isWriting).toHaveBeenCalledTimes(1);

      // After 1000ms - second poll
      await vi.advanceTimersByTimeAsync(500);
      expect(chatgptAdapter.isWriting).toHaveBeenCalledTimes(2);

      // After 1500ms - third poll
      await vi.advanceTimersByTimeAsync(500);
      expect(chatgptAdapter.isWriting).toHaveBeenCalledTimes(3);
    });

    it('should calculate responseProgress correctly', async () => {
      browserManager.createView('chatgpt');
      const chatgptAdapter = browserManager.getAdapter('chatgpt');

      vi.spyOn(chatgptAdapter, 'isWriting').mockResolvedValue(true);
      vi.spyOn(chatgptAdapter, 'getTokenCount').mockResolvedValue(1000);

      statusPoller.setActiveProviders(['chatgpt']);

      const status = await statusPoller.getDetailedStatus('chatgpt');

      // 1000 tokens / 2000 estimated max * 100 = 50%
      expect(status.responseProgress).toBe(50);
      expect(status.isWriting).toBe(true);
      expect(status.tokenCount).toBe(1000);
    });

    it('should set responseProgress to 100 when writing completes', async () => {
      browserManager.createView('chatgpt');
      const chatgptAdapter = browserManager.getAdapter('chatgpt');

      vi.spyOn(chatgptAdapter, 'isWriting').mockResolvedValue(false);
      vi.spyOn(chatgptAdapter, 'getTokenCount').mockResolvedValue(1500);

      statusPoller.setActiveProviders(['chatgpt']);

      const status = await statusPoller.getDetailedStatus('chatgpt');

      expect(status.responseProgress).toBe(100);
      expect(status.isWriting).toBe(false);
    });

    it('should call onDetailedStatusUpdate callback with progress info', async () => {
      browserManager.createView('chatgpt');
      const chatgptAdapter = browserManager.getAdapter('chatgpt');

      vi.spyOn(chatgptAdapter, 'isWriting').mockResolvedValue(true);
      vi.spyOn(chatgptAdapter, 'getTokenCount').mockResolvedValue(800);

      const detailedStatuses: DetailedStatus[] = [];
      statusPoller.onDetailedStatusUpdate((status) => {
        detailedStatuses.push(status);
      });

      statusPoller.setActiveProviders(['chatgpt']);
      statusPoller.start();

      await vi.advanceTimersByTimeAsync(500);

      expect(detailedStatuses.length).toBeGreaterThan(0);
      expect(detailedStatuses[0]).toEqual(
        expect.objectContaining({
          provider: 'chatgpt',
          isWriting: true,
          tokenCount: 800,
          responseProgress: 40, // 800/2000 * 100
        })
      );
    });

    it('should call onStatusChange when writing state changes', async () => {
      browserManager.createView('chatgpt');
      const chatgptAdapter = browserManager.getAdapter('chatgpt');

      const statusChanges: Array<{ current: boolean; previous: boolean | null }> = [];

      statusPoller.onStatusChange((status, previousStatus) => {
        statusChanges.push({
          current: status.isWriting,
          previous: previousStatus?.isWriting ?? null,
        });
      });

      statusPoller.setActiveProviders(['chatgpt']);
      statusPoller.start();

      // First poll: writing = true
      vi.spyOn(chatgptAdapter, 'isWriting').mockResolvedValue(true);
      vi.spyOn(chatgptAdapter, 'getTokenCount').mockResolvedValue(100);
      await vi.advanceTimersByTimeAsync(500);

      // Second poll: writing = false (completed)
      vi.spyOn(chatgptAdapter, 'isWriting').mockResolvedValue(false);
      vi.spyOn(chatgptAdapter, 'getTokenCount').mockResolvedValue(1500);
      await vi.advanceTimersByTimeAsync(500);

      // Should have detected the change from writing to not writing
      expect(statusChanges.some((s) => s.current === false && s.previous === true)).toBe(true);
    });
  });

  describe('Response Extraction', () => {
    it('should extract response after completion', async () => {
      const responseContent = 'This is the GPT response to your test message.';

      mockWebContents.executeJavaScript.mockResolvedValue({
        success: true,
        content: responseContent,
        selector: '[data-message-author-role="assistant"]',
      });

      // getResponse (called by extractResponse) has 1500ms sleep
      const responsePromise = adapter.extractResponse();
      await vi.advanceTimersByTimeAsync(1500);
      const response = await responsePromise;

      expect(response).toBe(responseContent);
    });

    it('should return empty string when no response found', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({
        success: false,
        content: '',
        error: 'no messages found',
      });

      // getResponse (called by extractResponse) has 1500ms sleep
      const responsePromise = adapter.extractResponse();
      await vi.advanceTimersByTimeAsync(1500);
      const response = await responsePromise;

      expect(response).toBe('');
    });
  });

  describe('Full Message Send and Monitor Flow', () => {
    it('should complete full flow: input -> send -> monitor -> extract', async () => {
      // Step 1: Input message
      mockWebContents.executeJavaScript
        .mockResolvedValueOnce({ success: true, method: 'contenteditable' })
        .mockResolvedValueOnce(true); // verifyInput

      const inputPromise = adapter.enterPrompt('테스트 메시지');
      await vi.advanceTimersByTimeAsync(1000); // enterPrompt has 1000ms sleep
      const inputResult = await inputPromise;
      expect(inputResult.success).toBe(true);

      // Step 2: Send message
      mockWebContents.executeJavaScript.mockResolvedValueOnce({
        success: true,
        selector: '[data-testid="send-button"]',
      });

      const sendPromise = adapter.submitMessage();
      await vi.advanceTimersByTimeAsync(1000); // submitMessage has 1000ms sleep
      const sendResult = await sendPromise;
      expect(sendResult.success).toBe(true);

      // Step 3: Monitor progress (simulated)
      // First check: writing = true, tokens = 200
      mockWebContents.executeJavaScript.mockResolvedValueOnce({
        writing: true,
        debug: { streaming: true },
      });
      const isWriting1 = await adapter.isWriting();
      expect(isWriting1).toBe(true);

      // getTokenCount needs: findElement check + actual count
      mockWebContents.executeJavaScript
        .mockResolvedValueOnce(true)  // findElement
        .mockResolvedValueOnce(200);  // count
      const tokens1 = await adapter.getTokenCount();
      expect(tokens1).toBe(200);

      // Second check: writing = true, tokens = 800
      mockWebContents.executeJavaScript.mockResolvedValueOnce({
        writing: true,
        debug: { streaming: true },
      });
      const isWriting2 = await adapter.isWriting();
      expect(isWriting2).toBe(true);

      mockWebContents.executeJavaScript
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(800);
      const tokens2 = await adapter.getTokenCount();
      expect(tokens2).toBe(800);

      // Third check: writing = false (completed), tokens = 1500
      mockWebContents.executeJavaScript.mockResolvedValueOnce({
        writing: false,
        debug: { streaming: false },
      });
      const isWriting3 = await adapter.isWriting();
      expect(isWriting3).toBe(false);

      // Step 4: Extract response
      mockWebContents.executeJavaScript.mockResolvedValueOnce({
        success: true,
        content: '테스트 메시지에 대한 GPT 응답입니다.',
        selector: 'article[data-testid^="conversation-turn"]',
      });

      const responsePromise = adapter.extractResponse();
      await vi.advanceTimersByTimeAsync(1500); // getResponse has 1500ms sleep
      const response = await responsePromise;
      expect(response).toBe('테스트 메시지에 대한 GPT 응답입니다.');
    });

    it('should log progress throughout the flow', async () => {
      browserManager.createView('chatgpt');
      const chatgptAdapter = browserManager.getAdapter('chatgpt');

      const logSpy = vi.spyOn(logger, 'log');

      // Simulate progress: writing with increasing tokens
      let tokenCount = 0;
      vi.spyOn(chatgptAdapter, 'isWriting').mockImplementation(async () => {
        return tokenCount < 1500;
      });
      vi.spyOn(chatgptAdapter, 'getTokenCount').mockImplementation(async () => {
        tokenCount += 300;
        return tokenCount;
      });

      statusPoller.setActiveProviders(['chatgpt']);
      statusPoller.setPollInterval(500);
      statusPoller.start();

      // Run for 3 seconds (6 polls)
      await vi.advanceTimersByTimeAsync(3000);

      // Should have logged multiple times
      expect(logSpy).toHaveBeenCalled();

      // Get all logged statuses
      const loggedStatuses = logSpy.mock.calls.map((call) => call[0]);

      // Token count should increase over time
      const tokenCounts = loggedStatuses.map((s: DetailedStatus) => s.tokenCount);
      expect(tokenCounts[tokenCounts.length - 1]).toBeGreaterThan(tokenCounts[0]);
    });
  });

  describe('Error Handling', () => {
    it('should handle adapter errors during monitoring', async () => {
      browserManager.createView('chatgpt');
      const chatgptAdapter = browserManager.getAdapter('chatgpt');

      // Simulate error
      vi.spyOn(chatgptAdapter, 'isWriting').mockRejectedValue(new Error('Connection lost'));
      vi.spyOn(chatgptAdapter, 'getTokenCount').mockRejectedValue(new Error('Connection lost'));

      statusPoller.setActiveProviders(['chatgpt']);

      // Should not throw, should return safe defaults
      const status = await statusPoller.checkStatus('chatgpt');

      expect(status.isWriting).toBe(false);
      expect(status.tokenCount).toBe(0);
    });

    it('should continue polling even after individual errors', async () => {
      browserManager.createView('chatgpt');
      const chatgptAdapter = browserManager.getAdapter('chatgpt');

      // Set up spies that return values on subsequent calls
      const isWritingSpy = vi.spyOn(chatgptAdapter, 'isWriting');
      const getTokenCountSpy = vi.spyOn(chatgptAdapter, 'getTokenCount');

      // First call: error, then success
      isWritingSpy
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValue(true);
      getTokenCountSpy
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValue(500);

      statusPoller.setActiveProviders(['chatgpt']);
      statusPoller.start();

      // First poll (with error)
      await vi.advanceTimersByTimeAsync(500);

      // Second poll (should recover)
      await vi.advanceTimersByTimeAsync(500);

      // Now directly call checkStatus which will use the successful mock
      const status = await statusPoller.checkStatus('chatgpt');
      expect(status.isWriting).toBe(true);
      expect(status.tokenCount).toBe(500);
    });
  });
});
