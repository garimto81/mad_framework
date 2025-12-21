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
        // Issue #11: 2025-12 실제 DOM 분석 기반
        primary: 'textarea[data-testid="chat-input-ssr"]',
        fallbacks: [
          '[data-testid="chat-input-ssr"]',
          'div.tiptap.ProseMirror[contenteditable="true"]',
          'div.ProseMirror[contenteditable="true"]',
          '[contenteditable="true"]',
          'fieldset textarea',
        ],
      },
      sendButton: {
        // Issue #11: 2025-12 실제 DOM - 한국어 우선
        primary: 'button[aria-label="메시지 보내기"]',
        fallbacks: [
          'button[aria-label="Send message"]',
          'button[aria-label="Send Message"]',
          'button[aria-label*="보내기"]',
          'button[aria-label*="Send"]',
          'fieldset button:not([aria-label*="Stop"]):not([aria-label*="Attach"]):not([aria-label*="첨부"])',
          '[data-testid="send-button"]',
        ],
      },
      stopButton: {
        // Issue #11: 2025-12 - Stop 버튼은 스트리밍 중에만 나타남
        // Claude는 더 이상 Stop 버튼을 사용하지 않을 수 있음
        primary: 'button[aria-label="응답 중지"]',
        fallbacks: [
          'button[aria-label*="Stop"]',
          'button[aria-label*="stop"]',
          'button[aria-label*="중지"]',
          'button[aria-label*="취소"]',
          '[data-testid="stop-button"]',
        ],
      },
      responseContainer: {
        // Issue #11: 2025-12 실제 DOM 분석
        primary: '[data-testid="conversation-turn-assistant"]',
        fallbacks: [
          '[data-testid*="assistant"]',
          '[data-testid*="message"]',
          'div[class*="font-claude-message"]',
          'article[class*="prose"]',
          '.prose:not([contenteditable])',
          'main article',
          'div[class*="whitespace-pre-wrap"]',
        ],
      },
      typingIndicator: {
        // Issue #11: 2025-12 - data-is-streaming 더 이상 사용되지 않음
        // 대안: Send 버튼 disabled 상태, 콘텐츠 변화 감지
        primary: 'button[aria-label="메시지 보내기"][disabled]',
        fallbacks: [
          'button[aria-label="Send message"][disabled]',
          'button[aria-label*="Send"][disabled]',
          '[data-is-streaming="true"]',
          '.animate-pulse',
          '[class*="streaming"]',
        ],
      },
      loginCheck: {
        // Issue #11: 2025-12 실제 DOM - user-menu-button
        primary: '[data-testid="user-menu-button"]',
        fallbacks: [
          '[data-testid="user-menu"]',
          'button[aria-label*="account"]',
          'button[aria-label*="Account"]',
          '[data-testid="menu-trigger"]',
          '[data-testid="chat-input-ssr"]',
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
