/**
 * CycleDetector Tests
 *
 * TDD RED Phase: 순환 감지 테스트
 * - Judge 모델로 마지막 3개 버전 비교
 * - 순환 패턴 감지
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CycleDetector } from '../../../electron/debate/cycle-detector';
import type { ElementVersion, LLMProvider } from '../../../shared/types';

const createMockBrowserManager = () => ({
  getAdapter: vi.fn().mockReturnValue({
    isLoggedIn: vi.fn().mockResolvedValue(true),
    waitForInputReady: vi.fn().mockResolvedValue(undefined),
    inputPrompt: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    waitForResponse: vi.fn().mockResolvedValue(undefined),
    extractResponse: vi.fn().mockResolvedValue(''),
  }),
  getWebContents: vi.fn().mockReturnValue({}),
});

describe('CycleDetector', () => {
  let detector: CycleDetector;
  let mockBrowserManager: ReturnType<typeof createMockBrowserManager>;

  beforeEach(() => {
    mockBrowserManager = createMockBrowserManager();
    detector = new CycleDetector(mockBrowserManager as any);
    vi.clearAllMocks();
  });

  describe('detectCycle', () => {
    it('should return false when less than 3 versions', async () => {
      const versions: ElementVersion[] = [
        { iteration: 1, content: 'V1', score: 80, timestamp: '', provider: 'chatgpt' },
        { iteration: 2, content: 'V2', score: 82, timestamp: '', provider: 'claude' },
      ];

      const result = await detector.detectCycle('gemini', versions);

      expect(result).toBe(false);
    });

    it('should use judge provider to analyze versions', async () => {
      const versions: ElementVersion[] = [
        { iteration: 1, content: 'Version A', score: 80, timestamp: '', provider: 'chatgpt' },
        { iteration: 2, content: 'Version B', score: 82, timestamp: '', provider: 'claude' },
        { iteration: 3, content: 'Version A similar', score: 81, timestamp: '', provider: 'chatgpt' },
      ];

      await detector.detectCycle('gemini', versions);

      expect(mockBrowserManager.getAdapter).toHaveBeenCalledWith('gemini');
    });

    it('should send prompt with 3 versions to judge', async () => {
      const versions: ElementVersion[] = [
        { iteration: 1, content: 'Code v1', score: 80, timestamp: '', provider: 'chatgpt' },
        { iteration: 2, content: 'Code v2', score: 85, timestamp: '', provider: 'claude' },
        { iteration: 3, content: 'Code v1 again', score: 80, timestamp: '', provider: 'chatgpt' },
      ];

      await detector.detectCycle('gemini', versions);

      const adapter = mockBrowserManager.getAdapter('gemini');
      expect(adapter.inputPrompt).toHaveBeenCalled();

      const prompt = adapter.inputPrompt.mock.calls[0][0];
      expect(prompt).toContain('Version 1');
      expect(prompt).toContain('Version 2');
      expect(prompt).toContain('Version 3');
      expect(prompt).toContain('Code v1');
      expect(prompt).toContain('Code v2');
    });

    it('should return true when judge detects cycle', async () => {
      const versions: ElementVersion[] = [
        { iteration: 1, content: 'V1', score: 80, timestamp: '', provider: 'chatgpt' },
        { iteration: 2, content: 'V2', score: 82, timestamp: '', provider: 'claude' },
        { iteration: 3, content: 'V1', score: 80, timestamp: '', provider: 'chatgpt' },
      ];

      mockBrowserManager.getAdapter().extractResponse.mockResolvedValue(
        JSON.stringify({ isCycle: true, reason: 'V1 and V3 are identical' })
      );

      const result = await detector.detectCycle('gemini', versions);

      expect(result).toBe(true);
    });

    it('should return false when judge detects no cycle', async () => {
      const versions: ElementVersion[] = [
        { iteration: 1, content: 'V1', score: 80, timestamp: '', provider: 'chatgpt' },
        { iteration: 2, content: 'V2', score: 85, timestamp: '', provider: 'claude' },
        { iteration: 3, content: 'V3', score: 88, timestamp: '', provider: 'chatgpt' },
      ];

      mockBrowserManager.getAdapter().extractResponse.mockResolvedValue(
        JSON.stringify({ isCycle: false, reason: 'Progressive improvement detected' })
      );

      const result = await detector.detectCycle('gemini', versions);

      expect(result).toBe(false);
    });

    it('should handle judge response timeout gracefully', async () => {
      const versions: ElementVersion[] = [
        { iteration: 1, content: 'V1', score: 80, timestamp: '', provider: 'chatgpt' },
        { iteration: 2, content: 'V2', score: 82, timestamp: '', provider: 'claude' },
        { iteration: 3, content: 'V3', score: 84, timestamp: '', provider: 'chatgpt' },
      ];

      mockBrowserManager.getAdapter().waitForResponse.mockRejectedValue(
        new Error('Response timeout')
      );

      // Should not throw, should return false (assume no cycle on error)
      const result = await detector.detectCycle('gemini', versions);

      expect(result).toBe(false);
    });

    it('should handle malformed judge response', async () => {
      const versions: ElementVersion[] = [
        { iteration: 1, content: 'V1', score: 80, timestamp: '', provider: 'chatgpt' },
        { iteration: 2, content: 'V2', score: 82, timestamp: '', provider: 'claude' },
        { iteration: 3, content: 'V3', score: 84, timestamp: '', provider: 'chatgpt' },
      ];

      mockBrowserManager.getAdapter().extractResponse.mockResolvedValue(
        'Invalid JSON response'
      );

      const result = await detector.detectCycle('gemini', versions);

      expect(result).toBe(false);
    });
  });

  describe('buildCycleDetectionPrompt', () => {
    it('should build clear prompt for judge', () => {
      const versions: ElementVersion[] = [
        { iteration: 1, content: 'First version', score: 80, timestamp: '', provider: 'chatgpt' },
        { iteration: 2, content: 'Second version', score: 85, timestamp: '', provider: 'claude' },
        { iteration: 3, content: 'Third version', score: 82, timestamp: '', provider: 'chatgpt' },
      ];

      const prompt = detector.buildCycleDetectionPrompt(versions);

      expect(prompt).toContain('순환');
      expect(prompt).toContain('Version 1');
      expect(prompt).toContain('First version');
      expect(prompt).toContain('JSON');
      expect(prompt).toContain('isCycle');
    });
  });

  describe('parseCycleResponse', () => {
    it('should parse valid JSON response', () => {
      const response = '{"isCycle": true, "reason": "Versions are repeating"}';

      const result = detector.parseCycleResponse(response);

      expect(result).toEqual({
        isCycle: true,
        reason: 'Versions are repeating',
      });
    });

    it('should extract JSON from markdown code block', () => {
      const response = `Here's my analysis:
\`\`\`json
{"isCycle": false, "reason": "No cycle detected"}
\`\`\`
`;

      const result = detector.parseCycleResponse(response);

      expect(result).toEqual({
        isCycle: false,
        reason: 'No cycle detected',
      });
    });

    it('should return default on invalid JSON', () => {
      const response = 'Not a JSON response';

      const result = detector.parseCycleResponse(response);

      expect(result).toEqual({
        isCycle: false,
        reason: 'Parse error',
      });
    });
  });
});
