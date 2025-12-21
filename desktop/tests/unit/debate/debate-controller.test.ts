/**
 * Debate Controller Tests
 *
 * TDD RED Phase: 토론 컨트롤러 테스트
 * - 무한 반복 토론
 * - 요소별 점수 (90점 이상 완성)
 * - Judge 모델 순환 감지
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DebateController } from '../../../electron/debate/debate-controller';
import type {
  DebateConfig,
  DebateSession,
  DebateElement,
  LLMProvider,
} from '../../../shared/types';

// Default valid JSON response for tests
const VALID_JSON_RESPONSE = JSON.stringify({
  elements: [
    { name: '보안', score: 85, critique: 'Good security practices' },
    { name: '성능', score: 80, critique: 'Performance is acceptable' },
    { name: '가독성', score: 82, critique: 'Code is readable' },
    { name: '유지보수성', score: 78, critique: 'Maintainability could improve' },
  ],
});

// Mocks
const createMockAdapter = () => ({
  isLoggedIn: vi.fn().mockResolvedValue(true),
  waitForInputReady: vi.fn().mockResolvedValue(undefined),
  inputPrompt: vi.fn().mockResolvedValue(undefined),
  sendMessage: vi.fn().mockResolvedValue(undefined),
  waitForResponse: vi.fn().mockResolvedValue(undefined),
  extractResponse: vi.fn().mockResolvedValue(VALID_JSON_RESPONSE),
  isWriting: vi.fn().mockResolvedValue(false),
  getTokenCount: vi.fn().mockResolvedValue(100),
});

const createMockBrowserViewManager = (mockAdapter: ReturnType<typeof createMockAdapter>) => ({
  createView: vi.fn(),
  getAdapter: vi.fn().mockReturnValue(mockAdapter),
  checkLoginStatus: vi.fn().mockResolvedValue({
    chatgpt: { isLoggedIn: true },
    claude: { isLoggedIn: true },
    gemini: { isLoggedIn: true },
  }),
});

const createMockRepository = () => ({
  create: vi.fn().mockResolvedValue('debate-123'),
  createElements: vi.fn().mockResolvedValue(undefined),
  updateElementScore: vi.fn().mockResolvedValue(undefined),
  markElementComplete: vi.fn().mockResolvedValue(undefined),
  getLast3Versions: vi.fn().mockResolvedValue([]),
  getIncompleteElements: vi.fn().mockResolvedValue([]),
  updateIteration: vi.fn().mockResolvedValue(undefined),
  updateStatus: vi.fn().mockResolvedValue(undefined),
});

const createMockCycleDetector = () => ({
  detectCycle: vi.fn().mockResolvedValue(false),
});

const createMockEventEmitter = () => ({
  emit: vi.fn(),
  on: vi.fn(),
});

describe('DebateController', () => {
  let controller: DebateController;
  let mockAdapter: ReturnType<typeof createMockAdapter>;
  let mockBrowserManager: ReturnType<typeof createMockBrowserViewManager>;
  let mockRepository: ReturnType<typeof createMockRepository>;
  let mockCycleDetector: ReturnType<typeof createMockCycleDetector>;
  let mockEventEmitter: ReturnType<typeof createMockEventEmitter>;

  const defaultConfig: DebateConfig = {
    topic: 'Test debate topic',
    context: 'Test context',
    preset: 'code_review',
    participants: ['chatgpt', 'claude'],
    judgeProvider: 'gemini',
    completionThreshold: 90,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockAdapter = createMockAdapter();
    mockBrowserManager = createMockBrowserViewManager(mockAdapter);
    mockRepository = createMockRepository();
    mockCycleDetector = createMockCycleDetector();
    mockEventEmitter = createMockEventEmitter();

    controller = new DebateController(
      mockBrowserManager as any,
      mockRepository as any,
      mockCycleDetector as any,
      mockEventEmitter as any
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('start', () => {
    it('should create debate session in repository', async () => {
      // Set up quick completion
      mockRepository.getIncompleteElements.mockResolvedValue([]);

      await controller.start(defaultConfig);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: defaultConfig.topic,
          preset: defaultConfig.preset,
        })
      );
    });

    it('should create elements based on preset', async () => {
      mockRepository.getIncompleteElements.mockResolvedValue([]);

      await controller.start(defaultConfig);

      expect(mockRepository.createElements).toHaveBeenCalled();
    });

    it('should check login status before starting', async () => {
      mockRepository.getIncompleteElements.mockResolvedValue([]);

      await controller.start(defaultConfig);

      expect(mockBrowserManager.checkLoginStatus).toHaveBeenCalled();
    });

    it('should throw error if any participant is not logged in', async () => {
      mockBrowserManager.checkLoginStatus.mockResolvedValue({
        chatgpt: { isLoggedIn: false },
        claude: { isLoggedIn: true },
        gemini: { isLoggedIn: true },
      });

      await expect(controller.start(defaultConfig)).rejects.toThrow('Not logged in');
    });

    it('should emit progress events during debate', async () => {
      const incompleteElement: DebateElement = {
        id: 'elem-1',
        name: '보안',
        status: 'pending',
        currentScore: 0,
        scoreHistory: [],
        versionHistory: [],
      };

      // First call returns incomplete, second call returns empty (complete)
      mockRepository.getIncompleteElements
        .mockResolvedValueOnce([incompleteElement])
        .mockResolvedValueOnce([]);

      await controller.start(defaultConfig);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'debate:progress',
        expect.objectContaining({
          iteration: expect.any(Number),
          currentProvider: expect.any(String),
        })
      );
    });
  });

  describe('infinite loop with element scoring', () => {
    it('should continue until all elements are complete', async () => {
      const element: DebateElement = {
        id: 'elem-1',
        name: '보안',
        status: 'pending',
        currentScore: 85,
        scoreHistory: [85],
        versionHistory: [],
      };

      // Each iteration calls getIncompleteElements 3 times:
      // 1. executeIteration (prompt building)
      // 2. main loop (check after execute)
      // 3. main loop (re-check after cycle detection)
      // Simulate 2 iterations before completion
      mockRepository.getIncompleteElements
        // Iteration 1
        .mockResolvedValueOnce([element])  // executeIteration
        .mockResolvedValueOnce([element])  // main loop check
        .mockResolvedValueOnce([{ ...element, currentScore: 88 }])  // re-check
        // Iteration 2
        .mockResolvedValueOnce([{ ...element, currentScore: 88 }])  // executeIteration
        .mockResolvedValueOnce([{ ...element, currentScore: 92 }])  // main loop check
        .mockResolvedValueOnce([]);  // re-check -> all complete

      await controller.start(defaultConfig);

      // Should have iterated at least 2 times
      expect(mockRepository.updateIteration.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should mark element complete when score reaches threshold (90)', async () => {
      const element: DebateElement = {
        id: 'elem-1',
        name: '보안',
        status: 'pending',
        currentScore: 92,
        scoreHistory: [],
        versionHistory: [],
      };

      // Mock calls order:
      // 1. L107 main loop (progress) - return element
      // 2. L213 executeIteration (prompt building) - return element
      // 3. L145 main loop (re-check) - return empty (complete)
      mockRepository.getIncompleteElements
        .mockResolvedValueOnce([element])  // L107 - progress
        .mockResolvedValueOnce([element])  // L213 - prompt building
        .mockResolvedValueOnce([]);        // L145 - complete

      // Mock response with high score
      mockAdapter.extractResponse.mockResolvedValue(
        JSON.stringify({
          elements: [{ name: '보안', score: 92, critique: 'Good' }],
        })
      );

      await controller.start(defaultConfig);

      expect(mockRepository.markElementComplete).toHaveBeenCalledWith(
        'elem-1',
        'threshold'
      );
    });

    it('should rotate through participants in order', async () => {
      const element: DebateElement = {
        id: 'elem-1',
        name: '보안',
        status: 'pending',
        currentScore: 50,
        scoreHistory: [],
        versionHistory: [],
      };

      // Each iteration calls getIncompleteElements 4 times:
      // L107 (progress), L213 (executeIteration), L145 (re-check), L156 (re-check after cycle)
      // 4 iterations = 16 mock calls, last one returns empty
      mockRepository.getIncompleteElements
        // Iteration 1 (chatgpt)
        .mockResolvedValueOnce([element])  // L107 - progress
        .mockResolvedValueOnce([element])  // L213 - prompt building
        .mockResolvedValueOnce([element])  // L145 - re-check
        .mockResolvedValueOnce([element])  // L156 - re-check after cycle
        // Iteration 2 (claude)
        .mockResolvedValueOnce([element])
        .mockResolvedValueOnce([element])
        .mockResolvedValueOnce([element])
        .mockResolvedValueOnce([element])
        // Iteration 3 (chatgpt)
        .mockResolvedValueOnce([element])
        .mockResolvedValueOnce([element])
        .mockResolvedValueOnce([element])
        .mockResolvedValueOnce([element])
        // Iteration 4 (claude)
        .mockResolvedValueOnce([element])
        .mockResolvedValueOnce([element])
        .mockResolvedValueOnce([]);  // L145 - complete

      await controller.start(defaultConfig);

      const progressCalls = mockEventEmitter.emit.mock.calls.filter(
        ([event]) => event === 'debate:progress'
      );

      // Should rotate: chatgpt, claude, chatgpt, claude
      expect(progressCalls[0][1].currentProvider).toBe('chatgpt');
      expect(progressCalls[1][1].currentProvider).toBe('claude');
      expect(progressCalls[2][1].currentProvider).toBe('chatgpt');
      expect(progressCalls[3][1].currentProvider).toBe('claude');
    });

    it('should store version history for each element iteration', async () => {
      const element: DebateElement = {
        id: 'elem-1',
        name: '보안',
        status: 'pending',
        currentScore: 70,
        scoreHistory: [],
        versionHistory: [],
      };

      mockRepository.getIncompleteElements
        .mockResolvedValueOnce([element])  // L107 - progress
        .mockResolvedValueOnce([element])  // L213 - prompt building
        .mockResolvedValueOnce([]);        // L145 - complete

      await controller.start(defaultConfig);

      expect(mockRepository.updateElementScore).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.any(Number),
        expect.any(String),
        expect.any(String)
      );
    });
  });

  describe('cycle detection', () => {
    it('should invoke judge model when element has 3+ versions', async () => {
      const element: DebateElement = {
        id: 'elem-1',
        name: '보안',
        status: 'pending',
        currentScore: 85,
        scoreHistory: [80, 82, 85],
        versionHistory: [
          { iteration: 1, content: 'V1', score: 80, timestamp: '', provider: 'chatgpt' },
          { iteration: 2, content: 'V2', score: 82, timestamp: '', provider: 'claude' },
          { iteration: 3, content: 'V1', score: 85, timestamp: '', provider: 'chatgpt' },
        ],
      };

      // Flow: L107 (progress), L213 (executeIteration), L145 (re-check), L156 (re-check after cycle)
      mockRepository.getIncompleteElements
        .mockResolvedValueOnce([element])  // L107 - progress
        .mockResolvedValueOnce([element])  // L213 - prompt building
        .mockResolvedValueOnce([element])  // L145 - re-check (needs to be non-empty for cycle detection)
        .mockResolvedValueOnce([]);        // L156 - re-check after cycle detection

      mockRepository.getLast3Versions.mockResolvedValue(element.versionHistory);

      await controller.start(defaultConfig);

      expect(mockCycleDetector.detectCycle).toHaveBeenCalledWith(
        'gemini',
        expect.any(Array)
      );
    });

    it('should mark element complete with cycle reason when cycle detected', async () => {
      const element: DebateElement = {
        id: 'elem-1',
        name: '보안',
        status: 'pending',
        currentScore: 85,
        scoreHistory: [80, 82, 85],
        versionHistory: [
          { iteration: 1, content: 'V1', score: 80, timestamp: '', provider: 'chatgpt' },
          { iteration: 2, content: 'V2', score: 82, timestamp: '', provider: 'claude' },
          { iteration: 3, content: 'V1', score: 80, timestamp: '', provider: 'chatgpt' },
        ],
      };

      mockRepository.getIncompleteElements
        .mockResolvedValueOnce([element])  // L107 - progress
        .mockResolvedValueOnce([element])  // L213 - prompt building
        .mockResolvedValueOnce([element])  // L145 - re-check
        .mockResolvedValueOnce([]);        // L156 - re-check after cycle detection

      mockRepository.getLast3Versions.mockResolvedValue(element.versionHistory);
      mockCycleDetector.detectCycle.mockResolvedValue(true);

      await controller.start(defaultConfig);

      expect(mockRepository.markElementComplete).toHaveBeenCalledWith(
        'elem-1',
        'cycle'
      );
    });

    it('should emit cycle-detected event', async () => {
      const element: DebateElement = {
        id: 'elem-1',
        name: '보안',
        status: 'pending',
        currentScore: 85,
        scoreHistory: [80, 82, 85],
        versionHistory: [
          { iteration: 1, content: 'V1', score: 80, timestamp: '', provider: 'chatgpt' },
          { iteration: 2, content: 'V2', score: 82, timestamp: '', provider: 'claude' },
          { iteration: 3, content: 'V1', score: 80, timestamp: '', provider: 'chatgpt' },
        ],
      };

      mockRepository.getIncompleteElements
        .mockResolvedValueOnce([element])  // L107 - progress
        .mockResolvedValueOnce([element])  // L213 - prompt building
        .mockResolvedValueOnce([element])  // L145 - re-check
        .mockResolvedValueOnce([]);        // L156 - re-check after cycle detection

      mockRepository.getLast3Versions.mockResolvedValue(element.versionHistory);
      mockCycleDetector.detectCycle.mockResolvedValue(true);

      await controller.start(defaultConfig);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'debate:cycle-detected',
        expect.objectContaining({
          elementId: 'elem-1',
        })
      );
    });
  });

  describe('cancel', () => {
    it('should stop the debate loop', async () => {
      const element: DebateElement = {
        id: 'elem-1',
        name: '보안',
        status: 'pending',
        currentScore: 50,
        scoreHistory: [],
        versionHistory: [],
      };

      // Track call count and cancel on second call
      let callCount = 0;
      mockRepository.getIncompleteElements.mockImplementation(async () => {
        callCount++;
        // Cancel after first iteration completes (getIncompleteElements called twice per iteration)
        if (callCount === 2) {
          controller.cancel();
        }
        return [element];
      });

      await controller.start(defaultConfig);

      expect(mockRepository.updateStatus).toHaveBeenCalledWith(
        expect.any(String),
        'cancelled'
      );
    });
  });

  describe('completion', () => {
    it('should emit complete event with final result', async () => {
      mockRepository.getIncompleteElements.mockResolvedValue([]);

      await controller.start(defaultConfig);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'debate:complete',
        expect.objectContaining({
          sessionId: 'debate-123',
        })
      );
    });

    it('should update debate status to completed', async () => {
      mockRepository.getIncompleteElements.mockResolvedValue([]);

      await controller.start(defaultConfig);

      expect(mockRepository.updateStatus).toHaveBeenCalledWith(
        'debate-123',
        'completed'
      );
    });
  });

  describe('error scenarios (Issue #19)', () => {
    it('should handle empty response from extractResponse', async () => {
      const element: DebateElement = {
        id: 'elem-1',
        name: '보안',
        status: 'pending',
        currentScore: 50,
        scoreHistory: [],
        versionHistory: [],
      };

      // Return empty response
      mockAdapter.extractResponse.mockResolvedValue('');

      // After 3 empty responses, circuit breaker should trigger
      mockRepository.getIncompleteElements.mockResolvedValue([element]);

      await controller.start(defaultConfig);

      // Should emit error event for empty responses
      const errorCalls = mockEventEmitter.emit.mock.calls.filter(
        ([event]) => event === 'debate:error'
      );
      expect(errorCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('should stop after MAX_CONSECUTIVE_EMPTY_RESPONSES (3)', async () => {
      const element: DebateElement = {
        id: 'elem-1',
        name: '보안',
        status: 'pending',
        currentScore: 50,
        scoreHistory: [],
        versionHistory: [],
      };

      // Return empty response every time
      mockAdapter.extractResponse.mockResolvedValue('');
      mockRepository.getIncompleteElements.mockResolvedValue([element]);

      await controller.start(defaultConfig);

      // Should stop after 3 consecutive empty responses
      expect(mockRepository.updateStatus).toHaveBeenCalledWith(
        expect.any(String),
        'error'
      );
    });

    it('should emit error event when inputPrompt fails', async () => {
      const element: DebateElement = {
        id: 'elem-1',
        name: '보안',
        status: 'pending',
        currentScore: 50,
        scoreHistory: [],
        versionHistory: [],
      };

      mockAdapter.inputPrompt.mockRejectedValue(
        new Error('Input failed: textarea not found')
      );
      mockRepository.getIncompleteElements.mockResolvedValue([element]);

      await controller.start(defaultConfig);

      // Should emit error event
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'debate:error',
        expect.objectContaining({
          error: expect.stringContaining('Input failed'),
        })
      );
    });

    it('should emit error event when sendMessage fails', async () => {
      const element: DebateElement = {
        id: 'elem-1',
        name: '보안',
        status: 'pending',
        currentScore: 50,
        scoreHistory: [],
        versionHistory: [],
      };

      mockAdapter.sendMessage.mockRejectedValue(
        new Error('Send failed: button disabled')
      );
      mockRepository.getIncompleteElements.mockResolvedValue([element]);

      await controller.start(defaultConfig);

      // Should emit error event
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'debate:error',
        expect.objectContaining({
          error: expect.stringContaining('Send failed'),
        })
      );
    });

    it('should emit error event when waitForResponse times out', async () => {
      const element: DebateElement = {
        id: 'elem-1',
        name: '보안',
        status: 'pending',
        currentScore: 50,
        scoreHistory: [],
        versionHistory: [],
      };

      mockAdapter.waitForResponse.mockRejectedValue(
        new Error('Response timeout for chatgpt')
      );
      mockRepository.getIncompleteElements.mockResolvedValue([element]);

      await controller.start(defaultConfig);

      // Should emit error event
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'debate:error',
        expect.objectContaining({
          error: expect.stringContaining('timeout'),
        })
      );
    });

    it('should handle unparseable JSON response', async () => {
      const element: DebateElement = {
        id: 'elem-1',
        name: '보안',
        status: 'pending',
        currentScore: 50,
        scoreHistory: [],
        versionHistory: [],
      };

      // Return invalid JSON
      mockAdapter.extractResponse.mockResolvedValue('Not a valid JSON response');
      mockRepository.getIncompleteElements.mockResolvedValue([element]);

      await controller.start(defaultConfig);

      // Should continue but emit error after consecutive failures
      expect(mockRepository.updateStatus).toHaveBeenCalledWith(
        expect.any(String),
        'error'
      );
    });
  });

  // Issue #33: parseElementScores 로버스트화 테스트
  describe('parseElementScores (Issue #33)', () => {
    it('should parse JSON from ```json code block', async () => {
      const element: DebateElement = {
        id: 'elem-1',
        name: '보안',
        status: 'pending',
        currentScore: 50,
        scoreHistory: [],
        versionHistory: [],
      };

      // Mock calls order:
      // 1. L107 main loop (progress event) - return element
      // 2. L213 executeIteration (prompt building) - return element
      // 3. L145 main loop (re-check after iteration) - return empty (complete)
      mockRepository.getIncompleteElements
        .mockResolvedValueOnce([element])  // L107 - progress
        .mockResolvedValueOnce([element])  // L213 - prompt building
        .mockResolvedValueOnce([]);        // L145 - complete

      const response = '```json\n{"elements": [{"name": "보안", "score": 85, "critique": "Good"}]}\n```';
      mockAdapter.extractResponse.mockResolvedValue(response);

      await controller.start(defaultConfig);

      expect(mockRepository.updateElementScore).toHaveBeenCalledWith(
        'elem-1',
        85,
        expect.any(Number),
        'Good',
        expect.any(String)
      );
    });

    it('should parse JSON from plain ``` code block', async () => {
      const element: DebateElement = {
        id: 'elem-1',
        name: '보안',
        status: 'pending',
        currentScore: 50,
        scoreHistory: [],
        versionHistory: [],
      };

      mockRepository.getIncompleteElements
        .mockResolvedValueOnce([element])  // L107 - progress
        .mockResolvedValueOnce([element])  // L213 - prompt building
        .mockResolvedValueOnce([]);        // L145 - complete

      const response = '```\n{"elements": [{"name": "보안", "score": 80, "critique": "OK"}]}\n```';
      mockAdapter.extractResponse.mockResolvedValue(response);

      await controller.start(defaultConfig);

      expect(mockRepository.updateElementScore).toHaveBeenCalledWith(
        'elem-1',
        80,
        expect.any(Number),
        'OK',
        expect.any(String)
      );
    });

    it('should parse JSON object directly without code block', async () => {
      const element: DebateElement = {
        id: 'elem-1',
        name: '보안',
        status: 'pending',
        currentScore: 50,
        scoreHistory: [],
        versionHistory: [],
      };

      mockRepository.getIncompleteElements
        .mockResolvedValueOnce([element])  // L107 - progress
        .mockResolvedValueOnce([element])  // L213 - prompt building
        .mockResolvedValueOnce([]);        // L145 - complete

      const response = 'Here is my analysis: {"elements": [{"name": "보안", "score": 88, "critique": "Great"}]}';
      mockAdapter.extractResponse.mockResolvedValue(response);

      await controller.start(defaultConfig);

      expect(mockRepository.updateElementScore).toHaveBeenCalledWith(
        'elem-1',
        88,
        expect.any(Number),
        'Great',
        expect.any(String)
      );
    });

    it('should parse array directly without elements wrapper', async () => {
      const element: DebateElement = {
        id: 'elem-1',
        name: '보안',
        status: 'pending',
        currentScore: 50,
        scoreHistory: [],
        versionHistory: [],
      };

      mockRepository.getIncompleteElements
        .mockResolvedValueOnce([element])  // L107 - progress
        .mockResolvedValueOnce([element])  // L213 - prompt building
        .mockResolvedValueOnce([]);        // L145 - complete

      const response = '[{"name": "보안", "score": 82, "critique": "Acceptable"}]';
      mockAdapter.extractResponse.mockResolvedValue(response);

      await controller.start(defaultConfig);

      expect(mockRepository.updateElementScore).toHaveBeenCalledWith(
        'elem-1',
        82,
        expect.any(Number),
        'Acceptable',
        expect.any(String)
      );
    });

    it('should use fallback regex parsing for Korean text format', async () => {
      const element: DebateElement = {
        id: 'elem-1',
        name: '보안',
        status: 'pending',
        currentScore: 50,
        scoreHistory: [],
        versionHistory: [],
      };

      mockRepository.getIncompleteElements
        .mockResolvedValueOnce([element])  // L107 - progress
        .mockResolvedValueOnce([element])  // L213 - prompt building
        .mockResolvedValueOnce([]);        // L145 - complete

      const response = '분석 결과입니다:\n- 보안: 85점\n평가 완료';
      mockAdapter.extractResponse.mockResolvedValue(response);

      await controller.start(defaultConfig);

      expect(mockRepository.updateElementScore).toHaveBeenCalledWith(
        'elem-1',
        85,
        expect.any(Number),
        expect.any(String),
        expect.any(String)
      );
    });

    it('should normalize different element property names (elementName -> name)', async () => {
      const element: DebateElement = {
        id: 'elem-1',
        name: '보안',
        status: 'pending',
        currentScore: 50,
        scoreHistory: [],
        versionHistory: [],
      };

      mockRepository.getIncompleteElements
        .mockResolvedValueOnce([element])  // L107 - progress
        .mockResolvedValueOnce([element])  // L213 - prompt building
        .mockResolvedValueOnce([]);        // L145 - complete

      const response = '{"elements": [{"elementName": "보안", "score": 90, "feedback": "Excellent"}]}';
      mockAdapter.extractResponse.mockResolvedValue(response);

      await controller.start(defaultConfig);

      expect(mockRepository.updateElementScore).toHaveBeenCalledWith(
        'elem-1',
        90,
        expect.any(Number),
        'Excellent',
        expect.any(String)
      );
    });
  });
});
