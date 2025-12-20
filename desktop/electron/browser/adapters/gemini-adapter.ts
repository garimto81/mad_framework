/**
 * Gemini Adapter
 *
 * gemini.google.com 사이트 자동화
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

        // 1. Stop 버튼 체크
        const stopSelectors = [
          'button[aria-label*="Stop"]',
          '.stop-button',
          'button[aria-label="Stop generating"]',
          '[aria-label*="cancel"]'
        ];
        debug.stopButton = stopSelectors.some(sel => !!document.querySelector(sel));

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

        // 4. Send 버튼 상태 체크
        const sendButton = document.querySelector('.send-button, button[aria-label*="Send"]');
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

  // Issue #33: getResponse 강화 - 다중 셀렉터 fallback
  async getResponse(): Promise<AdapterResult<string>> {
    console.log(`[gemini] getResponse called`);

    // Wait for DOM to settle
    await this.sleep(1500);

    const script = `
      (() => {
        const selectors = [
          '.response-container',
          '.model-response',
          '[data-content-type="response"]',
          '.message-content',
          'model-response .content',
          '.markdown-content',
          '[role="article"]'
        ];

        const debug = { tried: [], found: [] };

        for (const sel of selectors) {
          debug.tried.push(sel);
          try {
            const messages = document.querySelectorAll(sel);
            if (messages.length > 0) {
              const lastMessage = messages[messages.length - 1];
              const content = lastMessage?.innerText || lastMessage?.textContent || '';
              if (content.trim().length > 10) {
                debug.found.push({ selector: sel, length: content.length });
                return { success: true, content: content.trim(), selector: sel, debug };
              }
            }
          } catch (e) {
            debug.found.push({ selector: sel, error: e.message });
          }
        }

        return { success: false, content: '', error: 'no messages found', debug };
      })()
    `;

    try {
      const result = await this.executeScript<{
        success: boolean;
        content: string;
        selector?: string;
        error?: string;
        debug?: object;
      }>(script, { success: false, content: '', error: 'script failed' });

      console.log('[gemini] getResponse result:', JSON.stringify(result));

      if (!result.success) {
        return this.error('EXTRACT_FAILED', `Gemini getResponse failed: ${result.error}`);
      }

      return this.success(result.content);
    } catch (error) {
      return this.error('EXTRACT_FAILED', `Gemini getResponse exception: ${error}`);
    }
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
