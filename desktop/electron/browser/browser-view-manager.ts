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

interface BrowserView {
  webContents: any;
  setBounds: (bounds: Rectangle) => void;
  destroy: () => void;
}

interface BrowserWindow {
  setBrowserView: (view: BrowserView | null) => void;
  getBounds: () => Rectangle;
}

const LLM_URLS: Record<LLMProvider, string> = {
  chatgpt: 'https://chat.openai.com',
  claude: 'https://claude.ai',
  gemini: 'https://gemini.google.com',
};

export class BrowserViewManager {
  private views: Map<LLMProvider, BrowserView> = new Map();
  private adapters: Map<LLMProvider, BaseLLMAdapter> = new Map();
  private sessionManager: SessionManager;
  private mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    this.sessionManager = new SessionManager();
  }

  createView(provider: LLMProvider): BrowserView {
    const session = this.sessionManager.getSession(provider);

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

    return view;
  }

  private createAdapter(provider: LLMProvider, webContents: any): BaseLLMAdapter {
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

  getWebContents(provider: LLMProvider): any {
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
      this.mainWindow.setBrowserView(view);
      view.setBounds(bounds);
    }
  }

  hideAllViews(): void {
    this.mainWindow.setBrowserView(null);
  }

  destroyView(provider: LLMProvider): void {
    const view = this.views.get(provider);
    if (view) {
      view.destroy();
      this.views.delete(provider);
      this.adapters.delete(provider);
    }
  }

  destroyAllViews(): void {
    const providers: LLMProvider[] = ['chatgpt', 'claude', 'gemini'];
    providers.forEach((p) => this.destroyView(p));
  }

  async checkLoginStatus(): Promise<Record<LLMProvider, LLMLoginStatus>> {
    const result: Record<LLMProvider, LLMLoginStatus> = {} as any;
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
