/* global console, process, window, setTimeout */
/**
 * Claude.ai DOM 구조 분석 스크립트
 * 응답 컨테이너 셀렉터 식별용
 */

import { chromium } from 'playwright';

async function analyzeDom() {
  console.log('=== Claude.ai DOM 분석 ===\n');

  // CDP로 실행 중인 앱에 연결
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const contexts = browser.contexts();
  const context = contexts[0];
  const pages = context.pages();

  console.log('연결된 페이지 수:', pages.length);

  // Claude 페이지 찾기
  const claudePage = pages.find(p => p.url().includes('claude.ai'));
  if (!claudePage) {
    console.error('Claude 페이지를 찾을 수 없습니다.');
    console.log('현재 페이지 URL들:', pages.map(p => p.url()));
    await browser.close();
    process.exit(1);
  }

  console.log('Claude 페이지 URL:', claudePage.url());
  console.log('\n--- DOM 구조 분석 ---\n');

  // DOM 분석 스크립트
  const analysis = await claudePage.evaluate(() => {
    const result = {
      main: null,
      articles: [],
      possibleContainers: [],
      dataTestIds: [],
      proseElements: [],
      conversationElements: [],
    };

    // main 태그 분석
    const main = document.querySelector('main');
    if (main) {
      result.main = {
        exists: true,
        childCount: main.children.length,
        innerHTML: main.innerHTML.substring(0, 500),
      };
    }

    // article 요소들
    document.querySelectorAll('article').forEach((el, i) => {
      result.articles.push({
        index: i,
        className: el.className,
        textLength: el.textContent?.length || 0,
        dataAttrs: Object.keys(el.dataset),
      });
    });

    // data-testid 속성을 가진 요소들
    document.querySelectorAll('[data-testid]').forEach(el => {
      const testId = el.getAttribute('data-testid');
      if (testId && (testId.includes('message') || testId.includes('turn') || testId.includes('conversation') || testId.includes('assistant'))) {
        result.dataTestIds.push({
          testId,
          tagName: el.tagName,
          className: el.className?.toString?.().substring(0, 100),
          textLength: el.textContent?.length || 0,
        });
      }
    });

    // prose 클래스 요소들
    document.querySelectorAll('.prose, [class*="prose"]').forEach((el, i) => {
      result.proseElements.push({
        index: i,
        tagName: el.tagName,
        className: el.className?.toString?.().substring(0, 100),
        textLength: el.textContent?.length || 0,
        isContentEditable: el.getAttribute('contenteditable') === 'true',
      });
    });

    // 대화 관련 요소 (main 하위)
    if (main) {
      // main 직계 자식 중 텍스트가 있는 div들
      Array.from(main.querySelectorAll('div')).slice(0, 50).forEach((el, i) => {
        const text = el.textContent?.trim() || '';
        if (text.length > 50 && !el.closest('[contenteditable]') && !el.closest('textarea') && !el.closest('fieldset')) {
          result.conversationElements.push({
            index: i,
            tagName: el.tagName,
            className: el.className?.toString?.().substring(0, 150),
            textPreview: text.substring(0, 100),
            textLength: text.length,
            dataAttrs: Object.keys(el.dataset),
            parentClass: el.parentElement?.className?.toString?.().substring(0, 100),
          });
        }
      });
    }

    // 가능한 응답 컨테이너 셀렉터 테스트
    const testSelectors = [
      '[data-testid*="message"]',
      '[data-testid*="turn"]',
      '[data-testid*="conversation"]',
      '[data-testid*="assistant"]',
      'main article',
      'main .prose',
      'main div[class*="font-"]',
      'main div[class*="text-"]',
      '.whitespace-pre-wrap',
      'div[class*="whitespace-pre-wrap"]',
      'main div > p',
      '[class*="markdown"]',
      '[class*="response"]',
    ];

    testSelectors.forEach(sel => {
      try {
        const elements = document.querySelectorAll(sel);
        if (elements.length > 0) {
          result.possibleContainers.push({
            selector: sel,
            count: elements.length,
            samples: Array.from(elements).slice(0, 3).map(el => ({
              tagName: el.tagName,
              className: el.className?.toString?.().substring(0, 100),
              textLength: el.textContent?.length || 0,
              textPreview: el.textContent?.substring(0, 50),
            })),
          });
        }
      } catch (e) {
        // Skip invalid selectors
      }
    });

    return result;
  });

  console.log('=== 분석 결과 ===\n');
  console.log('1. main 태그:', analysis.main ? '존재' : '없음');
  if (analysis.main) {
    console.log('   - 자식 수:', analysis.main.childCount);
  }

  console.log('\n2. article 요소들:', analysis.articles.length);
  analysis.articles.forEach(a => {
    console.log(`   [${a.index}] class: ${a.className}, textLen: ${a.textLength}`);
  });

  console.log('\n3. data-testid (message/turn/conversation 관련):');
  analysis.dataTestIds.forEach(d => {
    console.log(`   - ${d.testId}: <${d.tagName}> textLen=${d.textLength}`);
  });

  console.log('\n4. prose 요소들:', analysis.proseElements.length);
  analysis.proseElements.forEach(p => {
    console.log(`   [${p.index}] <${p.tagName}> class: ${p.className?.substring(0, 50)} textLen=${p.textLength} editable=${p.isContentEditable}`);
  });

  console.log('\n5. 가능한 응답 컨테이너:');
  analysis.possibleContainers.forEach(c => {
    console.log(`\n   selector: "${c.selector}" (count: ${c.count})`);
    c.samples.forEach((s, i) => {
      console.log(`     [${i}] <${s.tagName}> textLen=${s.textLength} preview="${s.textPreview?.substring(0, 30)}..."`);
    });
  });

  console.log('\n6. 대화 요소들 (main 하위):');
  analysis.conversationElements.slice(0, 10).forEach(c => {
    console.log(`\n   [${c.index}] class: ${c.className?.substring(0, 80)}`);
    console.log(`     textLen: ${c.textLength}, preview: "${c.textPreview?.substring(0, 50)}..."`);
    console.log(`     parentClass: ${c.parentClass?.substring(0, 80)}`);
    if (c.dataAttrs.length) console.log(`     dataAttrs: ${c.dataAttrs.join(', ')}`);
  });

  await browser.close();
  console.log('\n=== 분석 완료 ===');
}

analyzeDom().catch(err => {
  console.error('분석 오류:', err);
  process.exit(1);
});
