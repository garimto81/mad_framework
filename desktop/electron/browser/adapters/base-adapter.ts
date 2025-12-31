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
import { selectorMonitor, type ProviderValidationResult } from './selector-monitor';
import { adaptiveTimeoutManager, type TimeoutPrediction } from '../../utils/adaptive-timeout';
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

/**
 * Issue #31: 응답 추출 옵션
 */
export interface ResponseExtractionOptions {
  /** 시도할 셀렉터 목록 (기본: getResponseSelectors()) */
  selectors?: string[];
  /** 최소 응답 길이 (기본: 5) */
  minLength?: number;
  /** DOM 안정화 대기 시간 ms (기본: 1500) */
  domSettleMs?: number;
  /** 최대 재시도 횟수 (기본: 1) */
  maxRetries?: number;
  /** 재시도 간격 ms (기본: 1000) */
  retryDelayMs?: number;
  /** 재귀적 텍스트 추출 사용 여부 (기본: false) */
  useRecursiveExtraction?: boolean;
  /** TreeWalker 폴백 사용 여부 (기본: false) */
  useTreeWalker?: boolean;
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

    // Initialize from config modules
    this.baseUrl = getBaseUrl(provider);
    this.selectors = getDefaultSelectors(provider);
    this.selectorSets = getSelectorSets(provider);
  }

  // Issue #18: Find element with fallback support
  // Issue #43: 셀렉터 모니터링 통합
  protected async findElement(
    selectorSet: SelectorSet,
    selectorType?: keyof ProviderSelectors
  ): Promise<string | null> {
    const allSelectors = [selectorSet.primary, ...selectorSet.fallbacks];

    for (const selector of allSelectors) {
      try {
        const exists = await this.executeScript<boolean>(
          `!!document.querySelector('${selector}')`,
          false
        );

        if (exists) {
          console.log(`[${this.provider}] Found element: ${selector}`);
          // Issue #43: 성공 기록
          if (selectorType) {
            selectorMonitor.recordSuccess(this.provider, selectorType, selector);
          }
          return selector;
        } else {
          // Issue #43: 실패 기록
          if (selectorType) {
            selectorMonitor.recordFailure(this.provider, selectorType, selector);
          }
        }
      } catch (error) {
        console.warn(`[${this.provider}] Error checking selector: ${selector}`, error);
        // Issue #43: 에러도 실패로 기록
        if (selectorType) {
          selectorMonitor.recordFailure(this.provider, selectorType, selector, 'script_error');
        }
      }
    }

    console.error(`[${this.provider}] No element found for primary: ${selectorSet.primary}`);

    // Issue #43: 모든 폴백 실패 이벤트 발생
    if (selectorType) {
      selectorMonitor.recordAllFallbacksFailed(
        this.provider,
        selectorType,
        selectorSet
      );
    }

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

  // --- Issue #43: 셀렉터 유효성 검증 ---

  /**
   * Provider의 모든 셀렉터 유효성을 검증합니다.
   * 앱 시작 시 또는 주기적으로 호출하여 셀렉터 상태를 확인합니다.
   */
  async validateSelectors(): Promise<ProviderValidationResult> {
    return selectorMonitor.validateProvider(
      this.provider,
      (script) => this.executeScript(script)
    );
  }

  /**
   * 캐시된 셀렉터 검증 결과를 반환합니다.
   */
  getCachedValidation(): ProviderValidationResult | null {
    return selectorMonitor.getCachedValidation(this.provider);
  }

  /**
   * 셀렉터 통계를 반환합니다.
   */
  getSelectorStats() {
    return selectorMonitor.getProviderStats(this.provider);
  }

  // --- AdapterResult-based methods (Issue #17) with fallback (Issue #18) ---

  async checkLogin(): Promise<AdapterResult<boolean>> {
    try {
      // Issue #18: Use fallback selectors for login check
      // Issue #43: 셀렉터 타입 전달
      const selector = await this.findElement(this.selectorSets.loginCheck, 'loginCheck');
      return this.success(selector !== null);
    } catch (error) {
      return this.error('NOT_LOGGED_IN', `Login check failed: ${error}`);
    }
  }

  async prepareInput(timeout: number = INPUT_READY_TIMEOUT): Promise<AdapterResult> {
    const isReady = await this.waitForCondition(
      async () => {
        // Issue #18: Use fallback selectors for input check
        // Issue #43: 셀렉터 타입 전달
        const selector = await this.findElement(this.selectorSets.inputTextarea, 'inputTextarea');
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
    // Issue #43: 셀렉터 타입 전달
    const selector = await this.findElement(this.selectorSets.inputTextarea, 'inputTextarea');
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
    // Issue #43: 셀렉터 타입 전달
    const selector = await this.findElement(this.selectorSets.sendButton, 'sendButton');
    if (!selector) {
      console.warn(`[${this.provider}] No send button found, trying Enter key`);
      // Fallback: Try Enter key
      const inputSelector = await this.findElement(this.selectorSets.inputTextarea, 'inputTextarea');
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
    // Issue #46: 적응형 타임아웃 적용
    const prediction = this.getAdaptiveTimeout();
    const effectiveTimeout = timeout > 0 ? Math.min(timeout, prediction.recommendedTimeoutMs) : prediction.recommendedTimeoutMs;

    console.log(`[${this.provider}] awaitResponse started, timeout: ${effectiveTimeout}ms ` +
      `(adaptive: ${prediction.recommendedTimeoutMs}ms, confidence: ${prediction.confidence})`);

    const startTime = Date.now();

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
    const remainingTimeout = Math.max(effectiveTimeout - TYPING_START_TIMEOUT, TYPING_FINISH_MIN_TIMEOUT);
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
        timeout: effectiveTimeout,
        remainingTimeout,
        adaptivePrediction: prediction,
      });
    }

    // Step 3: DOM stabilization delay
    await this.sleep(DOM_STABILIZATION_DELAY);

    // Issue #46: 응답 시간 기록 (성공)
    const elapsedMs = Date.now() - startTime;
    console.log(`[${this.provider}] Response complete in ${elapsedMs}ms`);

    return this.success();
  }

  // Issue #46: 적응형 타임아웃 예측
  getAdaptiveTimeout(promptLength?: number): TimeoutPrediction {
    return adaptiveTimeoutManager.predictTimeout(this.provider, promptLength);
  }

  // Issue #46: 응답 시간 기록
  recordResponseTime(
    responseTimeMs: number,
    promptLength: number,
    responseLength: number,
    success: boolean
  ): void {
    adaptiveTimeoutManager.recordResponseTime(
      this.provider,
      responseTimeMs,
      promptLength,
      responseLength,
      success
    );
  }

  // Issue #46: 예상 완료 시간 조회
  estimateCompletion(elapsedMs: number, currentResponseLength: number) {
    return adaptiveTimeoutManager.estimateCompletionTime(
      this.provider,
      elapsedMs,
      currentResponseLength
    );
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
    // Issue #31: 기본 구현은 extractResponseFromSelectors 사용
    return this.extractResponseFromSelectors();
  }

  /**
   * Issue #31: 공통 응답 추출 로직
   *
   * 모든 어댑터가 공유하는 응답 추출 패턴을 통합
   * - 셀렉터 목록 순회
   * - 텍스트 추출 (innerText → textContent → recursive)
   * - 최소 길이 검증
   * - 재시도 로직
   *
   * @param options 추출 옵션 (셀렉터, 대기시간, 재시도 등)
   */
  protected async extractResponseFromSelectors(
    options: ResponseExtractionOptions = {}
  ): Promise<AdapterResult<string>> {
    const {
      selectors = this.getResponseSelectors(),
      minLength = 5,
      domSettleMs = 1500,
      maxRetries = 1,
      retryDelayMs = 1000,
      useRecursiveExtraction = false,
      useTreeWalker = false,
    } = options;

    console.log(`[${this.provider}] extractResponseFromSelectors called`);

    // DOM 안정화 대기
    await this.sleep(domSettleMs);

    const selectorsJson = selectors.map(s => `'${s}'`).join(', ');

    const script = `
      (() => {
        try {
          const debug = { tried: [], found: [], extractionMethod: '' };
          const selectors = [${selectorsJson}];
          const minLength = ${minLength};
          const useRecursive = ${useRecursiveExtraction};
          const useTreeWalker = ${useTreeWalker};

          // Issue #31: 재귀적 텍스트 추출 함수 (ChatGPT 스타일)
          function extractTextRecursively(element) {
            if (!element) return '';

            const style = window.getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden') {
              return '';
            }

            const tagName = element.tagName?.toLowerCase();
            if (['button', 'svg', 'script', 'style', 'nav', 'header'].includes(tagName)) {
              return '';
            }

            const testId = element.getAttribute?.('data-testid') || '';
            if (testId.includes('copy') || testId.includes('button')) {
              return '';
            }

            const className = element.className || '';
            if (typeof className === 'string' && (className.includes('copy') || className.includes('toolbar'))) {
              return '';
            }

            if (element.nodeType === Node.TEXT_NODE) {
              return element.textContent || '';
            }

            let text = '';
            for (const child of element.childNodes) {
              text += extractTextRecursively(child);
            }

            const blockElements = ['p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'br'];
            if (blockElements.includes(tagName) && text.trim()) {
              text += '\\n';
            }

            return text;
          }

          // 셀렉터 순회하며 텍스트 추출
          for (const sel of selectors) {
            debug.tried.push(sel);
            try {
              const messages = document.querySelectorAll(sel);
              if (messages.length > 0) {
                debug.found.push({ sel, count: messages.length });
                const lastMessage = messages[messages.length - 1];

                // 1차: innerText
                let content = lastMessage?.innerText?.trim() || '';
                if (content.length >= minLength) {
                  debug.extractionMethod = 'innerText';
                  return { success: true, content, selector: sel, count: messages.length, debug };
                }

                // 2차: textContent
                content = lastMessage?.textContent?.trim() || '';
                if (content.length >= minLength) {
                  debug.extractionMethod = 'textContent';
                  return { success: true, content, selector: sel, count: messages.length, debug };
                }

                // 3차: 재귀 추출 (옵션)
                if (useRecursive) {
                  content = extractTextRecursively(lastMessage).trim().replace(/\\n{3,}/g, '\\n\\n');
                  if (content.length >= minLength) {
                    debug.extractionMethod = 'recursive';
                    return { success: true, content, selector: sel, count: messages.length, debug };
                  }
                }
              }
            } catch (e) {
              // Continue to next selector
            }
          }

          // TreeWalker 폴백 (옵션)
          if (useTreeWalker) {
            const main = document.querySelector('main');
            if (main) {
              const walker = document.createTreeWalker(
                main,
                NodeFilter.SHOW_ELEMENT,
                {
                  acceptNode: function(node) {
                    const text = node.textContent?.trim() || '';
                    if (text.length > 50 && !node.closest('[contenteditable]') && !node.closest('textarea') && !node.closest('fieldset')) {
                      return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_SKIP;
                  }
                }
              );

              let count = 0;
              let lastValidNode = null;
              let node;
              while ((node = walker.nextNode()) && count < 20) {
                debug.mainChildren = debug.mainChildren || [];
                debug.mainChildren.push({
                  tag: node.tagName,
                  classes: node.className?.toString?.()?.substring?.(0, 50),
                  textLen: node.textContent?.length || 0,
                });
                lastValidNode = node;
                count++;
              }

              if (lastValidNode) {
                const content = lastValidNode.innerText || lastValidNode.textContent || '';
                if (content.trim().length >= minLength) {
                  debug.extractionMethod = 'treeWalker';
                  return { success: true, content: content.trim(), selector: 'treeWalker', count: 1, debug };
                }
              }
            }
          }

          // 디버그 정보 추가
          debug.markdownCount = document.querySelectorAll('.markdown').length;
          debug.proseCount = document.querySelectorAll('.prose').length;
          debug.articleCount = document.querySelectorAll('article').length;
          debug.mainCount = document.querySelectorAll('main').length;

          return { success: false, content: '', error: 'no messages found', debug };
        } catch (e) {
          return { success: false, content: '', error: e.message };
        }
      })()
    `;

    // 재시도 로직
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.executeScript<{
          success: boolean;
          content: string;
          error?: string;
          selector?: string;
          count?: number;
          debug?: Record<string, unknown>;
        }>(script, { success: false, content: '', error: 'script failed' });

        console.log(`[${this.provider}] extractResponse attempt ${attempt}/${maxRetries}:`);
        console.log(`  - success: ${result.success}`);
        console.log(`  - content length: ${result.content?.length || 0}`);
        console.log(`  - selector: ${result.selector || 'none'}`);
        if (result.error) {
          console.log(`  - error: ${result.error}`);
        }
        if (result.debug) {
          console.log(`  - debug:`, JSON.stringify(result.debug, null, 2));
        }

        if (result.success && result.content) {
          return this.success(result.content);
        }

        // 재시도 전 대기
        if (attempt < maxRetries) {
          console.log(`[${this.provider}] Retrying in ${retryDelayMs}ms...`);
          await this.sleep(retryDelayMs);
        }
      } catch (error) {
        console.error(`[${this.provider}] extractResponse exception:`, error);
      }
    }

    return this.error('EXTRACT_FAILED', `Failed to extract response after ${maxRetries} attempts`);
  }

  /**
   * Issue #31: 어댑터별 응답 셀렉터 목록 반환
   * 하위 클래스에서 오버라이드하여 커스텀 셀렉터 제공
   */
  protected getResponseSelectors(): string[] {
    return [
      this.selectorSets.responseContainer.primary,
      ...this.selectorSets.responseContainer.fallbacks,
    ];
  }

  /**
   * Issue #31: 응답 후처리 (하위 클래스에서 오버라이드)
   * ChatGPT의 "코드 복사" 텍스트 제거 등
   */
  protected postProcessResponse(content: string): string {
    return content;
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
    // Issue #43: 셀렉터 타입 전달
    const selector = await this.findElement(this.selectorSets.responseContainer, 'responseContainer');
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
    // Issue #43: 셀렉터 타입 전달
    const selector = await this.findElement(this.selectorSets.inputTextarea, 'inputTextarea');
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

// Issue #43: Re-export selector monitor
export { selectorMonitor } from './selector-monitor';
export type {
  SelectorStats,
  SelectorValidationResult,
  ProviderValidationResult,
  SelectorFailureEvent,
} from './selector-monitor';
