/**
 * Electron E2E 테스트 공통 Fixture
 *
 * 모든 Electron E2E 테스트에서 공유하는 설정:
 * - 일관된 userData 경로 (세션 공유)
 * - Electron 앱 launch/close 로직
 */

import { test as base, type ElectronApplication, type Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import * as path from 'path';
import * as os from 'os';

// 기존 Electron 세션 경로 (로그인 정보 유지)
// 이 경로는 프로덕션 앱과 동일한 userData 경로를 사용하여 세션을 공유함
export const USER_DATA_DIR = path.join(os.homedir(), 'AppData', 'Roaming', 'mad-desktop');

// 빌드된 main.js 경로
const MAIN_JS_PATH = path.join(__dirname, '../../../dist/main/electron/main.js');

/**
 * Electron 테스트용 확장 fixture
 */
export const test = base.extend<{
  electronApp: ElectronApplication;
  mainWindow: Page;
}>({
  // Electron 앱 fixture
  electronApp: async (_, use) => {
    const app = await electron.launch({
      args: [MAIN_JS_PATH, `--user-data-dir=${USER_DATA_DIR}`],
      env: {
        ...process.env,
        NODE_ENV: 'production',
      },
      timeout: 60000,
    });

    await use(app);

    // 테스트 후 앱 종료
    await app.close();
  },

  // 메인 윈도우 fixture
  mainWindow: async ({ electronApp }, use) => {
    const window = await electronApp.firstWindow({ timeout: 60000 });
    await window.waitForLoadState('domcontentloaded');

    // 앱 초기화 대기
    await window.waitForTimeout(3000);

    await use(window);
  },
});

export { expect } from '@playwright/test';
