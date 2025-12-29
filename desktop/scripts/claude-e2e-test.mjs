/* global console, process, window, setTimeout */
/**
 * Claude 실제 연동 E2E 테스트 스크립트
 * CDP를 통해 실행 중인 앱에 연결하여 테스트
 */

import { chromium } from 'playwright';

async function runTest() {
  console.log('=== Claude 실제 연동 E2E 테스트 ===\n');

  // CDP로 실행 중인 앱에 연결
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const contexts = browser.contexts();
  const context = contexts[0];
  const pages = context.pages();

  console.log('연결된 페이지 수:', pages.length);

  // MAD 메인 윈도우 찾기
  const mainWindow = pages.find(p => p.url().includes('index.html'));
  if (!mainWindow) {
    console.error('MAD 메인 윈도우를 찾을 수 없습니다.');
    await browser.close();
    process.exit(1);
  }

  console.log('메인 윈도우 URL:', mainWindow.url());
  console.log('\n--- Claude 로그인 상태 확인 ---');

  // Claude 로그인 확인
  const loginResult = await mainWindow.evaluate(async () => {
    return await window.electronAPI.adapter.checkLogin('claude');
  });

  console.log('로그인 상태:', JSON.stringify(loginResult, null, 2));

  if (!loginResult.success || !loginResult.data) {
    console.error('Claude 로그인 필요');
    await browser.close();
    process.exit(1);
  }

  console.log('\n--- 메시지 전송 테스트 ---');

  // Claude BrowserView 활성화
  await mainWindow.evaluate(async () => {
    await window.electronAPI.login.openLoginWindow('claude');
  });
  await new Promise(r => setTimeout(r, 5000));

  const prompt = '1+1=? (한 줄로 답해줘)';
  console.log('프롬프트:', prompt);

  // Step 1: 입력 준비
  console.log('\nStep 1: 입력 준비...');
  const prepareResult = await mainWindow.evaluate(async () => {
    return await window.electronAPI.adapter.prepareInput('claude', 15000);
  });
  console.log('결과:', prepareResult.success ? '성공' : '실패', prepareResult);

  if (!prepareResult.success) {
    console.error('입력 준비 실패');
    await browser.close();
    process.exit(1);
  }

  // Step 2: 프롬프트 입력
  console.log('\nStep 2: 프롬프트 입력...');
  const enterResult = await mainWindow.evaluate(async (p) => {
    return await window.electronAPI.adapter.enterPrompt('claude', p);
  }, prompt);
  console.log('결과:', enterResult.success ? '성공' : '실패', enterResult);

  // Step 3: 메시지 전송
  console.log('\nStep 3: 메시지 전송...');
  const submitResult = await mainWindow.evaluate(async () => {
    return await window.electronAPI.adapter.submitMessage('claude');
  });
  console.log('결과:', submitResult.success ? '성공' : '실패', submitResult);

  // Step 4: 응답 대기
  console.log('\nStep 4: 응답 대기 중... (최대 60초)');
  const awaitResult = await mainWindow.evaluate(async () => {
    return await window.electronAPI.adapter.awaitResponse('claude', 60000);
  });
  console.log('결과:', awaitResult.success ? '성공' : '실패');

  // Step 5: 응답 추출
  console.log('\nStep 5: 응답 추출...');
  const getResult = await mainWindow.evaluate(async () => {
    return await window.electronAPI.adapter.getResponse('claude');
  });

  console.log('\n========== 최종 결과 ==========');
  if (getResult.success && getResult.data) {
    console.log('✅ 테스트 성공!');
    console.log('응답 길이:', getResult.data.length, '자');
    console.log('응답 내용:\n---');
    console.log(getResult.data.substring(0, 500));
    console.log('---');
  } else {
    console.log('❌ 테스트 실패');
    console.log('에러:', JSON.stringify(getResult.error, null, 2));
  }

  await browser.close();
  console.log('\n=== 테스트 완료 ===');
  process.exit(getResult.success ? 0 : 1);
}

runTest().catch(err => {
  console.error('테스트 오류:', err);
  process.exit(1);
});
