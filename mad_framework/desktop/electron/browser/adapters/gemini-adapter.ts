/**
 * Gemini Adapter
 *
 * gemini.google.com 사이트 자동화
 */

import { BaseLLMAdapter } from './base-adapter';

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

  async isLoggedIn(): Promise<boolean> {
    const script = `!!document.querySelector('${this.selectors.loginCheck}')`;
    return this.webContents.executeJavaScript(script);
  }

  async inputPrompt(prompt: string): Promise<void> {
    const escapedPrompt = JSON.stringify(prompt);
    const script = `
      const editor = document.querySelector('${this.selectors.inputTextarea}');
      editor.innerHTML = ${escapedPrompt};
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    `;
    await this.webContents.executeJavaScript(script);
  }
}
