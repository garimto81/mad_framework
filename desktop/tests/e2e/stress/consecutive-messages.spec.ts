/**
 * ChatGPT 10회 연속 메시지 전송/응답 테스트
 *
 * 실제 앱에서 ChatGPT 어댑터를 통해 10회 연속 메시지를 전송하고
 * 응답을 수신하는 자동화 테스트입니다.
 *
 * 사전 조건:
 * - ChatGPT에 로그인된 상태 (persist:chatgpt 세션 사용)
 */

import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import * as path from 'path';
import * as os from 'os';

// 기존 Electron 세션 경로 (로그인 정보 유지)
const USER_DATA_DIR = path.join(os.homedir(), 'AppData', 'Roaming', 'mad-desktop');

// 테스트 타임아웃 설정 (15분 - 10회 테스트)
test.setTimeout(900000);

let electronApp: ElectronApplication;
let mainWindow: Page;

// 테스트 결과 기록
interface TestResult {
  cycle: number;
  prompt: string;
  success: boolean;
  responseLength: number;
  responseTime: number;
  responsePreview: string;
  error?: string;
}

const testResults: TestResult[] = [];

test.describe('ChatGPT 10회 연속 메시지 테스트', () => {
  test.describe.configure({ timeout: 900000 });

  // beforeAll 타임아웃을 120초로 설정
  test.beforeAll(async (_fixtures, testInfo) => {
    testInfo.setTimeout(120000);
    console.log('\n=== ChatGPT 10회 연속 메시지 테스트 시작 ===\n');

    // Electron 앱 시작
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

    // 메인 윈도우 가져오기
    mainWindow = await electronApp.firstWindow({ timeout: 60000 });
    await mainWindow.waitForLoadState('domcontentloaded');

    // 앱 초기화 대기
    await mainWindow.waitForTimeout(10000);

    // BrowserView 준비 대기
    await mainWindow.waitForFunction(
      () => {
        return typeof window !== 'undefined' &&
               window.electronAPI &&
               typeof window.electronAPI.adapter === 'object';
      },
      { timeout: 30000 }
    );

    // ChatGPT BrowserView 활성화
    await mainWindow.evaluate(async () => {
      await window.electronAPI.login.openLoginWindow('chatgpt');
    });

    // ChatGPT 페이지 로드 대기 (BrowserView가 완전히 렌더링되도록)
    console.log('ChatGPT 페이지 로드 대기 중...');
    await mainWindow.waitForTimeout(15000);

    // 로그인 상태 확인 (최대 60초 대기)
    let loginSuccess = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      const result = await mainWindow.evaluate(async () => {
        return await window.electronAPI.adapter.checkLogin('chatgpt');
      });
      console.log(`로그인 확인 시도 ${attempt + 1}/30: ${result.success ? result.data : 'failed'}`);
      if (result.success && result.data === true) {
        loginSuccess = true;
        console.log('ChatGPT 로그인 확인 완료');
        break;
      }
      await mainWindow.waitForTimeout(2000);
    }

    if (!loginSuccess) {
      throw new Error('ChatGPT 로그인 상태 확인 실패 (60초 타임아웃)');
    }
  });

  test.afterAll(async () => {
    // 결과 출력
    console.log('\n=== 테스트 결과 요약 ===\n');
    console.log('| 회차 | 성공 | 응답길이 | 응답시간 | 프롬프트 |');
    console.log('|------|------|----------|----------|----------|');

    let successCount = 0;
    let totalResponseTime = 0;
    let totalResponseLength = 0;

    for (const result of testResults) {
      const status = result.success ? 'O' : 'X';
      console.log(`| ${result.cycle} | ${status} | ${result.responseLength} | ${result.responseTime}ms | ${result.prompt.substring(0, 20)}... |`);
      if (result.success) {
        successCount++;
        totalResponseTime += result.responseTime;
        totalResponseLength += result.responseLength;
      }
    }

    console.log('\n--- 통계 ---');
    console.log(`총 테스트: ${testResults.length}`);
    console.log(`성공: ${successCount}`);
    console.log(`실패: ${testResults.length - successCount}`);
    console.log(`성공률: ${((successCount / testResults.length) * 100).toFixed(1)}%`);
    if (successCount > 0) {
      console.log(`평균 응답시간: ${(totalResponseTime / successCount).toFixed(0)}ms`);
      console.log(`평균 응답길이: ${(totalResponseLength / successCount).toFixed(0)}자`);
    }
    console.log('\n=== 테스트 완료 ===\n');

    if (electronApp) {
      await electronApp.close();
    }
  });

  test('10회 연속 메시지 전송/응답', async () => {
    const prompts = [
      '안녕하세요! 간단히 인사해주세요.',
      '1+1은 얼마인가요?',
      '오늘 날씨가 어떤가요? 짧게 답해주세요.',
      'JavaScript에서 배열을 선언하는 방법을 알려주세요.',
      '대한민국의 수도는 어디인가요?',
      'Python과 JavaScript의 차이점을 한 문장으로 설명해주세요.',
      '가장 좋아하는 색깔은 무엇인가요? (가상으로 답해주세요)',
      'HTTP와 HTTPS의 차이를 간단히 설명해주세요.',
      '3 * 5는 얼마인가요?',
      '이 테스트가 마지막입니다. 수고하셨습니다! 라고 말해주세요.',
    ];

    for (let i = 0; i < 10; i++) {
      const cycle = i + 1;
      const prompt = prompts[i];
      const startTime = Date.now();

      console.log(`\n--- [${cycle}/10] 테스트 시작 ---`);
      console.log(`프롬프트: ${prompt}`);

      let result: TestResult = {
        cycle,
        prompt,
        success: false,
        responseLength: 0,
        responseTime: 0,
        responsePreview: '',
      };

      try {
        // Step 1: 입력 준비
        const prepareResult = await mainWindow.evaluate(async () => {
          return await window.electronAPI.adapter.prepareInput('chatgpt', 15000);
        });

        if (!prepareResult.success) {
          throw new Error('입력 준비 실패');
        }

        // Step 2: 프롬프트 입력
        const enterResult = await mainWindow.evaluate(async (p: string) => {
          return await window.electronAPI.adapter.enterPrompt('chatgpt', p);
        }, prompt);

        if (!enterResult.success) {
          throw new Error('프롬프트 입력 실패');
        }

        // Step 3: 메시지 전송
        const submitResult = await mainWindow.evaluate(async () => {
          return await window.electronAPI.adapter.submitMessage('chatgpt');
        });

        if (!submitResult.success) {
          throw new Error('메시지 전송 실패');
        }

        // Step 4: 응답 대기
        const awaitResult = await mainWindow.evaluate(async () => {
          return await window.electronAPI.adapter.awaitResponse('chatgpt', 120000);
        });

        if (!awaitResult.success) {
          throw new Error('응답 대기 실패');
        }

        // Step 5: 응답 추출
        const getResult = await mainWindow.evaluate(async () => {
          return await window.electronAPI.adapter.getResponse('chatgpt');
        });

        if (!getResult.success || !getResult.data) {
          throw new Error('응답 추출 실패');
        }

        const responseTime = Date.now() - startTime;
        const responseText = getResult.data as string;

        result = {
          cycle,
          prompt,
          success: true,
          responseLength: responseText.length,
          responseTime,
          responsePreview: responseText.substring(0, 100),
        };

        console.log(`응답 (${responseText.length}자, ${responseTime}ms): ${responseText.substring(0, 100)}...`);

        // 검증
        expect(responseText.length).toBeGreaterThan(0);

      } catch (error) {
        const responseTime = Date.now() - startTime;
        result = {
          cycle,
          prompt,
          success: false,
          responseLength: 0,
          responseTime,
          responsePreview: '',
          error: error instanceof Error ? error.message : String(error),
        };

        console.error(`오류: ${result.error}`);
      }

      testResults.push(result);

      // 다음 메시지 전 잠시 대기 (ChatGPT 쓰로틀링 방지)
      if (i < 9) {
        console.log('다음 테스트 대기 중 (3초)...');
        await mainWindow.waitForTimeout(3000);
      }
    }

    // 전체 결과 검증
    const successCount = testResults.filter(r => r.success).length;
    console.log(`\n전체 결과: ${successCount}/10 성공`);

    // 최소 8개 이상 성공해야 통과
    expect(successCount).toBeGreaterThanOrEqual(8);
  });
});
