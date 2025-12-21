/**
 * Claude Adapter
 *
 * claude.ai 사이트 자동화
 * Issue #17: AdapterResult 타입으로 표준화
 */

import { BaseLLMAdapter } from './base-adapter';
import type { AdapterResult } from '../../../shared/types';

interface WebContents {
  executeJavaScript: (script: string) => Promise<any>;
  loadURL: (url: string) => void;
  getURL: () => string;
  on: (event: string, callback: (...args: any[]) => void) => void;
}

export class ClaudeAdapter extends BaseLLMAdapter {
  readonly provider = 'claude' as const;
  readonly baseUrl = 'https://claude.ai';

  readonly selectors = {
    inputTextarea: '[contenteditable="true"]',
    sendButton: '[aria-label="Send message"]',
    responseContainer: '[data-is-streaming="false"]',
    typingIndicator: '[data-is-streaming="true"]',
    loginCheck: '[data-testid="user-menu"]',
  };

  constructor(webContents: WebContents) {
    super('claude', webContents);
  }

  // --- AdapterResult-based methods (Issue #17) ---

  async checkLogin(): Promise<AdapterResult<boolean>> {
    try {
      // Issue #11: 2025-12 DOM 업데이트
      const script = `
        !!(
          document.querySelector('[data-testid="user-menu-button"]') ||
          document.querySelector('[data-testid="user-menu"]') ||
          document.querySelector('[data-testid="chat-input-ssr"]') ||
          document.querySelector('button[aria-label*="account"]') ||
          document.querySelector('[contenteditable="true"]') ||
          document.querySelector('fieldset[dir="auto"]')
        )
      `;
      const isLoggedIn = await this.executeScript<boolean>(script, false);
      return this.success(isLoggedIn);
    } catch (error) {
      return this.error('NOT_LOGGED_IN', `Claude login check failed: ${error}`);
    }
  }

  async enterPrompt(prompt: string): Promise<AdapterResult> {
    const escapedPrompt = JSON.stringify(prompt);
    console.log(`[claude] enterPrompt called, length: ${prompt.length}`);

    // Issue #11: 2025-12 DOM 업데이트 - textarea 또는 contenteditable
    const script = `
      (() => {
        try {
          // 1. 먼저 textarea 시도 (2025-12 DOM)
          const textarea = document.querySelector('textarea[data-testid="chat-input-ssr"]');
          if (textarea) {
            textarea.value = ${escapedPrompt};
            textarea.dispatchEvent(new InputEvent('input', { bubbles: true }));
            return { success: true, method: 'textarea' };
          }

          // 2. fallback: contenteditable
          const editor = document.querySelector('[contenteditable="true"]');
          if (!editor) {
            return { success: false, error: 'editor not found' };
          }
          editor.innerHTML = '';
          editor.innerText = ${escapedPrompt};
          editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
          return { success: true, method: 'contenteditable' };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })()
    `;

    try {
      const result = await this.executeScript<{success: boolean; error?: string}>(
        script,
        { success: false, error: 'script failed' }
      );

      if (!result.success) {
        return this.error('INPUT_FAILED', `Claude enterPrompt failed: ${result.error}`, {
          promptLength: prompt.length,
        });
      }

      return this.success();
    } catch (error) {
      return this.error('INPUT_FAILED', `Claude enterPrompt exception: ${error}`);
    }
  }

