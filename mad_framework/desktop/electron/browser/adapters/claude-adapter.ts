/**
 * Claude Adapter
 *
 * claude.ai 사이트 자동화
 */

import { BaseLLMAdapter } from './base-adapter';

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

  async isLoggedIn(): Promise<boolean> {
    const script = `!!document.querySelector('${this.selectors.loginCheck}')`;
    return this.webContents.executeJavaScript(script);
  }

  async inputPrompt(prompt: string): Promise<void> {
    const escapedPrompt = JSON.stringify(prompt);
    // Claude uses contenteditable div
    const script = `
      const editor = document.querySelector('${this.selectors.inputTextarea}');
      editor.innerHTML = '';
      editor.innerText = ${escapedPrompt};
      editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
    `;
    await this.webContents.executeJavaScript(script);
  }

  async isWriting(): Promise<boolean> {
    const script = `!!document.querySelector('${this.selectors.typingIndicator}')`;
    return this.webContents.executeJavaScript(script);
  }
}
