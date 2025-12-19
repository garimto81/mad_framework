/**
 * Selector Configuration
 *
 * Provider별 셀렉터 설정
 * Issue #18: 셀렉터 Fallback 시스템
 */

import type { LLMProvider } from '../../../shared/types';
import type { AdapterSelectors, ProviderSelectors } from './types';

export function getBaseUrl(provider: LLMProvider): string {
  const urls: Record<LLMProvider, string> = {
    chatgpt: 'https://chat.openai.com',
    claude: 'https://claude.ai',
    gemini: 'https://gemini.google.com',
  };
  return urls[provider];
}

export function getDefaultSelectors(provider: LLMProvider): AdapterSelectors {
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
export function getSelectorSets(provider: LLMProvider): ProviderSelectors {
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
