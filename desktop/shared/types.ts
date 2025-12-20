/**
 * MAD Desktop - Shared Types
 */

// LLM Provider Types
export type LLMProvider = 'chatgpt' | 'claude' | 'gemini';

// Adapter Result Types (Issue #17)
export interface AdapterResult<T = void> {
  success: boolean;
  data?: T;
  error?: AdapterError;
}

export interface AdapterError {
  code: AdapterErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type AdapterErrorCode =
  | 'SELECTOR_NOT_FOUND'
  | 'INPUT_FAILED'
  | 'SEND_FAILED'
  | 'RESPONSE_TIMEOUT'
  | 'EXTRACT_FAILED'
  | 'NOT_LOGGED_IN'
  | 'VERIFICATION_FAILED'
  | 'UNKNOWN';

// Login Status
export interface LLMLoginStatus {
  provider: LLMProvider;
  isLoggedIn: boolean;
  lastChecked: string;
  username?: string;
}

// LLM Status (for polling)
export interface LLMStatus {
  provider: LLMProvider;
  isWriting: boolean;
  tokenCount: number;
  timestamp: string;
}

// Debate Element
export interface DebateElement {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cycle_detected';
  currentScore: number;
  scoreHistory: number[];
  versionHistory: ElementVersion[];
  completedAt?: string;
  completionReason?: 'threshold' | 'cycle';
}

// Element Version (for cycle detection)
export interface ElementVersion {
  iteration: number;
  content: string;
  score: number;
  timestamp: string;
  provider: LLMProvider;
}

// Debate Config
export interface DebateConfig {
  topic: string;
  context?: string;
  preset: string;
  participants: LLMProvider[];
  judgeProvider: LLMProvider;
  completionThreshold: number;  // default 90
}

// Debate Session
export interface DebateSession {
  id: string;
  config: DebateConfig;
  status: 'pending' | 'running' | 'completed' | 'cancelled' | 'error';
  currentIteration: number;
  elements: DebateElement[];
  createdAt: string;
  completedAt?: string;
}

// Debate Progress
export interface DebateProgress {
  sessionId: string;
  iteration: number;
  currentProvider: LLMProvider;
  phase: 'input' | 'waiting' | 'extracting' | 'scoring' | 'cycle_check';
}

// Element Score Update
export interface ElementScoreUpdate {
  elementId: string;
  elementName: string;
  score: number;
  critique: string;
  iteration: number;
}

// Debate Response
export interface DebateResponse {
  sessionId: string;
  iteration: number;
  provider: LLMProvider;
  content: string;
  elementScores: ElementScoreUpdate[];
  timestamp: string;
}

// Debate Result
export interface DebateResult {
  sessionId: string;
  finalElements: DebateElement[];
  totalIterations: number;
  completedAt: string;
}