  // Issue #11: Claude 전용 submitMessage - 2025-12 DOM 업데이트
  async submitMessage(): Promise<AdapterResult> {
    console.log(`[claude] submitMessage called`);

    const script = `
      (() => {
        try {
          const debug = { tried: [], clicked: null };

          // Issue #11: 2025-12 전송 버튼 셀렉터 목록 (한국어 우선)
          const buttonSelectors = [
            'button[aria-label="메시지 보내기"]',
            'button[aria-label="Send message"]',
            'button[aria-label="Send Message"]',
            'button[aria-label*="보내기"]',
            'button[aria-label*="Send"]',
            'fieldset button:not([aria-label*="Stop"]):not([aria-label*="Attach"]):not([aria-label*="첨부"]):not([aria-label*="파일"])',
            'button[data-testid="send-button"]',
          ];

          // 버튼 찾기
          let button = null;
          for (const sel of buttonSelectors) {
            debug.tried.push(sel);
            try {
              const el = document.querySelector(sel);
              if (el && !el.disabled) {
                // SVG 아이콘이 있는 버튼인지 확인 (전송 버튼은 보통 화살표 아이콘)
                const svg = el.querySelector('svg');
                if (svg || el.textContent?.trim() === '' || el.getAttribute('aria-label')?.includes('Send')) {
                  button = el;
                  debug.clicked = sel;
                  break;
                }
              }
            } catch (e) {}
          }

          if (!button) {
            // Fallback: fieldset 내의 마지막 버튼
            const fieldset = document.querySelector('fieldset');
            if (fieldset) {
              const buttons = fieldset.querySelectorAll('button:not([aria-label*="Stop"]):not([aria-label*="Attach"])');
              if (buttons.length > 0) {
                button = buttons[buttons.length - 1];
                debug.clicked = 'fieldset last button (fallback)';
              }
            }
          }

          if (!button) {
            return { success: false, error: 'send button not found', debug };
          }

          // MouseEvent 시퀀스로 클릭 시뮬레이션
          const rect = button.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;

          const eventInit = {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: x,
            clientY: y,
            button: 0
          };

          // 이벤트 순서: pointerdown → mousedown → pointerup → mouseup → click
          button.dispatchEvent(new PointerEvent('pointerdown', { ...eventInit, pointerId: 1 }));
          button.dispatchEvent(new MouseEvent('mousedown', eventInit));
          button.dispatchEvent(new PointerEvent('pointerup', { ...eventInit, pointerId: 1 }));
          button.dispatchEvent(new MouseEvent('mouseup', eventInit));
          button.dispatchEvent(new MouseEvent('click', eventInit));

          // 추가로 직접 click() 호출
          button.click();

          return { success: true, selector: debug.clicked, debug };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })()
    `;

    try {
      const result = await this.executeScript<{
        success: boolean;
        error?: string;
        selector?: string;
        debug?: object;
      }>(script, { success: false, error: 'script failed' });

      console.log(`[claude] submitMessage result:`, JSON.stringify(result, null, 2));

      if (!result.success) {
        // Fallback: Enter 키 시도
        console.log(`[claude] Button click failed, trying Enter key...`);
        const enterResult = await this.tryEnterKey();
        if (enterResult.success) {
          return this.success();
        }
        return this.error('SEND_FAILED', `Claude submitMessage failed: ${result.error}`, {
          debug: result.debug,
        });
      }

      // 전송 후 대기
      await this.sleep(500);
      return this.success();
    } catch (error) {
      return this.error('SEND_FAILED', `Claude submitMessage exception: ${error}`);
    }
  }

  // Enter 키로 메시지 전송 시도
  private async tryEnterKey(): Promise<AdapterResult> {
    const script = `
      (() => {
        try {
          const editor = document.querySelector('[contenteditable="true"]');
          if (!editor) {
            return { success: false, error: 'editor not found' };
          }

          editor.focus();

          // Enter 키 이벤트 (Shift 없이)
          const keydownEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true,
            composed: true
          });

          const keypressEvent = new KeyboardEvent('keypress', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true,
            composed: true
          });

          const keyupEvent = new KeyboardEvent('keyup', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true,
            composed: true
          });

          editor.dispatchEvent(keydownEvent);
          editor.dispatchEvent(keypressEvent);
          editor.dispatchEvent(keyupEvent);

          return { success: true, method: 'enter-key' };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })()
    `;

    const result = await this.executeScript<{ success: boolean; error?: string }>(
      script,
      { success: false, error: 'script failed' }
    );

    console.log(`[claude] tryEnterKey result:`, result);

    if (!result.success) {
      return this.error('SEND_FAILED', `Claude Enter key failed: ${result.error}`);
    }

    return this.success();
  }

  // --- Legacy methods (backward compatibility) ---

  async isLoggedIn(): Promise<boolean> {
    const result = await this.checkLogin();
    return result.success && result.data === true;
  }

  async inputPrompt(prompt: string): Promise<void> {
    const result = await this.enterPrompt(prompt);
    if (!result.success) {
      throw new Error(result.error?.message || `Claude inputPrompt failed`);
    }
  }

  async sendMessage(): Promise<void> {
    // Issue #11: 새 메시지 전송 시 콘텐츠 추적 리셋
    this.resetContentTracking();

    const result = await this.submitMessage();
    if (!result.success) {
      throw new Error(result.error?.message || `Claude sendMessage failed`);
    }
  }

  // Issue #11: 콘텐츠 변화 감지를 위한 상태
  private lastResponseContent: string = '';
  private lastContentChangeTime: number = 0;
  private contentStableThreshold: number = 2000; // 2초

