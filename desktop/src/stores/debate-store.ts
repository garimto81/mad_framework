/**
 * Debate Store
 *
 * 토론 상태 관리 (Zustand)
 */

import { create } from 'zustand';
import type {
  DebateConfig,
  DebateSession,
  DebateElement,
  DebateProgressExtended,
  DebateResponse,
  DebateResult,
  DebateStateSnapshot,
  DebateStartedEvent,
  DetailedStatus,
  ElementScoreUpdate,
} from '@shared/types';
import { ipc } from '../lib/ipc';

interface DebateState {
  // Current session
  session: DebateSession | null;
  // Issue #34: isRunning은 Controller 상태에서 파생 (캐시)
  isRunning: boolean;

  // Issue #34: Controller 상태 스냅샷 (Single Source of Truth 캐시)
  controllerState: DebateStateSnapshot | null;

  // Progress tracking
  currentProgress: DebateProgressExtended | null;
  currentStatus: DetailedStatus | null;
  elements: DebateElement[];
  responses: DebateResponse[];

  // Error state
  error: string | null;

  // Actions
  startDebate: (config: DebateConfig) => Promise<void>;
  cancelDebate: () => Promise<void>;
  resetDebate: () => void;

  // IPC event handlers
  initializeIPC: () => void;
  handleProgress: (progress: DebateProgressExtended) => void;
  handleStatusUpdate: (status: DetailedStatus) => void;
  handleElementScore: (update: ElementScoreUpdate) => void;
  handleResponse: (response: DebateResponse) => void;
  handleCycleDetected: (data: { elementId: string; elementName: string }) => void;
  handleComplete: (result: DebateResult) => void;
  handleError: (error: { error: string }) => void;
  // Issue #34: 새로운 이벤트 핸들러
  handleStarted: (event: DebateStartedEvent) => void;
  handleStateChanged: (state: DebateStateSnapshot) => void;
}

export const useDebateStore = create<DebateState>((set, get) => ({
  // Initial state
  session: null,
  isRunning: false,
  // Issue #34: Controller 상태 캐시
  controllerState: null,
  currentProgress: null,
  currentStatus: null,
  elements: [],
  responses: [],
  error: null,

  // Actions
  // Issue #34: 임시 세션 생성 제거 - Controller의 debate:started 이벤트에서 세션 정보 수신
  startDebate: async (config: DebateConfig) => {
    set({ error: null });
    // isRunning은 handleStateChanged에서 Controller 상태 기반으로 설정됨

    try {
      const result = await ipc.debate.start(config);

      // IPC 호출은 성공했지만 비즈니스 로직에서 실패한 경우
      if (result && 'success' in result && !result.success) {
        const errorMsg = result.error || 'Debate start failed';
        set({ error: errorMsg, isRunning: false });
        console.error('[DebateStore] startDebate failed:', errorMsg);
        return;
      }

      // 성공 시 세션 정보는 handleStarted에서 설정됨
    } catch (error) {
      // IPC 호출 자체가 실패한 경우
      const errorMsg = error instanceof Error ? error.message : String(error);
      set({ error: errorMsg, isRunning: false });
      console.error('[DebateStore] startDebate error:', error);
    }
  },

  cancelDebate: async () => {
    const { session } = get();
    if (session) {
      await ipc.debate.cancel(session.id);
      set({
        isRunning: false,
        session: session ? { ...session, status: 'cancelled' } : null,
      });
    }
  },

  resetDebate: () => {
    set({
      session: null,
      isRunning: false,
      controllerState: null,
      currentProgress: null,
      currentStatus: null,
      elements: [],
      responses: [],
      error: null,
    });
  },

  // IPC initialization
  initializeIPC: () => {
    const store = get();

    // Subscribe to IPC events
    ipc.onDebateProgress(store.handleProgress);
    ipc.onStatusUpdate(store.handleStatusUpdate);
    ipc.onElementScore(store.handleElementScore);
    ipc.onDebateResponse(store.handleResponse);
    ipc.onCycleDetected(store.handleCycleDetected);
    ipc.onDebateComplete(store.handleComplete);
    ipc.onDebateError(store.handleError);
    // Issue #34: 새로운 이벤트 구독
    ipc.onDebateStarted(store.handleStarted);
    ipc.onDebateStateChanged(store.handleStateChanged);
  },

  // Event handlers
  handleProgress: (progress: DebateProgressExtended) => {
    set((state) => ({
      currentProgress: progress,
      session: state.session
        ? { ...state.session, currentIteration: progress.iteration }
        : null,
    }));
  },

  handleStatusUpdate: (status: DetailedStatus) => {
    set({ currentStatus: status });
  },

  handleElementScore: (update: ElementScoreUpdate) => {
    set((state) => {
      const elements = [...state.elements];
      const index = elements.findIndex((e) => e.id === update.elementId);

      if (index >= 0) {
        elements[index] = {
          ...elements[index],
          currentScore: update.score,
          scoreHistory: [...elements[index].scoreHistory, update.score],
        };
      } else {
        // New element
        elements.push({
          id: update.elementId,
          name: update.elementName,
          status: 'in_progress',
          currentScore: update.score,
          scoreHistory: [update.score],
          versionHistory: [],
        });
      }

      return { elements };
    });
  },

  handleResponse: (response: DebateResponse) => {
    set((state) => ({
      responses: [...state.responses, response],
    }));
  },

  handleCycleDetected: (data: { elementId: string; elementName: string }) => {
    set((state) => ({
      elements: state.elements.map((e) =>
        e.id === data.elementId
          ? { ...e, status: 'cycle_detected' as const, completionReason: 'cycle' as const }
          : e
      ),
    }));
  },

  handleComplete: (result: DebateResult) => {
    set((state) => ({
      isRunning: false,
      session: state.session
        ? {
            ...state.session,
            status: 'completed',
            completedAt: result.completedAt,
          }
        : null,
    }));
  },

  handleError: (error: { error: string }) => {
    set({
      error: error.error,
      isRunning: false,
    });
  },

  // Issue #34: Controller에서 debate:started 이벤트 수신
  handleStarted: (event: DebateStartedEvent) => {
    set({
      session: {
        id: event.sessionId,
        config: event.config,
        status: 'running',
        currentIteration: 0,
        elements: [],
        createdAt: event.createdAt,
      },
    });
  },

  // Issue #34: Controller 상태 변경 시 캐시 업데이트
  handleStateChanged: (state: DebateStateSnapshot) => {
    set({
      controllerState: state,
      isRunning: state.isRunning,
    });
  },
}));
