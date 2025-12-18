/**
 * Base LLM Adapter
 *
 * 브라우저 자동화를 위한 기본 어댑터 클래스
 */

import type { LLMProvider } from '../../../shared/types';

interface WebContents {
  executeJavaScript: (script: string) => Promise<any>;
  loadURL: (url: string) => void;
  getURL: () => string;
  on: (event: string, callback: (...args: any[]) => void) => void;
}

interface AdapterSelectors {
  inputTextarea: string;
  sendButton: string;
  responseContainer: string;
  typingIndicator: string;
  loginCheck: string;
}

export class BaseLLMAdapter {
  readonly provider: LLMProvider;
  readonly baseUrl: string;
  readonly selectors: AdapterSelectors;
  protected webContents: WebContents;

  constructor(provider: LLMProvider, webContents: WebContents) {
    this.provider = provider;
    this.webContents = webContents;

    // Default selectors - should be overridden by subclasses
    this.baseUrl = this.getBaseUrl(provider);
    this.selectors = this.getDefaultSelectors(provider);
  }

  private getBaseUrl(provider: LLMProvider): string {
    const urls: Record<LLMProvider, string> = {
      chatgpt: 'https://chat.openai.com',
      claude: 'https://claude.ai',
      gemini: 'https://gemini.google.com',
    };
    return urls[provider];
  }

  private getDefaultSelectors(provider: LLMProvider): AdapterSelectors {
    const selectorMap: Record<LLMProvider, AdapterSelectors> = {
      chatgpt: {
        inputTextarea: '#prompt-textarea',
        sendButton: '[data-testid="send-button"]',
        responseContainer: '[data-message-author-role="assistant"]',
        typingIndicator: '.result-streaming',
        loginCheck: '[data-testid="profile-button"]',
      },
      claude: {
        inputTextarea: '[contenteditable="true"]',
        sendButton: '[aria-label="Send message"]',
        responseContainer: '[data-is-streaming="false"]',
        typingIndicator: '[data-is-streaming="true"]',
        loginCheck: '[data-testid="user-menu"]',
      },
      gemini: {
        inputTextarea: '.ql-editor',
        sendButton: '.send-button',
        responseContainer: '.response-container',
        typingIndicator: '.loading-indicator',
        loginCheck: '[data-user-email]',
      },
    };
    return selectorMap[provider];
  }

  async isLoggedIn(): Promise<boolean> {
    const script = `!!document.querySelector('${this.selectors.loginCheck}')`;
    return this.webContents.executeJavaScript(script);
  }

  async waitForInputReady(timeout: number = 10000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const isReady = await this.webContents.executeJavaScript(
        `!!document.querySelector('${this.selectors.inputTextarea}')`
      );
      if (isReady) return;
      await this.sleep(500);
    }

    throw new Error('Input not ready');
  }

  async inputPrompt(prompt: string): Promise<void> {
    const escapedPrompt = JSON.stringify(prompt);
    const script = `
      const textarea = document.querySelector('${this.selectors.inputTextarea}');
      if (textarea.tagName === 'TEXTAREA' || textarea.tagName === 'INPUT') {
        textarea.value = ${escapedPrompt};
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        textarea.innerText = ${escapedPrompt};
        textarea.dispatchEvent(new InputEvent('input', { bubbles: true }));
      }
    `;
    await this.webContents.executeJavaScript(script);
  }

  async sendMessage(): Promise<void> {
    const script = `
      const button = document.querySelector('${this.selectors.sendButton}');
      if (button) button.click();
    `;
    await this.webContents.executeJavaScript(script);
  }

  async waitForResponse(timeout: number = 120000): Promise<void> {
    const script = `
      new Promise((resolve, reject) => {
        const startTime = Date.now();
        const check = () => {
          const indicator = document.querySelector('${this.selectors.typingIndicator}');
          if (!indicator) {
            resolve();
          } else if (Date.now() - startTime > ${timeout}) {
            reject(new Error('Response timeout'));
          } else {
            setTimeout(check, 500);
          }
        };
        setTimeout(check, 2000);
      });
    `;
    await this.webContents.executeJavaScript(script);
  }

  async extractResponse(): Promise<string> {
    const script = `
      const messages = document.querySelectorAll('${this.selectors.responseContainer}');
      const lastMessage = messages[messages.length - 1];
      return lastMessage?.innerText || '';
    `;
    return this.webContents.executeJavaScript(script);
  }

  async isWriting(): Promise<boolean> {
    const script = `!!document.querySelector('${this.selectors.typingIndicator}')`;
    return this.webContents.executeJavaScript(script);
  }

  async getTokenCount(): Promise<number> {
    const script = `
      const messages = document.querySelectorAll('${this.selectors.responseContainer}');
      const lastMessage = messages[messages.length - 1];
      return (lastMessage?.innerText || '').length;
    `;
    return this.webContents.executeJavaScript(script);
  }

  async clearInput(): Promise<void> {
    const script = `
      const textarea = document.querySelector('${this.selectors.inputTextarea}');
      if (textarea.tagName === 'TEXTAREA' || textarea.tagName === 'INPUT') {
        textarea.value = '';
      } else {
        textarea.innerHTML = '';
      }
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    `;
    await this.webContents.executeJavaScript(script);
  }

  async scrollToBottom(): Promise<void> {
    const script = `window.scrollTo(0, document.body.scrollHeight);`;
    await this.webContents.executeJavaScript(script);
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
