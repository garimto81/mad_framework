/* global console, process, window, setTimeout */
/**
 * Claude 응답 추출 테스트 스크립트
 * 앱 내에서 메시지 전송 후 DOM 분석
 */

import { chromium } from 'playwright';

async function runTest() {
  console.log('=== Claude 응답 추출 테스트 ===\n');

  // CDP로 실행 중인 앱에 연결
  let browser;
  try {
    browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  } catch (e) {
    console.error('CDP 연결 실패. 앱을 디버그 모드로 실행해주세요.');
    console.error('다음 명령으로 실행: npm run dev:debug');
    process.exit(1);
  }

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

  // Claude 로그인 확인
  const loginResult = await mainWindow.evaluate(async () => {
    return await window.electronAPI.adapter.checkLogin('claude');
  });

  console.log('Claude 로그인 상태:', loginResult.success && loginResult.data);

  if (!loginResult.success || !loginResult.data) {
    console.error('Claude 로그인 필요');
    await browser.close();
    process.exit(1);
  }

  // Claude BrowserView에서 DOM 분석
  console.log('\n--- Claude BrowserView DOM 분석 ---\n');

  // Claude 페이지 활성화
  await mainWindow.evaluate(async () => {
    await window.electronAPI.login.openLoginWindow('claude');
  });
  await new Promise(r => setTimeout(r, 3000));

  // DOM 분석 실행 (adapter를 통해)
  const domAnalysis = await mainWindow.evaluate(async () => {
    // BrowserView의 webContents에서 직접 실행
    const script = `
      (() => {
        const result = {
          url: window.location.href,
          main: null,
          allDataTestIds: [],
          messageElements: [],
          textContainers: [],
        };

        // 모든 data-testid 수집
        document.querySelectorAll('[data-testid]').forEach(el => {
          const testId = el.getAttribute('data-testid');
          if (!result.allDataTestIds.includes(testId)) {
            result.allDataTestIds.push(testId);
          }
        });

        // main 태그 분석
        const main = document.querySelector('main');
        if (main) {
          result.main = {
            exists: true,
            childCount: main.children.length,
            classes: main.className,
            innerHTML: main.innerHTML?.substring(0, 1000),
          };
        }

        // 텍스트가 있는 모든 요소 찾기 (main 하위)
        if (main) {
          const walker = document.createTreeWalker(
            main,
            NodeFilter.SHOW_ELEMENT,
            {
              acceptNode: (node) => {
                const text = node.innerText || node.textContent || '';
                if (text.trim().length > 10 &&
                    !node.closest('[contenteditable]') &&
                    !node.closest('textarea') &&
                    !node.closest('fieldset')) {
                  return NodeFilter.FILTER_ACCEPT;
                }
                return NodeFilter.FILTER_SKIP;
              }
            }
          );

          let count = 0;
          let node;
          while ((node = walker.nextNode()) && count < 30) {
            result.textContainers.push({
              tagName: node.tagName,
              className: node.className?.toString?.()?.substring(0, 150),
              textLength: (node.innerText || node.textContent || '').length,
              textPreview: (node.innerText || node.textContent || '').substring(0, 100),
              dataTestId: node.getAttribute('data-testid'),
              dataAttrs: Object.keys(node.dataset || {}),
              parentTagName: node.parentElement?.tagName,
              parentClass: node.parentElement?.className?.toString?.()?.substring(0, 100),
            });
            count++;
          }
        }

        return result;
      })()
    `;

    // executeJavaScript를 직접 호출하는 것은 불가능하므로
    // 대신 adapter의 getResponse를 확장 버전으로 호출
    return await window.electronAPI.adapter.analyzeClaudeDOM?.() ||
           { error: 'analyzeClaudeDOM not available' };
  });

  console.log('DOM 분석 결과:', JSON.stringify(domAnalysis, null, 2));

  await browser.close();
  console.log('\n=== 테스트 완료 ===');
}

runTest().catch(err => {
  console.error('테스트 오류:', err);
  process.exit(1);
});
