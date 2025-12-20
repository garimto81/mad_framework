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
      const script = `
        !!(
          document.querySelector('[data-testid="user-menu"]') ||
          document.querySelector('button[aria-label*="account"]') ||
          document.querySelector('button[aria-label*="Account"]') ||
          document.querySelector('[data-testid="menu-trigger"]') ||
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

    const script = `
      (() => {
        try {
          const editor = document.querySelector('[contenteditable="true"]');
          if (!editor) {
            return { success: false, error: 'editor not found' };
          }
          editor.innerHTML = '';
          editor.innerText = ${escapedPrompt};
          editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
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
        return this.error('INPUT_FAILED', `Claude enterPrompt failed: ${result.error}`, {
          promptLength: prompt.length,
        });
      }

      return this.success();
    } catch (error) {
      return this.error('INPUT_FAILED', `Claude enterPrompt exception: ${error}`);
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
      throw new Error(result.error?.message || `Claude inputPrompt failed`);
    }
  }

  async isWriting(): Promise<boolean> {
    // Issue #18: selector-config.ts의 fallback 시스템 사용
    const stopSelectors = [
      this.selectorSets.stopButton.primary,
      ...this.selectorSets.stopButton.fallbacks,
    ].map(s => `'${s}'`).join(', ');

    const typingSelectors = [
      this.selectorSets.typingIndicator.primary,
      ...this.selectorSets.typingIndicator.fallbacks,
    ].map(s => `'${s}'`).join(', ');

    const sendSelectors = [
      this.selectorSets.sendButton.primary,
      ...this.selectorSets.sendButton.fallbacks,
    ].map(s => `'${s}'`).join(', ');

    const script = `
      (() => {
        const debug = {};
        const stopSelectors = [${stopSelectors}];
        const typingSelectors = [${typingSelectors}];
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

        // 1. Stop 버튼 체크
        const stopResult = findAny(stopSelectors);
        debug.stopButton = stopResult.found;
        debug.stopSelector = stopResult.selector;

        // 2. Typing/Streaming 인디케이터 체크
        const typingResult = findAny(typingSelectors);
        debug.streaming = typingResult.found;
        debug.streamingSelector = typingResult.selector;

        // 3. Send 버튼 상태 체크
        const sendResult = findAny(sendSelectors);
        if (sendResult.found) {
          const btn = sendResult.element;
          debug.sendButton = {
            exists: true,
            disabled: btn.disabled || btn.getAttribute('disabled') !== null,
            selector: sendResult.selector
          };
        } else {
          debug.sendButton = { exists: false, disabled: null };
        }

        // 4. 추가 로딩 인디케이터 체크
        debug.loading = !!(
          document.querySelector('.animate-pulse') ||
          document.querySelector('.animate-spin') ||
          document.querySelector('[data-testid*="loading"]')
        );

        // 로직: 우선순위대로 체크
        let writing = false;
        let reason = 'none';

        if (debug.stopButton) {
          writing = true;
          reason = 'stopButton: ' + debug.stopSelector;
        } else if (debug.streaming) {
          writing = true;
          reason = 'streaming: ' + debug.streamingSelector;
        } else if (debug.sendButton.exists && debug.sendButton.disabled) {
          writing = true;
          reason = 'sendDisabled';
        } else if (debug.loading) {
          writing = true;
          reason = 'loading';
        }

        return { writing, reason, debug };
      })()
    `;

    const result = await this.executeScript<{writing: boolean; reason: string; debug: object}>(
      script,
      { writing: false, reason: 'error', debug: {} }
    );
    console.log('[claude:isWriting]', JSON.stringify(result));
    return result.writing;
  }

  async getResponse(): Promise<AdapterResult<string>> {
    console.log(`[claude] getResponse called`);

    // Wait for DOM to settle
    await this.sleep(1500);

    // Issue #18: selector-config.ts의 fallback 시스템 사용
    const responseSelectors = [
      this.selectorSets.responseContainer.primary,
      ...this.selectorSets.responseContainer.fallbacks,
      // 추가 fallback: .prose 하위 요소 탐색
      `${this.selectorSets.responseContainer.primary} .prose`,
      '.prose:not([contenteditable])',
      'article .prose',
      'main .whitespace-pre-wrap',
    ].map(s => `'${s}'`).join(', ');

    const script = `
      (() => {
        try {
          const debug = { tried: [], found: [] };
          const selectors = [${responseSelectors}];

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
          debug.streamingFalse = document.querySelectorAll('[data-is-streaming="false"]').length;
          debug.streamingTrue = document.querySelectorAll('[data-is-streaming="true"]').length;

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

      console.log(`[claude] getResponse result:`, JSON.stringify(result).substring(0, 500));

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
