/**
 * ChatGPT 10회 연속 테스트 스크립트
 * CDP를 통해 실행 중인 앱에 연결하여 테스트
 */

import { chromium } from 'playwright';

async function runTest() {
  console.log('=== ChatGPT 10회 연속 메시지 테스트 ===\n');

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

  // ChatGPT 뷰 활성화
  await mainWindow.evaluate(async () => {
    await window.electronAPI.login.openLoginWindow('chatgpt');
  });
  await new Promise(r => setTimeout(r, 3000));

  const prompts = [
    '1+1=?', '2+2=?', '3+3=?', '4+4=?', '5+5=?',
    '6+6=?', '7+7=?', '8+8=?', '9+9=?', '10+10=?'
  ];

  const results = [];
  let successCount = 0;

  for (let i = 0; i < 10; i++) {
    const cycle = i + 1;
    const prompt = prompts[i];
    const startTime = Date.now();

    console.log(`--- [${cycle}/10] ${prompt} ---`);

    try {
      // Step 1: 입력 준비
      const prepareResult = await mainWindow.evaluate(async () => {
        return await window.electronAPI.adapter.prepareInput('chatgpt', 15000);
      });
      if (!prepareResult.success) throw new Error('입력 준비 실패');

      // Step 2: 프롬프트 입력
      const enterResult = await mainWindow.evaluate(async (p) => {
        return await window.electronAPI.adapter.enterPrompt('chatgpt', p);
      }, prompt);
      if (!enterResult.success) throw new Error('프롬프트 입력 실패');

      // Step 3: 메시지 전송
      const submitResult = await mainWindow.evaluate(async () => {
        return await window.electronAPI.adapter.submitMessage('chatgpt');
      });
      if (!submitResult.success) throw new Error('메시지 전송 실패');

      // Step 4: 응답 대기
      const awaitResult = await mainWindow.evaluate(async () => {
        return await window.electronAPI.adapter.awaitResponse('chatgpt', 120000);
      });
      if (!awaitResult.success) throw new Error('응답 대기 실패');

      // Step 5: 응답 추출
      const getResult = await mainWindow.evaluate(async () => {
        return await window.electronAPI.adapter.getResponse('chatgpt');
      });

      const elapsed = Date.now() - startTime;

      if (getResult.success && getResult.data) {
        successCount++;
        const preview = getResult.data.substring(0, 80).replace(/\n/g, ' ');
        console.log(`  ✅ 성공 (${elapsed}ms): ${preview}...`);
        results.push({ cycle, success: true, elapsed, length: getResult.data.length });
      } else {
        console.log(`  ❌ 실패: 응답 추출 실패`);
        results.push({ cycle, success: false, elapsed, error: '응답 추출 실패' });
      }
    } catch (err) {
      const elapsed = Date.now() - startTime;
      console.log(`  ❌ 실패: ${err.message}`);
      results.push({ cycle, success: false, elapsed, error: err.message });
    }

    // 다음 테스트 전 대기
    if (i < 9) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  // 결과 요약
  console.log('\n=== 테스트 결과 ===');
  console.log(`성공: ${successCount}/10 (${successCount * 10}%)`);
  console.log(`목표: 90% 이상`);
  console.log(`결과: ${successCount >= 9 ? '✅ 통과' : '❌ 실패'}`);

  await browser.close();
  process.exit(successCount >= 9 ? 0 : 1);
}

runTest().catch(err => {
  console.error('테스트 오류:', err);
  process.exit(1);
});
