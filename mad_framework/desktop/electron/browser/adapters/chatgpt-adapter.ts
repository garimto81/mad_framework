/**
 * ChatGPT Adapter
 *
 * chat.openai.com 사이트 자동화
 */

import { BaseLLMAdapter } from './base-adapter';

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

  async isLoggedIn(): Promise<boolean> {
    const script = `!!document.querySelector('${this.selectors.loginCheck}')`;
    return this.webContents.executeJavaScript(script);
  }

  async inputPrompt(prompt: string): Promise<void> {
    const escapedPrompt = JSON.stringify(prompt);
    const script = `
      const textarea = document.querySelector('${this.selectors.inputTextarea}');
      textarea.value = ${escapedPrompt};
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    `;
    await this.webContents.executeJavaScript(script);
  }

  async isWriting(): Promise<boolean> {
    const script = `!!document.querySelector('${this.selectors.typingIndicator}')`;
    return this.webContents.executeJavaScript(script);
  }

  async getTokenCount(): Promise<number> {
    const script = `
      const lastMsg = document.querySelectorAll('[data-message-author-role="assistant"]');
      const text = lastMsg[lastMsg.length - 1]?.innerText || '';
      return text.length;
    `;
    return this.webContents.executeJavaScript(script);
  }

  async extractResponse(): Promise<string> {
    const script = `
      const messages = document.querySelectorAll('[data-message-author-role="assistant"]');
      const lastMessage = messages[messages.length - 1];
      return lastMessage?.innerText || '';
    `;
    return this.webContents.executeJavaScript(script);
  }
}
