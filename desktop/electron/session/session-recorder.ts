/**
 * Session Recorder
 *
 * Issue #25: 토론 세션의 메시지를 메모리에 기록
 * P0: 메모리 기반 기록, JSON 내보내기
 */

import type { LLMProvider, DebateConfig, DebateElement } from '../../shared/types';
import type { SessionRecord, MessageRecord, SessionMetadata } from './types';

/**
 * 세션 레코더 - 토론 메시지를 메모리에 기록
 */
export class SessionRecorder {
  private sessions: Map<string, SessionRecord> = new Map();
  private currentSessionId: string | null = null;

  /**
   * 새 세션 시작
   */
  startSession(debateId: string, config: DebateConfig): string {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const session: SessionRecord = {
      id: sessionId,
      debateId,
      startedAt: new Date().toISOString(),
      status: 'active',
      config,
      messages: [],
      elements: [],
      metadata: {
        totalTokens: 0,
        totalIterations: 0,
        providersUsed: [...new Set(config.participants)],
      },
    };

    this.sessions.set(sessionId, session);
    this.currentSessionId = sessionId;

    console.log(`[SessionRecorder] Started session: ${sessionId}`);
    return sessionId;
  }

  /**
   * 메시지 기록
   */
  recordMessage(
    provider: LLMProvider,
    role: 'user' | 'assistant',
    content: string,
    iteration: number,
    elementId?: string
  ): MessageRecord | null {
    if (!this.currentSessionId) {
      console.warn('[SessionRecorder] No active session');
      return null;
    }

    const session = this.sessions.get(this.currentSessionId);
    if (!session) {
      console.warn(`[SessionRecorder] Session not found: ${this.currentSessionId}`);
      return null;
    }

    const message: MessageRecord = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      provider,
      role,
      content,
      tokenCount: this.estimateTokenCount(content),
      iteration,
      elementId,
    };

    session.messages.push(message);
    session.metadata.totalTokens += message.tokenCount || 0;
    session.metadata.totalIterations = Math.max(session.metadata.totalIterations, iteration);

    // Provider 목록 업데이트
    if (!session.metadata.providersUsed.includes(provider)) {
      session.metadata.providersUsed.push(provider);
    }

    console.log(
      `[SessionRecorder] Recorded message: ${role} from ${provider}, iteration ${iteration}, ${content.length} chars`
    );

    return message;
  }

  /**
   * 요소 상태 업데이트
   */
  updateElements(elements: DebateElement[]): void {
    if (!this.currentSessionId) return;

    const session = this.sessions.get(this.currentSessionId);
    if (!session) return;

    session.elements = elements;
  }

  /**
   * 세션 완료
   */
  completeSession(
    reason: SessionMetadata['completionReason'] = 'consensus'
  ): SessionRecord | null {
    if (!this.currentSessionId) {
      console.warn('[SessionRecorder] No active session to complete');
      return null;
    }

    const session = this.sessions.get(this.currentSessionId);
    if (!session) return null;

    session.endedAt = new Date().toISOString();
    session.status = 'completed';
    session.metadata.completionReason = reason;

    console.log(
      `[SessionRecorder] Completed session: ${this.currentSessionId}, reason: ${reason}`
    );

    const completedSession = session;
    this.currentSessionId = null;

    return completedSession;
  }

  /**
   * 세션 취소
   */
  cancelSession(): SessionRecord | null {
    if (!this.currentSessionId) return null;

    const session = this.sessions.get(this.currentSessionId);
    if (!session) return null;

    session.endedAt = new Date().toISOString();
    session.status = 'cancelled';
    session.metadata.completionReason = 'cancelled';

    console.log(`[SessionRecorder] Cancelled session: ${this.currentSessionId}`);

    const cancelledSession = session;
    this.currentSessionId = null;

    return cancelledSession;
  }

  /**
   * 세션 오류
   */
  errorSession(error: string): SessionRecord | null {
    if (!this.currentSessionId) return null;

    const session = this.sessions.get(this.currentSessionId);
    if (!session) return null;

    session.endedAt = new Date().toISOString();
    session.status = 'error';
    session.metadata.completionReason = 'error';

    console.log(`[SessionRecorder] Error in session: ${this.currentSessionId}, ${error}`);

    const errorSession = session;
    this.currentSessionId = null;

    return errorSession;
  }

  /**
   * 현재 세션 조회
   */
  getCurrentSession(): SessionRecord | null {
    if (!this.currentSessionId) return null;
    return this.sessions.get(this.currentSessionId) || null;
  }

  /**
   * 세션 ID로 조회
   */
  getSession(sessionId: string): SessionRecord | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * 모든 세션 목록
   */
  getAllSessions(): SessionRecord[] {
    return Array.from(this.sessions.values());
  }

  /**
   * 세션 삭제
   */
  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * 모든 세션 초기화
   */
  clear(): void {
    this.sessions.clear();
    this.currentSessionId = null;
  }

  /**
   * 토큰 수 추정 (간단한 방식: 4자당 1토큰)
   */
  private estimateTokenCount(content: string): number {
    return Math.ceil(content.length / 4);
  }
}

// 싱글톤 인스턴스
let instance: SessionRecorder | null = null;

export function getSessionRecorder(): SessionRecorder {
  if (!instance) {
    instance = new SessionRecorder();
  }
  return instance;
}
