/**
 * Electron Main Process
 *
 * MAD Desktop 애플리케이션 진입점
 */

import { app, BrowserWindow } from 'electron';
import path from 'path';
import { registerIpcHandlers, cleanupIpcHandlers } from './ipc/handlers';
import { createScopedLogger } from './utils/logger';
import { DEV_SERVER_PORT } from './constants';

// userData 경로 override (테스트 환경 지원)
// 환경변수 또는 CLI 인자로 커스텀 경로 설정 가능
const customUserDataArg = process.argv.find((arg) => arg.startsWith('--user-data-dir='));
const customUserData = process.env.MAD_USER_DATA_DIR || customUserDataArg?.split('=')[1];
if (customUserData) {
  app.setPath('userData', customUserData);
}

const log = createScopedLogger('Main');

// E2E 테스트를 위한 userData 경로 설정
// --user-data-dir 인자가 전달되면 해당 경로를 사용하여 기존 로그인 세션 공유
const userDataArg = process.argv.find(arg => arg.startsWith('--user-data-dir='));
if (userDataArg) {
  const userDataDir = userDataArg.split('=')[1];
  app.setPath('userData', userDataDir);
}

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

function createWindow() {
  // 테스트 환경에서는 윈도우를 바로 표시 (Playwright 윈도우 감지 위해)
  const isTest = process.env.NODE_ENV === 'test' || !!process.env.TEST_PROVIDER;

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    backgroundColor: '#111827', // gray-900
    titleBarStyle: 'hiddenInset',
    show: isTest, // 테스트 시 바로 표시
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL(`http://localhost:${DEV_SERVER_PORT}`);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Windows/Linux: 창 닫기 시 앱 종료 트리거
  mainWindow.on('close', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  // Register IPC handlers
  registerIpcHandlers(mainWindow);
}

// Graceful shutdown handler
async function gracefulShutdown(): Promise<void> {
  if (isQuitting) return;
  isQuitting = true;

  log.info('Starting graceful shutdown...');

  const shutdownTimeout = setTimeout(() => {
    log.warn('Shutdown timeout reached (10s), forcing exit');
    app.exit(1);
  }, 10000);

  try {
    await cleanupIpcHandlers();
    log.info('Cleanup completed');
  } catch (err) {
    log.error('Error during cleanup:', err);
  } finally {
    clearTimeout(shutdownTimeout);
    log.info('Shutdown complete');
  }
}

// App lifecycle
app.whenReady().then(() => {
  log.info('App ready, creating window...');
  createWindow();
});

app.on('before-quit', async (event) => {
  if (!isQuitting) {
    event.preventDefault();
    await gracefulShutdown();
    app.quit();
  }
});

app.on('will-quit', () => {
  log.info('Application will quit');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  log.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled rejection:', reason);
});

// Export for testing
export { mainWindow };
