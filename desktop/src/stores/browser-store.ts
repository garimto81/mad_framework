/**
 * Browser Store
 *
 * BrowserView 표시 상태 통합 관리 (Zustand)
 */

import { create } from 'zustand';
import type { LLMProvider } from '@shared/types';
import { ipc } from '../lib/ipc';

export type ViewMode = 'login' | 'debate' | null;

interface BrowserState {
  // 현재 표시 중인 BrowserView
  visibleView: LLMProvider | null;
  // 표시 목적 (로그인 / 토론)
  viewMode: ViewMode;

  // Actions
  initializeBrowserListener: () => void;
  setVisibleView: (provider: LLMProvider | null, mode: ViewMode) => void;
  hideView: () => Promise<void>;
}

export const useBrowserStore = create<BrowserState>((set) => ({
  visibleView: null,
  viewMode: null,

  initializeBrowserListener: () => {
    // Main process에서 BrowserView 변경 이벤트 수신
    ipc.onBrowserViewChanged((data) => {
      const { provider, visible, mode } = data;
      console.log('[Browser Store] View changed:', { provider, visible, mode });

      if (visible && provider) {
        set({ visibleView: provider, viewMode: mode });
      } else {
        set({ visibleView: null, viewMode: null });
      }
    });
  },

  setVisibleView: (provider: LLMProvider | null, mode: ViewMode) => {
    set({ visibleView: provider, viewMode: mode });
  },

  hideView: async () => {
    try {
      await ipc.login.closeLoginWindow();
      set({ visibleView: null, viewMode: null });
    } catch (error) {
      console.error('Failed to hide view:', error);
    }
  },
}));
