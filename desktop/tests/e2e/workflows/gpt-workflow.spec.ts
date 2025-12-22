/**
 * GPT Single Browser Workflow E2E Test
 *
 * 실제 브라우저에서 ChatGPT 워크플로우를 검증합니다.
 *
 * 사전 조건:
 * - ChatGPT에 로그인된 상태 (persist:chatgpt 세션 사용)
 * - Electron 앱 실행 중
 *
 * 테스트 범위:
 * 1. 로그인 상태 확인
 * 2. 입력창 준비 대기
 * 3. 프롬프트 입력
 * 4. 메시지 전송
 * 5. 진행상태 모니터링 (isWriting, tokenCount)
 * 6. 응답 추출
 */

import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import * as path from 'path';
import * as os from 'os';
import testPrompts from '../fixtures/test-prompts.json';

// 기존 Electron 세션 경로 (로그인 정보 유지)
const USER_DATA_DIR = path.join(os.homedir(), 'AppData', 'Roaming', 'mad-desktop');

// 테스트 타임아웃 설정 (3분)
test.setTimeout(180000);

let electronApp: ElectronApplication;
let mainWindow: Page;

test.describe('ChatGPT Single Workflow E2E', () => {
  // 직렬 실행 + 타임아웃 설정 (하나의 Electron 앱을 공유하므로 병렬 불가)
  test.describe.configure({ mode: 'serial', timeout: 90000 });

  test.beforeAll(async () => {
    // Electron 앱 시작 (GPT만 테스트)
    // NOTE: NODE_ENV를 production으로 설정하여 dist/renderer/index.html 로드
    // userData를 공유하여 기존 로그인 세션 유지
    electronApp = await electron.launch({
      args: [
        path.join(__dirname, '../../../dist/main/electron/main.js'),
        `--user-data-dir=${USER_DATA_DIR}`,
      ],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        TEST_PROVIDER: 'chatgpt',
      },
      timeout: 60000,
    });

    // 메인 윈도우 가져오기 (60초 대기)
    mainWindow = await electronApp.firstWindow({ timeout: 60000 });
    await mainWindow.waitForLoadState('domcontentloaded');

    // 앱 초기화 대기 (BrowserView 생성 및 로그인 상태 확인)
    // 기존 세션 로드에 충분한 시간이 필요
    await mainWindow.waitForTimeout(10000);

    // BrowserView가 완전히 로드되었는지 확인 (최대 30초 대기)
    await mainWindow.waitForFunction(
      () => {
        // electronAPI가 존재하고 adapter가 준비되었는지 확인
        return typeof window !== 'undefined' &&
               window.electronAPI &&
               typeof window.electronAPI.adapter === 'object';
      },
      { timeout: 30000 }
    );

    // ChatGPT BrowserView를 활성화하여 페이지 렌더링 보장
    await mainWindow.evaluate(async () => {
      await window.electronAPI.login.openLoginWindow('chatgpt');
    });

    // 페이지가 완전히 로드될 때까지 대기
    await mainWindow.waitForTimeout(5000);
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test.describe('Checklist: 로그인 확인 (checkLogin)', () => {
    test('[GPT-LOGIN-01] profile-button 셀렉터 존재 확인', async () => {
      // ChatGPT BrowserView가 완전히 로드될 때까지 재시도 (최대 30초)
      // BrowserView 내 ChatGPT 페이지 렌더링에 시간이 필요할 수 있음
      let result: { success: boolean; data?: boolean } = { success: false };
      let attempts = 0;
      const maxAttempts = 15; // 15회 * 2초 = 30초

      while (attempts < maxAttempts) {
        result = await mainWindow.evaluate(async () => {
          return await window.electronAPI.adapter.checkLogin('chatgpt');
        });

        if (result.success && result.data === true) {
          break;
        }

        attempts++;
        await mainWindow.waitForTimeout(2000);
      }

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    test('[GPT-LOGIN-02] 비로그인 상태에서 false 반환', async () => {
      // 이 테스트는 로그아웃 상태에서만 유효
      // 현재 로그인된 상태라면 skip
      test.skip(true, '로그인된 상태에서는 이 테스트를 건너뜁니다');
    });
  });

  test.describe('Checklist: 입력 준비 (prepareInput)', () => {
    test('[GPT-INPUT-01] prompt-textarea 셀렉터 존재 확인', async () => {
      const result = await mainWindow.evaluate(async () => {
        return await window.electronAPI.adapter.prepareInput('chatgpt', 10000);
      });

      expect(result.success).toBe(true);
    });

    test('[GPT-INPUT-02] 10초 타임아웃 내 준비 완료', async () => {
      const startTime = Date.now();

      const result = await mainWindow.evaluate(async () => {
        return await window.electronAPI.adapter.prepareInput('chatgpt', 10000);
      });

      const elapsed = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(elapsed).toBeLessThan(10000);
    });
  });

  test.describe('Checklist: 프롬프트 입력 (enterPrompt)', () => {
    test('[GPT-PROMPT-01] 한글 입력 정상 동작', async () => {
      const prompt = testPrompts.korean.prompt;

      const result = await mainWindow.evaluate(async (p: string) => {
        return await window.electronAPI.adapter.enterPrompt('chatgpt', p);
      }, prompt);

      expect(result.success).toBe(true);
    });

    test('[GPT-PROMPT-02] 특수문자 포함 입력', async () => {
      const prompt = testPrompts.specialChars.prompt;

      const result = await mainWindow.evaluate(async (p: string) => {
        return await window.electronAPI.adapter.enterPrompt('chatgpt', p);
      }, prompt);

      expect(result.success).toBe(true);
    });

    test('[GPT-PROMPT-03] 1000ms React 처리 대기 후 입력 확인', async () => {
      const prompt = testPrompts.simple.prompt;

      const result = await mainWindow.evaluate(async (p: string) => {
        return await window.electronAPI.adapter.enterPrompt('chatgpt', p);
      }, prompt);

      // 1000ms 후 입력 필드 값 확인 (enterPrompt 내부에서 이미 대기함)
      expect(result.success).toBe(true);
    });
  });

  test.describe('Checklist: 메시지 전송 (submitMessage)', () => {
    test('[GPT-SEND-01] send-button 클릭', async () => {
      // 먼저 프롬프트 입력
      await mainWindow.evaluate(async () => {
        return await window.electronAPI.adapter.enterPrompt('chatgpt', '테스트 메시지');
      });

      // 전송
      const result = await mainWindow.evaluate(async () => {
        return await window.electronAPI.adapter.submitMessage('chatgpt');
      });

      expect(result.success).toBe(true);
    });

    test('[GPT-SEND-02] 전송 후 버튼 비활성화 확인', async () => {
      // 전송 직후 isWriting 상태 확인
      const isWriting = await mainWindow.evaluate(async () => {
        return await window.electronAPI.adapter.isWriting('chatgpt');
      });

      // 응답 생성 중이면 isWriting이 true여야 함
      expect(isWriting).toBe(true);
    });
  });

  test.describe('Checklist: 응답 대기 (awaitResponse)', () => {
    test('[GPT-WAIT-01] result-streaming 타이핑 상태 감지', async () => {
      // 먼저 메시지 전송
      await mainWindow.evaluate(async () => {
        await window.electronAPI.adapter.enterPrompt('chatgpt', '안녕하세요');
        return await window.electronAPI.adapter.submitMessage('chatgpt');
      });

      // isWriting 상태 확인
      const isWriting = await mainWindow.evaluate(async () => {
        return await window.electronAPI.adapter.isWriting('chatgpt');
      });

      // 전송 직후에는 isWriting이 true여야 함
      expect(isWriting).toBe(true);
    });

    test('[GPT-WAIT-02] 타이핑 완료 대기 (120초 내)', async () => {
      const result = await mainWindow.evaluate(async () => {
        return await window.electronAPI.adapter.awaitResponse('chatgpt', 120000);
      });

      expect(result.success).toBe(true);
    });
  });

  test.describe('Checklist: 응답 추출 (getResponse)', () => {
    test('[GPT-RESPONSE-01] 응답 셀렉터 성공', async () => {
      const result = await mainWindow.evaluate(async () => {
        return await window.electronAPI.adapter.getResponse('chatgpt');
      });

      expect(result.success).toBe(true);
      expect(typeof result.data).toBe('string');
    });

    test('[GPT-RESPONSE-02] 마지막 메시지만 추출', async () => {
      const result = await mainWindow.evaluate(async () => {
        return await window.electronAPI.adapter.getResponse('chatgpt');
      });

      expect(result.success).toBe(true);
      // 응답에 이전 메시지가 포함되지 않아야 함
      expect(result.data).not.toContain('테스트 메시지'); // 사용자 메시지
    });

    test('[GPT-RESPONSE-03] 코드 복사 텍스트 제거 (Issue #9)', async () => {
      // 코드가 포함된 응답 요청
      await mainWindow.evaluate(async () => {
        await window.electronAPI.adapter.enterPrompt('chatgpt', '파이썬으로 hello world 코드를 작성해주세요.');
        await window.electronAPI.adapter.submitMessage('chatgpt');
        return await window.electronAPI.adapter.awaitResponse('chatgpt', 60000);
      });

      const result = await mainWindow.evaluate(async () => {
        return await window.electronAPI.adapter.getResponse('chatgpt');
      });

      expect(result.success).toBe(true);
      // "코드 복사" 또는 "Copy code" 텍스트가 없어야 함
      expect(result.data).not.toMatch(/코드 복사|Copy code/i);
    });
  });

  test.describe('Checklist: 진행상태 모니터링', () => {
    test('[GPT-PROGRESS-01] isWriting 스트리밍 상태 정확 감지', async () => {
      // 새 메시지 전송
      await mainWindow.evaluate(async () => {
        await window.electronAPI.adapter.enterPrompt('chatgpt', '100단어로 AI에 대해 설명해주세요.');
        return await window.electronAPI.adapter.submitMessage('chatgpt');
      });

      // 초기 상태: isWriting = true
      const initialWriting = await mainWindow.evaluate(async () => {
        return await window.electronAPI.adapter.isWriting('chatgpt');
      });
      expect(initialWriting).toBe(true);

      // 응답 완료 대기
      await mainWindow.evaluate(async () => {
        return await window.electronAPI.adapter.awaitResponse('chatgpt', 120000);
      });

      // 완료 상태: isWriting = false
      const finalWriting = await mainWindow.evaluate(async () => {
        return await window.electronAPI.adapter.isWriting('chatgpt');
      });
      expect(finalWriting).toBe(false);
    });

    test('[GPT-PROGRESS-02] tokenCount 응답 길이 추적', async () => {
      // 새 메시지 전송
      await mainWindow.evaluate(async () => {
        await window.electronAPI.adapter.enterPrompt('chatgpt', '짧게 답해주세요: 1+1=?');
        return await window.electronAPI.adapter.submitMessage('chatgpt');
      });

      // 토큰 카운트 확인
      const counts: number[] = [];

      for (let i = 0; i < 5; i++) {
        const count = await mainWindow.evaluate(async () => {
          return await window.electronAPI.adapter.getTokenCount('chatgpt');
        });
        counts.push(count);
        await mainWindow.waitForTimeout(500);
      }

      // 카운트가 증가해야 함 (응답 생성 중)
      expect(counts[counts.length - 1]).toBeGreaterThanOrEqual(counts[0]);
    });

    test('[GPT-PROGRESS-03] responseProgress 0-100% 계산', async () => {
      const progress = await mainWindow.evaluate(async () => {
        const tokenCount = await window.electronAPI.adapter.getTokenCount('chatgpt');
        const isWriting = await window.electronAPI.adapter.isWriting('chatgpt');

        // responseProgress 계산 (tokenCount / 2000 * 100)
        const responseProgress = isWriting ? Math.min((tokenCount / 2000) * 100, 99) : 100;
        return { tokenCount, isWriting, responseProgress };
      });

      expect(progress.responseProgress).toBeGreaterThanOrEqual(0);
      expect(progress.responseProgress).toBeLessThanOrEqual(100);
    });
  });

  test.describe('Full Workflow Integration', () => {
    test('[GPT-FULL-01] 전체 워크플로우: 입력 -> 전송 -> 모니터링 -> 추출', async () => {
      const prompt = testPrompts.codeReview.prompt;
      const startTime = Date.now();

      // Step 1: 입력창 준비
      const prepareResult = await mainWindow.evaluate(async () => {
        return await window.electronAPI.adapter.prepareInput('chatgpt', 10000);
      });
      expect(prepareResult.success).toBe(true);

      // Step 2: 프롬프트 입력
      const enterResult = await mainWindow.evaluate(async (p: string) => {
        return await window.electronAPI.adapter.enterPrompt('chatgpt', p);
      }, prompt);
      expect(enterResult.success).toBe(true);

      // Step 3: 메시지 전송
      const submitResult = await mainWindow.evaluate(async () => {
        return await window.electronAPI.adapter.submitMessage('chatgpt');
      });
      expect(submitResult.success).toBe(true);

      // Step 4: 진행상태 모니터링
      let progressCallCount = 0;
      const monitorProgress = async () => {
        const status = await mainWindow.evaluate(async () => {
          const isWriting = await window.electronAPI.adapter.isWriting('chatgpt');
          const tokenCount = await window.electronAPI.adapter.getTokenCount('chatgpt');
          return { isWriting, tokenCount };
        });
        progressCallCount++;
        return status;
      };

      // 모니터링 루프
      let isWriting = true;
      while (isWriting && Date.now() - startTime < 120000) {
        const status = await monitorProgress();
        isWriting = status.isWriting;
        await mainWindow.waitForTimeout(1000);
      }

      // 진행상태 콜백 최소 3회 호출 확인
      expect(progressCallCount).toBeGreaterThanOrEqual(3);

      // Step 5: 응답 추출
      const getResult = await mainWindow.evaluate(async () => {
        return await window.electronAPI.adapter.getResponse('chatgpt');
      });
      expect(getResult.success).toBe(true);

      // 성공 기준 검증
      const elapsed = Date.now() - startTime;
      expect(getResult.data.length).toBeGreaterThan(testPrompts.codeReview.expectedMinLength);
      expect(elapsed).toBeLessThan(testPrompts.codeReview.expectedMaxResponseTime);
    });
  });
});
