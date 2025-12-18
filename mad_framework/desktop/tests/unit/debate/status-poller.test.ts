/**
 * StatusPoller Tests
 *
 * TDD RED Phase: 5초 간격 상태 폴링 테스트
 * - 5초 간격으로 각 LLM 상태 체크
 * - isWriting, tokenCount 조회
 * - 로그 출력
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StatusPoller } from '../../../electron/debate/status-poller';
import type { LLMProvider, LLMStatus } from '../../../shared/types';

const createMockBrowserManager = () => ({
  getAdapter: vi.fn().mockReturnValue({
    isWriting: vi.fn().mockResolvedValue(false),
    getTokenCount: vi.fn().mockResolvedValue(0),
  }),
  getWebContents: vi.fn().mockReturnValue({}),
});

const createMockLogger = () => ({
  log: vi.fn(),
  logElementScore: vi.fn(),
  logCycleDetected: vi.fn(),
  logIteration: vi.fn(),
});

describe('StatusPoller', () => {
  let poller: StatusPoller;
  let mockBrowserManager: ReturnType<typeof createMockBrowserManager>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockBrowserManager = createMockBrowserManager();
    mockLogger = createMockLogger();
    poller = new StatusPoller(mockBrowserManager as any, mockLogger as any);
  });

  afterEach(() => {
    poller.stop();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with 5 second poll interval', () => {
      expect(poller.pollInterval).toBe(5000);
    });

    it('should not be running initially', () => {
      expect(poller.isRunning).toBe(false);
    });
  });

  describe('start', () => {
    it('should start polling', () => {
      poller.start();

      expect(poller.isRunning).toBe(true);
    });

    it('should poll immediately on start', async () => {
      poller.start();

      await vi.runOnlyPendingTimersAsync();

      expect(mockBrowserManager.getAdapter).toHaveBeenCalled();
    });

    it('should poll every 5 seconds', async () => {
      poller.start();

      // First poll
      await vi.advanceTimersByTimeAsync(5000);
      expect(mockBrowserManager.getAdapter).toHaveBeenCalledTimes(3); // 3 providers

      // Second poll
      await vi.advanceTimersByTimeAsync(5000);
      expect(mockBrowserManager.getAdapter).toHaveBeenCalledTimes(6);

      // Third poll
      await vi.advanceTimersByTimeAsync(5000);
      expect(mockBrowserManager.getAdapter).toHaveBeenCalledTimes(9);
    });

    it('should check all three providers', async () => {
      const providers: LLMProvider[] = [];
      mockBrowserManager.getAdapter.mockImplementation((provider: LLMProvider) => {
        providers.push(provider);
        return {
          isWriting: vi.fn().mockResolvedValue(false),
          getTokenCount: vi.fn().mockResolvedValue(0),
        };
      });

      poller.start();
      await vi.advanceTimersByTimeAsync(5000);

      expect(providers).toContain('chatgpt');
      expect(providers).toContain('claude');
      expect(providers).toContain('gemini');
    });
  });

  describe('stop', () => {
    it('should stop polling', () => {
      poller.start();
      poller.stop();

      expect(poller.isRunning).toBe(false);
    });

    it('should not poll after stopping', async () => {
      poller.start();
      poller.stop();

      const callCount = mockBrowserManager.getAdapter.mock.calls.length;

      await vi.advanceTimersByTimeAsync(10000);

      expect(mockBrowserManager.getAdapter).toHaveBeenCalledTimes(callCount);
    });

    it('should be safe to call stop multiple times', () => {
      poller.start();
      poller.stop();
      poller.stop();

      expect(poller.isRunning).toBe(false);
    });
  });

  describe('checkStatus', () => {
    it('should return LLMStatus object', async () => {
      mockBrowserManager.getAdapter().isWriting.mockResolvedValue(true);
      mockBrowserManager.getAdapter().getTokenCount.mockResolvedValue(1234);

      const status = await poller.checkStatus('chatgpt');

      expect(status).toEqual(
        expect.objectContaining({
          provider: 'chatgpt',
          isWriting: true,
          tokenCount: 1234,
          timestamp: expect.any(String),
        })
      );
    });

    it('should include ISO timestamp', async () => {
      const status = await poller.checkStatus('chatgpt');

      expect(new Date(status.timestamp).toISOString()).toBe(status.timestamp);
    });
  });

  describe('logging', () => {
    it('should log status for each provider', async () => {
      poller.start();
      await vi.advanceTimersByTimeAsync(5000);

      expect(mockLogger.log).toHaveBeenCalledTimes(3); // 3 providers
    });

    it('should log correct status format', async () => {
      mockBrowserManager.getAdapter().isWriting.mockResolvedValue(true);
      mockBrowserManager.getAdapter().getTokenCount.mockResolvedValue(2456);

      poller.start();
      await vi.advanceTimersByTimeAsync(5000);

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          isWriting: true,
          tokenCount: 2456,
        })
      );
    });
  });

  describe('setActiveProviders', () => {
    it('should only poll specified providers', async () => {
      poller.setActiveProviders(['chatgpt', 'claude']);
      poller.start();

      await vi.advanceTimersByTimeAsync(5000);

      const calls = mockBrowserManager.getAdapter.mock.calls.map(c => c[0]);
      expect(calls).toContain('chatgpt');
      expect(calls).toContain('claude');
      expect(calls).not.toContain('gemini');
    });
  });

  describe('onStatusChange callback', () => {
    it('should call callback when status changes', async () => {
      const callback = vi.fn();
      poller.onStatusChange(callback);

      // First poll - not writing
      mockBrowserManager.getAdapter().isWriting.mockResolvedValue(false);
      poller.start();
      await vi.advanceTimersByTimeAsync(5000);

      // Second poll - writing
      mockBrowserManager.getAdapter().isWriting.mockResolvedValue(true);
      await vi.advanceTimersByTimeAsync(5000);

      expect(callback).toHaveBeenCalled();
    });
  });
});