  async isWriting(): Promise<boolean> {
    // Issue #11: 2025-12 DOM 업데이트 - Send 버튼 disabled + 콘텐츠 변화 감지
    const sendSelectors = [
      this.selectorSets.sendButton.primary,
      ...this.selectorSets.sendButton.fallbacks,
    ].map(s => `'${s}'`).join(', ');

    const script = `
      (() => {
        const debug = {};
        const sendSelectors = [${sendSelectors}];

        // Helper: 선택자 목록 중 하나라도 존재하는지 확인
        const findAny = (selectors) => {
          for (const sel of selectors) {
            try {
              const el = document.querySelector(sel);
              if (el) return { found: true, selector: sel, element: el };
            } catch (e) {}
          }
          return { found: false };
        };

        // Issue #11: 2025-12 주요 감지 방법

        // 1. Send 버튼 상태 체크 (disabled = 응답 중)
        const sendResult = findAny(sendSelectors);
        if (sendResult.found) {
          const btn = sendResult.element;
          debug.sendButton = {
            exists: true,
            disabled: btn.disabled || btn.getAttribute('disabled') !== null || btn.getAttribute('aria-disabled') === 'true',
            selector: sendResult.selector
          };
        } else {
          debug.sendButton = { exists: false, disabled: null };
        }

        // 2. Stop 버튼 체크 (있으면 응답 중)
        const stopSelectors = [
          'button[aria-label="응답 중지"]',
          'button[aria-label*="Stop"]',
          'button[aria-label*="stop"]',
          'button[aria-label*="중지"]',
        ];
        let stopFound = false;
        for (const sel of stopSelectors) {
          try {
            if (document.querySelector(sel)) {
              stopFound = true;
              debug.stopSelector = sel;
              break;
            }
          } catch (e) {}
        }
        debug.stopButton = stopFound;

        // 3. 응답 콘텐츠 캡처 (콘텐츠 변화 감지용)
        const responseSelectors = [
          'main article',
          '.prose:not([contenteditable])',
          'div[class*="whitespace-pre-wrap"]',
          '[data-testid*="message"]',
        ];
        let responseContent = '';
        for (const sel of responseSelectors) {
          try {
            const messages = document.querySelectorAll(sel);
            if (messages.length > 0) {
              const lastMsg = messages[messages.length - 1];
              responseContent = lastMsg?.innerText || lastMsg?.textContent || '';
              if (responseContent.length > 10) {
                debug.responseSelector = sel;
                break;
              }
            }
          } catch (e) {}
        }
        debug.responseLength = responseContent.length;

        // 4. 추가 로딩 인디케이터 (낮은 우선순위)
        debug.loading = !!(
          document.querySelector('.animate-pulse') ||
          document.querySelector('[class*="streaming"]')
        );

        // 로직: 우선순위대로 체크
        let writing = false;
        let reason = 'none';

        if (debug.stopButton) {
          writing = true;
          reason = 'stopButton: ' + debug.stopSelector;
        } else if (debug.sendButton.exists && debug.sendButton.disabled) {
          writing = true;
          reason = 'sendDisabled';
        } else if (debug.loading) {
          writing = true;
          reason = 'loading';
        }

        return { writing, reason, debug, responseContent };
      })()
    `;

    const result = await this.executeScript<{
      writing: boolean;
      reason: string;
      debug: object;
      responseContent: string;
    }>(script, { writing: false, reason: 'error', debug: {}, responseContent: '' });

    // Issue #11: 콘텐츠 변화 감지 (셀렉터 실패 시 백업)
    const now = Date.now();
    let finalWriting = result.writing;
    let finalReason = result.reason;

    if (!result.writing && result.responseContent) {
      // 셀렉터 기반 감지 실패 - 콘텐츠 변화로 판단
      if (result.responseContent !== this.lastResponseContent) {
        // 콘텐츠가 변화함 = 아직 writing 중
        this.lastResponseContent = result.responseContent;
        this.lastContentChangeTime = now;
        finalWriting = true;
        finalReason = 'contentChanging';
      } else if (now - this.lastContentChangeTime < this.contentStableThreshold) {
        // 콘텐츠가 최근에 변화함 = 아직 writing 중일 가능성
        finalWriting = true;
        finalReason = 'contentRecentlyChanged';
      }
      // 그 외: 콘텐츠가 안정됨 = writing 완료
    }

    // Issue #9: 상세 디버그 로그
    console.log('[claude:isWriting]');
    console.log(`  - writing: ${finalWriting}`);
    console.log(`  - reason: ${finalReason}`);
    console.log(`  - debug:`, JSON.stringify(result.debug, null, 2));
    return finalWriting;
  }

