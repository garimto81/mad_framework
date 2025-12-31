/**
 * Adaptive Timeout Tests
 *
 * Issue #46: 타임아웃 전략 적응형 개선
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AdaptiveTimeoutManager,
  adaptiveTimeoutManager,
  type ProviderProfile,
} from '../../../electron/utils/adaptive-timeout';

describe('AdaptiveTimeoutManager', () => {
  let manager: AdaptiveTimeoutManager;

  beforeEach(() => {
    manager = AdaptiveTimeoutManager.getInstance();
    manager.reset();
  });

  describe('recordResponseTime', () => {
    it('should record response time', () => {
      manager.recordResponseTime('chatgpt', 5000, 100, 500, true);

      const profile = manager.getProfile('chatgpt');
      expect(profile).not.toBeNull();
      expect(profile!.sampleCount).toBe(1);
    });

    it('should accumulate multiple records', () => {
      manager.recordResponseTime('chatgpt', 5000, 100, 500, true);
      manager.recordResponseTime('chatgpt', 6000, 100, 600, true);
      manager.recordResponseTime('chatgpt', 7000, 100, 700, true);

      const profile = manager.getProfile('chatgpt');
      expect(profile!.sampleCount).toBe(3);
    });

    it('should track failures separately', () => {
      manager.recordResponseTime('claude', 5000, 100, 0, true);
      manager.recordResponseTime('claude', 0, 100, 0, false);

      const profile = manager.getProfile('claude');
      expect(profile!.sampleCount).toBe(1); // Only success counts for stats
      expect(profile!.successRate).toBe(50); // 1 success, 1 failure
    });
  });

  describe('getProfile', () => {
    it('should return null for unknown provider', () => {
      const profile = manager.getProfile('gemini');
      expect(profile).toBeNull();
    });

    it('should calculate statistics correctly', () => {
      // Record 5 responses
      manager.recordResponseTime('chatgpt', 4000, 100, 400, true);
      manager.recordResponseTime('chatgpt', 5000, 100, 500, true);
      manager.recordResponseTime('chatgpt', 6000, 100, 600, true);
      manager.recordResponseTime('chatgpt', 7000, 100, 700, true);
      manager.recordResponseTime('chatgpt', 10000, 100, 1000, true);

      const profile = manager.getProfile('chatgpt');

      expect(profile!.sampleCount).toBe(5);
      expect(profile!.minResponseTimeMs).toBe(4000);
      expect(profile!.maxResponseTimeMs).toBe(10000);
      expect(profile!.averageResponseTimeMs).toBe(6400); // (4+5+6+7+10)/5 = 6.4s
      expect(profile!.p50ResponseTimeMs).toBe(6000); // median
    });

    it('should calculate response speed', () => {
      manager.recordResponseTime('chatgpt', 10000, 100, 1000, true); // 100 chars/sec

      const profile = manager.getProfile('chatgpt');

      expect(profile!.averageResponseSpeed).toBe(100); // chars/sec
    });
  });

  describe('predictTimeout', () => {
    it('should return default timeout with no samples', () => {
      const prediction = manager.predictTimeout('chatgpt');

      expect(prediction.recommendedTimeoutMs).toBe(120000); // default
      expect(prediction.confidence).toBe('low');
      expect(prediction.basedOnSamples).toBe(0);
    });

    it('should return default timeout with insufficient samples', () => {
      manager.recordResponseTime('chatgpt', 5000, 100, 500, true);
      manager.recordResponseTime('chatgpt', 6000, 100, 600, true);

      const prediction = manager.predictTimeout('chatgpt');

      expect(prediction.confidence).toBe('low');
      expect(prediction.reason).toContain('샘플 부족');
    });

    it('should calculate adaptive timeout with sufficient samples', () => {
      // Record enough samples
      for (let i = 0; i < 5; i++) {
        manager.recordResponseTime('chatgpt', 5000 + i * 1000, 100, 500, true);
      }

      const prediction = manager.predictTimeout('chatgpt');

      expect(prediction.confidence).not.toBe('low');
      expect(prediction.basedOnSamples).toBe(5);
      expect(prediction.recommendedTimeoutMs).toBeGreaterThan(5000);
    });

    it('should apply safety margin', () => {
      // All responses take exactly 10 seconds
      for (let i = 0; i < 5; i++) {
        manager.recordResponseTime('chatgpt', 10000, 100, 500, true);
      }

      const prediction = manager.predictTimeout('chatgpt');

      // p90 = 10000, margin = 1.5x, so recommended = 15000
      expect(prediction.recommendedTimeoutMs).toBe(15000);
    });

    it('should respect min/max timeout bounds', () => {
      // Very fast responses
      for (let i = 0; i < 5; i++) {
        manager.recordResponseTime('chatgpt', 1000, 100, 500, true);
      }

      const prediction = manager.predictTimeout('chatgpt');

      expect(prediction.recommendedTimeoutMs).toBeGreaterThanOrEqual(5000); // min
    });

    it('should have high confidence with many successful samples', () => {
      for (let i = 0; i < 15; i++) {
        manager.recordResponseTime('chatgpt', 5000, 100, 500, true);
      }

      const prediction = manager.predictTimeout('chatgpt');

      expect(prediction.confidence).toBe('high');
    });
  });

  describe('estimateCompletionTime', () => {
    it('should estimate completion with low confidence when no samples', () => {
      const estimate = manager.estimateCompletionTime('chatgpt', 5000, 200);

      expect(estimate.confidence).toBe('low');
      expect(estimate.progress).toBeGreaterThan(0);
    });

    it('should estimate based on elapsed time', () => {
      for (let i = 0; i < 5; i++) {
        manager.recordResponseTime('chatgpt', 10000, 100, 500, true);
      }

      // 5 seconds elapsed, average is 10 seconds
      const estimate = manager.estimateCompletionTime('chatgpt', 5000, 0);

      expect(estimate.progress).toBeCloseTo(50, -1); // ~50%
      expect(estimate.estimatedRemainingMs).toBeCloseTo(5000, -2); // ~5 seconds
    });
  });

  describe('getAllProfiles', () => {
    it('should return all provider profiles', () => {
      manager.recordResponseTime('chatgpt', 5000, 100, 500, true);
      manager.recordResponseTime('claude', 6000, 100, 600, true);

      const profiles = manager.getAllProfiles();

      expect(profiles.chatgpt).toBeDefined();
      expect(profiles.claude).toBeDefined();
    });
  });

  describe('getSummary', () => {
    it('should return summary statistics', () => {
      manager.recordResponseTime('chatgpt', 5000, 100, 500, true);
      manager.recordResponseTime('claude', 6000, 100, 600, true);

      const summary = manager.getSummary();

      expect(summary.totalRecords).toBe(2);
      expect(summary.providers).toContain('chatgpt');
      expect(summary.providers).toContain('claude');
    });
  });

  describe('reset', () => {
    it('should clear all history', () => {
      manager.recordResponseTime('chatgpt', 5000, 100, 500, true);
      expect(manager.getProfile('chatgpt')).not.toBeNull();

      manager.reset();

      expect(manager.getProfile('chatgpt')).toBeNull();
    });
  });

  describe('resetProvider', () => {
    it('should reset specific provider', () => {
      manager.recordResponseTime('chatgpt', 5000, 100, 500, true);
      manager.recordResponseTime('claude', 6000, 100, 600, true);

      manager.resetProvider('chatgpt');

      expect(manager.getProfile('chatgpt')).toBeNull();
      expect(manager.getProfile('claude')).not.toBeNull();
    });
  });

  describe('export/import', () => {
    it('should export history as JSON', () => {
      manager.recordResponseTime('chatgpt', 5000, 100, 500, true);

      const json = manager.exportHistory();
      const parsed = JSON.parse(json);

      expect(parsed.history.chatgpt).toHaveLength(1);
      expect(parsed.exportedAt).toBeDefined();
    });

    it('should import history from JSON', () => {
      manager.recordResponseTime('chatgpt', 5000, 100, 500, true);
      const json = manager.exportHistory();

      manager.reset();
      expect(manager.getProfile('chatgpt')).toBeNull();

      manager.importHistory(json);
      expect(manager.getProfile('chatgpt')).not.toBeNull();
    });
  });
});

describe('adaptiveTimeoutManager singleton', () => {
  it('should be a singleton', () => {
    const instance1 = AdaptiveTimeoutManager.getInstance();
    const instance2 = AdaptiveTimeoutManager.getInstance();
    expect(instance1).toBe(instance2);
    expect(adaptiveTimeoutManager).toBe(instance1);
  });
});
