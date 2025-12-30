/**
 * Session Recording Types
 *
 * Issue #25: Session Recording & Export
 */

import type { LLMProvider, DebateConfig, DebateElement } from '../../shared/types';

/**
 * 개별 메시지 기록
 */
export interface MessageRecord {
  id: string;
  timestamp: string;
  provider: LLMProvider;
  role: 'user' | 'assistant';
  content: string;
  tokenCount?: number;
  iteration: number;
  elementId?: string;
}

/**
 * 세션 메타데이터
 */
export interface SessionMetadata {
  totalTokens: number;
  totalIterations: number;
  providersUsed: LLMProvider[];
  completionReason?: 'consensus' | 'cycle' | 'maxIterations' | 'cancelled' | 'error';
}

/**
 * 세션 기록
 */
export interface SessionRecord {
  id: string;
  debateId: string;
  startedAt: string;
  endedAt?: string;
  status: 'active' | 'completed' | 'cancelled' | 'error';
  config: DebateConfig;
  messages: MessageRecord[];
  elements: DebateElement[];
  metadata: SessionMetadata;
}

/**
 * 내보내기 옵션
 */
export interface ExportOptions {
  /** 출력 파일 경로 (없으면 문자열 반환) */
  outputPath?: string;
  /** 날짜 형식 (default: 'ISO') */
  dateFormat?: 'ISO' | 'locale' | 'unix';
  /** 들여쓰기 크기 (JSON용, default: 2) */
  indent?: number;
  /** 메타데이터 포함 여부 (default: true) */
  includeMetadata?: boolean;
}

/**
 * JSON 내보내기 결과
 */
export interface JsonExportResult {
  session: {
    id: string;
    debateId: string;
    startedAt: string;
    endedAt?: string;
    status: string;
  };
  config: DebateConfig;
  messages: MessageRecord[];
  elements: DebateElement[];
  metadata: SessionMetadata;
}

/**
 * 세션 이벤트 타입
 */
export type SessionEventType =
  | 'session:started'
  | 'session:message-recorded'
  | 'session:completed'
  | 'session:error';
