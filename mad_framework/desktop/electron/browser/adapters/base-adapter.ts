/**
 * Base LLM Adapter
 *
 * 브라우저 자동화를 위한 기본 어댑터 클래스
 * Issue #17: AdapterResult 타입으로 표준화
 * Issue #18: 셀렉터 Fallback 시스템
 */

import type { LLMProvider, AdapterResult, AdapterErrorCode } from '../../../shared/types';

interface WebContents {
  executeJavaScript: (script: string) => Promise<any>;
  loadURL: (url: string) => void;
  getURL: () => string;
  on: (event: string, callback: (...args: any[]) => void) => void;
}

// Issue #18: SelectorSet for fallback support
interface SelectorSet {
  primary: string;
  fallbacks: string[];
}

interface ProviderSelectors {
  inputTextarea: SelectorSet;
  sendButton: SelectorSet;
  responseContainer: SelectorSet;
  typingIndicator: SelectorSet;
  loginCheck: SelectorSet;
}

// Legacy interface for backward compatibility
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
  readonly selectorSets: ProviderSelectors;
  protected webContents: WebContents;

  constructor(provider: LLMProvider, webContents: WebContents) {
    this.provider = provider;
    this.webContents = webContents;

    // Default selectors - should be overridden by subclasses
    this.baseUrl = this.getBaseUrl(provider);
    this.selectors = this.getDefaultSelectors(provider);
    this.selectorSets = this.getSelectorSets(provider);
  }

  // Issue #18: Find element with fallback support
  protected async findElement(selectorSet: SelectorSet): Promise<string | null> {
    const allSelectors = [selectorSet.primary, ...selectorSet.fallbacks];

    for (const selector of allSelectors) {
      try {
        const exists = await this.executeScript<boolean>(
          `!!document.querySelector('${selector}')`,
          false
        );

        if (exists) {
          console.log(`[${this.provider}] Found element: ${selector}`);
          return selector;
        }
      } catch (error) {
        console.warn(`[${this.provider}] Error checking selector: ${selector}`, error);
      }
    }

    console.error(`[${this.provider}] No element found for primary: ${selectorSet.primary}`);
    return null;
  }

  // Issue #18: Find element and execute action with fallback
  protected async findAndExecute<T>(
    selectorSet: SelectorSet,
    action: (selector: string) => Promise<T>,
    errorMessage: string
  ): Promise<T> {
    const selector = await this.findElement(selectorSet);
    if (!selector) {
      throw new Error(`${errorMessage}: no selector found for ${this.provider}`);
    }
    return action(selector);
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

  // Issue #18: Selector fallback definitions
  private getSelectorSets(provider: LLMProvider): ProviderSelectors {
    const selectorSetsMap: Record<LLMProvider, ProviderSelectors> = {
      chatgpt: {
        inputTextarea: {
          primary: '#prompt-textarea',
          fallbacks: [
            '[contenteditable="true"]',
            'textarea[placeholder*="Message"]',
            'div[role="textbox"]',
          ],
        },
        sendButton: {
          primary: '[data-testid="send-button"]',
          fallbacks: [
            'button[data-testid="send-button"]',
            'button[aria-label="Send prompt"]',
            'button[aria-label*="Send"]',
            'form button:not([disabled])',
          ],
        },
        responseContainer: {
          primary: '[data-message-author-role="assistant"]',
          fallbacks: [
            '[data-message-author-role="assistant"] .markdown',
            '.agent-turn .markdown',
            '.prose',
            'article[data-testid*="conversation"] div.markdown',
          ],
        },
        typingIndicator: {
          primary: '.result-streaming',
          fallbacks: [
            '.agent-turn',
            '[data-message-author-role="assistant"]:empty',
            '[data-testid*="streaming"]',
          ],
        },
        loginCheck: {
          primary: '[data-testid="profile-button"]',
          fallbacks: [
            'button[aria-label*="Account"]',
            'img[alt*="User"]',
            '#prompt-textarea',
          ],
        },
      },
      claude: {
        inputTextarea: {
          primary: '[contenteditable="true"]',
          fallbacks: [
            'div[contenteditable="true"]',
            'fieldset[dir="auto"] [contenteditable]',
            '[data-placeholder]',
          ],
        },
        sendButton: {
          primary: '[aria-label="Send message"]',
          fallbacks: [
            'button[aria-label*="Send"]',
            '[data-testid="send-button"]',
            'form button:not([disabled])',
          ],
        },
        responseContainer: {
          primary: '[data-is-streaming="false"]',
          fallbacks: [
            '[data-testid="assistant-message"]',
            '.prose',
            '[role="article"]',
          ],
        },
        typingIndicator: {
          primary: '[data-is-streaming="true"]',
          fallbacks: [
            '.animate-pulse',
            '[data-testid*="loading"]',
          ],
        },
        loginCheck: {
          primary: '[data-testid="user-menu"]',
          fallbacks: [
            'button[aria-label*="account"]',
            'button[aria-label*="Account"]',
            '[data-testid="menu-trigger"]',
            '[contenteditable="true"]',
          ],
        },
      },
      gemini: {
        inputTextarea: {
          primary: '.ql-editor',
          fallbacks: [
            'rich-textarea',
            '[contenteditable="true"]',
            'textarea[aria-label*="prompt"]',
          ],
        },
        sendButton: {
          primary: '.send-button',
          fallbacks: [
            'button[aria-label*="Send"]',
            '[data-testid="send-button"]',
            'button[mat-icon-button]',
          ],
        },
        responseContainer: {
          primary: '.response-container',
          fallbacks: [
            '.model-response',
            '[data-content-type="response"]',
            '.message-content',
          ],
        },
        typingIndicator: {
          primary: '.loading-indicator',
          fallbacks: [
            '.thinking-indicator',
            '[aria-busy="true"]',
            '.spinner',
          ],
        },
        loginCheck: {
          primary: '[data-user-email]',
          fallbacks: [
            'img[data-iml]',
            '[aria-label*="Google Account"]',
            '.ql-editor',
          ],
        },
      },
    };
    return selectorSetsMap[provider];
  }

  // --- AdapterResult-based methods (Issue #17) with fallback (Issue #18) ---

  async checkLogin(): Promise<AdapterResult<boolean>> {
    try {
      // Issue #18: Use fallback selectors for login check
      const selector = await this.findElement(this.selectorSets.loginCheck);
      return this.success(selector !== null);
    } catch (error) {
      return this.error('NOT_LOGGED_IN', `Login check failed: ${error}`);
    }
  }

  async prepareInput(timeout: number = 10000): Promise<AdapterResult> {
    const isReady = await this.waitForCondition(
      async () => {
        // Issue #18: Use fallback selectors for input check
        const selector = await this.findElement(this.selectorSets.inputTextarea);
        return selector !== null;
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
    // Issue #18: Find input with fallback
    const selector = await this.findElement(this.selectorSets.inputTextarea);
    if (!selector) {
      return this.error('SELECTOR_NOT_FOUND', `Failed to input prompt for ${this.provider}: no input found`);
    }

    const escapedPrompt = JSON.stringify(prompt);
    const script = `
      (() => {
        const textarea = document.querySelector('${selector}');
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
    // Issue #18: Find send button with fallback
    const selector = await this.findElement(this.selectorSets.sendButton);
    if (!selector) {
      console.warn(`[${this.provider}] No send button found, trying Enter key`);
      // Fallback: Try Enter key
      const inputSelector = await this.findElement(this.selectorSets.inputTextarea);
      if (inputSelector) {
        const enterScript = `
          (() => {
            const input = document.querySelector('${inputSelector}');
            if (input) {
              input.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true
              }));
              return { success: true };
            }
            return { success: false, error: 'input not found' };
          })()
        `;
        const result = await this.executeScript<{ success: boolean }>(enterScript, { success: false });
        if (result.success) {
          return this.success();
        }
      }
      return this.error('SEND_FAILED', `Send button not found for ${this.provider}`);
    }

    const script = `
      (() => {
        const button = document.querySelector('${selector}');
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
    // Issue #18: Find response container with fallback
    const selector = await this.findElement(this.selectorSets.responseContainer);
    if (!selector) {
      console.warn(`[${this.provider}] No response container found`);
      return this.success('');
    }

    const script = `
      (() => {
        const messages = document.querySelectorAll('${selector}');
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
      throw new Error(result.error?.message || `Failed to input prompt for ${this.provider}: no input found`);
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
    // Issue #18: Check all typing indicator selectors
    const allSelectors = [
      this.selectorSets.typingIndicator.primary,
      ...this.selectorSets.typingIndicator.fallbacks,
    ];

    const selectorQuery = allSelectors.map(s => `document.querySelector('${s}')`).join(' || ');
    const script = `!!(${selectorQuery})`;
    return this.executeScript<boolean>(script, false);
  }

  async getTokenCount(): Promise<number> {
    // Issue #18: Find response container with fallback
    const selector = await this.findElement(this.selectorSets.responseContainer);
    if (!selector) {
      return 0;
    }

    const script = `
      (() => {
        const messages = document.querySelectorAll('${selector}');
        const lastMessage = messages[messages.length - 1];
        return (lastMessage?.innerText || '').length;
      })()
    `;
    return this.executeScript<number>(script, 0);
  }

  async clearInput(): Promise<void> {
    // Issue #18: Find input with fallback
    const selector = await this.findElement(this.selectorSets.inputTextarea);
    if (!selector) {
      return;
    }

    const script = `
      (() => {
        const textarea = document.querySelector('${selector}');
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
