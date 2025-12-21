/**
 * ChatGPT Adapter
 *
 * chat.openai.com 사이트 자동화
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

export class ChatGPTAdapter extends BaseLLMAdapter {
  readonly provider = 'chatgpt' as const;
  readonly baseUrl = 'https://chat.openai.com';

  readonly selectors = {
    inputTextarea: '#prompt-textarea',
    sendButton: '[data-testid="send-button"]',
    responseContainer: '[data-message-author-role="assistant"]',
    typingIndicator: '.result-streaming',
    loginCheck: '[data-testid="profile-button"]',
  };

  constructor(webContents: WebContents) {
    super('chatgpt', webContents);
  }

  // --- AdapterResult-based methods (Issue #17) ---

  async checkLogin(): Promise<AdapterResult<boolean>> {
    try {
      const script = `
        !!(
          document.querySelector('[data-testid="profile-button"]') ||
          document.querySelector('button[aria-label*="Account"]') ||
          document.querySelector('img[alt*="User"]') ||
          document.querySelector('#prompt-textarea')
        )
      `;
      const isLoggedIn = await this.executeScript<boolean>(script, false);
      return this.success(isLoggedIn);
    } catch (error) {
      return this.error('NOT_LOGGED_IN', `ChatGPT login check failed: ${error}`);
    }
  }

  async enterPrompt(prompt: string): Promise<AdapterResult> {
    const escapedPrompt = JSON.stringify(prompt);
    console.log(`[chatgpt] enterPrompt called, length: ${prompt.length}`);

    const script = `
      (() => {
        try {
          const textarea = document.querySelector('#prompt-textarea');
          if (!textarea) {
            return { success: false, error: 'textarea not found' };
          }

          // Focus first
          textarea.focus();

          // Method 1: For contenteditable (ProseMirror)
          if (textarea.contentEditable === 'true' || textarea.getAttribute('contenteditable')) {
            // Clear existing content
            textarea.innerHTML = '';

            // Create paragraph with text
            const p = document.createElement('p');
            p.textContent = ${escapedPrompt};
            textarea.appendChild(p);

            // Trigger multiple events for React detection (Issue #16)
            ['input', 'change', 'keyup', 'keydown'].forEach(eventType => {
              textarea.dispatchEvent(new Event(eventType, { bubbles: true }));
            });

            // Also dispatch InputEvent for better compatibility
            textarea.dispatchEvent(new InputEvent('input', {
              bubbles: true,
              cancelable: true,
              inputType: 'insertText',
              data: ${escapedPrompt}
            }));

            return { success: true, method: 'contenteditable' };
          }

          // Method 2: For regular textarea - use native setter to bypass React
          if (textarea.tagName === 'TEXTAREA') {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
              window.HTMLTextAreaElement.prototype, 'value'
            )?.set;

            if (nativeInputValueSetter) {
              nativeInputValueSetter.call(textarea, ${escapedPrompt});
            } else {
              textarea.value = ${escapedPrompt};
            }

            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            return { success: true, method: 'native-setter' };
          }

          return { success: false, error: 'unknown input type' };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })()
    `;

    try {
      const result = await this.executeScript<{success: boolean; error?: string; method?: string}>(
        script,
        { success: false, error: 'script failed' }
      );
      console.log(`[chatgpt] enterPrompt result:`, result);

      if (!result.success) {
        return this.error('INPUT_FAILED', `ChatGPT enterPrompt failed: ${result.error}`, {
          promptLength: prompt.length,
        });
      }

      // Wait longer for React to process (500ms → 1000ms as per Issue #16)
      await this.sleep(1000);

      // Verify input was successful
      const verified = await this.verifyInput();
      if (!verified) {
        return this.error('VERIFICATION_FAILED', 'ChatGPT enterPrompt verification failed: input is empty', {
          promptLength: prompt.length,
          method: result.method,
        });
      }

      return this.success();
    } catch (error) {
      return this.error('INPUT_FAILED', `ChatGPT enterPrompt exception: ${error}`);
    }
  }

  async submitMessage(): Promise<AdapterResult> {
    console.log(`[chatgpt] submitMessage called`);

    const script = `
      (() => {
        try {
          // Try multiple send button selectors (ChatGPT UI changes frequently)
          const selectors = [
            '[data-testid="send-button"]',
            'button[data-testid="send-button"]',
            'button[aria-label="Send prompt"]',
            'button[aria-label*="Send"]',
            'form button:not([disabled])',
            'button svg[viewBox*="24"]'  // SVG send icon
          ];

          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
              const button = el.tagName === 'BUTTON' ? el : el.closest('button');
              if (button && !button.disabled) {
                button.click();
                return { success: true, selector: sel };
              }
            }
          }

          // Fallback: Submit via Enter key
          const textarea = document.querySelector('#prompt-textarea');
          if (textarea) {
            const enterEvent = new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true
            });
            textarea.dispatchEvent(enterEvent);
            return { success: true, method: 'enter-key' };
          }

          return { success: false, error: 'no send method found' };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })()
    `;

    try {
      const result = await this.executeScript<{success: boolean; error?: string; selector?: string}>(
        script,
        { success: false }
      );
      console.log(`[chatgpt] submitMessage result:`, result);

      // Wait for message to be sent
      await this.sleep(1000);

      if (!result.success) {
        return this.error('SEND_FAILED', `ChatGPT submitMessage failed: ${result.error}`, {
          selector: this.selectors.sendButton,
        });
      }

      return this.success();
    } catch (error) {
      return this.error('SEND_FAILED', `ChatGPT submitMessage exception: ${error}`);
    }
  }

  async getResponse(): Promise<AdapterResult<string>> {
    console.log(`[chatgpt] getResponse called`);

    // Wait for DOM to be fully rendered after response
    await this.sleep(1500);

    const script = `
      (() => {
        try {
          const debug = { tried: [], found: [] };

          // Try multiple selectors for ChatGPT responses (expanded list)
          const selectors = [
            // 2025 ChatGPT UI selectors (newest first)
            '[data-testid^="conversation-turn-"] [class*="markdown"]',
            'article[data-scroll-anchor="true"] .markdown',
            'div[data-message-model-slug] .markdown',
            '.group\\/conversation-turn .markdown',
            // 2024-2025 ChatGPT UI selectors
            'article[data-testid^="conversation-turn"] div.markdown',
            'article[data-testid^="conversation-turn"] .prose',
            '[data-testid^="conversation-turn-"] div.markdown',
            'div[data-message-id] div.markdown',
            'div[data-message-id] .prose',
            // Legacy selectors
            '[data-message-author-role="assistant"] .markdown',
            '[data-message-author-role="assistant"]',
            '.agent-turn .markdown',
            '.prose.dark\\\\:prose-invert',
            // Fallback: any markdown content
            'main .markdown',
            'main .prose'
          ];

          for (const sel of selectors) {
            debug.tried.push(sel);
            try {
              const messages = document.querySelectorAll(sel);
              if (messages.length > 0) {
                debug.found.push({ sel, count: messages.length });
                // Get the last assistant message
                const lastMessage = messages[messages.length - 1];
                const content = lastMessage?.innerText || lastMessage?.textContent || '';
                if (content.trim().length > 0) {
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

          // Debug: check what elements exist
          debug.articleCount = document.querySelectorAll('article').length;
          debug.mainCount = document.querySelectorAll('main').length;
          debug.markdownCount = document.querySelectorAll('.markdown').length;
          debug.proseCount = document.querySelectorAll('.prose').length;
          debug.conversationTurns = document.querySelectorAll('[data-testid^="conversation-turn"]').length;
          debug.allDataTestIds = Array.from(document.querySelectorAll('[data-testid]'))
            .map(el => el.getAttribute('data-testid')).slice(0, 30);

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

      // Issue #9: 상세 디버그 로그 출력
      console.log(`[chatgpt] getResponse result:`);
      console.log(`  - success: ${result.success}`);
      console.log(`  - content length: ${result.content?.length || 0}`);
      console.log(`  - selector: ${result.selector || 'none'}`);
      if (result.error) {
        console.log(`  - error: ${result.error}`);
      }

      // Log detailed debug info
      if (result.debug) {
        console.log(`[chatgpt] DEBUG info:`);
        console.log(JSON.stringify(result.debug, null, 2));
      }

      if (!result.success || !result.content) {
        return this.error('EXTRACT_FAILED', `ChatGPT getResponse failed: ${result.error}`, {
          selector: this.selectors.responseContainer,
          debug: result.debug,
        });
      }

      return this.success(result.content);
    } catch (error) {
      return this.error('EXTRACT_FAILED', `ChatGPT getResponse exception: ${error}`);
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
      throw new Error(result.error?.message || `ChatGPT inputPrompt failed`);
    }
  }

  async sendMessage(): Promise<void> {
    const result = await this.submitMessage();
    if (!result.success) {
      throw new Error(result.error?.message || `ChatGPT sendMessage failed`);
    }
  }

  async extractResponse(): Promise<string> {
    const result = await this.getResponse();
    return result.data || '';
  }

  async isWriting(): Promise<boolean> {
    const script = `
      (() => {
        const debug = {};

        // Stop 버튼 체크
        const stopButton = document.querySelector('button[aria-label="Stop generating"]');
        debug.stopButton = {
          exists: !!stopButton,
          visible: stopButton ? stopButton.offsetParent !== null : false
        };

        // Stop 버튼 대체 (data-testid)
        const stopButtonAlt = document.querySelector('button[data-testid="stop-button"]');
        debug.stopButtonAlt = {
          exists: !!stopButtonAlt,
          visible: stopButtonAlt ? stopButtonAlt.offsetParent !== null : false
        };

        // Send 버튼 체크 (가장 신뢰성 높음)
        const sendButton = document.querySelector('button[data-testid="send-button"]');
        debug.sendButton = {
          exists: !!sendButton,
          disabled: sendButton ? sendButton.disabled : null,
          enabled: sendButton ? !sendButton.disabled : null
        };

        // 스트리밍 클래스 체크
        debug.streaming = !!document.querySelector('.result-streaming');

        // 커서 인디케이터 체크
        debug.cursor = !!document.querySelector('[data-message-author-role="assistant"] .cursor, [data-message-author-role="assistant"] .animate-pulse');

        // 로직: streaming 상태가 가장 신뢰성 높음
        let writing = false;

        // 1. 스트리밍 클래스가 있으면 응답 중 (최우선)
        if (debug.streaming) {
          writing = true;
        }
        // 2. 커서 인디케이터가 있으면 응답 중
        else if (debug.cursor) {
          writing = true;
        }
        // 3. Send 버튼이 비활성화되면 응답 중 (버튼이 존재하는 경우만)
        else if (sendButton && sendButton.disabled) {
          writing = true;
        }
        // 4. 위 조건이 모두 false면 응답 완료
        // (stopButtonAlt는 응답 완료 후에도 존재하므로 무시)

        return { writing, debug };
      })()
    `;

    const result = await this.executeScript<{writing: boolean; debug: object}>(
      script,
      { writing: false, debug: {} }
    );
    // Issue #9: 상세 디버그 로그
    console.log('[chatgpt:isWriting]');
    console.log(`  - writing: ${result.writing}`);
    console.log(`  - debug:`, JSON.stringify(result.debug, null, 2));
    return result.writing;
  }

  // Verify that input was successfully entered
  private async verifyInput(): Promise<boolean> {
    const script = `
      (() => {
        const textarea = document.querySelector('#prompt-textarea');
        const content = textarea?.innerText || textarea?.value || '';
        return content.trim().length > 0;
      })()
    `;
    return this.executeScript<boolean>(script, false);
  }
}
