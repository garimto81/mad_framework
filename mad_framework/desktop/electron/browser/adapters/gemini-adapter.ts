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
