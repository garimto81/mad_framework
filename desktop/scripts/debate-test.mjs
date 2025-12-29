/**
 * MAD 토론 테스트 스크립트
 * CDP를 통해 실행 중인 앱에 연결하여 토론 실행
 */

import { chromium } from 'playwright';

async function runDebateTest() {
  console.log('=== MAD 토론 테스트 ===\n');

  // CDP로 실행 중인 앱에 연결
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const contexts = browser.contexts();
  const context = contexts[0];
  const pages = context.pages();

  // MAD 메인 윈도우 찾기
  const mainWindow = pages.find(p => p.url().includes('index.html'));
  if (!mainWindow) {
    console.error('MAD 메인 윈도우를 찾을 수 없습니다.');
    await browser.close();
    process.exit(1);
  }

  console.log('메인 윈도우 연결 완료\n');

  // 로그인 상태 확인
  console.log('1. 로그인 상태 확인...');
  const loginStatus = await mainWindow.evaluate(async () => {
    return await window.electronAPI.login.checkStatus();
  });

  console.log('로그인 상태:');
  for (const [provider, status] of Object.entries(loginStatus)) {
    console.log(`  ${provider}: ${status.isLoggedIn ? '로그인됨' : '로그인 필요'}`);
  }

  // 모든 프로바이더 로그인 확인
  const allLoggedIn = Object.values(loginStatus).every(s => s.isLoggedIn);
  if (!allLoggedIn) {
    console.error('\n일부 프로바이더에 로그인되지 않았습니다.');
    await browser.close();
    process.exit(1);
  }

  console.log('\n2. 토론 시작...');

  // 토론 설정
  const debateConfig = {
    topic: '다음 코드의 보안 문제를 검토해주세요',
    context: `def process_user_input(data):
    result = eval(data['command'])
    return result`,
    preset: 'code_review',
    participants: ['chatgpt', 'claude'],
    judgeProvider: 'gemini',
    completionThreshold: 85,
    maxIterations: 3
  };

  console.log('토론 주제:', debateConfig.topic);
  console.log('참여자:', debateConfig.participants.join(', '));
  console.log('심판:', debateConfig.judgeProvider);
  console.log('');

  // 토론 이벤트 리스너 설정
  await mainWindow.evaluate(() => {
    window.debateProgress = [];
    window.debateResult = null;
    window.debateError = null;
    window.electronAPI.on('debate:progress', (data) => {
      window.debateProgress.push(data);
      console.log('[Progress]', JSON.stringify(data));
    });
    window.electronAPI.on('debate:complete', (result) => {
      window.debateResult = result;
      console.log('[Complete]', JSON.stringify(result));
    });
    window.electronAPI.on('debate:error', (error) => {
      window.debateError = error;
      console.log('[Error]', error);
    });
  });

  // 토론 시작
  const startTime = Date.now();
  try {
    const debateId = await mainWindow.evaluate(async (config) => {
      return await window.electronAPI.debate.start(config);
    }, debateConfig);

    console.log(`토론 ID: ${debateId}`);
    console.log('토론 진행 중...\n');

    // 토론 완료 대기 (최대 5분)
    const maxWait = 5 * 60 * 1000;
    const pollInterval = 3000;
    let elapsed = 0;

    while (elapsed < maxWait) {
      await new Promise(r => setTimeout(r, pollInterval));
      elapsed += pollInterval;

      // 진행 상황 확인
      const status = await mainWindow.evaluate(() => {
        return {
          progress: window.debateProgress.slice(-5),
          result: window.debateResult,
          error: window.debateError
        };
      });

      // 진행 상황 출력
      if (status.progress.length > 0) {
        const latest = status.progress[status.progress.length - 1];
        process.stdout.write(`\r[${Math.floor(elapsed/1000)}s] ${latest.message || latest.status || 'processing...'}`);
      }

      // 완료 또는 에러 체크
      if (status.result) {
        console.log('\n\n=== 토론 완료 ===');
        console.log(`소요 시간: ${Math.floor((Date.now() - startTime) / 1000)}초`);
        console.log('결과:', JSON.stringify(status.result, null, 2));
        break;
      }

      if (status.error) {
        console.log('\n\n=== 토론 오류 ===');
        console.log('오류:', status.error);
        break;
      }
    }

    if (elapsed >= maxWait) {
      console.log('\n\n토론 시간 초과 (5분)');
    }

  } catch (err) {
    console.error('토론 시작 오류:', err.message);
  }

  await browser.close();
  console.log('\n테스트 종료');
}

runDebateTest().catch(err => {
  console.error('테스트 오류:', err);
  process.exit(1);
});
