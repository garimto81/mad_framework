/**
 * Circuit Breaker Tests
 *
 * Issue #45: Circuit Breaker 패턴 고도화
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  CircuitBreaker,
  CircuitBreakerManager,
  circuitBreakerManager,
  type CircuitBreakerEvent,
} from '../../../electron/utils/circuit-breaker';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
    breaker = new CircuitBreaker('chatgpt', {
      failureThreshold: 3,
      resetTimeout: 5000,
      successThreshold: 2,
    });
  });

  afterEach(() => {
    breaker.dispose();
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should start in closed state', () => {
      expect(breaker.getState()).toBe('closed');
    });

    it('should allow requests when closed', () => {
      expect(breaker.canRequest()).toBe(true);
    });

    it('should have initial metrics', () => {
      const metrics = breaker.getMetrics();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successCount).toBe(0);
      expect(metrics.failureCount).toBe(0);
      expect(metrics.successRate).toBe(100);
    });
  });

  describe('success recording', () => {
    it('should record success', () => {
      breaker.recordSuccess();

      const metrics = breaker.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successCount).toBe(1);
      expect(metrics.consecutiveSuccesses).toBe(1);
      expect(metrics.lastSuccessTime).not.toBeNull();
    });

    it('should reset consecutive failures on success', () => {
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordSuccess();

      const metrics = breaker.getMetrics();
      expect(metrics.consecutiveFailures).toBe(0);
      expect(metrics.consecutiveSuccesses).toBe(1);
    });
  });

  describe('failure recording', () => {
    it('should record failure', () => {
      breaker.recordFailure();

      const metrics = breaker.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.failureCount).toBe(1);
      expect(metrics.consecutiveFailures).toBe(1);
      expect(metrics.lastFailureTime).not.toBeNull();
    });

    it('should open circuit after threshold failures', () => {
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      expect(breaker.getState()).toBe('open');
      expect(breaker.canRequest()).toBe(false);
    });
  });

  describe('state transitions', () => {
    it('should transition from open to half-open after timeout', () => {
      // Open the circuit
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState()).toBe('open');

      // Wait for reset timeout
      vi.advanceTimersByTime(5000);

      expect(breaker.getState()).toBe('half-open');
      expect(breaker.canRequest()).toBe(true);
    });

    it('should transition from half-open to closed on success threshold', () => {
      // Open the circuit
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      // Wait for half-open
      vi.advanceTimersByTime(5000);
      expect(breaker.getState()).toBe('half-open');

      // Success threshold is 2
      breaker.recordSuccess();
      expect(breaker.getState()).toBe('half-open');

      breaker.recordSuccess();
      expect(breaker.getState()).toBe('closed');
    });

    it('should transition from half-open to open on failure', () => {
      // Open → half-open
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();
      vi.advanceTimersByTime(5000);
      expect(breaker.getState()).toBe('half-open');

      // Fail during half-open
      breaker.recordFailure();
      expect(breaker.getState()).toBe('open');
    });
  });

  describe('exponential backoff', () => {
    it('should increase reset timeout on repeated failures', () => {
      const callback = vi.fn();
      breaker.onStateChange(callback);

      // First open
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState()).toBe('open');

      // Wait and fail again
      vi.advanceTimersByTime(5000);
      expect(breaker.getState()).toBe('half-open');
      breaker.recordFailure();
      expect(breaker.getState()).toBe('open');

      // Next reset should take longer (5000 * 2 = 10000)
      vi.advanceTimersByTime(5000);
      expect(breaker.getState()).toBe('open'); // Still open

      vi.advanceTimersByTime(5000);
      expect(breaker.getState()).toBe('half-open'); // Now half-open
    });
  });

  describe('event callbacks', () => {
    it('should emit events on state change', () => {
      const callback = vi.fn();
      breaker.onStateChange(callback);

      // Trigger open
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'chatgpt',
          previousState: 'closed',
          newState: 'open',
        })
      );
    });

    it('should allow unsubscribing from events', () => {
      const callback = vi.fn();
      const unsubscribe = breaker.onStateChange(callback);

      unsubscribe();

      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('manual controls', () => {
    it('should allow manual trip', () => {
      breaker.trip('Manual test');
      expect(breaker.getState()).toBe('open');
    });

    it('should allow manual reset', () => {
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState()).toBe('open');

      breaker.reset();
      expect(breaker.getState()).toBe('closed');
    });
  });

  describe('success rate calculation', () => {
    it('should calculate success rate correctly', () => {
      breaker.recordSuccess();
      breaker.recordSuccess();
      breaker.recordFailure();

      const metrics = breaker.getMetrics();
      expect(metrics.successRate).toBe(67); // 2/3 ≈ 67%
    });
  });
});

describe('CircuitBreakerManager', () => {
  let manager: CircuitBreakerManager;

  beforeEach(() => {
    // Get fresh instance (reset if needed)
    manager = CircuitBreakerManager.getInstance({
      failureThreshold: 3,
      resetTimeout: 5000,
    });
    manager.resetAll();
  });

  afterEach(() => {
    manager.dispose();
  });

  describe('getBreaker', () => {
    it('should create breaker for provider', () => {
      const breaker = manager.getBreaker('chatgpt');
      expect(breaker).toBeDefined();
      expect(breaker.provider).toBe('chatgpt');
    });

    it('should return same breaker for same provider', () => {
      const breaker1 = manager.getBreaker('claude');
      const breaker2 = manager.getBreaker('claude');
      expect(breaker1).toBe(breaker2);
    });

    it('should create different breakers for different providers', () => {
      const chatgptBreaker = manager.getBreaker('chatgpt');
      const claudeBreaker = manager.getBreaker('claude');
      expect(chatgptBreaker).not.toBe(claudeBreaker);
    });
  });

  describe('getAllStates', () => {
    it('should return states for all providers', () => {
      manager.getBreaker('chatgpt').recordSuccess();
      manager.getBreaker('claude').recordFailure();

      const states = manager.getAllStates();

      expect(states.chatgpt).toBeDefined();
      expect(states.claude).toBeDefined();
    });
  });

  describe('getSummary', () => {
    it('should return correct summary', () => {
      manager.getBreaker('chatgpt'); // closed
      manager.getBreaker('claude'); // closed

      const summary = manager.getSummary();

      expect(summary.totalProviders).toBe(2);
      expect(summary.closedCount).toBe(2);
      expect(summary.openCount).toBe(0);
      expect(summary.halfOpenCount).toBe(0);
    });
  });

  describe('onAnyStateChange', () => {
    it('should notify on any provider state change', () => {
      const callback = vi.fn();
      manager.onAnyStateChange(callback);

      const breaker = manager.getBreaker('gemini');
      breaker.trip('Test');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'gemini',
          newState: 'open',
        })
      );
    });
  });

  describe('resetAll', () => {
    it('should reset all breakers', () => {
      const chatgpt = manager.getBreaker('chatgpt');
      const claude = manager.getBreaker('claude');

      chatgpt.trip('Test');
      claude.trip('Test');

      expect(chatgpt.getState()).toBe('open');
      expect(claude.getState()).toBe('open');

      manager.resetAll();

      expect(chatgpt.getState()).toBe('closed');
      expect(claude.getState()).toBe('closed');
    });
  });

  describe('resetProvider', () => {
    it('should reset specific provider', () => {
      const chatgpt = manager.getBreaker('chatgpt');
      const claude = manager.getBreaker('claude');

      chatgpt.trip('Test');
      claude.trip('Test');

      manager.resetProvider('chatgpt');

      expect(chatgpt.getState()).toBe('closed');
      expect(claude.getState()).toBe('open');
    });
  });
});

describe('circuitBreakerManager singleton', () => {
  it('should be a singleton', () => {
    const instance1 = CircuitBreakerManager.getInstance();
    const instance2 = CircuitBreakerManager.getInstance();
    expect(instance1).toBe(instance2);
    expect(circuitBreakerManager).toBe(instance1);
  });
});
