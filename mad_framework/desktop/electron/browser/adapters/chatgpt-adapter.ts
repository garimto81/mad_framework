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
    await this.sleep(1000);

    const script = `
      (() => {
        try {
          // Try multiple selectors for ChatGPT responses (ordered by specificity)
          const selectors = [
            '[data-message-author-role="assistant"] .markdown',
            '[data-message-author-role="assistant"]',
            'div[data-message-author-role="assistant"] > div > div',
            '.agent-turn .markdown',
            '.prose',
            'article[data-testid*="conversation"] div.markdown'
          ];

          for (const sel of selectors) {
            const messages = document.querySelectorAll(sel);
            if (messages.length > 0) {
              const lastMessage = messages[messages.length - 1];
              const content = lastMessage?.innerText || lastMessage?.textContent || '';
              if (content.trim()) {
                return { success: true, content: content.trim(), selector: sel, count: messages.length };
              }
            }
          }

          return {
            success: false,
            content: '',
            error: 'no messages found'
          };
        } catch (e) {
          return { success: false, content: '', error: e.message };
        }
      })()
    `;

    try {
      const result = await this.executeScript<{success: boolean; content: string; error?: string; selector?: string}>(
        script,
        { success: false, content: '', error: 'script failed' }
      );

      console.log(`[chatgpt] getResponse result:`, JSON.stringify(result).substring(0, 300));

      if (!result.success || !result.content) {
        return this.error('EXTRACT_FAILED', `ChatGPT getResponse failed: ${result.error}`, {
          selector: this.selectors.responseContainer,
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
      !!(
        document.querySelector('.result-streaming') ||
        document.querySelector('[data-message-author-role="assistant"] .markdown.prose.dark:empty') ||
        document.querySelector('.agent-turn')
      )
    `;
    return this.executeScript<boolean>(script, false);
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
