/**
 * Base LLM Adapter
 *
 * 브라우저 자동화를 위한 기본 어댑터 클래스
 * Issue #17: AdapterResult 타입으로 표준화
 * Issue #18: 셀렉터 Fallback 시스템
 * Issue #27: 파일 분할 리팩토링
 */

import type { LLMProvider, AdapterResult, AdapterErrorCode } from '../../../shared/types';
import type { WebContents, SelectorSet, ProviderSelectors, AdapterSelectors } from './types';
import { getBaseUrl, getDefaultSelectors, getSelectorSets } from './selector-config';
import {
  INPUT_READY_TIMEOUT,
  RESPONSE_TIMEOUT,
  TYPING_START_TIMEOUT,
  TYPING_FINISH_MIN_TIMEOUT,
  CONDITION_CHECK_INTERVAL,
  TYPING_START_CHECK_INTERVAL,
  TYPING_START_MAX_ATTEMPTS,
  TYPING_FINISH_MAX_ATTEMPTS,
  DEFAULT_MAX_ATTEMPTS,
  DOM_STABILIZATION_DELAY,
  MAX_BACKOFF_INTERVAL,
  MIN_RESPONSE_LENGTH,
} from '../../constants';

export class BaseLLMAdapter {
  readonly provider: LLMProvider;
  readonly baseUrl: string;
  readonly selectors: AdapterSelectors;
  readonly selectorSets: ProviderSelectors;
  protected webContents: WebContents;

  constructor(provider: LLMProvider, webContents: WebContents) {
    this.provider = provider;
    this.webContents = webContents;

    // Initialize from config modules
    this.baseUrl = getBaseUrl(provider);
    this.selectors = getDefaultSelectors(provider);
    this.selectorSets = getSelectorSets(provider);
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

  async prepareInput(timeout: number = INPUT_READY_TIMEOUT): Promise<AdapterResult> {
    const isReady = await this.waitForCondition(
      async () => {
        // Issue #18: Use fallback selectors for input check
        const selector = await this.findElement(this.selectorSets.inputTextarea);
        return selector !== null;
      },
      { timeout, interval: CONDITION_CHECK_INTERVAL, description: 'input to be ready' }
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

    console.log(`[${this.provider}] enterPrompt called, length: ${prompt.length}`);

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

  async awaitResponse(timeout: number = RESPONSE_TIMEOUT): Promise<AdapterResult> {
    console.log(`[${this.provider}] awaitResponse started, timeout: ${timeout}ms`);

    // Step 1: Wait for typing to start
    const typingStarted = await this.waitForCondition(
      () => this.isWriting(),
      { timeout: TYPING_START_TIMEOUT, interval: TYPING_START_CHECK_INTERVAL, maxAttempts: TYPING_START_MAX_ATTEMPTS, description: 'typing to start' }
    );

    if (!typingStarted) {
      console.warn(`[${this.provider}] Typing never started, checking for response anyway`);
      // Early check: 응답이 이미 있는지 확인
      const hasResponse = await this.hasValidResponse();
      if (hasResponse) {
        console.log(`[${this.provider}] Response already present, skipping wait`);
        return this.success();
      }
    }

    // Step 2: Wait for typing to finish with reasonable limits
    const remainingTimeout = Math.max(timeout - TYPING_START_TIMEOUT, TYPING_FINISH_MIN_TIMEOUT);
    const typingFinished = await this.waitForCondition(
      async () => !(await this.isWriting()),
      {
        timeout: remainingTimeout,
        interval: CONDITION_CHECK_INTERVAL,
        maxAttempts: TYPING_FINISH_MAX_ATTEMPTS,
        description: 'typing to finish',
      }
    );

    if (!typingFinished) {
      // Fallback: 타임아웃 되었지만 응답이 있는지 최종 확인
      const hasResponse = await this.hasValidResponse();
      if (hasResponse) {
        console.log(`[${this.provider}] Response present despite timeout`);
        return this.success();
      }
      return this.error('RESPONSE_TIMEOUT', `Response timeout for ${this.provider}`, {
        timeout,
        remainingTimeout,
      });
    }

    // Step 3: DOM stabilization delay
    await this.sleep(DOM_STABILIZATION_DELAY);
    console.log(`[${this.provider}] Response complete`);
    return this.success();
  }

  // Helper: 유효한 응답이 있는지 확인 (Issue #33 개선)
  protected async hasValidResponse(): Promise<boolean> {
    const result = await this.getResponse();
    if (!result.success || typeof result.data !== 'string') {
      return false;
    }

    const content = result.data.trim();

    // 최소 길이 체크
    if (content.length <= MIN_RESPONSE_LENGTH) {
      console.log(`[${this.provider}] hasValidResponse: too short (${content.length})`);
      return false;
    }

    // 로딩 플레이스홀더 필터링
    if (content === '...' || content === '…') {
      console.log(`[${this.provider}] hasValidResponse: ellipsis only`);
      return false;
    }

    // 로딩 상태 텍스트 필터링
    if (/^(loading|thinking|generating|writing)/i.test(content)) {
      console.log(`[${this.provider}] hasValidResponse: loading placeholder`);
      return false;
    }

    console.log(`[${this.provider}] hasValidResponse: valid (${content.length} chars)`);
    return true;
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

  async waitForInputReady(timeout: number = INPUT_READY_TIMEOUT): Promise<void> {
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

  async waitForResponse(timeout: number = RESPONSE_TIMEOUT): Promise<void> {
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
      maxAttempts?: number;
    }
  ): Promise<boolean> {
    const startTime = Date.now();
    const maxAttempts = options.maxAttempts || DEFAULT_MAX_ATTEMPTS;
    let attempts = 0;

    while (Date.now() - startTime < options.timeout && attempts < maxAttempts) {
      attempts++;
      try {
        if (await checkFn()) {
          console.log(`[${this.provider}] Condition met: ${options.description} (${attempts} attempts)`);
          return true;
        }
      } catch (error) {
        console.warn(`[${this.provider}] Check failed for ${options.description}:`, error);
      }

      // Progressive backoff: 처음 10회는 빠르게, 이후 점점 느리게
      const backoffInterval = attempts <= 10
        ? options.interval
        : Math.min(options.interval * 2, MAX_BACKOFF_INTERVAL);

      await this.sleep(backoffInterval);
    }

    console.warn(`[${this.provider}] Timeout waiting for: ${options.description} (${attempts} attempts)`);
    return false;
  }
}

// Re-export types for convenience
export type { WebContents, SelectorSet, ProviderSelectors, AdapterSelectors } from './types';
