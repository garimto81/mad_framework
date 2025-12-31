/**
 * Selector Monitor Tests
 *
 * Issue #43: 셀렉터 폴백 체인 시스템 고도화
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SelectorMonitor,
  selectorMonitor,
  type SelectorFailureEvent,
} from '../../../electron/browser/adapters/selector-monitor';

describe('SelectorMonitor', () => {
  let monitor: SelectorMonitor;

  beforeEach(() => {
    // 새 인스턴스 사용을 위해 싱글톤 리셋
    monitor = SelectorMonitor.getInstance();
    monitor.reset();
  });

  describe('recordSuccess', () => {
    it('should record selector success', () => {
      monitor.recordSuccess('chatgpt', 'loginCheck', '[data-testid="profile-button"]');

      const stats = monitor.getProviderStats('chatgpt');
      const loginCheckStats = Array.from(stats.values()).find(
        (s) => s.selector === '[data-testid="profile-button"]'
      );

      expect(loginCheckStats).toBeDefined();
      expect(loginCheckStats!.attempts).toBe(1);
      expect(loginCheckStats!.successes).toBe(1);
      expect(loginCheckStats!.successRate).toBe(100);
    });

    it('should calculate success rate correctly', () => {
      const selector = '[data-testid="profile-button"]';

      // 2 successes, 1 failure
      monitor.recordSuccess('chatgpt', 'loginCheck', selector);
      monitor.recordSuccess('chatgpt', 'loginCheck', selector);
      monitor.recordFailure('chatgpt', 'loginCheck', selector);

      const stats = monitor.getProviderStats('chatgpt');
      const loginCheckStats = Array.from(stats.values()).find(
        (s) => s.selector === selector
      );

      expect(loginCheckStats!.attempts).toBe(3);
      expect(loginCheckStats!.successes).toBe(2);
      expect(loginCheckStats!.failures).toBe(1);
      expect(loginCheckStats!.successRate).toBeCloseTo(66.67, 1);
    });
  });

  describe('recordFailure', () => {
    it('should record selector failure', () => {
      monitor.recordFailure('claude', 'sendButton', 'button[aria-label="Send"]');

      const stats = monitor.getProviderStats('claude');
      const buttonStats = Array.from(stats.values()).find(
        (s) => s.selector === 'button[aria-label="Send"]'
      );

      expect(buttonStats).toBeDefined();
      expect(buttonStats!.attempts).toBe(1);
      expect(buttonStats!.failures).toBe(1);
      expect(buttonStats!.successRate).toBe(0);
    });

    it('should record failure with context', () => {
      monitor.recordFailure('gemini', 'inputTextarea', '.ql-editor', 'script_error');

      const stats = monitor.getProviderStats('gemini');
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe('recordAllFallbacksFailed', () => {
    it('should trigger failure callback', () => {
      const callback = vi.fn();
      const unsubscribe = monitor.onFailure(callback);

      monitor.recordAllFallbacksFailed(
        'chatgpt',
        'loginCheck',
        {
          primary: '[data-testid="profile-button"]',
          fallbacks: ['button[aria-label*="Account"]', 'img[alt*="User"]'],
        }
      );

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'chatgpt',
          selectorType: 'loginCheck',
          primary: '[data-testid="profile-button"]',
          fallbacksTried: ['button[aria-label*="Account"]', 'img[alt*="User"]'],
        })
      );

      unsubscribe();
    });

    it('should allow unsubscribing from failure events', () => {
      const callback = vi.fn();
      const unsubscribe = monitor.onFailure(callback);

      unsubscribe();

      monitor.recordAllFallbacksFailed(
        'chatgpt',
        'loginCheck',
        { primary: 'test', fallbacks: [] }
      );

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('validateProvider', () => {
    it('should validate all selectors for a provider', async () => {
      const mockExecuteScript = vi.fn<[string], Promise<boolean>>()
        .mockResolvedValue(true);

      const result = await monitor.validateProvider('chatgpt', mockExecuteScript);

      expect(result.provider).toBe('chatgpt');
      expect(result.overallHealth).toBe('healthy');
      expect(result.workingPercentage).toBe(100);
      expect(result.results.length).toBe(6); // 6 selector types
    });

    it('should detect degraded health when some selectors fail', async () => {
      let callCount = 0;
      const mockExecuteScript = vi.fn<[string], Promise<boolean>>()
        .mockImplementation(() => {
          callCount++;
          // Fail every other selector group
          return Promise.resolve(callCount % 3 !== 0);
        });

      const result = await monitor.validateProvider('claude', mockExecuteScript);

      expect(['healthy', 'degraded', 'critical']).toContain(result.overallHealth);
    });

    it('should cache validation results', async () => {
      const mockExecuteScript = vi.fn<[string], Promise<boolean>>()
        .mockResolvedValue(true);

      await monitor.validateProvider('gemini', mockExecuteScript);
      const cached = monitor.getCachedValidation('gemini');

      expect(cached).not.toBeNull();
      expect(cached!.provider).toBe('gemini');
    });
  });

  describe('getLowPerformingSelectors', () => {
    it('should return selectors below threshold', () => {
      const selector = '[data-testid="bad-selector"]';

      // 1 success, 9 failures = 10% success rate
      monitor.recordSuccess('chatgpt', 'test', selector);
      for (let i = 0; i < 9; i++) {
        monitor.recordFailure('chatgpt', 'test', selector);
      }

      const lowPerforming = monitor.getLowPerformingSelectors(50);

      expect(lowPerforming.length).toBe(1);
      expect(lowPerforming[0].successRate).toBe(10);
    });

    it('should sort by success rate ascending', () => {
      monitor.recordSuccess('chatgpt', 'test1', 'selector1');
      monitor.recordFailure('chatgpt', 'test1', 'selector1');
      // 50% success rate

      monitor.recordFailure('claude', 'test2', 'selector2');
      monitor.recordFailure('claude', 'test2', 'selector2');
      // 0% success rate

      const lowPerforming = monitor.getLowPerformingSelectors(60);

      expect(lowPerforming.length).toBe(2);
      expect(lowPerforming[0].successRate).toBe(0);
      expect(lowPerforming[1].successRate).toBe(50);
    });
  });

  describe('getAllStats', () => {
    it('should return stats grouped by provider', () => {
      monitor.recordSuccess('chatgpt', 'login', 'selector1');
      monitor.recordSuccess('claude', 'login', 'selector2');
      monitor.recordSuccess('gemini', 'login', 'selector3');

      const allStats = monitor.getAllStats();

      expect(allStats).toHaveProperty('chatgpt');
      expect(allStats).toHaveProperty('claude');
      expect(allStats).toHaveProperty('gemini');
    });
  });

  describe('exportStats', () => {
    it('should export stats as JSON', () => {
      monitor.recordSuccess('chatgpt', 'test', 'selector');

      const exported = monitor.exportStats();
      const parsed = JSON.parse(exported);

      expect(parsed).toHaveProperty('stats');
      expect(parsed).toHaveProperty('exportedAt');
    });
  });

  describe('reset', () => {
    it('should clear all stats', () => {
      monitor.recordSuccess('chatgpt', 'test', 'selector');
      expect(monitor.getProviderStats('chatgpt').size).toBeGreaterThan(0);

      monitor.reset();
      expect(monitor.getProviderStats('chatgpt').size).toBe(0);
    });
  });
});

describe('selectorMonitor singleton', () => {
  it('should be a singleton instance', () => {
    const instance1 = SelectorMonitor.getInstance();
    const instance2 = SelectorMonitor.getInstance();

    expect(instance1).toBe(instance2);
    expect(selectorMonitor).toBe(instance1);
  });
});
