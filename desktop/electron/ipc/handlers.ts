/**
 * IPC Handlers
 *
 * Main ↔ Renderer 통신 핸들러
 */

import { ipcMain, BrowserWindow, app } from 'electron';
import * as path from 'path';
import type {
  DebateConfig,
  LLMProvider,
} from '../../shared/types';
import { BrowserViewManager } from '../browser/browser-view-manager';
import { DebateController } from '../debate/debate-controller';
import { CycleDetector } from '../debate/cycle-detector';
import { InMemoryRepository } from '../debate/in-memory-repository';
import { ProgressLogger } from '../debate/progress-logger';
import { createScopedLogger } from '../utils/logger';
import { BROWSER_VIEW_CREATION_DELAY, PROVIDER_CREATION_DELAY } from '../constants';

const log = createScopedLogger('IPC');

let browserManager: BrowserViewManager | null = null;
let debateController: DebateController | null = null;
let repository: InMemoryRepository | null = null;
let progressLogger: ProgressLogger | null = null;

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

  // Initialize progress logger with file logging
  progressLogger = new ProgressLogger();
  const logDir = path.join(app.getAppPath(), 'logs');
  progressLogger.enableFileLogging(logDir);

  // Initialize repository, cycle detector, and debate controller
  repository = new InMemoryRepository();
  const cycleDetector = new CycleDetector(browserManager);
  debateController = new DebateController(
    browserManager,
    repository,
    cycleDetector,
    eventEmitter,
    progressLogger
  );

  // Auto-create views and check login status on startup
  const providers: LLMProvider[] = ['chatgpt', 'claude', 'gemini'];
  log.info('Auto-creating browser views on startup...');

  for (const provider of providers) {
    browserManager.createView(provider);
  }

  // Wait for pages to load, then check login status
  setTimeout(async () => {
    log.info('Auto-checking login status...');
    const status = await browserManager!.checkLoginStatus();
    log.info('Auto-check result:', status);
    eventEmitter.emit('login:status-changed', status);
  }, 5000); // Wait 5 seconds for pages to load

  // === Debate Handlers ===

  ipcMain.handle('debate:start', async (_event, config: DebateConfig) => {
    log.info('debate:start called', config);

    if (!debateController) {
      throw new Error('Debate controller not initialized');
    }

    // Create browser views for participants
    log.info('Creating browser views...');
    const providers: LLMProvider[] = [...config.participants, config.judgeProvider];
    for (const provider of new Set(providers)) {
      if (!browserManager?.getView(provider)) {
        log.info(`Creating view for ${provider}`);
        browserManager?.createView(provider);
      } else {
        log.debug(`View already exists for ${provider}`);
      }
    }

    // Issue #9: Show first participant's view so user can see progress
    // Instead of hiding all views, show the active debater
    const firstParticipant = config.participants[0];
    log.info(`Showing browser view for first participant: ${firstParticipant}`);
    const bounds = mainWindow.getBounds();
    browserManager?.showView(firstParticipant, {
      x: 0,
      y: 50, // Leave space for header
      width: bounds.width,
      height: bounds.height - 50,
    });

    // Start debate (runs in background)
    log.info('Starting debate controller...');
    debateController.start(config).catch((error) => {
      log.error('Debate Error:', error);
      eventEmitter.emit('debate:error', { error: String(error) });
    });

    log.info('debate:start returning success');
    return { success: true };
  });

  ipcMain.handle('debate:cancel', async (_event, _sessionId: string) => {
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

  // === Adapter Handlers (E2E 테스트용) ===

  ipcMain.handle('adapter:check-login', async (_event, provider: LLMProvider) => {
    if (!browserManager) {
      return { success: false, error: { code: 'INIT_ERROR', message: 'Browser manager not initialized' } };
    }
    const adapter = browserManager.getAdapter(provider);
    if (!adapter) {
      return { success: false, error: { code: 'NO_ADAPTER', message: `No adapter for ${provider}` } };
    }
    return adapter.checkLogin();
  });

  ipcMain.handle('adapter:prepare-input', async (_event, provider: LLMProvider, timeout: number) => {
    if (!browserManager) {
      return { success: false, error: { code: 'INIT_ERROR', message: 'Browser manager not initialized' } };
    }
    const adapter = browserManager.getAdapter(provider);
    if (!adapter) {
      return { success: false, error: { code: 'NO_ADAPTER', message: `No adapter for ${provider}` } };
    }
    return adapter.prepareInput(timeout);
  });

  ipcMain.handle('adapter:enter-prompt', async (_event, provider: LLMProvider, prompt: string) => {
    if (!browserManager) {
      return { success: false, error: { code: 'INIT_ERROR', message: 'Browser manager not initialized' } };
    }
    const adapter = browserManager.getAdapter(provider);
    if (!adapter) {
      return { success: false, error: { code: 'NO_ADAPTER', message: `No adapter for ${provider}` } };
    }
    return adapter.enterPrompt(prompt);
  });

  ipcMain.handle('adapter:submit-message', async (_event, provider: LLMProvider) => {
    if (!browserManager) {
      return { success: false, error: { code: 'INIT_ERROR', message: 'Browser manager not initialized' } };
    }
    const adapter = browserManager.getAdapter(provider);
    if (!adapter) {
      return { success: false, error: { code: 'NO_ADAPTER', message: `No adapter for ${provider}` } };
    }
    return adapter.submitMessage();
  });

  ipcMain.handle('adapter:await-response', async (_event, provider: LLMProvider, timeout: number) => {
    if (!browserManager) {
      return { success: false, error: { code: 'INIT_ERROR', message: 'Browser manager not initialized' } };
    }
    const adapter = browserManager.getAdapter(provider);
    if (!adapter) {
      return { success: false, error: { code: 'NO_ADAPTER', message: `No adapter for ${provider}` } };
    }
    return adapter.awaitResponse(timeout);
  });

  ipcMain.handle('adapter:get-response', async (_event, provider: LLMProvider) => {
    if (!browserManager) {
      return { success: false, error: { code: 'INIT_ERROR', message: 'Browser manager not initialized' } };
    }
    const adapter = browserManager.getAdapter(provider);
    if (!adapter) {
      return { success: false, error: { code: 'NO_ADAPTER', message: `No adapter for ${provider}` } };
    }
    return adapter.getResponse();
  });

  // Issue #11: 스트리밍 상태 캡처 (메시지 전송 후 DOM 변화 분석)
  ipcMain.handle('debug:capture-streaming', async (_event, provider: LLMProvider) => {
    if (!browserManager) {
      throw new Error('Browser manager not initialized');
    }

    const adapter = browserManager.getAdapter(provider);
    if (!adapter) {
      return { error: 'No adapter for provider' };
    }

    const webContents = browserManager.getWebContents(provider);
    if (!webContents) {
      return { error: 'No webContents for provider' };
    }

    // 1. 테스트 메시지 전송
    log.debug(`Sending test message to ${provider}...`);
    await adapter.enterPrompt('Say "Hello" and nothing else.');
    await new Promise(r => setTimeout(r, BROWSER_VIEW_CREATION_DELAY));
    await adapter.submitMessage();

    // 2. 스트리밍 시작 대기 후 DOM 캡처 (여러 번)
    const captures: unknown[] = [];

    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, PROVIDER_CREATION_DELAY));

      const snapshot = await webContents.executeJavaScript(`
        (() => {
          const result = {
            timestamp: Date.now(),
            stopButtons: [],
            streamingAttrs: [],
            loadingElements: [],
            disabledButtons: [],
            responseAreas: [],
          };

          // Stop 버튼 찾기
          document.querySelectorAll('button').forEach(btn => {
            const label = (btn.getAttribute('aria-label') || '').toLowerCase();
            if (label.includes('stop') || label.includes('중지') || label.includes('취소')) {
              result.stopButtons.push({
                ariaLabel: btn.getAttribute('aria-label'),
                classes: btn.className?.substring?.(0, 80),
                visible: btn.offsetParent !== null,
              });
            }
            if (btn.disabled) {
              result.disabledButtons.push({
                ariaLabel: btn.getAttribute('aria-label'),
                testId: btn.getAttribute('data-testid'),
              });
            }
          });

          // data-is-streaming 속성
          document.querySelectorAll('[data-is-streaming]').forEach(el => {
            result.streamingAttrs.push({
              tag: el.tagName,
              value: el.getAttribute('data-is-streaming'),
              classes: el.className?.substring?.(0, 80),
            });
          });

          // 로딩/애니메이션 요소
          document.querySelectorAll('[class*="animate"], [class*="loading"], [class*="typing"]').forEach(el => {
            result.loadingElements.push({
              tag: el.tagName,
              classes: el.className?.substring?.(0, 100),
            });
          });

          // 응답 영역
          document.querySelectorAll('[class*="prose"], [class*="response"], [class*="message"], main article').forEach(el => {
            if (el.textContent && el.textContent.length > 5) {
              result.responseAreas.push({
                tag: el.tagName,
                classes: el.className?.substring?.(0, 80),
                textPreview: el.textContent?.substring?.(0, 50),
              });
            }
          });

          return result;
        })()
      `);

      captures.push(snapshot);
      log.debug(`Capture ${i + 1}:`, JSON.stringify(snapshot, null, 2));
    }

    return { captures };
  });

  // Issue #11: DOM 구조 분석용 디버그 핸들러
  ipcMain.handle('debug:dom-snapshot', async (_event, provider: LLMProvider) => {
    if (!browserManager) {
      throw new Error('Browser manager not initialized');
    }

    const webContents = browserManager.getWebContents(provider);
    if (!webContents) {
      return { error: 'No webContents for provider' };
    }

    const script = `
      (() => {
        const snapshot = {
          url: window.location.href,
          buttons: [],
          streamingElements: [],
          contentEditables: [],
          stopButtons: [],
          sendButtons: [],
          responseContainers: [],
        };

        // 모든 버튼 분석
        document.querySelectorAll('button').forEach(btn => {
          snapshot.buttons.push({
            ariaLabel: btn.getAttribute('aria-label'),
            testId: btn.getAttribute('data-testid'),
            classes: btn.className,
            disabled: btn.disabled,
            text: btn.textContent?.substring(0, 50),
          });

          // Stop 버튼 후보
          const label = (btn.getAttribute('aria-label') || btn.textContent || '').toLowerCase();
          if (label.includes('stop') || label.includes('cancel')) {
            snapshot.stopButtons.push({
              ariaLabel: btn.getAttribute('aria-label'),
              testId: btn.getAttribute('data-testid'),
              classes: btn.className,
            });
          }

          // Send 버튼 후보
          if (label.includes('send') || btn.closest('fieldset')) {
            snapshot.sendButtons.push({
              ariaLabel: btn.getAttribute('aria-label'),
              testId: btn.getAttribute('data-testid'),
              classes: btn.className,
              disabled: btn.disabled,
              inFieldset: !!btn.closest('fieldset'),
            });
          }
        });

        // Streaming 관련 요소
        document.querySelectorAll('[data-is-streaming]').forEach(el => {
          snapshot.streamingElements.push({
            tag: el.tagName,
            value: el.getAttribute('data-is-streaming'),
            classes: el.className,
          });
        });

        // ContentEditable 요소
        document.querySelectorAll('[contenteditable="true"]').forEach(el => {
          snapshot.contentEditables.push({
            tag: el.tagName,
            classes: el.className,
            placeholder: el.getAttribute('data-placeholder'),
          });
        });

        // 응답 컨테이너 후보 (prose, message, response 클래스)
        document.querySelectorAll('.prose, [class*="message"], [class*="response"], [class*="Message"]').forEach(el => {
          snapshot.responseContainers.push({
            tag: el.tagName,
            classes: el.className?.substring?.(0, 100),
            textLength: el.textContent?.length || 0,
          });
        });

        return snapshot;
      })()
    `;

    try {
      const result = await webContents.executeJavaScript(script);
      log.debug(`DOM Snapshot for ${provider}:`, JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      return { error: String(error) };
    }
  });

  // === Debug Handlers (Claude Code 모니터링용) ===

  ipcMain.handle('debug:get-logs', async (_event, options?: { limit?: number; type?: string }) => {
    if (!progressLogger) {
      return { logs: [], error: 'Logger not initialized' };
    }

    const limit = options?.limit || 100;
    const type = options?.type;

    if (type) {
      return { logs: progressLogger.getLogsByType(type as any).slice(0, limit) };
    }
    return { logs: progressLogger.getLogs(limit) };
  });

  ipcMain.handle('debug:get-debate-status', async () => {
    if (!debateController) {
      return { isRunning: false, error: 'Controller not initialized' };
    }

    return {
      isRunning: debateController.isRunning(),
      currentIteration: debateController.getCurrentIteration(),
      currentProvider: debateController.getCurrentProvider(),
    };
  });
}

