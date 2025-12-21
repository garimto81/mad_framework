/**
 * IPC Handlers
 *
 * Main ↔ Renderer 통신 핸들러
 */

import { ipcMain, BrowserWindow } from 'electron';
import type {
  DebateConfig,
  DebateProgress,
  DebateResponse,
  DebateResult,
  ElementScoreUpdate,
  LLMLoginStatus,
  LLMProvider,
} from '../../shared/types';
import { BrowserViewManager } from '../browser/browser-view-manager';
import { DebateController } from '../debate/debate-controller';
import { CycleDetector } from '../debate/cycle-detector';
import { InMemoryRepository } from '../debate/in-memory-repository';

let browserManager: BrowserViewManager | null = null;
let debateController: DebateController | null = null;
let repository: InMemoryRepository | null = null;

export function registerIpcHandlers(mainWindow: BrowserWindow) {
  // Initialize browser manager
  // Issue #10: addBrowserView/removeBrowserView 추가
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  browserManager = new BrowserViewManager(mainWindow as any);

  // Create event emitter that forwards to renderer
  const eventEmitter = {
    emit: (event: string, data: unknown) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(event, data);
      }
    },
    on: () => {},
  };

  // Initialize repository, cycle detector, and debate controller
  repository = new InMemoryRepository();
  const cycleDetector = new CycleDetector(browserManager);
  debateController = new DebateController(
    browserManager,
    repository,
    cycleDetector,
    eventEmitter
  );

  // Auto-create views and check login status on startup
  const providers: LLMProvider[] = ['chatgpt', 'claude', 'gemini'];
  console.log('[IPC] Auto-creating browser views on startup...');

  for (const provider of providers) {
    browserManager.createView(provider);
  }

  // Wait for pages to load, then check login status
  setTimeout(async () => {
    console.log('[IPC] Auto-checking login status...');
    const status = await browserManager!.checkLoginStatus();
    console.log('[IPC] Auto-check result:', status);
    eventEmitter.emit('login:status-changed', status);
  }, 5000); // Wait 5 seconds for pages to load

  // === Debate Handlers ===

  ipcMain.handle('debate:start', async (_event, config: DebateConfig) => {
    console.log('[IPC] debate:start called', config);

    if (!debateController) {
      throw new Error('Debate controller not initialized');
    }

    // Create browser views for participants
    console.log('[IPC] Creating browser views...');
    const providers: LLMProvider[] = [...config.participants, config.judgeProvider];
    for (const provider of new Set(providers)) {
      if (!browserManager?.getView(provider)) {
        console.log(`[IPC] Creating view for ${provider}`);
        browserManager?.createView(provider);
      } else {
        console.log(`[IPC] View already exists for ${provider}`);
      }
    }

    // Issue #9: Show first participant's view so user can see progress
    // Instead of hiding all views, show the active debater
    const firstParticipant = config.participants[0];
    console.log(`[IPC] Showing browser view for first participant: ${firstParticipant}`);
    const bounds = mainWindow.getBounds();
    browserManager?.showView(firstParticipant, {
      x: 0,
      y: 50, // Leave space for header
      width: bounds.width,
      height: bounds.height - 50,
    });

    // Start debate (runs in background)
    console.log('[IPC] Starting debate controller...');
    debateController.start(config).catch((error) => {
      console.error('[Debate Error]', error);
      eventEmitter.emit('debate:error', { error: String(error) });
    });

    console.log('[IPC] debate:start returning success');
    return { success: true };
  });

  ipcMain.handle('debate:cancel', async (_event, sessionId: string) => {
    debateController?.cancel();
    return { success: true };
  });

  ipcMain.handle('debate:get-status', async () => {
    // Return current debate status
    return { status: 'idle' };
  });

  // === Login Handlers ===

  ipcMain.handle('login:check-status', async () => {
    if (!browserManager) {
      return {};
    }
    return browserManager.checkLoginStatus();
  });

  ipcMain.handle('login:open-window', async (_event, provider: LLMProvider) => {
    if (!browserManager) {
      throw new Error('Browser manager not initialized');
    }

    // Create view if not exists
    if (!browserManager.getView(provider)) {
      browserManager.createView(provider);
    }

    // Show the view for login
    const bounds = mainWindow.getBounds();
    browserManager.showView(provider, {
      x: 0,
      y: 50, // Leave space for header
      width: bounds.width,
      height: bounds.height - 50,
    });

    return { success: true };
  });

  ipcMain.handle('login:close-window', async () => {
    if (!browserManager) {
      throw new Error('Browser manager not initialized');
    }

    browserManager.hideAllViews();
    return { success: true };
  });
}

// Cleanup on app quit
export function cleanupIpcHandlers() {
  // 1. 진행 중인 토론 취소
  if (debateController) {
    debateController.cancel();
    debateController = null;
  }

  // 2. BrowserView 정리
  if (browserManager) {
    browserManager.destroyAllViews();
    browserManager = null;
  }

  // 3. Repository 정리
  if (repository) {
    repository.clear();
    repository = null;
  }
}
