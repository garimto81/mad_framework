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
    const script = `!!document.querySelector('${this.selectors.typingIndicator}')`;
    return this.executeScript<boolean>(script, false);
  }
}
