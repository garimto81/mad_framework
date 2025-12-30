 
/**
 * Claude Single Browser Workflow E2E Test
 *
 * 실제 브라우저에서 Claude 워크플로우를 검증합니다.
 *
 * 사전 조건:
 * - Claude에 로그인된 상태 (persist:claude 세션 사용)
 * - Electron 앱 실행 중
 *
 * Claude 특화 검증:
 * - PointerEvent → MouseEvent 시퀀스
 * - TreeWalker 기반 응답 추출
 * - 콘텐츠 변화 추적 메커니즘
 */

import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import * as path from 'path';
import testPrompts from '../fixtures/test-prompts.json';

// 테스트 타임아웃 설정 (3분)
test.setTimeout(180000);

let electronApp: ElectronApplication;
let mainWindow: Page;

test.describe('Claude Single Workflow E2E', () => {
  test.beforeAll(async () => {
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../../dist/main/index.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
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
    test('[CLAUDE-LOGIN-01] user-menu-button 셀렉터 존재 확인', async () => {
      const result = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:checkLogin', 'claude');
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    test('[CLAUDE-LOGIN-02] Fallback 6개 셀렉터 순차 시도', async () => {
      // fallback 셀렉터가 동작하는지 확인
      const result = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:checkLoginWithFallback', 'claude');
      });

      expect(result.success).toBe(true);
      expect(result.usedSelector).toBeDefined();
    });
  });

  test.describe('Checklist: 프롬프트 입력 (enterPrompt)', () => {
    test('[CLAUDE-PROMPT-01] chat-input-ssr 셀렉터 확인 (Issue #11)', async () => {
      const prompt = testPrompts.simple.prompt;

      const result = await mainWindow.evaluate(async (p: string) => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:enterPrompt', 'claude', p);
      }, prompt);

      expect(result.success).toBe(true);
    });

    test('[CLAUDE-PROMPT-02] Fallback contenteditable div', async () => {
      // textarea가 없을 경우 contenteditable 사용 확인
      const result = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:getInputMethod', 'claude');
      });

      expect(['textarea', 'contenteditable']).toContain(result.method);
    });

    test('[CLAUDE-PROMPT-03] input 이벤트 정상 발생', async () => {
      const prompt = '테스트 입력';

      await mainWindow.evaluate(async (p: string) => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:enterPrompt', 'claude', p);
      }, prompt);

      // 입력 후 값 확인
      const inputValue = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:getInputValue', 'claude');
      });

      expect(inputValue).toContain('테스트 입력');
    });
  });

  test.describe('Checklist: 메시지 전송 (submitMessage)', () => {
    test('[CLAUDE-SEND-01] PointerEvent → MouseEvent 시퀀스 동작', async () => {
      await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:enterPrompt', 'claude', '테스트');
      });

      const result = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:submitMessage', 'claude');
      });

      expect(result.success).toBe(true);
    });

    test('[CLAUDE-SEND-02] 한국어 aria-label "메시지 보내기" 확인', async () => {
      const result = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:getSendButtonSelector', 'claude');
      });

      // 한국어 또는 영어 셀렉터가 사용되어야 함
      expect(result.selector).toMatch(/메시지 보내기|Send message/);
    });

    test('[CLAUDE-SEND-03] Fallback Enter 키', async () => {
      // 버튼 클릭 실패 시 Enter 키가 동작하는지 확인
      const result = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:testEnterKeyFallback', 'claude');
      });

      expect(result.enterKeyWorks).toBe(true);
    });
  });

  test.describe('Checklist: 응답 대기 (awaitResponse)', () => {
    test('[CLAUDE-WAIT-01] Stop 버튼 존재 = 응답 중', async () => {
      // 메시지 전송 후 Stop 버튼 확인
      await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        await ipcRenderer.invoke('adapter:enterPrompt', 'claude', '안녕하세요');
        return await ipcRenderer.invoke('adapter:submitMessage', 'claude');
      });

      const hasStopButton = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:hasStopButton', 'claude');
      });

      // 응답 생성 중이면 Stop 버튼이 있어야 함
      expect(hasStopButton).toBe(true);
    });

    test('[CLAUDE-WAIT-02] Send 버튼 disabled = 응답 중', async () => {
      const isDisabled = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:isSendButtonDisabled', 'claude');
      });

      expect(isDisabled).toBe(true);
    });

    test('[CLAUDE-WAIT-03] contentStableThreshold (2초) 동작', async () => {
      // 응답 완료 대기
      const result = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:awaitResponse', 'claude', 120000);
      });

      expect(result.success).toBe(true);
    });
  });

  test.describe('Checklist: 응답 추출 (getResponse)', () => {
    test('[CLAUDE-RESPONSE-01] TreeWalker 기반 DOM 분석 동작', async () => {
      const result = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:getResponse', 'claude');
      });

      expect(result.success).toBe(true);
      expect(typeof result.data).toBe('string');
    });

    test('[CLAUDE-RESPONSE-02] 50자 이상 텍스트 노드 검색', async () => {
      // 긴 응답 요청
      await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        await ipcRenderer.invoke('adapter:enterPrompt', 'claude', '100단어로 프로그래밍에 대해 설명해주세요.');
        await ipcRenderer.invoke('adapter:submitMessage', 'claude');
        return await ipcRenderer.invoke('adapter:awaitResponse', 'claude', 120000);
      });

      const result = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:getResponse', 'claude');
      });

      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(50);
    });

    test('[CLAUDE-RESPONSE-03] Fallback 6개 응답 셀렉터', async () => {
      const result = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:getResponseWithFallback', 'claude');
      });

      expect(result.success).toBe(true);
      expect(result.usedMethod).toBeDefined(); // 'treeWalker' or 'selector'
    });
  });

  test.describe('Checklist: 진행상태 모니터링', () => {
    test('[CLAUDE-PROGRESS-01] isWriting Stop/Send 버튼 상태 기반', async () => {
      // 새 메시지 전송
      await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        await ipcRenderer.invoke('adapter:enterPrompt', 'claude', '짧게 답해주세요: 2+2=?');
        return await ipcRenderer.invoke('adapter:submitMessage', 'claude');
      });

      const isWriting = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:isWriting', 'claude');
      });

      expect(isWriting).toBe(true);

      // 응답 완료 대기
      await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:awaitResponse', 'claude', 60000);
      });

      const isWritingAfter = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:isWriting', 'claude');
      });

      expect(isWritingAfter).toBe(false);
    });

    test('[CLAUDE-PROGRESS-02] 콘텐츠 변화 추적 동작', async () => {
      // 콘텐츠 변화 추적 상태 확인
      const trackingState = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:getContentTrackingState', 'claude');
      });

      expect(trackingState).toHaveProperty('lastResponseContent');
      expect(trackingState).toHaveProperty('lastContentChangeTime');
    });

    test('[CLAUDE-PROGRESS-03] resetContentTracking 호출 확인', async () => {
      // 새 메시지 전송 전 resetContentTracking 호출됨
      const result = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        await ipcRenderer.invoke('adapter:resetContentTracking', 'claude');
        const state = await ipcRenderer.invoke('adapter:getContentTrackingState', 'claude');
        return state;
      });

      expect(result.lastResponseContent).toBe('');
    });
  });

  test.describe('Full Workflow Integration', () => {
    test('[CLAUDE-FULL-01] 전체 워크플로우: 입력 -> 전송 -> 모니터링 -> 추출', async () => {
      const prompt = testPrompts.longResponse.prompt;
      const startTime = Date.now();

      // Step 1: 입력창 준비
      const prepareResult = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:prepareInput', 'claude', 10000);
      });
      expect(prepareResult.success).toBe(true);

      // Step 2: 프롬프트 입력
      const enterResult = await mainWindow.evaluate(async (p: string) => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:enterPrompt', 'claude', p);
      }, prompt);
      expect(enterResult.success).toBe(true);

      // Step 3: 메시지 전송
      const submitResult = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('adapter:submitMessage', 'claude');
      });
      expect(submitResult.success).toBe(true);

      // Step 4: 진행상태 모니터링
      let progressCallCount = 0;
      let isWriting = true;

      while (isWriting && Date.now() - startTime < 120000) {
        const status = await mainWindow.evaluate(async () => {
          const { ipcRenderer } = require('electron');
          const isWriting = await ipcRenderer.invoke('adapter:isWriting', 'claude');
          const tokenCount = await ipcRenderer.invoke('adapter:getTokenCount', 'claude');
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
        return await ipcRenderer.invoke('adapter:getResponse', 'claude');
      });
      expect(getResult.success).toBe(true);

      // 성공 기준 검증
      const elapsed = Date.now() - startTime;
      expect(getResult.data.length).toBeGreaterThan(testPrompts.longResponse.expectedMinLength);
      expect(elapsed).toBeLessThan(testPrompts.longResponse.expectedMaxResponseTime);
    });
  });
});
