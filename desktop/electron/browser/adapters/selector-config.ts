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
      stopButton: {
        primary: 'button[aria-label*="Stop"]',
        fallbacks: [
          '[data-testid="stop-button"]',
          'button[aria-label="Stop generating"]',
          'button.stop-button',
        ],
      },
      responseContainer: {
        primary: '[data-message-author-role="assistant"]',
        fallbacks: [
          // 2025 ChatGPT UI selectors
          '[data-testid^="conversation-turn-"] [class*="markdown"]',
          'article[data-scroll-anchor="true"] .markdown',
          'div[data-message-model-slug] .markdown',
          '.group\\/conversation-turn .markdown',
          // Legacy selectors
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
          '[aria-label="Send Message"]',
          'button[aria-label*="Send"]',
          '[data-testid="send-button"]',
          'button[type="submit"]',
          'fieldset button:not([aria-label*="Stop"])',
        ],
      },
      stopButton: {
        primary: 'button[aria-label*="Stop"]',
        fallbacks: [
          '[aria-label="Stop Response"]',
          '[aria-label="Stop response"]',
          '[aria-label="Stop generating"]',
          '[data-testid="stop-button"]',
          'button[aria-label*="stop"]',
        ],
      },
      responseContainer: {
        primary: '[data-is-streaming="false"]',
        fallbacks: [
          '[data-testid="assistant-message"]',
          '.font-claude-message',
          '.prose:not([contenteditable])',
          '[role="article"]',
        ],
      },
      typingIndicator: {
        primary: '[data-is-streaming="true"]',
        fallbacks: [
          '[data-testid="streaming-response"]',
          '.animate-pulse',
          '.animate-spin',
          '[data-testid*="loading"]',
          '.cursor-blink',
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
      stopButton: {
        primary: 'button[aria-label*="Stop"]',
        fallbacks: [
          '.stop-button',
          'button[aria-label="Stop generating"]',
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
