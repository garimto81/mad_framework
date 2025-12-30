/**
 * SessionRepository 단위 테스트
 *
 * Issue #25 P2: SQLite 기반 영구 저장소
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionRepository } from '../../../electron/session/session-repository';
import type { SessionRecord, MessageRecord } from '../../../electron/session/types';
import type { DebateConfig, DebateElement } from '../../../shared/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('SessionRepository', () => {
  let repository: SessionRepository;
  let testDbPath: string;

  const mockConfig: DebateConfig = {
    topic: 'Test Topic',
    context: 'Test Context',
    preset: 'code_review',
    participants: ['chatgpt', 'claude'],
    judgeProvider: 'gemini',
  };

  const mockSession: SessionRecord = {
    id: 'session-test-123',
    debateId: 'debate-test-456',
    startedAt: '2025-12-30T10:00:00.000Z',
    status: 'active',
    config: mockConfig,
    messages: [],
    elements: [],
    metadata: {
      totalTokens: 0,
      totalIterations: 0,
      providersUsed: ['chatgpt', 'claude'],
    },
  };

  const mockMessage: MessageRecord = {
    id: 'msg-test-789',
    timestamp: '2025-12-30T10:01:00.000Z',
    provider: 'chatgpt',
    role: 'user',
    content: 'Test message content',
    tokenCount: 5,
    iteration: 1,
  };

  beforeEach(() => {
    // 임시 디렉토리에 테스트 DB 생성
    const tempDir = os.tmpdir();
    testDbPath = path.join(tempDir, `test-sessions-${Date.now()}.db`);
    repository = new SessionRepository(testDbPath);
  });

  afterEach(() => {
    // DB 연결 닫기 및 파일 삭제
    repository.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('saveSession', () => {
    it('새 세션을 저장해야 함', () => {
      repository.saveSession(mockSession);

      const saved = repository.getSession(mockSession.id);
      expect(saved).not.toBeNull();
      expect(saved?.id).toBe(mockSession.id);
      expect(saved?.debateId).toBe(mockSession.debateId);
      expect(saved?.status).toBe('active');
    });

    it('세션 업데이트가 가능해야 함', () => {
      repository.saveSession(mockSession);

      const updated: SessionRecord = {
        ...mockSession,
        status: 'completed',
        endedAt: '2025-12-30T10:15:00.000Z',
        metadata: {
          ...mockSession.metadata,
          totalTokens: 100,
          completionReason: 'consensus',
        },
      };
      repository.saveSession(updated);

      const saved = repository.getSession(mockSession.id);
      expect(saved?.status).toBe('completed');
      expect(saved?.endedAt).toBe('2025-12-30T10:15:00.000Z');
      expect(saved?.metadata.totalTokens).toBe(100);
      expect(saved?.metadata.completionReason).toBe('consensus');
    });

    it('메시지가 포함된 세션을 저장해야 함', () => {
      const sessionWithMessages: SessionRecord = {
        ...mockSession,
        messages: [mockMessage],
      };
      repository.saveSession(sessionWithMessages);

      const saved = repository.getSession(mockSession.id);
      expect(saved?.messages).toHaveLength(1);
      expect(saved?.messages[0].id).toBe(mockMessage.id);
      expect(saved?.messages[0].content).toBe(mockMessage.content);
    });
  });

  describe('getSession', () => {
    it('존재하지 않는 세션은 null 반환', () => {
      const session = repository.getSession('non-existent-id');
      expect(session).toBeNull();
    });

    it('메시지와 요소 포함하여 조회', () => {
      const element: DebateElement = {
        id: 'elem-1',
        name: 'Debater A',
        provider: 'chatgpt',
        role: 'debater',
        position: { row: 0, col: 0 },
        status: 'idle',
      };
      const sessionWithData: SessionRecord = {
        ...mockSession,
        messages: [mockMessage],
        elements: [element],
      };
      repository.saveSession(sessionWithData);

      const saved = repository.getSession(mockSession.id);
      expect(saved?.messages).toHaveLength(1);
      expect(saved?.elements).toHaveLength(1);
      expect(saved?.elements[0].id).toBe('elem-1');
    });
  });

  describe('getAllSessions', () => {
    it('모든 세션 목록 조회', () => {
      const session1 = { ...mockSession, id: 'session-1' };
      const session2 = { ...mockSession, id: 'session-2' };
      repository.saveSession(session1);
      repository.saveSession(session2);

      const sessions = repository.getAllSessions();
      expect(sessions).toHaveLength(2);
    });

    it('최신순으로 정렬', () => {
      const session1 = {
        ...mockSession,
        id: 'session-1',
        startedAt: '2025-12-30T09:00:00.000Z',
      };
      const session2 = {
        ...mockSession,
        id: 'session-2',
        startedAt: '2025-12-30T11:00:00.000Z',
      };
      repository.saveSession(session1);
      repository.saveSession(session2);

      const sessions = repository.getAllSessions();
      expect(sessions[0].id).toBe('session-2');
      expect(sessions[1].id).toBe('session-1');
    });

    it('메시지 포함하여 조회 옵션', () => {
      const sessionWithMessages: SessionRecord = {
        ...mockSession,
        messages: [mockMessage],
      };
      repository.saveSession(sessionWithMessages);

      const sessionsWithMessages = repository.getAllSessions({ includeMessages: true });
      expect(sessionsWithMessages[0].messages).toHaveLength(1);

      const sessionsWithoutMessages = repository.getAllSessions({ includeMessages: false });
      expect(sessionsWithoutMessages[0].messages).toHaveLength(0);
    });
  });

  describe('deleteSession', () => {
    it('세션 삭제 성공', () => {
      repository.saveSession(mockSession);
      const deleted = repository.deleteSession(mockSession.id);

      expect(deleted).toBe(true);
      expect(repository.getSession(mockSession.id)).toBeNull();
    });

    it('존재하지 않는 세션 삭제 시 false 반환', () => {
      const deleted = repository.deleteSession('non-existent');
      expect(deleted).toBe(false);
    });

    it('세션 삭제 시 관련 메시지도 삭제', () => {
      const sessionWithMessages: SessionRecord = {
        ...mockSession,
        messages: [mockMessage],
      };
      repository.saveSession(sessionWithMessages);
      repository.deleteSession(mockSession.id);

      // 메시지도 삭제되었는지 확인 (다시 조회 시 null)
      expect(repository.getSession(mockSession.id)).toBeNull();
    });
  });

  describe('searchSessions', () => {
    beforeEach(() => {
      const session1: SessionRecord = {
        ...mockSession,
        id: 'session-1',
        config: { ...mockConfig, topic: 'React performance optimization' },
      };
      const session2: SessionRecord = {
        ...mockSession,
        id: 'session-2',
        config: { ...mockConfig, topic: 'Node.js best practices' },
      };
      const session3: SessionRecord = {
        ...mockSession,
        id: 'session-3',
        config: { ...mockConfig, topic: 'Python machine learning' },
        messages: [{ ...mockMessage, content: 'React is great for UI' }],
      };
      repository.saveSession(session1);
      repository.saveSession(session2);
      repository.saveSession(session3);
    });

    it('토픽으로 검색', () => {
      const results = repository.searchSessions({ query: 'React' });
      expect(results).toHaveLength(2); // topic에 React + message에 React
    });

    it('프리셋으로 필터', () => {
      const results = repository.searchSessions({ preset: 'code_review' });
      expect(results).toHaveLength(3);
    });

    it('상태로 필터', () => {
      // session-1을 완료로 변경
      const completedSession: SessionRecord = {
        ...mockSession,
        id: 'session-1',
        status: 'completed',
        config: { ...mockConfig, topic: 'React performance optimization' },
      };
      repository.saveSession(completedSession);

      const results = repository.searchSessions({ status: 'completed' });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('session-1');
    });

    it('날짜 범위로 필터', () => {
      const results = repository.searchSessions({
        startDate: '2025-12-30T00:00:00.000Z',
        endDate: '2025-12-31T00:00:00.000Z',
      });
      expect(results).toHaveLength(3);
    });

    it('provider로 필터', () => {
      const results = repository.searchSessions({ provider: 'chatgpt' });
      expect(results).toHaveLength(3);
    });
  });

  describe('getSessionCount', () => {
    it('전체 세션 수 조회', () => {
      repository.saveSession({ ...mockSession, id: 'session-1' });
      repository.saveSession({ ...mockSession, id: 'session-2' });
      repository.saveSession({ ...mockSession, id: 'session-3' });

      expect(repository.getSessionCount()).toBe(3);
    });

    it('상태별 세션 수 조회', () => {
      repository.saveSession({ ...mockSession, id: 'session-1', status: 'completed' });
      repository.saveSession({ ...mockSession, id: 'session-2', status: 'completed' });
      repository.saveSession({ ...mockSession, id: 'session-3', status: 'active' });

      expect(repository.getSessionCount('completed')).toBe(2);
      expect(repository.getSessionCount('active')).toBe(1);
    });
  });

  describe('clear', () => {
    it('모든 세션 삭제', () => {
      repository.saveSession({ ...mockSession, id: 'session-1' });
      repository.saveSession({ ...mockSession, id: 'session-2' });

      repository.clear();

      expect(repository.getAllSessions()).toHaveLength(0);
      expect(repository.getSessionCount()).toBe(0);
    });
  });

  describe('addMessage', () => {
    it('기존 세션에 메시지 추가', () => {
      repository.saveSession(mockSession);
      repository.addMessage(mockSession.id, mockMessage);

      const saved = repository.getSession(mockSession.id);
      expect(saved?.messages).toHaveLength(1);
      expect(saved?.messages[0].id).toBe(mockMessage.id);
    });

    it('존재하지 않는 세션에 메시지 추가 시 false 반환', () => {
      const result = repository.addMessage('non-existent', mockMessage);
      expect(result).toBe(false);
    });

    it('여러 메시지 순서대로 추가', () => {
      repository.saveSession(mockSession);

      const msg1 = { ...mockMessage, id: 'msg-1', timestamp: '2025-12-30T10:01:00.000Z' };
      const msg2 = { ...mockMessage, id: 'msg-2', timestamp: '2025-12-30T10:02:00.000Z' };
      const msg3 = { ...mockMessage, id: 'msg-3', timestamp: '2025-12-30T10:03:00.000Z' };

      repository.addMessage(mockSession.id, msg1);
      repository.addMessage(mockSession.id, msg2);
      repository.addMessage(mockSession.id, msg3);

      const saved = repository.getSession(mockSession.id);
      expect(saved?.messages).toHaveLength(3);
      expect(saved?.messages[0].id).toBe('msg-1');
      expect(saved?.messages[2].id).toBe('msg-3');
    });
  });
});
