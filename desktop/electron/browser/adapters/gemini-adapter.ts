/**
 * Gemini Adapter
 *
 * gemini.google.com 사이트 자동화
 * Issue #17: AdapterResult 타입으로 표준화
 */

import { BaseLLMAdapter } from './base-adapter';
import type { AdapterResult } from '../../../shared/types';
import type { WebContents } from './types';

export class GeminiAdapter extends BaseLLMAdapter {
  readonly provider = 'gemini' as const;
  readonly baseUrl = 'https://gemini.google.com';

  readonly selectors = {
    inputTextarea: '.ql-editor',
    sendButton: '.send-button',
    responseContainer: '.response-container',
    typingIndicator: '.loading-indicator',
    loginCheck: '[data-user-email]',
  };

  constructor(webContents: WebContents) {
    super('gemini', webContents);
  }

  // --- AdapterResult-based methods (Issue #17) ---

  async checkLogin(): Promise<AdapterResult<boolean>> {
    try {
      const script = `
        !!(
          document.querySelector('[data-user-email]') ||
          document.querySelector('img[data-iml]') ||
          document.querySelector('[aria-label*="Google Account"]') ||
          document.querySelector('.ql-editor') ||
          document.querySelector('rich-textarea')
        )
      `;
      const isLoggedIn = await this.executeScript<boolean>(script, false);
      return this.success(isLoggedIn);
    } catch (error) {
      return this.error('NOT_LOGGED_IN', `Gemini login check failed: ${error}`);
    }
  }

