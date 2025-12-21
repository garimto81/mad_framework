/**
 * Electron Preload Script
 *
 * contextBridge를 통한 안전한 IPC 노출
 */

import { contextBridge, ipcRenderer } from 'electron';
import type {
  DebateConfig,
  DebateProgress,
  DebateResponse,
  DebateResult,
  ElementScoreUpdate,
  LLMLoginStatus,
  LLMProvider,
} from '../shared/types';

// API exposed to renderer
const electronAPI = {
  // Debate actions (Renderer → Main)
  debate: {
    start: (config: DebateConfig) => ipcRenderer.invoke('debate:start', config),
    cancel: (sessionId: string) => ipcRenderer.invoke('debate:cancel', sessionId),
    getStatus: () => ipcRenderer.invoke('debate:get-status'),
  },

  // Login actions (Renderer → Main)
  login: {
    checkStatus: () => ipcRenderer.invoke('login:check-status'),
    openLoginWindow: (provider: LLMProvider) =>
      ipcRenderer.invoke('login:open-window', provider),
    closeLoginWindow: () => ipcRenderer.invoke('login:close-window'),
  },

  // Event listeners (Main → Renderer)
  on: (
    channel: string,
    callback: (...args: unknown[]) => void
  ): (() => void) => {
    const validChannels = [
      'debate:progress',
      'debate:response',
      'debate:element-score',
      'debate:cycle-detected',
      'debate:complete',
      'debate:error',
      'debate:status-update', // Issue #13: Detailed status updates
      'login:status-changed',
    ];

    if (!validChannels.includes(channel)) {
      console.warn(`Invalid channel: ${channel}`);
      return () => {};
    }

    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => {
      callback(...args);
    };

    ipcRenderer.on(channel, listener);

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
};

// Expose to renderer
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Type declaration for renderer
declare global {
  interface Window {
    electronAPI: typeof electronAPI;
  }
}
