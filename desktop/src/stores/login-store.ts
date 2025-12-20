/**
 * Login Store
 *
 * LLM 로그인 상태 관리 (Zustand)
 */

import { create } from 'zustand';
import type { LLMLoginStatus, LLMProvider } from '@shared/types';
import { ipc } from '../lib/ipc';

interface LoginState {
  // Login status for each provider
  status: Record<LLMProvider, LLMLoginStatus>;
  isChecking: boolean;
  activeLoginProvider: LLMProvider | null;

  // Actions
  initializeLoginListener: () => void;
  checkLoginStatus: () => Promise<void>;
  openLoginWindow: (provider: LLMProvider) => Promise<void>;
  closeLoginWindow: () => Promise<void>;
  updateStatus: (provider: LLMProvider, isLoggedIn: boolean) => void;
}

const defaultStatus: Record<LLMProvider, LLMLoginStatus> = {
  chatgpt: {
    provider: 'chatgpt',
    isLoggedIn: false,
    lastChecked: '',
  },
  claude: {
    provider: 'claude',
    isLoggedIn: false,
    lastChecked: '',
  },
  gemini: {
    provider: 'gemini',
    isLoggedIn: false,
    lastChecked: '',
  },
};

export const useLoginStore = create<LoginState>((set, get) => ({
  status: defaultStatus,
  isChecking: false,
  activeLoginProvider: null,

  initializeLoginListener: () => {
    // Listen for auto-check results from main process
    ipc.onLoginStatusChanged((status) => {
      console.log('[Login Store] Received status update:', status);
      set({ status, isChecking: false });
    });
  },

  checkLoginStatus: async () => {
    set({ isChecking: true });

    try {
      const status = await ipc.login.checkStatus();
      set({ status, isChecking: false });
    } catch (error) {
      console.error('Failed to check login status:', error);
      set({ isChecking: false });
    }
  },

  openLoginWindow: async (provider: LLMProvider) => {
    try {
      await ipc.login.openLoginWindow(provider);
      set({ activeLoginProvider: provider });
    } catch (error) {
      console.error('Failed to open login window:', error);
    }
  },

  closeLoginWindow: async () => {
    try {
      await ipc.login.closeLoginWindow();
      set({ activeLoginProvider: null });
      // Refresh login status after closing
      await get().checkLoginStatus();
    } catch (error) {
      console.error('Failed to close login window:', error);
    }
  },

  updateStatus: (provider: LLMProvider, isLoggedIn: boolean) => {
    set((state) => ({
      status: {
        ...state.status,
        [provider]: {
          ...state.status[provider],
          isLoggedIn,
          lastChecked: new Date().toISOString(),
        },
      },
    }));
  },
}));