  async enterPrompt(prompt: string): Promise<AdapterResult> {
    const escapedPrompt = JSON.stringify(prompt);
    console.log(`[gemini] enterPrompt called, length: ${prompt.length}`);

    const script = `
      (() => {
        try {
          const editor = document.querySelector('.ql-editor');
          if (!editor) {
            return { success: false, error: 'editor not found' };
          }
          editor.innerHTML = ${escapedPrompt};
          editor.dispatchEvent(new Event('input', { bubbles: true }));
          return { success: true };
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
        return this.error('INPUT_FAILED', `Gemini enterPrompt failed: ${result.error}`, {
          promptLength: prompt.length,
        });
      }

      return this.success();
    } catch (error) {
      return this.error('INPUT_FAILED', `Gemini enterPrompt exception: ${error}`);
    }
  }

  // Issue #33: isWriting 강화 - Claude 수준의 다중 감지 방식
  async isWriting(): Promise<boolean> {
    const script = `
      (() => {
        const debug = {};

        // 1. Stop 버튼 체크 (다국어 지원)
        const stopSelectors = [
          'button[aria-label="Stop generating"]',
          'button[aria-label="생성 중지"]',
          'button[aria-label*="Stop"]',
          'button[aria-label*="중지"]',
          'button[aria-label*="Cancel"]',
          'button[aria-label*="취소"]',
          '.stop-button',
        ];
        debug.stopButton = stopSelectors.some(sel => {
          const el = document.querySelector(sel);
          return el && el.offsetParent !== null; // visible check
        });

        // 2. 로딩 인디케이터 체크
        const loadingSelectors = [
          '.loading-indicator',
          '.thinking-indicator',
          '[aria-busy="true"]',
          '.spinner',
          'mat-spinner',
          '[role="progressbar"]',
          '.animate-pulse'
        ];
        debug.loading = loadingSelectors.some(sel => !!document.querySelector(sel));

        // 3. 응답 컨테이너 updating 상태 체크
        const responseContainer = document.querySelector('.response-container, .model-response');
        debug.hasResponse = !!responseContainer;
        debug.responseUpdating = responseContainer?.classList?.contains('updating') || false;

        // 4. Send 버튼 상태 체크 (다국어 지원)
        const sendSelectors = [
          'button[aria-label="Submit prompt"]',
          'button[aria-label="프롬프트 보내기"]',
          'button[aria-label*="Submit"]',
          'button[aria-label*="Send"]',
          'button[aria-label*="보내"]',
          '.send-button',
        ];
        let sendButton = null;
        for (const sel of sendSelectors) {
          sendButton = document.querySelector(sel);
          if (sendButton) break;
        }
        debug.sendButton = {
          exists: !!sendButton,
          disabled: sendButton?.disabled || sendButton?.getAttribute('aria-disabled') === 'true' || sendButton?.getAttribute('disabled') !== null
        };

        // 5. aria-busy 체크
        debug.ariaBusy = !!document.querySelector('[aria-busy="true"]');

        // 6. 커서/애니메이션 체크
        debug.cursor = !!(
          document.querySelector('.cursor-blink') ||
          document.querySelector('[class*="typing"]') ||
          document.querySelector('.animate-pulse')
        );

        // 로직: 우선순위대로 체크
        let writing = false;
        let reason = 'none';

        if (debug.stopButton) {
          writing = true;
          reason = 'stopButton';
        } else if (debug.loading) {
          writing = true;
          reason = 'loading';
        } else if (debug.ariaBusy) {
          writing = true;
          reason = 'ariaBusy';
        } else if (debug.responseUpdating) {
          writing = true;
          reason = 'responseUpdating';
        } else if (debug.sendButton.exists && debug.sendButton.disabled) {
          writing = true;
          reason = 'sendDisabled';
        } else if (debug.cursor) {
          writing = true;
          reason = 'cursor';
        }

        return { writing, reason, debug };
      })()
    `;

    const result = await this.executeScript<{writing: boolean; reason: string; debug: object}>(
      script,
      { writing: false, reason: 'error', debug: {} }
    );
    console.log('[gemini:isWriting]', JSON.stringify(result));
    return result.writing;
  }

  /**
   * Issue #52: submitMessage() 특화 구현
   * Material Design 버튼 + PointerEvent/MouseEvent 시퀀스
   */
  async submitMessage(): Promise<AdapterResult> {
    console.log(`[gemini] submitMessage called`);

    const script = `
      (() => {
        try {
          const debug = { tried: [], clicked: null };

          // Gemini 전송 버튼 셀렉터 목록 (다국어 지원)
          const buttonSelectors = [
            'button[aria-label="Submit prompt"]',
            'button[aria-label="프롬프트 보내기"]',
            'button[aria-label="プロンプトを送信"]',
            'button[aria-label*="Submit"]',
            'button[aria-label*="보내"]',
            'button[aria-label*="Send"]',
            '.send-button',
            'button.mat-mdc-icon-button:has(mat-icon)',
            'rich-textarea ~ button:not([disabled])',
            'form button:not([disabled])',
          ];

          // 버튼 찾기
          let button = null;
          for (const sel of buttonSelectors) {
            debug.tried.push(sel);
            try {
              const el = document.querySelector(sel);
              if (el && !el.disabled && el.offsetParent !== null) {
                button = el;
                debug.clicked = sel;
                break;
              }
            } catch (e) {}
          }

          if (!button) {
            return { success: false, error: 'send button not found', debug };
          }

          // Material Design 이벤트 시퀀스 (Claude 스타일)
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

          // 이벤트 순서: pointerdown -> mousedown -> pointerup -> mouseup -> click
          button.dispatchEvent(new PointerEvent('pointerdown', { ...eventInit, pointerId: 1 }));
          button.dispatchEvent(new MouseEvent('mousedown', eventInit));
          button.dispatchEvent(new PointerEvent('pointerup', { ...eventInit, pointerId: 1 }));
          button.dispatchEvent(new MouseEvent('mouseup', eventInit));
          button.dispatchEvent(new MouseEvent('click', eventInit));

          // 직접 click() 호출
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

      console.log(`[gemini] submitMessage result:`, JSON.stringify(result, null, 2));

      if (!result.success) {
        // Fallback: Enter 키 시도
        console.log(`[gemini] Button click failed, trying Enter key...`);
        const enterResult = await this.tryEnterKey();
        if (enterResult.success) {
          return this.success();
        }
        return this.error('SEND_FAILED', `Gemini submitMessage failed: ${result.error}`, {
          debug: result.debug,
        });
      }

      // 전송 후 대기
      await this.sleep(500);
      return this.success();
    } catch (error) {
      return this.error('SEND_FAILED', `Gemini submitMessage exception: ${error}`);
    }
  }

  /**
   * Issue #52: Enter 키로 메시지 전송 시도 (폴백)
   */
  private async tryEnterKey(): Promise<AdapterResult> {
    const script = `
      (() => {
        try {
          const editor = document.querySelector('.ql-editor') ||
                         document.querySelector('rich-textarea') ||
                         document.querySelector('[contenteditable="true"]');
          if (!editor) {
            return { success: false, error: 'editor not found' };
          }

          editor.focus();

          const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true,
            composed: true
          });

          editor.dispatchEvent(enterEvent);
          editor.dispatchEvent(new KeyboardEvent('keypress', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true,
            composed: true
          }));
          editor.dispatchEvent(new KeyboardEvent('keyup', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true,
            composed: true
          }));

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

    console.log(`[gemini] tryEnterKey result:`, result);

    if (!result.success) {
      return this.error('SEND_FAILED', `Gemini Enter key failed: ${result.error}`);
    }

    return this.success();
  }

  /**
   * Issue #31, #52: 공통 extractResponseFromSelectors 사용
   * Gemini 전용 셀렉터 + 재귀/TreeWalker 폴백 활성화
   */
  async getResponse(): Promise<AdapterResult<string>> {
    console.log(`[gemini] getResponse called`);
    return this.extractResponseFromSelectors({
      selectors: this.getResponseSelectors(),
      minLength: 10,
      domSettleMs: 2000,              // Gemini 렌더링 대기 (1500 -> 2000)
      maxRetries: 2,                  // 재시도 추가 (1 -> 2)
      retryDelayMs: 1500,
      useRecursiveExtraction: true,   // Web Component 대응 (false -> true)
      useTreeWalker: true,            // 최후의 폴백 (false -> true)
    });
  }

  /**
   * Issue #31, #52: Gemini 전용 응답 셀렉터 확장
   */
  protected override getResponseSelectors(): string[] {
    return [
      // Gemini Web Component 구조
      'model-response',
      'model-response .response-text',
      'model-response .markdown-content',
      // 클래스 기반
      '.model-response',
      '.response-container',
      '[data-content-type="response"]',
      '.message-content',
      'message-content[role="presentation"]',
      // Markdown 렌더링
      '.markdown-content',
      '.rendered-markdown',
      '[class*="markdown"]',
      // 일반 fallback
      '[role="article"]',
      'main [class*="response"]',
      'main article',
      'main p',
    ];
  }

  // --- Legacy methods (backward compatibility) ---

  async isLoggedIn(): Promise<boolean> {
    const result = await this.checkLogin();
    return result.success && result.data === true;
  }

  async inputPrompt(prompt: string): Promise<void> {
    const result = await this.enterPrompt(prompt);
    if (!result.success) {
      throw new Error(result.error?.message || `Gemini inputPrompt failed`);
    }
  }
}
