/**
 * Electron Preload Script
 *
 * contextBridge를 통한 안전한 IPC 노출
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { DebateConfig, LLMProvider } from '../shared/types';

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

  // Adapter actions (E2E 테스트용)
  adapter: {
    checkLogin: (provider: LLMProvider) =>
      ipcRenderer.invoke('adapter:checkLogin', provider),
    prepareInput: (provider: LLMProvider, timeout?: number) =>
      ipcRenderer.invoke('adapter:prepareInput', provider, timeout),
    enterPrompt: (provider: LLMProvider, prompt: string) =>
      ipcRenderer.invoke('adapter:enterPrompt', provider, prompt),
    submitMessage: (provider: LLMProvider) =>
      ipcRenderer.invoke('adapter:submitMessage', provider),
    awaitResponse: (provider: LLMProvider, timeout?: number) =>
      ipcRenderer.invoke('adapter:awaitResponse', provider, timeout),
    getResponse: (provider: LLMProvider) =>
      ipcRenderer.invoke('adapter:getResponse', provider),
    isWriting: (provider: LLMProvider) =>
      ipcRenderer.invoke('adapter:isWriting', provider),
    getTokenCount: (provider: LLMProvider) =>
      ipcRenderer.invoke('adapter:getTokenCount', provider),
  },

  // Session actions (Issue #25)
  session: {
    list: () => ipcRenderer.invoke('session:list'),
    get: (sessionId: string) => ipcRenderer.invoke('session:get', sessionId),
    getCurrent: () => ipcRenderer.invoke('session:get-current'),
    exportJson: (sessionId: string, outputPath?: string) =>
      ipcRenderer.invoke('session:export-json', sessionId, outputPath),
    exportMarkdown: (sessionId: string, outputPath?: string) =>
      ipcRenderer.invoke('session:export-markdown', sessionId, outputPath),
    delete: (sessionId: string) => ipcRenderer.invoke('session:delete', sessionId),
    clear: () => ipcRenderer.invoke('session:clear'),
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
      'debate:started', // Issue #34: Session started
      'debate:state-changed', // Issue #34: State snapshot
      'login:status-changed',
      'browser:view-changed', // BrowserView 표시 상태 변경
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
