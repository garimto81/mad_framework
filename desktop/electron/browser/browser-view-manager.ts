/**
 * BrowserView Manager
 *
 * BrowserView 생성 및 관리
 */

import type { LLMProvider, LLMLoginStatus } from '../../shared/types';
import { SessionManager } from './session-manager';
import { ChatGPTAdapter } from './adapters/chatgpt-adapter';
import { ClaudeAdapter } from './adapters/claude-adapter';
import { GeminiAdapter } from './adapters/gemini-adapter';
import { BaseLLMAdapter } from './adapters/base-adapter';

interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BrowserViewWebContents {
  loadURL: (url: string) => void;
  executeJavaScript: <T = unknown>(script: string) => Promise<T>;
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  getURL: () => string;
  close?: () => void;
}

interface BrowserView {
  webContents: BrowserViewWebContents;
  setBounds: (bounds: Rectangle) => void;
  destroy: () => void;
}

interface BrowserWindow {
  setBrowserView: (view: BrowserView | null) => void;
  addBrowserView: (view: BrowserView) => void;
  removeBrowserView: (view: BrowserView) => void;
  getBrowserViews: () => BrowserView[];
  getBounds: () => Rectangle;
}

const LLM_URLS: Record<LLMProvider, string> = {
  chatgpt: 'https://chat.openai.com',
  claude: 'https://claude.ai',
  gemini: 'https://gemini.google.com',
};

// Issue #10: 화면 밖 위치 (view를 숨기되 렌더링은 유지)
const OFFSCREEN_BOUNDS: Rectangle = { x: -10000, y: -10000, width: 1920, height: 1080 };

export class BrowserViewManager {
  private views: Map<LLMProvider, BrowserView> = new Map();
  private adapters: Map<LLMProvider, BaseLLMAdapter> = new Map();
  private sessionManager: SessionManager;
  private mainWindow: BrowserWindow;
  private activeProvider: LLMProvider | null = null;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    this.sessionManager = new SessionManager();
  }

  createView(provider: LLMProvider): BrowserView {
    // Session is retrieved internally by electron via partition
    this.sessionManager.getSession(provider);

    // Try to use electron BrowserView if available
    let view: BrowserView;
    try {
      const { BrowserView: ElectronBrowserView, session: electronSession } = require('electron');
      const ses = electronSession.fromPartition(`persist:${provider}`);

      view = new ElectronBrowserView({
        webPreferences: {
          session: ses,
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      });
    } catch {
      // Electron not available (testing environment)
      view = {
        webContents: {
          loadURL: () => {},
          executeJavaScript: async () => '',
          on: () => {},
          getURL: () => '',
        },
        setBounds: () => {},
        destroy: () => {},
      };
    }

    // Load LLM site
    view.webContents.loadURL(LLM_URLS[provider]);

    // Create adapter
    const adapter = this.createAdapter(provider, view.webContents);

    this.views.set(provider, view);
    this.adapters.set(provider, adapter);

    // Issue #10: addBrowserView로 추가하고 화면 밖에 배치 (렌더링 유지)
    try {
      this.mainWindow.addBrowserView(view);
      view.setBounds(OFFSCREEN_BOUNDS);
      console.log(`[BrowserViewManager] Added ${provider} view (offscreen)`);
    } catch {
      console.log(`[BrowserViewManager] addBrowserView not available, using legacy mode`);
    }

    return view;
  }

  private createAdapter(provider: LLMProvider, webContents: BrowserViewWebContents): BaseLLMAdapter {
    switch (provider) {
      case 'chatgpt':
        return new ChatGPTAdapter(webContents);
      case 'claude':
        return new ClaudeAdapter(webContents);
      case 'gemini':
        return new GeminiAdapter(webContents);
      default:
        return new BaseLLMAdapter(provider, webContents);
    }
  }

  getView(provider: LLMProvider): BrowserView | undefined {
    return this.views.get(provider);
  }

  getWebContents(provider: LLMProvider): BrowserViewWebContents | undefined {
    return this.views.get(provider)?.webContents;
  }

  getAdapter(provider: LLMProvider): BaseLLMAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new Error(`Adapter not found for ${provider}. Create view first.`);
    }
    return adapter;
  }

  showView(provider: LLMProvider, bounds: Rectangle): void {
    const view = this.views.get(provider);
    if (view) {
      // Issue #10: 모든 view를 화면 밖으로 이동 후, 선택된 view만 화면 안으로
      for (const [p, v] of this.views.entries()) {
        if (p === provider) {
          v.setBounds(bounds);
          console.log(`[BrowserViewManager] Showing ${provider} view`);
        } else {
          v.setBounds(OFFSCREEN_BOUNDS);
        }
      }
      this.activeProvider = provider;
    }
  }

  hideAllViews(): void {
    // Issue #10: 모든 view를 화면 밖으로 이동 (제거하지 않음 - 렌더링 유지)
    for (const [provider, view] of this.views.entries()) {
      view.setBounds(OFFSCREEN_BOUNDS);
      console.log(`[BrowserViewManager] Hiding ${provider} view (offscreen)`);
    }
    this.activeProvider = null;
  }

  // Issue #10: 특정 view만 숨기기
  hideView(provider: LLMProvider): void {
    const view = this.views.get(provider);
    if (view) {
      view.setBounds(OFFSCREEN_BOUNDS);
      if (this.activeProvider === provider) {
        this.activeProvider = null;
      }
    }
  }

  getActiveProvider(): LLMProvider | null {
    return this.activeProvider;
  }

  destroyView(provider: LLMProvider): void {
    const view = this.views.get(provider);
    if (view) {
      // Issue #10: removeBrowserView 호출 후 destroy
      try {
        this.mainWindow.removeBrowserView(view);
      } catch {
        // Legacy mode
      }

      // Electron 30+: destroy() deprecated, use webContents.close()
      try {
        if (view.webContents && typeof view.webContents.close === 'function') {
          view.webContents.close();
        } else if (typeof view.destroy === 'function') {
          view.destroy();
        }
      } catch {
        // View already destroyed or not available
      }

      this.views.delete(provider);
      this.adapters.delete(provider);
      if (this.activeProvider === provider) {
        this.activeProvider = null;
      }
    }
  }

  destroyAllViews(): void {
    const providers: LLMProvider[] = ['chatgpt', 'claude', 'gemini'];
    providers.forEach((p) => this.destroyView(p));
  }

  async checkLoginStatus(): Promise<Record<LLMProvider, LLMLoginStatus>> {
    const result = {} as Record<LLMProvider, LLMLoginStatus>;
    const providers: LLMProvider[] = ['chatgpt', 'claude', 'gemini'];

    for (const provider of providers) {
      const adapter = this.adapters.get(provider);
      if (adapter) {
        try {
          const isLoggedIn = await adapter.isLoggedIn();
          result[provider] = {
            provider,
            isLoggedIn: Boolean(isLoggedIn),
            lastChecked: new Date().toISOString(),
          };
          console.log(`[Login Check] ${provider}: ${isLoggedIn}`);
        } catch (error) {
          console.error(`[Login Check] ${provider} error:`, error);
          result[provider] = {
            provider,
            isLoggedIn: false,
            lastChecked: new Date().toISOString(),
          };
        }
      } else {
        result[provider] = {
          provider,
          isLoggedIn: false,
          lastChecked: new Date().toISOString(),
        };
      }
    }

    return result;
  }
}
