/**
 * Adapter Type Definitions
 *
 * 어댑터에서 사용하는 타입 정의
 */

import type { LLMProvider } from '../../../shared/types';

export interface WebContents {
  executeJavaScript: (script: string) => Promise<any>;
  loadURL: (url: string) => void;
  getURL: () => string;
  on: (event: string, callback: (...args: any[]) => void) => void;
}

// Issue #18: SelectorSet for fallback support
export interface SelectorSet {
  primary: string;
  fallbacks: string[];
}

export interface ProviderSelectors {
  inputTextarea: SelectorSet;
  sendButton: SelectorSet;
  responseContainer: SelectorSet;
  typingIndicator: SelectorSet;
  loginCheck: SelectorSet;
}

// Legacy interface for backward compatibility
export interface AdapterSelectors {
  inputTextarea: string;
  sendButton: string;
  responseContainer: string;
  typingIndicator: string;
  loginCheck: string;
}

export type { LLMProvider };