  // Issue #11: 콘텐츠 상태 리셋 (새 메시지 전송 시)
  resetContentTracking(): void {
    this.lastResponseContent = '';
    this.lastContentChangeTime = 0;
  }

  async getResponse(): Promise<AdapterResult<string>> {
    console.log(`[claude] getResponse called`);

    // Wait for DOM to settle
    await this.sleep(1500);

    // Issue #11: 2025-12 DOM - main 태그 하위에서 응답 찾기
    const responseSelectors = [
      // 2025-12 새로운 셀렉터 (main 기반)
      'main div[class*="font-"]',
      'main div[class*="text-"]',
      'main [data-testid*="message"]',
      'main [data-testid*="turn"]',
      // 기존 fallback
      ...this.selectorSets.responseContainer.fallbacks,
      // 추가 fallback
      '.whitespace-pre-wrap',
      'main p',
      'main div > p',
    ].map(s => `'${s}'`).join(', ');

    const script = `
      (() => {
        try {
          const debug = { tried: [], found: [], mainChildren: [] };
          const selectors = [${responseSelectors}];

          // Issue #11: main 태그 하위 구조 분석
          const main = document.querySelector('main');
          if (main) {
            // main의 직접 자식 중 텍스트가 있는 요소 찾기
            const walker = document.createTreeWalker(
              main,
              NodeFilter.SHOW_ELEMENT,
              {
                acceptNode: function(node) {
                  const text = node.textContent?.trim() || '';
                  // 충분한 텍스트가 있고, 입력 영역이 아닌 경우
                  if (text.length > 50 && !node.closest('[contenteditable]') && !node.closest('textarea')) {
                    return NodeFilter.FILTER_ACCEPT;
                  }
                  return NodeFilter.FILTER_SKIP;
                }
              }
            );

            let count = 0;
            let lastValidNode = null;
            let node;
            while ((node = walker.nextNode()) && count < 20) {
              debug.mainChildren.push({
                tag: node.tagName,
                classes: node.className?.toString?.()?.substring?.(0, 50),
                textLen: node.textContent?.length || 0,
              });
              lastValidNode = node;
              count++;
            }

            // 가장 긴 텍스트를 가진 요소 찾기
            if (lastValidNode) {
              const content = lastValidNode.innerText || lastValidNode.textContent || '';
              if (content.trim().length > 10) {
                return {
                  success: true,
                  content: content.trim(),
                  selector: 'treeWalker',
                  count: 1,
                  debug
                };
              }
            }
          }

          // 기존 셀렉터 로직
          for (const sel of selectors) {
            debug.tried.push(sel);
            try {
              const messages = document.querySelectorAll(sel);
              if (messages.length > 0) {
                debug.found.push({ sel, count: messages.length });
                const lastMessage = messages[messages.length - 1];
                const content = lastMessage?.innerText || lastMessage?.textContent || '';
                if (content.trim() && content.length > 10) {
                  return {
                    success: true,
                    content: content.trim(),
                    selector: sel,
                    count: messages.length,
                    debug
                  };
                }
              }
            } catch (e) {
              // Continue to next selector
            }
          }

          // Debug info
          debug.proseCount = document.querySelectorAll('.prose').length;
          debug.articleCount = document.querySelectorAll('article').length;
          debug.mainCount = document.querySelectorAll('main').length;

          return {
            success: false,
            content: '',
            error: 'no messages found',
            debug
          };
        } catch (e) {
          return { success: false, content: '', error: e.message };
        }
      })()
    `;

    try {
      const result = await this.executeScript<{
        success: boolean;
        content: string;
        error?: string;
        selector?: string;
        debug?: object;
      }>(script, { success: false, content: '', error: 'script failed' });

      // Issue #9: 상세 디버그 로그
      console.log(`[claude] getResponse result:`);
      console.log(`  - success: ${result.success}`);
      console.log(`  - content length: ${result.content?.length || 0}`);
      console.log(`  - selector: ${result.selector || 'none'}`);
      if (result.error) {
        console.log(`  - error: ${result.error}`);
      }
      if (result.debug) {
        console.log(`[claude] DEBUG info:`);
        console.log(JSON.stringify(result.debug, null, 2));
      }

      if (!result.success || !result.content) {
        return this.error('EXTRACT_FAILED', `Claude getResponse failed: ${result.error}`, {
          debug: result.debug,
        });
      }

      return this.success(result.content);
    } catch (error) {
      return this.error('EXTRACT_FAILED', `Claude getResponse exception: ${error}`);
    }
  }
}
