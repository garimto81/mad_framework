/**
 * Claude Message Send and Progress Monitoring Integration Tests
 *
 * Claude 어댑터를 통한 메시지 전송 및 진행상태 모니터링 통합 테스트
 *
 * 테스트 범위:
 * - Message Input and Send: 메시지 입력 및 전송 기능
 * - Progress Monitoring: 응답 진행상태 (isWriting, tokenCount) 모니터링
 * - StatusPoller: 폴링 간격 및 콜백 동작
 * - Response Extraction: 응답 완료 후 텍스트 추출
 * - Error Handling: 오류 상황 복구
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ClaudeAdapter } from '../../electron/browser/adapters/claude-adapter';
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
      getURL: vi.fn().mockReturnValue('https://claude.ai'),
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

describe('Claude Message Send and Progress Monitoring', () => {
  let mockWebContents: any;
  let adapter: ClaudeAdapter;
  let browserManager: BrowserViewManager;
  let statusPoller: StatusPoller;
  let logger: ProgressLogger;
  let mockMainWindow: any;

  beforeEach(() => {
    vi.useFakeTimers();

    mockWebContents = {
      executeJavaScript: vi.fn(),
      loadURL: vi.fn(),
      getURL: vi.fn().mockReturnValue('https://claude.ai'),
      on: vi.fn(),
    };

    mockMainWindow = {
      setBrowserView: vi.fn(),
      getBounds: vi.fn().mockReturnValue({ x: 0, y: 0, width: 1200, height: 800 }),
    };

    adapter = new ClaudeAdapter(mockWebContents);
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
    it('should successfully input a test message via textarea', async () => {
      const testMessage = 'Claude에게 보내는 테스트 메시지입니다.';

      mockWebContents.executeJavaScript.mockResolvedValue({
        success: true,
        method: 'textarea',
      });

      const result = await adapter.enterPrompt(testMessage);

      expect(result.success).toBe(true);
      const inputScript = mockWebContents.executeJavaScript.mock.calls[0][0];
      expect(inputScript).toContain(testMessage);
    });

    it('should successfully input via contenteditable fallback', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({
        success: true,
        method: 'contenteditable',
      });

      const result = await adapter.enterPrompt('Fallback test');

      expect(result.success).toBe(true);
    });

    it('should successfully send the message', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({
        success: true,
        selector: 'button[aria-label="메시지 보내기"]',
        debug: { tried: [], clicked: 'button[aria-label="메시지 보내기"]' },
      });

      // submitMessage has 500ms sleep
      const resultPromise = adapter.submitMessage();
      await vi.advanceTimersByTimeAsync(500);
      const result = await resultPromise;

      expect(result.success).toBe(true);
    });

    it('should handle input failure gracefully', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({
        success: false,
        error: 'editor not found',
      });

      const result = await adapter.enterPrompt('Test');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INPUT_FAILED');
    });

    it('should handle send failure and try Enter key fallback', async () => {
      // First call: button click fails
      mockWebContents.executeJavaScript
        .mockResolvedValueOnce({
          success: false,
          error: 'send button not found',
          debug: { tried: [] },
        })
        // Second call: Enter key also fails
        .mockResolvedValueOnce({
          success: false,
          error: 'editor not found',
        });

      const result = await adapter.submitMessage();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SEND_FAILED');
    });
  });

  describe('Progress Monitoring After Message Send', () => {
    it('should detect writing state via stop button', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({
        writing: true,
        reason: 'stopButton: button[aria-label="응답 중지"]',
        debug: { stopButton: true },
        responseContent: '',
      });

      const isWriting = await adapter.isWriting();

      expect(isWriting).toBe(true);
    });

    it('should detect writing state via send button disabled', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({
        writing: true,
        reason: 'sendDisabled',
        debug: { sendButton: { exists: true, disabled: true } },
        responseContent: '',
      });

      const isWriting = await adapter.isWriting();

      expect(isWriting).toBe(true);
    });

    it('should detect completion when no indicators present', async () => {
      // Reset content tracking to avoid content change detection interference
      adapter.resetContentTracking();

      mockWebContents.executeJavaScript.mockResolvedValue({
        writing: false,
        reason: 'none',
        debug: { stopButton: false, sendButton: { exists: true, disabled: false } },
        responseContent: '', // Empty content skips content change detection
      });

      const isWriting = await adapter.isWriting();

      expect(isWriting).toBe(false);
    });

    it('should track token count growth during response', async () => {
      // Each getTokenCount call needs: findElement check + actual count
      mockWebContents.executeJavaScript
        .mockResolvedValueOnce(true).mockResolvedValueOnce(150)
        .mockResolvedValueOnce(true).mockResolvedValueOnce(600)
        .mockResolvedValueOnce(true).mockResolvedValueOnce(1200);

      const count1 = await adapter.getTokenCount();
      const count2 = await adapter.getTokenCount();
      const count3 = await adapter.getTokenCount();

      expect(count1).toBe(150);
      expect(count2).toBe(600);
      expect(count3).toBe(1200);
      expect(count3).toBeGreaterThan(count1);
    });
  });

  describe('StatusPoller Progress Monitoring', () => {
    it('should poll Claude status at configured interval', async () => {
      browserManager.createView('claude');
      const claudeAdapter = browserManager.getAdapter('claude');

      vi.spyOn(claudeAdapter, 'isWriting').mockResolvedValue(true);
      vi.spyOn(claudeAdapter, 'getTokenCount').mockResolvedValue(500);

      statusPoller.setActiveProviders(['claude']);
      statusPoller.setPollInterval(500);
      statusPoller.start();

      await vi.advanceTimersByTimeAsync(500);
      expect(claudeAdapter.isWriting).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(500);
      expect(claudeAdapter.isWriting).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(500);
      expect(claudeAdapter.isWriting).toHaveBeenCalledTimes(3);
    });

    it('should calculate responseProgress correctly', async () => {
      browserManager.createView('claude');
      const claudeAdapter = browserManager.getAdapter('claude');

      vi.spyOn(claudeAdapter, 'isWriting').mockResolvedValue(true);
      vi.spyOn(claudeAdapter, 'getTokenCount').mockResolvedValue(1000);

      statusPoller.setActiveProviders(['claude']);

      const status = await statusPoller.getDetailedStatus('claude');

      expect(status.responseProgress).toBe(50); // 1000/2000 * 100
      expect(status.isWriting).toBe(true);
      expect(status.tokenCount).toBe(1000);
    });

    it('should set responseProgress to 100 when writing completes', async () => {
      browserManager.createView('claude');
      const claudeAdapter = browserManager.getAdapter('claude');

      vi.spyOn(claudeAdapter, 'isWriting').mockResolvedValue(false);
      vi.spyOn(claudeAdapter, 'getTokenCount').mockResolvedValue(1800);

      statusPoller.setActiveProviders(['claude']);

      const status = await statusPoller.getDetailedStatus('claude');

      expect(status.responseProgress).toBe(100);
      expect(status.isWriting).toBe(false);
    });

    it('should call onDetailedStatusUpdate callback with progress info', async () => {
      browserManager.createView('claude');
      const claudeAdapter = browserManager.getAdapter('claude');

      vi.spyOn(claudeAdapter, 'isWriting').mockResolvedValue(true);
      vi.spyOn(claudeAdapter, 'getTokenCount').mockResolvedValue(800);

      const detailedStatuses: DetailedStatus[] = [];
      statusPoller.onDetailedStatusUpdate((status) => {
        detailedStatuses.push(status);
      });

      statusPoller.setActiveProviders(['claude']);
      statusPoller.start();

      await vi.advanceTimersByTimeAsync(500);

      expect(detailedStatuses.length).toBeGreaterThan(0);
      expect(detailedStatuses[0]).toEqual(
        expect.objectContaining({
          provider: 'claude',
          isWriting: true,
          tokenCount: 800,
          responseProgress: 40,
        })
      );
    });
  });

  describe('Response Extraction', () => {
    it('should extract response after completion', async () => {
      const responseContent = 'This is the Claude response to your message.';

      mockWebContents.executeJavaScript.mockResolvedValue({
        success: true,
        content: responseContent,
        selector: 'treeWalker',
      });

      // getResponse has 1500ms sleep
      const responsePromise = adapter.getResponse();
      await vi.advanceTimersByTimeAsync(1500);
      const result = await responsePromise;

      expect(result.success).toBe(true);
      expect(result.data).toBe(responseContent);
    });

    it('should return error when no response found', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({
        success: false,
        content: '',
        error: 'no messages found',
        debug: {},
      });

      const responsePromise = adapter.getResponse();
      await vi.advanceTimersByTimeAsync(1500);
      const result = await responsePromise;

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('EXTRACT_FAILED');
    });
  });

  describe('Full Message Send and Monitor Flow', () => {
    it('should complete full flow: input -> send -> monitor -> extract', async () => {
      // Step 1: Input message
      mockWebContents.executeJavaScript.mockResolvedValueOnce({
        success: true,
        method: 'textarea',
      });

      const inputResult = await adapter.enterPrompt('Claude 테스트 메시지');
      expect(inputResult.success).toBe(true);

      // Step 2: Send message (has 500ms sleep)
      mockWebContents.executeJavaScript.mockResolvedValueOnce({
        success: true,
        selector: 'button[aria-label="Send message"]',
      });

      const sendPromise = adapter.submitMessage();
      await vi.advanceTimersByTimeAsync(500);
      const sendResult = await sendPromise;
      expect(sendResult.success).toBe(true);

      // Step 3: Monitor progress
      // First check: writing = true (selector-based detection)
      mockWebContents.executeJavaScript.mockResolvedValueOnce({
        writing: true,
        reason: 'stopButton',
        debug: { stopButton: true },
        responseContent: '', // No content for simplicity
      });
      const isWriting1 = await adapter.isWriting();
      expect(isWriting1).toBe(true);

      // Second check: writing = false (selector-based detection only)
      mockWebContents.executeJavaScript.mockResolvedValueOnce({
        writing: false,
        reason: 'none',
        debug: { stopButton: false },
        responseContent: '', // No content = skip content change detection
      });
      const isWriting2 = await adapter.isWriting();
      expect(isWriting2).toBe(false);

      // Step 4: Extract response
      mockWebContents.executeJavaScript.mockResolvedValueOnce({
        success: true,
        content: 'Claude의 완성된 응답입니다.',
        selector: 'main article',
      });

      const responsePromise = adapter.extractResponse();
      await vi.advanceTimersByTimeAsync(1500);
      const response = await responsePromise;
      expect(response).toBe('Claude의 완성된 응답입니다.');
    });

    it('should log progress throughout the flow', async () => {
      browserManager.createView('claude');
      const claudeAdapter = browserManager.getAdapter('claude');

      const logSpy = vi.spyOn(logger, 'log');

      let tokenCount = 0;
      vi.spyOn(claudeAdapter, 'isWriting').mockImplementation(async () => {
        return tokenCount < 1500;
      });
      vi.spyOn(claudeAdapter, 'getTokenCount').mockImplementation(async () => {
        tokenCount += 300;
        return tokenCount;
      });

      statusPoller.setActiveProviders(['claude']);
      statusPoller.setPollInterval(500);
      statusPoller.start();

      await vi.advanceTimersByTimeAsync(3000);

      expect(logSpy).toHaveBeenCalled();

      const loggedStatuses = logSpy.mock.calls.map((call) => call[0]);
      const tokenCounts = loggedStatuses.map((s: DetailedStatus) => s.tokenCount);
      expect(tokenCounts[tokenCounts.length - 1]).toBeGreaterThan(tokenCounts[0]);
    });
  });

  describe('Error Handling', () => {
    it('should handle adapter errors during monitoring', async () => {
      browserManager.createView('claude');
      const claudeAdapter = browserManager.getAdapter('claude');

      vi.spyOn(claudeAdapter, 'isWriting').mockRejectedValue(new Error('Connection lost'));
      vi.spyOn(claudeAdapter, 'getTokenCount').mockRejectedValue(new Error('Connection lost'));

      statusPoller.setActiveProviders(['claude']);

      const status = await statusPoller.checkStatus('claude');

      expect(status.isWriting).toBe(false);
      expect(status.tokenCount).toBe(0);
    });

    it('should continue polling even after individual errors', async () => {
      browserManager.createView('claude');
      const claudeAdapter = browserManager.getAdapter('claude');

      const isWritingSpy = vi.spyOn(claudeAdapter, 'isWriting');
      const getTokenCountSpy = vi.spyOn(claudeAdapter, 'getTokenCount');

      isWritingSpy
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValue(true);
      getTokenCountSpy
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValue(600);

      statusPoller.setActiveProviders(['claude']);
      statusPoller.start();

      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(500);

      const status = await statusPoller.checkStatus('claude');
      expect(status.isWriting).toBe(true);
      expect(status.tokenCount).toBe(600);
    });
  });

  describe('Content Change Detection', () => {
    it('should detect writing via content change when selectors fail', async () => {
      // Reset content tracking first
      adapter.resetContentTracking();

      // First call: no selector indicators but content changed
      mockWebContents.executeJavaScript.mockResolvedValueOnce({
        writing: false,
        reason: 'none',
        debug: {},
        responseContent: 'Initial content',
      });
      const isWriting1 = await adapter.isWriting();
      // Should detect as writing because content changed from empty
      expect(isWriting1).toBe(true);

      // Second call: content changed again
      mockWebContents.executeJavaScript.mockResolvedValueOnce({
        writing: false,
        reason: 'none',
        debug: {},
        responseContent: 'Extended content with more text',
      });
      const isWriting2 = await adapter.isWriting();
      expect(isWriting2).toBe(true);
    });

    it('should detect completion after content stabilizes', async () => {
      // Reset content tracking first
      adapter.resetContentTracking();

      // Use vi.setSystemTime to control Date.now()
      const startTime = Date.now();
      vi.setSystemTime(startTime);

      // First call: content appears
      mockWebContents.executeJavaScript.mockResolvedValueOnce({
        writing: false,
        reason: 'none',
        debug: {},
        responseContent: 'Final content',
      });
      await adapter.isWriting();

      // Advance system time by 2.5 seconds (past content stable threshold)
      vi.setSystemTime(startTime + 2500);

      // Second call: same content, should be complete
      mockWebContents.executeJavaScript.mockResolvedValueOnce({
        writing: false,
        reason: 'none',
        debug: {},
        responseContent: 'Final content',
      });
      const isWriting2 = await adapter.isWriting();
      expect(isWriting2).toBe(false);
    });

    it('should reset content tracking on new message send', async () => {
      // First: simulate previous content
      mockWebContents.executeJavaScript.mockResolvedValueOnce({
        writing: false,
        reason: 'none',
        debug: {},
        responseContent: 'Previous response',
      });
      await adapter.isWriting();

      // Send new message (triggers reset)
      mockWebContents.executeJavaScript.mockResolvedValueOnce({
        success: true,
        selector: 'button[aria-label="Send message"]',
      });
      const sendPromise = adapter.sendMessage();
      await vi.advanceTimersByTimeAsync(500);
      await sendPromise;

      // Now content tracking should be reset
      expect(adapter['lastResponseContent']).toBe('');
    });
  });
});
