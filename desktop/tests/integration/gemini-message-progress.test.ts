/**
 * Gemini Message Send and Progress Monitoring Integration Tests
 *
 * Gemini 어댑터를 통한 메시지 전송 및 진행상태 모니터링 통합 테스트
 *
 * 테스트 범위:
 * - Message Input and Send: 메시지 입력 및 전송 기능
 * - Progress Monitoring: 응답 진행상태 (isWriting, tokenCount) 모니터링
 * - StatusPoller: 폴링 간격 및 콜백 동작
 * - Response Extraction: 응답 완료 후 텍스트 추출
 * - Error Handling: 오류 상황 복구
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GeminiAdapter } from '../../electron/browser/adapters/gemini-adapter';
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
      getURL: vi.fn().mockReturnValue('https://gemini.google.com'),
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

describe('Gemini Message Send and Progress Monitoring', () => {
  let mockWebContents: any;
  let adapter: GeminiAdapter;
  let browserManager: BrowserViewManager;
  let statusPoller: StatusPoller;
  let logger: ProgressLogger;
  let mockMainWindow: any;

  beforeEach(() => {
    vi.useFakeTimers();

    mockWebContents = {
      executeJavaScript: vi.fn(),
      loadURL: vi.fn(),
      getURL: vi.fn().mockReturnValue('https://gemini.google.com'),
      on: vi.fn(),
    };

    mockMainWindow = {
      setBrowserView: vi.fn(),
      getBounds: vi.fn().mockReturnValue({ x: 0, y: 0, width: 1200, height: 800 }),
    };

    adapter = new GeminiAdapter(mockWebContents);
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
      const testMessage = 'Gemini에게 보내는 테스트 메시지입니다.';

      mockWebContents.executeJavaScript.mockResolvedValue({
        success: true,
      });

      const result = await adapter.enterPrompt(testMessage);

      expect(result.success).toBe(true);
      const inputScript = mockWebContents.executeJavaScript.mock.calls[0][0];
      expect(inputScript).toContain('.ql-editor');
      expect(inputScript).toContain(testMessage);
    });

    it('should successfully send the message via base adapter', async () => {
      // Gemini uses base adapter's submitMessage
      // findElement check for send button
      mockWebContents.executeJavaScript
        .mockResolvedValueOnce(true) // findElement returns true
        .mockResolvedValueOnce({ success: true }); // click script

      const result = await adapter.submitMessage();

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

    it('should handle send failure gracefully', async () => {
      // findElement fails
      mockWebContents.executeJavaScript
        .mockResolvedValueOnce(false) // findElement for send button
        .mockResolvedValueOnce(false) // findElement for input (Enter key fallback)
        .mockResolvedValueOnce({ success: false }); // Enter key fails

      const result = await adapter.submitMessage();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SEND_FAILED');
    });
  });

  describe('Progress Monitoring After Message Send', () => {
    it('should detect writing state via stop button', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({
        writing: true,
        reason: 'stopButton',
        debug: { stopButton: true },
      });

      const isWriting = await adapter.isWriting();

      expect(isWriting).toBe(true);
    });

    it('should detect writing state via loading indicator', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({
        writing: true,
        reason: 'loading',
        debug: { loading: true },
      });

      const isWriting = await adapter.isWriting();

      expect(isWriting).toBe(true);
    });

    it('should detect writing state via aria-busy', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({
        writing: true,
        reason: 'ariaBusy',
        debug: { ariaBusy: true },
      });

      const isWriting = await adapter.isWriting();

      expect(isWriting).toBe(true);
    });

    it('should detect completion when no indicators present', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({
        writing: false,
        reason: 'none',
        debug: {
          stopButton: false,
          loading: false,
          ariaBusy: false,
          sendButton: { exists: true, disabled: false },
        },
      });

      const isWriting = await adapter.isWriting();

      expect(isWriting).toBe(false);
    });

    it('should track token count growth during response', async () => {
      // Each getTokenCount call needs: findElement check + actual count
      mockWebContents.executeJavaScript
        .mockResolvedValueOnce(true).mockResolvedValueOnce(200)
        .mockResolvedValueOnce(true).mockResolvedValueOnce(700)
        .mockResolvedValueOnce(true).mockResolvedValueOnce(1400);

      const count1 = await adapter.getTokenCount();
      const count2 = await adapter.getTokenCount();
      const count3 = await adapter.getTokenCount();

      expect(count1).toBe(200);
      expect(count2).toBe(700);
      expect(count3).toBe(1400);
      expect(count3).toBeGreaterThan(count1);
    });
  });

  describe('StatusPoller Progress Monitoring', () => {
    it('should poll Gemini status at configured interval', async () => {
      browserManager.createView('gemini');
      const geminiAdapter = browserManager.getAdapter('gemini');

      vi.spyOn(geminiAdapter, 'isWriting').mockResolvedValue(true);
      vi.spyOn(geminiAdapter, 'getTokenCount').mockResolvedValue(500);

      statusPoller.setActiveProviders(['gemini']);
      statusPoller.setPollInterval(500);
      statusPoller.start();

      await vi.advanceTimersByTimeAsync(500);
      expect(geminiAdapter.isWriting).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(500);
      expect(geminiAdapter.isWriting).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(500);
      expect(geminiAdapter.isWriting).toHaveBeenCalledTimes(3);
    });

    it('should calculate responseProgress correctly', async () => {
      browserManager.createView('gemini');
      const geminiAdapter = browserManager.getAdapter('gemini');

      vi.spyOn(geminiAdapter, 'isWriting').mockResolvedValue(true);
      vi.spyOn(geminiAdapter, 'getTokenCount').mockResolvedValue(1000);

      statusPoller.setActiveProviders(['gemini']);

      const status = await statusPoller.getDetailedStatus('gemini');

      expect(status.responseProgress).toBe(50); // 1000/2000 * 100
      expect(status.isWriting).toBe(true);
      expect(status.tokenCount).toBe(1000);
    });

    it('should set responseProgress to 100 when writing completes', async () => {
      browserManager.createView('gemini');
      const geminiAdapter = browserManager.getAdapter('gemini');

      vi.spyOn(geminiAdapter, 'isWriting').mockResolvedValue(false);
      vi.spyOn(geminiAdapter, 'getTokenCount').mockResolvedValue(2000);

      statusPoller.setActiveProviders(['gemini']);

      const status = await statusPoller.getDetailedStatus('gemini');

      expect(status.responseProgress).toBe(100);
      expect(status.isWriting).toBe(false);
    });

    it('should call onDetailedStatusUpdate callback with progress info', async () => {
      browserManager.createView('gemini');
      const geminiAdapter = browserManager.getAdapter('gemini');

      vi.spyOn(geminiAdapter, 'isWriting').mockResolvedValue(true);
      vi.spyOn(geminiAdapter, 'getTokenCount').mockResolvedValue(800);

      const detailedStatuses: DetailedStatus[] = [];
      statusPoller.onDetailedStatusUpdate((status) => {
        detailedStatuses.push(status);
      });

      statusPoller.setActiveProviders(['gemini']);
      statusPoller.start();

      await vi.advanceTimersByTimeAsync(500);

      expect(detailedStatuses.length).toBeGreaterThan(0);
      expect(detailedStatuses[0]).toEqual(
        expect.objectContaining({
          provider: 'gemini',
          isWriting: true,
          tokenCount: 800,
          responseProgress: 40,
        })
      );
    });

    it('should call onStatusChange when writing state changes', async () => {
      browserManager.createView('gemini');
      const geminiAdapter = browserManager.getAdapter('gemini');

      const statusChanges: Array<{ current: boolean; previous: boolean | null }> = [];

      statusPoller.onStatusChange((status, previousStatus) => {
        statusChanges.push({
          current: status.isWriting,
          previous: previousStatus?.isWriting ?? null,
        });
      });

      statusPoller.setActiveProviders(['gemini']);
      statusPoller.start();

      // First poll: writing = true
      vi.spyOn(geminiAdapter, 'isWriting').mockResolvedValue(true);
      vi.spyOn(geminiAdapter, 'getTokenCount').mockResolvedValue(100);
      await vi.advanceTimersByTimeAsync(500);

      // Second poll: writing = false (completed)
      vi.spyOn(geminiAdapter, 'isWriting').mockResolvedValue(false);
      vi.spyOn(geminiAdapter, 'getTokenCount').mockResolvedValue(2000);
      await vi.advanceTimersByTimeAsync(500);

      expect(statusChanges.some((s) => s.current === false && s.previous === true)).toBe(true);
    });
  });

  describe('Response Extraction', () => {
    it('should extract response after completion', async () => {
      const responseContent = 'This is the Gemini response to your message.';

      mockWebContents.executeJavaScript.mockResolvedValue({
        success: true,
        content: responseContent,
        selector: '.response-container',
        debug: {},
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
      });

      const inputResult = await adapter.enterPrompt('Gemini 테스트 메시지');
      expect(inputResult.success).toBe(true);

      // Step 2: Send message (Gemini uses base adapter)
      mockWebContents.executeJavaScript
        .mockResolvedValueOnce(true) // findElement for send button
        .mockResolvedValueOnce({ success: true }); // click

      const sendResult = await adapter.submitMessage();
      expect(sendResult.success).toBe(true);

      // Step 3: Monitor progress
      // First check: writing = true
      mockWebContents.executeJavaScript.mockResolvedValueOnce({
        writing: true,
        reason: 'loading',
        debug: {},
      });
      const isWriting1 = await adapter.isWriting();
      expect(isWriting1).toBe(true);

      // Second check: writing = false (completed)
      mockWebContents.executeJavaScript.mockResolvedValueOnce({
        writing: false,
        reason: 'none',
        debug: {},
      });
      const isWriting2 = await adapter.isWriting();
      expect(isWriting2).toBe(false);

      // Step 4: Extract response
      mockWebContents.executeJavaScript.mockResolvedValueOnce({
        success: true,
        content: 'Gemini의 완성된 응답입니다.',
        selector: '.model-response',
      });

      const responsePromise = adapter.getResponse();
      await vi.advanceTimersByTimeAsync(1500);
      const result = await responsePromise;
      expect(result.success).toBe(true);
      expect(result.data).toBe('Gemini의 완성된 응답입니다.');
    });

    it('should log progress throughout the flow', async () => {
      browserManager.createView('gemini');
      const geminiAdapter = browserManager.getAdapter('gemini');

      const logSpy = vi.spyOn(logger, 'log');

      let tokenCount = 0;
      vi.spyOn(geminiAdapter, 'isWriting').mockImplementation(async () => {
        return tokenCount < 1500;
      });
      vi.spyOn(geminiAdapter, 'getTokenCount').mockImplementation(async () => {
        tokenCount += 300;
        return tokenCount;
      });

      statusPoller.setActiveProviders(['gemini']);
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
      browserManager.createView('gemini');
      const geminiAdapter = browserManager.getAdapter('gemini');

      vi.spyOn(geminiAdapter, 'isWriting').mockRejectedValue(new Error('Connection lost'));
      vi.spyOn(geminiAdapter, 'getTokenCount').mockRejectedValue(new Error('Connection lost'));

      statusPoller.setActiveProviders(['gemini']);

      const status = await statusPoller.checkStatus('gemini');

      expect(status.isWriting).toBe(false);
      expect(status.tokenCount).toBe(0);
    });

    it('should continue polling even after individual errors', async () => {
      browserManager.createView('gemini');
      const geminiAdapter = browserManager.getAdapter('gemini');

      const isWritingSpy = vi.spyOn(geminiAdapter, 'isWriting');
      const getTokenCountSpy = vi.spyOn(geminiAdapter, 'getTokenCount');

      isWritingSpy
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValue(true);
      getTokenCountSpy
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValue(700);

      statusPoller.setActiveProviders(['gemini']);
      statusPoller.start();

      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(500);

      const status = await statusPoller.checkStatus('gemini');
      expect(status.isWriting).toBe(true);
      expect(status.tokenCount).toBe(700);
    });
  });

  describe('Gemini-Specific Detection', () => {
    it('should detect writing via response container updating state', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({
        writing: true,
        reason: 'responseUpdating',
        debug: { responseUpdating: true },
      });

      const isWriting = await adapter.isWriting();

      expect(isWriting).toBe(true);
    });

    it('should detect writing via cursor animation', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({
        writing: true,
        reason: 'cursor',
        debug: { cursor: true },
      });

      const isWriting = await adapter.isWriting();

      expect(isWriting).toBe(true);
    });
  });
});