// Cleanup on app quit
export async function cleanupIpcHandlers(): Promise<void> {
  log.info('Starting IPC cleanup...');

  // 1. 진행 중인 토론 취소
  if (debateController) {
    log.info('Cancelling debate...');
    debateController.cancel();
    debateController = null;
  }

  // 2. BrowserView 정리
  if (browserManager) {
    log.info('Destroying browser views...');
    browserManager.destroyAllViews();
    browserManager = null;
  }

  // 3. Repository 정리
  if (repository) {
    log.info('Clearing repository...');
    repository.clear();
    repository = null;
  }

  // 4. ProgressLogger 파일 스트림 정리
  if (progressLogger) {
    log.info('Closing progress logger...');
    progressLogger.close();
    progressLogger = null;
  }

  // 5. IPC 핸들러 제거
  log.info('Removing IPC handlers...');
  const handlers = [
    'debate:start',
    'debate:cancel',
    'debate:get-status',
    'login:check-status',
    'login:open-window',
    'login:close-window',
    'adapter:check-login',
    'adapter:prepare-input',
    'adapter:enter-prompt',
    'adapter:submit-message',
    'adapter:await-response',
    'adapter:get-response',
    'debug:capture-streaming',
    'debug:dom-snapshot',
    'debug:get-logs',
    'debug:get-debate-status',
  ];

  for (const handler of handlers) {
    ipcMain.removeHandler(handler);
  }

  log.info('IPC cleanup completed');
}
