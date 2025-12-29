/* global console, process */
/**
 * Claude.ai DOM 구조 직접 분석 스크립트
 * Playwright로 직접 Claude.ai 접속하여 분석
 */

import { chromium } from 'playwright';

async function analyzeDom() {
  console.log('=== Claude.ai DOM 직접 분석 ===\n');

  // 브라우저 실행 (헤드리스 모드 OFF)
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1400, height: 900 },
  });

  const page = await context.newPage();

  console.log('Claude.ai 접속 중...');
  await page.goto('https://claude.ai', { waitUntil: 'networkidle' });

  console.log('현재 URL:', page.url());

  // 로그인 상태 확인 및 대기
  console.log('\n로그인 상태를 확인합니다. 로그인이 필요하면 수동으로 로그인하세요.');
  console.log('60초 대기...\n');

  await page.waitForTimeout(60000);

  console.log('\n--- DOM 구조 분석 시작 ---\n');

  // DOM 분석 스크립트
  const analysis = await page.evaluate(() => {
    const result = {
      url: window.location.href,
      main: null,
      articles: [],
      possibleContainers: [],
      dataTestIds: [],
      proseElements: [],
      conversationElements: [],
      allDataTestIds: [],
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
      };
    }

    // article 요소들
    document.querySelectorAll('article').forEach((el, i) => {
      result.articles.push({
        index: i,
        className: el.className?.toString?.().substring(0, 150),
        textLength: el.textContent?.length || 0,
        dataAttrs: Object.keys(el.dataset),
        innerHTML: el.innerHTML?.substring(0, 200),
      });
    });

    // data-testid 속성을 가진 요소들 (message/turn/conversation 관련)
    document.querySelectorAll('[data-testid]').forEach(el => {
      const testId = el.getAttribute('data-testid');
      if (testId && (testId.includes('message') || testId.includes('turn') || testId.includes('conversation') || testId.includes('assistant') || testId.includes('user'))) {
        result.dataTestIds.push({
          testId,
          tagName: el.tagName,
          className: el.className?.toString?.().substring(0, 100),
          textLength: el.textContent?.length || 0,
          textPreview: el.textContent?.substring(0, 100),
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
      Array.from(main.querySelectorAll('div')).slice(0, 100).forEach((el, i) => {
        const text = el.textContent?.trim() || '';
        if (text.length > 20 && !el.closest('[contenteditable]') && !el.closest('textarea') && !el.closest('fieldset')) {
          // 중첩된 요소 제외 (부모가 이미 추가된 경우)
          const alreadyAdded = result.conversationElements.some(c =>
            el.contains(document.querySelector(`.${c.className?.split(' ')[0]}`))
          );
          if (!alreadyAdded && result.conversationElements.length < 30) {
            result.conversationElements.push({
              index: i,
              tagName: el.tagName,
              className: el.className?.toString?.().substring(0, 200),
              textPreview: text.substring(0, 150),
              textLength: text.length,
              dataAttrs: Object.keys(el.dataset),
              parentClass: el.parentElement?.className?.toString?.().substring(0, 100),
              depth: getDepth(el, main),
            });
          }
        }
      });

      function getDepth(el, root) {
        let depth = 0;
        let current = el;
        while (current && current !== root) {
          depth++;
          current = current.parentElement;
        }
        return depth;
      }
    }

    // 가능한 응답 컨테이너 셀렉터 테스트
    const testSelectors = [
      '[data-testid*="message"]',
      '[data-testid*="turn"]',
      '[data-testid*="conversation"]',
      '[data-testid*="assistant"]',
      '[data-testid*="user"]',
      'main article',
      'main .prose',
      'main div[class*="font-"]',
      'main div[class*="text-"]',
      '.whitespace-pre-wrap',
      'div[class*="whitespace-pre-wrap"]',
      'main div > p',
      '[class*="markdown"]',
      '[class*="response"]',
      '[class*="message"]',
      'div[dir="auto"]',
      'main div[dir="auto"]',
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
              textPreview: el.textContent?.substring(0, 80),
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
  console.log('URL:', analysis.url);
  console.log('\n1. main 태그:', analysis.main ? '존재' : '없음');
  if (analysis.main) {
    console.log('   - 자식 수:', analysis.main.childCount);
    console.log('   - classes:', analysis.main.classes);
  }

  console.log('\n2. 모든 data-testid 값들:');
  console.log('   ', analysis.allDataTestIds.join(', '));

  console.log('\n3. article 요소들:', analysis.articles.length);
  analysis.articles.forEach(a => {
    console.log(`   [${a.index}] class: ${a.className}`);
    console.log(`       textLen: ${a.textLength}, dataAttrs: ${a.dataAttrs.join(', ')}`);
  });

  console.log('\n4. data-testid (message/turn/conversation 관련):');
  analysis.dataTestIds.forEach(d => {
    console.log(`   - ${d.testId}: <${d.tagName}> textLen=${d.textLength}`);
    console.log(`     class: ${d.className}`);
    if (d.textPreview) console.log(`     preview: "${d.textPreview.substring(0, 60)}..."`);
  });

  console.log('\n5. prose 요소들:', analysis.proseElements.length);
  analysis.proseElements.forEach(p => {
    console.log(`   [${p.index}] <${p.tagName}> class: ${p.className?.substring(0, 80)}`);
    console.log(`       textLen=${p.textLength} editable=${p.isContentEditable}`);
  });

  console.log('\n6. 가능한 응답 컨테이너:');
  analysis.possibleContainers.forEach(c => {
    console.log(`\n   selector: "${c.selector}" (count: ${c.count})`);
    c.samples.forEach((s, i) => {
      console.log(`     [${i}] <${s.tagName}> textLen=${s.textLength}`);
      console.log(`         class: ${s.className?.substring(0, 60)}`);
      console.log(`         preview: "${s.textPreview?.substring(0, 50)}..."`);
    });
  });

  console.log('\n7. 대화 요소들 (main 하위, depth 순):');
  analysis.conversationElements
    .sort((a, b) => a.depth - b.depth)
    .slice(0, 15)
    .forEach(c => {
      console.log(`\n   [depth=${c.depth}] class: ${c.className?.substring(0, 100)}`);
      console.log(`     textLen: ${c.textLength}, preview: "${c.textPreview?.substring(0, 60)}..."`);
      if (c.dataAttrs.length) console.log(`     dataAttrs: ${c.dataAttrs.join(', ')}`);
    });

  console.log('\n\n브라우저를 닫으려면 Enter를 누르세요...');
  await page.waitForTimeout(30000);

  await browser.close();
  console.log('\n=== 분석 완료 ===');
}

analyzeDom().catch(err => {
  console.error('분석 오류:', err);
  process.exit(1);
});
