/**
 * Debate Store Tests
 *
 * Zustand 토론 상태 관리 테스트
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDebateStore } from '../../../src/stores/debate-store';

// Mock IPC module
vi.mock('../../../src/lib/ipc', () => ({
  ipc: {
    debate: {
      start: vi.fn().mockResolvedValue({ success: true }),
      cancel: vi.fn().mockResolvedValue({ success: true }),
    },
    onDebateProgress: vi.fn(),
    onElementScore: vi.fn(),
    onDebateResponse: vi.fn(),
    onCycleDetected: vi.fn(),
    onDebateComplete: vi.fn(),
    onDebateError: vi.fn(),
  },
}));

describe('useDebateStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useDebateStore.setState({
      session: null,
      isRunning: false,
      currentProgress: null,
      elements: [],
      responses: [],
      error: null,
    });
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useDebateStore.getState();

      expect(state.session).toBeNull();
      expect(state.isRunning).toBe(false);
      expect(state.currentProgress).toBeNull();
      expect(state.elements).toEqual([]);
      expect(state.responses).toEqual([]);
      expect(state.error).toBeNull();
    });
  });

  describe('startDebate', () => {
    it('should start debate and create session', async () => {
      const config = {
        topic: 'Test topic',
        preset: 'technical',
        participants: ['chatgpt', 'claude'] as const,
        judgeProvider: 'gemini' as const,
        completionThreshold: 90,
        maxIterations: 10,
      };

      await useDebateStore.getState().startDebate(config);

      const state = useDebateStore.getState();
      expect(state.isRunning).toBe(true);
      expect(state.session).not.toBeNull();
      expect(state.session?.config).toEqual(config);
      expect(state.session?.status).toBe('running');
      expect(state.error).toBeNull();
    });

    it('should handle start error', async () => {
      const { ipc } = await import('../../../src/lib/ipc');
      vi.mocked(ipc.debate.start).mockRejectedValueOnce(new Error('Start failed'));

      await useDebateStore.getState().startDebate({
        topic: 'Test',
        preset: 'technical',
        participants: ['chatgpt'],
        judgeProvider: 'claude',
        completionThreshold: 90,
        maxIterations: 10,
      });

      const state = useDebateStore.getState();
      expect(state.isRunning).toBe(false);
      expect(state.error).toContain('Start failed');
    });
  });

  describe('cancelDebate', () => {
    it('should cancel running debate', async () => {
      // Start a debate first
      useDebateStore.setState({
        session: {
          id: 'test-session',
          config: {
            topic: 'Test',
            preset: 'technical',
            participants: ['chatgpt'],
            judgeProvider: 'claude',
            completionThreshold: 90,
            maxIterations: 10,
          },
          status: 'running',
          currentIteration: 0,
          elements: [],
          createdAt: new Date().toISOString(),
        },
        isRunning: true,
      });

      await useDebateStore.getState().cancelDebate();

      const state = useDebateStore.getState();
      expect(state.isRunning).toBe(false);
      expect(state.session?.status).toBe('cancelled');
    });

    it('should do nothing if no session exists', async () => {
      await useDebateStore.getState().cancelDebate();

      const state = useDebateStore.getState();
      expect(state.session).toBeNull();
    });
  });

  describe('resetDebate', () => {
    it('should reset all state', () => {
      // Set some state
      useDebateStore.setState({
        session: {
          id: 'test',
          config: {} as any,
          status: 'completed',
          currentIteration: 5,
          elements: [],
          createdAt: '',
        },
        isRunning: false,
        currentProgress: { iteration: 5, totalIterations: 10, phase: 'judging' },
        elements: [{ id: '1', name: 'Test', status: 'completed', currentScore: 90, scoreHistory: [], versionHistory: [] }],
        responses: [{ provider: 'chatgpt', content: 'test', timestamp: '' }],
        error: 'Some error',
      });

      useDebateStore.getState().resetDebate();

      const state = useDebateStore.getState();
      expect(state.session).toBeNull();
      expect(state.isRunning).toBe(false);
      expect(state.currentProgress).toBeNull();
      expect(state.elements).toEqual([]);
      expect(state.responses).toEqual([]);
      expect(state.error).toBeNull();
    });
  });

  describe('handleProgress', () => {
    it('should update progress and session iteration', () => {
      useDebateStore.setState({
        session: {
          id: 'test',
          config: {} as any,
          status: 'running',
          currentIteration: 0,
          elements: [],
          createdAt: '',
        },
      });

      const progress = {
        iteration: 3,
        totalIterations: 10,
        phase: 'debating' as const,
      };

      useDebateStore.getState().handleProgress(progress);

      const state = useDebateStore.getState();
      expect(state.currentProgress).toEqual(progress);
      expect(state.session?.currentIteration).toBe(3);
    });

    it('should handle progress without session', () => {
      useDebateStore.getState().handleProgress({
        iteration: 1,
        totalIterations: 10,
        phase: 'debating',
      });

      const state = useDebateStore.getState();
      expect(state.currentProgress).not.toBeNull();
      expect(state.session).toBeNull();
    });
  });

  describe('handleElementScore', () => {
    it('should add new element', () => {
      useDebateStore.getState().handleElementScore({
        elementId: 'elem-1',
        elementName: 'Element 1',
        score: 75,
        iteration: 1,
      });

      const state = useDebateStore.getState();
      expect(state.elements).toHaveLength(1);
      expect(state.elements[0]).toEqual({
        id: 'elem-1',
        name: 'Element 1',
        status: 'in_progress',
        currentScore: 75,
        scoreHistory: [75],
        versionHistory: [],
      });
    });

    it('should update existing element score', () => {
      useDebateStore.setState({
        elements: [{
          id: 'elem-1',
          name: 'Element 1',
          status: 'in_progress',
          currentScore: 70,
          scoreHistory: [70],
          versionHistory: [],
        }],
      });

      useDebateStore.getState().handleElementScore({
        elementId: 'elem-1',
        elementName: 'Element 1',
        score: 80,
        iteration: 2,
      });

      const state = useDebateStore.getState();
      expect(state.elements[0].currentScore).toBe(80);
      expect(state.elements[0].scoreHistory).toEqual([70, 80]);
    });
  });

  describe('handleResponse', () => {
    it('should add response to list', () => {
      const response = {
        provider: 'chatgpt' as const,
        content: 'Test response',
        timestamp: new Date().toISOString(),
      };

      useDebateStore.getState().handleResponse(response);

      const state = useDebateStore.getState();
      expect(state.responses).toHaveLength(1);
      expect(state.responses[0]).toEqual(response);
    });

    it('should accumulate responses', () => {
      useDebateStore.getState().handleResponse({
        provider: 'chatgpt',
        content: 'Response 1',
        timestamp: '',
      });
      useDebateStore.getState().handleResponse({
        provider: 'claude',
        content: 'Response 2',
        timestamp: '',
      });

      const state = useDebateStore.getState();
      expect(state.responses).toHaveLength(2);
    });
  });

  describe('handleCycleDetected', () => {
    it('should mark element as cycle_detected', () => {
      useDebateStore.setState({
        elements: [
          { id: 'elem-1', name: 'Element 1', status: 'in_progress', currentScore: 70, scoreHistory: [], versionHistory: [] },
          { id: 'elem-2', name: 'Element 2', status: 'in_progress', currentScore: 75, scoreHistory: [], versionHistory: [] },
        ],
      });

      useDebateStore.getState().handleCycleDetected({
        elementId: 'elem-1',
        elementName: 'Element 1',
      });

      const state = useDebateStore.getState();
      expect(state.elements[0].status).toBe('cycle_detected');
      expect(state.elements[0].completionReason).toBe('cycle');
      expect(state.elements[1].status).toBe('in_progress');
    });
  });

  describe('handleComplete', () => {
    it('should update session to completed', () => {
      useDebateStore.setState({
        session: {
          id: 'test',
          config: {} as any,
          status: 'running',
          currentIteration: 5,
          elements: [],
          createdAt: '',
        },
        isRunning: true,
      });

      const completedAt = new Date().toISOString();
      useDebateStore.getState().handleComplete({
        sessionId: 'test',
        completedAt,
        elements: [],
        totalIterations: 5,
      });

      const state = useDebateStore.getState();
      expect(state.isRunning).toBe(false);
      expect(state.session?.status).toBe('completed');
      expect(state.session?.completedAt).toBe(completedAt);
    });
  });

  describe('handleError', () => {
    it('should set error and stop running', () => {
      useDebateStore.setState({ isRunning: true });

      useDebateStore.getState().handleError({ error: 'Something went wrong' });

      const state = useDebateStore.getState();
      expect(state.error).toBe('Something went wrong');
      expect(state.isRunning).toBe(false);
    });
  });
});
