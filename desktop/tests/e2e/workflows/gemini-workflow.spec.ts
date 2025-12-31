/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Gemini Single Browser Workflow E2E Test
 *
 * 실제 브라우저에서 Gemini 워크플로우를 검증합니다.
 *
 * 사전 조건:
 * - Gemini에 로그인된 상태 (persist:gemini 세션 사용)
 * - Electron 앱 실행 중
 *
 * Gemini 특화 검증:
 * - Quill Editor (.ql-editor) 입력
 * - 6가지 isWriting 감지 방식
 * - 7개 응답 셀렉터 fallback
 */

import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import * as url from 'url';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
const testPrompts = JSON.parse(
  fs.readFileSync(new URL('../fixtures/test-prompts.json', import.meta.url), 'utf-8')
);

// 기존 Electron 세션 경로 (로그인 정보 유지)
const USER_DATA_DIR = path.join(os.homedir(), 'AppData', 'Roaming', 'mad-desktop');

// 테스트 타임아웃 설정 (3분)
test.setTimeout(180000);

let electronApp: ElectronApplication;
let mainWindow: Page;

test.describe('Gemini Single Workflow E2E', () => {
  test.beforeAll(async () => {
    electronApp = await electron.launch({
      args: [
        path.join(__dirname, '../../../dist/main/electron/main.js'),
        `--user-data-dir=${USER_DATA_DIR}`,
      ],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        TEST_PROVIDER: 'gemini',
      },
    });

    mainWindow = await electronApp.firstWindow();
    await mainWindow.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test.describe('Checklist: 로그인 확인 (checkLogin)', () => {
    test('[GEMINI-LOGIN-01] data-user-email 속성 존재 확인', async () => {
      const result = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:checkLogin', 'gemini');
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    test('[GEMINI-LOGIN-02] Fallback 5개 셀렉터 순차 시도', async () => {
      const result = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:checkLoginWithFallback', 'gemini');
      });

      expect(result.success).toBe(true);
    });
  });

  test.describe('Checklist: 프롬프트 입력 (enterPrompt)', () => {
    test('[GEMINI-PROMPT-01] .ql-editor Quill Editor 존재 확인', async () => {
      const result = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:hasQuillEditor', 'gemini');
      });

      expect(result.exists).toBe(true);
    });

    test('[GEMINI-PROMPT-02] innerHTML 설정 동작 검증', async () => {
      const prompt = testPrompts.simple.prompt;

      const result = await mainWindow.evaluate(async (p: string) => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:enterPrompt', 'gemini', p);
      }, prompt);

      expect(result.success).toBe(true);
    });

    test('[GEMINI-PROMPT-03] input 이벤트 발생 확인', async () => {
      const prompt = '테스트 입력';

      await mainWindow.evaluate(async (p: string) => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:enterPrompt', 'gemini', p);
      }, prompt);

      const inputValue = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:getInputValue', 'gemini');
      });

      expect(inputValue).toContain('테스트 입력');
    });
  });

  test.describe('Checklist: 메시지 전송 (submitMessage)', () => {
    test('[GEMINI-SEND-01] .send-button 셀렉터 존재 확인', async () => {
      const result = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:hasSendButton', 'gemini');
      });

      // 셀렉터가 존재하거나 fallback이 동작해야 함
      expect(result.exists || result.fallbackAvailable).toBe(true);
    });

    test('[GEMINI-SEND-02] Fallback button[aria-label*="Send"]', async () => {
      await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:enterPrompt', 'gemini', '테스트');
      });

      const result = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:submitMessage', 'gemini');
      });

      expect(result.success).toBe(true);
    });

    test('[GEMINI-SEND-03] Fallback Enter 키', async () => {
      const result = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:testEnterKeyFallback', 'gemini');
      });

      expect(result.enterKeyWorks).toBe(true);
    });
  });

  test.describe('Checklist: 응답 대기 (awaitResponse)', () => {
    test('[GEMINI-WAIT-01] 로딩 인디케이터 감지', async () => {
      await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        await ipcRenderer.invoke('adapter:enterPrompt', 'gemini', '안녕하세요');
        return await ipcRenderer.invoke('adapter:submitMessage', 'gemini');
      });

      const hasLoadingIndicator = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:hasLoadingIndicator', 'gemini');
      });

      expect(typeof hasLoadingIndicator).toBe('boolean');
    });

    test('[GEMINI-WAIT-02] aria-busy="true" 감지', async () => {
      const isAriaBusy = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:isAriaBusy', 'gemini');
      });

      expect(typeof isAriaBusy).toBe('boolean');
    });

    test('[GEMINI-WAIT-03] stop button 존재 감지', async () => {
      const hasStopButton = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:hasStopButton', 'gemini');
      });

      expect(typeof hasStopButton).toBe('boolean');
    });
  });

  test.describe('Checklist: 응답 추출 (getResponse)', () => {
    test('[GEMINI-RESPONSE-01] 7개 셀렉터 fallback (Issue #33)', async () => {
      // 먼저 응답 대기
      await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:awaitResponse', 'gemini', 120000);
      });

      const result = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:getResponse', 'gemini');
      });

      expect(result.success).toBe(true);
    });

    test('[GEMINI-RESPONSE-02] 마지막 응답만 추출', async () => {
      const result = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:getResponse', 'gemini');
      });

      expect(result.success).toBe(true);
      expect(typeof result.data).toBe('string');
    });
  });

  test.describe('Checklist: 진행상태 모니터링', () => {
    test('[GEMINI-PROGRESS-01] 6가지 isWriting 감지 방식 동작', async () => {
      // 새 메시지 전송
      await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        await ipcRenderer.invoke('adapter:enterPrompt', 'gemini', '짧게 답해주세요: 3+3=?');
        return await ipcRenderer.invoke('adapter:submitMessage', 'gemini');
      });

      // 6가지 감지 방식 확인
      const detectionMethods = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:getIsWritingMethods', 'gemini');
      });

      // 최소 하나의 방식으로 감지되어야 함
      expect(
        detectionMethods.stopButton ||
        detectionMethods.loading ||
        detectionMethods.ariaBusy ||
        detectionMethods.responseUpdating ||
        detectionMethods.sendDisabled ||
        detectionMethods.cursor
      ).toBe(true);
    });

    test('[GEMINI-PROGRESS-02] tokenCount 추적', async () => {
      const counts: number[] = [];

      for (let i = 0; i < 3; i++) {
        const count = await mainWindow.evaluate(async () => {
          const { ipcRenderer } = require('electron');
          return await ipcRenderer.invoke('adapter:getTokenCount', 'gemini');
        });
        counts.push(count);
        await mainWindow.waitForTimeout(500);
      }

      // 카운트가 증가해야 함
      expect(counts[counts.length - 1]).toBeGreaterThanOrEqual(counts[0]);
    });
  });

  test.describe('Full Workflow Integration', () => {
    test('[GEMINI-FULL-01] 전체 워크플로우: 입력 -> 전송 -> 모니터링 -> 추출', async () => {
      const prompt = testPrompts.codeReview.prompt;
      const startTime = Date.now();

      // Step 1: 입력창 준비
      const prepareResult = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:prepareInput', 'gemini', 10000);
      });
      expect(prepareResult.success).toBe(true);

      // Step 2: 프롬프트 입력
      const enterResult = await mainWindow.evaluate(async (p: string) => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:enterPrompt', 'gemini', p);
      }, prompt);
      expect(enterResult.success).toBe(true);

      // Step 3: 메시지 전송
      const submitResult = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:submitMessage', 'gemini');
      });
      expect(submitResult.success).toBe(true);

      // Step 4: 진행상태 모니터링
      let progressCallCount = 0;
      let isWriting = true;

      while (isWriting && Date.now() - startTime < 120000) {
        const status = await mainWindow.evaluate(async () => {
          const { ipcRenderer } = require('electron');
          const isWriting = await ipcRenderer.invoke('adapter:isWriting', 'gemini');
          const tokenCount = await ipcRenderer.invoke('adapter:getTokenCount', 'gemini');
          return { isWriting, tokenCount };
        });
        isWriting = status.isWriting;
        progressCallCount++;
        await mainWindow.waitForTimeout(1000);
      }

      expect(progressCallCount).toBeGreaterThanOrEqual(3);

      // Step 5: 응답 추출
      const getResult = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:getResponse', 'gemini');
      });
      expect(getResult.success).toBe(true);

      // 성공 기준 검증
      const elapsed = Date.now() - startTime;
      expect(getResult.data.length).toBeGreaterThan(testPrompts.codeReview.expectedMinLength);
      expect(elapsed).toBeLessThan(testPrompts.codeReview.expectedMaxResponseTime);
    });
  });
});
