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

// Mocks
const createMockBrowserViewManager = () => ({
  createView: vi.fn(),
  getAdapter: vi.fn().mockReturnValue({
    isLoggedIn: vi.fn().mockResolvedValue(true),
    waitForInputReady: vi.fn().mockResolvedValue(undefined),
    inputPrompt: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    waitForResponse: vi.fn().mockResolvedValue(undefined),
    extractResponse: vi.fn().mockResolvedValue('Mock response'),
    isWriting: vi.fn().mockResolvedValue(false),
    getTokenCount: vi.fn().mockResolvedValue(100),
  }),
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
    mockBrowserManager = createMockBrowserViewManager();
    mockRepository = createMockRepository();
    mockCycleDetector = createMockCycleDetector();
    mockEventEmitter = createMockEventEmitter();

    controller = new DebateController(
      mockBrowserManager as any,
      mockRepository as any,
      mockCycleDetector as any,
      mockEventEmitter as any
    );

    vi.clearAllMocks();
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

      // Simulate 3 iterations before completion
      mockRepository.getIncompleteElements
        .mockResolvedValueOnce([element])
        .mockResolvedValueOnce([{ ...element, currentScore: 88 }])
        .mockResolvedValueOnce([{ ...element, currentScore: 92 }])
        .mockResolvedValueOnce([]); // All complete

      await controller.start(defaultConfig);

      // Should have iterated multiple times
      expect(mockRepository.updateIteration.mock.calls.length).toBeGreaterThanOrEqual(3);
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

      mockRepository.getIncompleteElements
        .mockResolvedValueOnce([element])
        .mockResolvedValueOnce([]);

      // Mock response with high score
      mockBrowserManager.getAdapter().extractResponse.mockResolvedValue(
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

      // 4 iterations before complete
      mockRepository.getIncompleteElements
        .mockResolvedValueOnce([element])
        .mockResolvedValueOnce([element])
        .mockResolvedValueOnce([element])
        .mockResolvedValueOnce([element])
        .mockResolvedValueOnce([]);

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
        .mockResolvedValueOnce([element])
        .mockResolvedValueOnce([]);

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

      mockRepository.getIncompleteElements
        .mockResolvedValueOnce([element])
        .mockResolvedValueOnce([]);

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
        .mockResolvedValueOnce([element])
        .mockResolvedValueOnce([]);

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
        .mockResolvedValueOnce([element])
        .mockResolvedValueOnce([]);

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

      // Keep returning incomplete to simulate infinite loop
      mockRepository.getIncompleteElements.mockResolvedValue([element]);

      // Start debate and cancel after short delay
      const debatePromise = controller.start(defaultConfig);

      setTimeout(() => {
        controller.cancel();
      }, 100);

      await debatePromise;

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
});
