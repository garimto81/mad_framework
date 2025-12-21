/**
 * IPC Client
 *
 * Renderer에서 Main 프로세스와 통신
 */

import type {
  DebateConfig,
  DebateProgress,
  DebateProgressExtended,
  DebateResponse,
  DebateResult,
  DetailedStatus,
  ElementScoreUpdate,
  LLMLoginStatus,
  LLMProvider,
} from '@shared/types';

// Mock electronAPI for browser environment (E2E testing)
const mockElectronAPI = {
  debate: {
    start: async () => ({ success: true }),
    cancel: async () => ({ success: true }),
    getStatus: async () => ({ status: 'idle' }),
  },
  login: {
    checkStatus: async () => ({
      chatgpt: { provider: 'chatgpt' as const, isLoggedIn: false, lastChecked: new Date().toISOString() },
      claude: { provider: 'claude' as const, isLoggedIn: false, lastChecked: new Date().toISOString() },
      gemini: { provider: 'gemini' as const, isLoggedIn: false, lastChecked: new Date().toISOString() },
    }),
    openLoginWindow: async () => ({ success: true }),
    closeLoginWindow: async () => ({ success: true }),
  },
  on: () => () => {},
};

// Use real electronAPI if available, otherwise use mock
const electronAPI = typeof window !== 'undefined' && window.electronAPI
  ? window.electronAPI
  : mockElectronAPI;

// Type-safe wrapper for electronAPI
export const ipc = {
  debate: {
    start: (config: DebateConfig): Promise<{ success: boolean }> => {
      return electronAPI.debate.start(config);
    },
    cancel: (sessionId: string): Promise<{ success: boolean }> => {
      return electronAPI.debate.cancel(sessionId);
    },
    getStatus: (): Promise<{ status: string }> => {
      return electronAPI.debate.getStatus();
    },
  },

  login: {
    checkStatus: (): Promise<Record<LLMProvider, LLMLoginStatus>> => {
      return electronAPI.login.checkStatus();
    },
    openLoginWindow: (provider: LLMProvider): Promise<{ success: boolean }> => {
      return electronAPI.login.openLoginWindow(provider);
    },
    closeLoginWindow: (): Promise<{ success: boolean }> => {
      return electronAPI.login.closeLoginWindow();
    },
  },

  // Event subscription helpers
  onDebateProgress: (callback: (progress: DebateProgressExtended) => void): (() => void) => {
    return electronAPI.on('debate:progress', callback as (...args: unknown[]) => void);
  },

  // Issue #13: Detailed status updates for progress monitoring
  onStatusUpdate: (callback: (status: DetailedStatus) => void): (() => void) => {
    return electronAPI.on('debate:status-update', callback as (...args: unknown[]) => void);
  },

  onDebateResponse: (callback: (response: DebateResponse) => void): (() => void) => {
    return electronAPI.on('debate:response', callback as (...args: unknown[]) => void);
  },

  onElementScore: (callback: (update: ElementScoreUpdate) => void): (() => void) => {
    return electronAPI.on('debate:element-score', callback as (...args: unknown[]) => void);
  },

  // StreamChunk is not currently used - placeholder for future streaming support
  onStreamChunk: (callback: (chunk: { content: string; provider: LLMProvider }) => void): (() => void) => {
    return electronAPI.on('debate:stream-chunk', callback as (...args: unknown[]) => void);
  },

  onCycleDetected: (
    callback: (data: { elementId: string; elementName: string }) => void
  ): (() => void) => {
    return electronAPI.on('debate:cycle-detected', callback as (...args: unknown[]) => void);
  },

  onDebateComplete: (callback: (result: DebateResult) => void): (() => void) => {
    return electronAPI.on('debate:complete', callback as (...args: unknown[]) => void);
  },

  onDebateError: (callback: (error: { error: string }) => void): (() => void) => {
    return electronAPI.on('debate:error', callback as (...args: unknown[]) => void);
  },

  onLoginStatusChanged: (
    callback: (status: Record<LLMProvider, LLMLoginStatus>) => void
  ): (() => void) => {
    return electronAPI.on('login:status-changed', callback as (...args: unknown[]) => void);
  },
};
