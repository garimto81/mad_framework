/**
 * Base LLM Adapter
 *
 * 브라우저 자동화를 위한 기본 어댑터 클래스
 * Issue #17: AdapterResult 타입으로 표준화
 */

import type { LLMProvider, AdapterResult, AdapterErrorCode } from '../../../shared/types';

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

  // Helper to create success result
  protected success<T>(data?: T): AdapterResult<T> {
    return { success: true, data };
  }

  // Helper to create error result
  protected error<T>(code: AdapterErrorCode, message: string, details?: Record<string, unknown>): AdapterResult<T> {
    return {
      success: false,
      error: { code, message, details },
    };
  }

  // Safe wrapper for executeJavaScript with error handling
  protected async executeScript<T>(script: string, defaultValue?: T): Promise<T> {
    try {
      const result = await this.webContents.executeJavaScript(script);
      return result as T;
    } catch (error) {
      console.error(`[${this.provider}] Script execution failed:`, error);
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Script execution failed for ${this.provider}: ${error}`);
    }
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

  // --- AdapterResult-based methods (Issue #17) ---

  async checkLogin(): Promise<AdapterResult<boolean>> {
    try {
      const script = `!!document.querySelector('${this.selectors.loginCheck}')`;
      const isLoggedIn = await this.executeScript<boolean>(script, false);
      return this.success(isLoggedIn);
    } catch (error) {
      return this.error('NOT_LOGGED_IN', `Login check failed: ${error}`);
    }
  }

  async prepareInput(timeout: number = 10000): Promise<AdapterResult> {
    const isReady = await this.waitForCondition(
      async () => {
        return this.executeScript<boolean>(
          `!!document.querySelector('${this.selectors.inputTextarea}')`,
          false
        );
      },
      { timeout, interval: 500, description: 'input to be ready' }
    );

    if (!isReady) {
      return this.error('SELECTOR_NOT_FOUND', `Input not ready for ${this.provider}`, {
        selector: this.selectors.inputTextarea,
        timeout,
      });
    }
    return this.success();
  }

  async enterPrompt(prompt: string): Promise<AdapterResult> {
    const escapedPrompt = JSON.stringify(prompt);
    const script = `
      (() => {
        const textarea = document.querySelector('${this.selectors.inputTextarea}');
        if (!textarea) return { success: false, error: 'selector not found' };
        if (textarea.tagName === 'TEXTAREA' || textarea.tagName === 'INPUT') {
          textarea.value = ${escapedPrompt};
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          textarea.innerText = ${escapedPrompt};
          textarea.dispatchEvent(new InputEvent('input', { bubbles: true }));
        }
        return { success: true };
      })()
    `;

    try {
      const result = await this.executeScript<{ success: boolean; error?: string }>(
        script,
        { success: false, error: 'script failed' }
      );

      if (!result.success) {
        return this.error('INPUT_FAILED', `Failed to input prompt: ${result.error}`, {
          promptLength: prompt.length,
        });
      }
      return this.success();
    } catch (error) {
      return this.error('INPUT_FAILED', `Input prompt exception: ${error}`);
    }
  }

  async submitMessage(): Promise<AdapterResult> {
    const script = `
      (() => {
        const button = document.querySelector('${this.selectors.sendButton}');
        if (button) {
          button.click();
          return { success: true };
        }
        return { success: false, error: 'send button not found' };
      })()
    `;

    try {
      const result = await this.executeScript<{ success: boolean; error?: string }>(
        script,
        { success: false, error: 'script failed' }
      );

      if (!result.success) {
        return this.error('SEND_FAILED', `Failed to send message: ${result.error}`, {
          selector: this.selectors.sendButton,
        });
      }
      return this.success();
    } catch (error) {
      return this.error('SEND_FAILED', `Send message exception: ${error}`);
    }
  }

  async awaitResponse(timeout: number = 120000): Promise<AdapterResult> {
    console.log(`[${this.provider}] awaitResponse started, timeout: ${timeout}ms`);

    // Step 1: Wait for typing to start (max 10 seconds)
    const typingStarted = await this.waitForCondition(
      () => this.isWriting(),
      { timeout: 10000, interval: 300, description: 'typing to start' }
    );

    if (!typingStarted) {
      console.warn(`[${this.provider}] Typing never started, checking for response anyway`);
    }

    // Step 2: Wait for typing to finish (remaining timeout)
    const remainingTimeout = Math.max(timeout - 10000, 5000);
    const typingFinished = await this.waitForCondition(
      async () => !(await this.isWriting()),
      { timeout: remainingTimeout, interval: 500, description: 'typing to finish' }
    );

    if (!typingFinished) {
      return this.error('RESPONSE_TIMEOUT', `Response timeout for ${this.provider}`, {
        timeout,
        remainingTimeout,
      });
    }

    // Step 3: DOM stabilization delay
    await this.sleep(1000);
    console.log(`[${this.provider}] Response complete`);
    return this.success();
  }

  async getResponse(): Promise<AdapterResult<string>> {
    const script = `
      (() => {
        const messages = document.querySelectorAll('${this.selectors.responseContainer}');
        const lastMessage = messages[messages.length - 1];
        return lastMessage?.innerText || '';
      })()
    `;

    try {
      const content = await this.executeScript<string>(script, '');
      return this.success(content);
    } catch (error) {
      return this.error('EXTRACT_FAILED', `Failed to extract response: ${error}`);
    }
  }

  // --- Legacy methods (backward compatibility) ---

  async isLoggedIn(): Promise<boolean> {
    const result = await this.checkLogin();
    return result.success && result.data === true;
  }

  async waitForInputReady(timeout: number = 10000): Promise<void> {
    const result = await this.prepareInput(timeout);
    if (!result.success) {
      throw new Error(result.error?.message || `Input not ready for ${this.provider}`);
    }
  }

  async inputPrompt(prompt: string): Promise<void> {
    const result = await this.enterPrompt(prompt);
    if (!result.success) {
      throw new Error(result.error?.message || `Failed to input prompt for ${this.provider}`);
    }
  }

  async sendMessage(): Promise<void> {
    const result = await this.submitMessage();
    if (!result.success) {
      throw new Error(result.error?.message || `Failed to send message for ${this.provider}`);
    }
  }

  async waitForResponse(timeout: number = 120000): Promise<void> {
    const result = await this.awaitResponse(timeout);
    if (!result.success) {
      throw new Error(result.error?.message || `Response timeout for ${this.provider}`);
    }
  }

  async extractResponse(): Promise<string> {
    const result = await this.getResponse();
    return result.data || '';
  }

  async isWriting(): Promise<boolean> {
    const script = `!!document.querySelector('${this.selectors.typingIndicator}')`;
    return this.executeScript<boolean>(script, false);
  }

  async getTokenCount(): Promise<number> {
    const script = `
      (() => {
        const messages = document.querySelectorAll('${this.selectors.responseContainer}');
        const lastMessage = messages[messages.length - 1];
        return (lastMessage?.innerText || '').length;
      })()
    `;
    return this.executeScript<number>(script, 0);
  }

  async clearInput(): Promise<void> {
    const script = `
      (() => {
        const textarea = document.querySelector('${this.selectors.inputTextarea}');
        if (!textarea) return;
        if (textarea.tagName === 'TEXTAREA' || textarea.tagName === 'INPUT') {
          textarea.value = '';
        } else {
          textarea.innerHTML = '';
        }
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `;
    await this.executeScript<void>(script);
  }

  async scrollToBottom(): Promise<void> {
    const script = `window.scrollTo(0, document.body.scrollHeight)`;
    await this.executeScript<void>(script);
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Wait for a condition to be true with configurable timeout and interval
   * @param checkFn - Function that returns true when condition is met
   * @param options - Configuration options
   * @returns true if condition met, false if timeout
   */
  protected async waitForCondition(
    checkFn: () => Promise<boolean>,
    options: {
      timeout: number;
      interval: number;
      description: string;
    }
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < options.timeout) {
      try {
        if (await checkFn()) {
          console.log(`[${this.provider}] Condition met: ${options.description}`);
          return true;
        }
      } catch (error) {
        console.warn(`[${this.provider}] Check failed for ${options.description}:`, error);
      }
      await this.sleep(options.interval);
    }

    console.warn(`[${this.provider}] Timeout waiting for: ${options.description}`);
    return false;
  }
}
