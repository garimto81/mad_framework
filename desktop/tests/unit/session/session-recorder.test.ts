/**
 * Session Recorder Tests
 *
 * Issue #25: Session Recording & Export
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SessionRecorder } from '../../../electron/session/session-recorder';
import type { DebateConfig } from '../../../shared/types';

describe('SessionRecorder', () => {
  let recorder: SessionRecorder;
  let mockConfig: DebateConfig;

  beforeEach(() => {
    recorder = new SessionRecorder();
    mockConfig = {
      topic: 'Test Topic',
      context: 'Test Context',
      preset: 'code_review',
      participants: ['chatgpt', 'claude'],
      judgeProvider: 'gemini',
      completionThreshold: 90,
    };
  });

  describe('startSession', () => {
    it('should create a new session with unique ID', () => {
      const sessionId = recorder.startSession('debate-123', mockConfig);

      expect(sessionId).toBeDefined();
      expect(sessionId).toMatch(/^session-\d+-[a-z0-9]+$/);
    });

    it('should store session with correct initial state', () => {
      const sessionId = recorder.startSession('debate-123', mockConfig);
      const session = recorder.getSession(sessionId);

      expect(session).not.toBeNull();
      expect(session?.debateId).toBe('debate-123');
      expect(session?.status).toBe('active');
      expect(session?.config).toEqual(mockConfig);
      expect(session?.messages).toHaveLength(0);
      expect(session?.metadata.totalTokens).toBe(0);
      expect(session?.metadata.totalIterations).toBe(0);
    });

    it('should set current session', () => {
      recorder.startSession('debate-123', mockConfig);
      const currentSession = recorder.getCurrentSession();

      expect(currentSession).not.toBeNull();
      expect(currentSession?.debateId).toBe('debate-123');
    });
  });

  describe('recordMessage', () => {
    it('should record user message', () => {
      recorder.startSession('debate-123', mockConfig);

      const message = recorder.recordMessage('chatgpt', 'user', 'Test prompt', 1);

      expect(message).not.toBeNull();
      expect(message?.provider).toBe('chatgpt');
      expect(message?.role).toBe('user');
      expect(message?.content).toBe('Test prompt');
      expect(message?.iteration).toBe(1);
    });

    it('should record assistant message', () => {
      recorder.startSession('debate-123', mockConfig);

      const message = recorder.recordMessage('claude', 'assistant', 'Test response', 1);

      expect(message).not.toBeNull();
      expect(message?.role).toBe('assistant');
    });

    it('should estimate token count', () => {
      recorder.startSession('debate-123', mockConfig);

      // 100 chars = ~25 tokens (4 chars per token)
      const content = 'a'.repeat(100);
      const message = recorder.recordMessage('chatgpt', 'user', content, 1);

      expect(message?.tokenCount).toBe(25);
    });

    it('should update metadata after recording', () => {
      recorder.startSession('debate-123', mockConfig);

      recorder.recordMessage('chatgpt', 'user', 'Test', 1);
      recorder.recordMessage('chatgpt', 'assistant', 'Response', 1);
      recorder.recordMessage('claude', 'user', 'Test 2', 2);

      const session = recorder.getCurrentSession();

      expect(session?.messages).toHaveLength(3);
      expect(session?.metadata.totalIterations).toBe(2);
      expect(session?.metadata.totalTokens).toBeGreaterThan(0);
    });

    it('should return null if no active session', () => {
      const message = recorder.recordMessage('chatgpt', 'user', 'Test', 1);

      expect(message).toBeNull();
    });
  });

  describe('completeSession', () => {
    it('should mark session as completed', () => {
      const sessionId = recorder.startSession('debate-123', mockConfig);
      recorder.recordMessage('chatgpt', 'user', 'Test', 1);

      const completedSession = recorder.completeSession('consensus');

      expect(completedSession).not.toBeNull();
      expect(completedSession?.status).toBe('completed');
      expect(completedSession?.metadata.completionReason).toBe('consensus');
      expect(completedSession?.endedAt).toBeDefined();
    });

    it('should clear current session after completion', () => {
      recorder.startSession('debate-123', mockConfig);
      recorder.completeSession('consensus');

      expect(recorder.getCurrentSession()).toBeNull();
    });

    it('should return null if no active session', () => {
      const result = recorder.completeSession('consensus');

      expect(result).toBeNull();
    });
  });

  describe('cancelSession', () => {
    it('should mark session as cancelled', () => {
      recorder.startSession('debate-123', mockConfig);

      const cancelledSession = recorder.cancelSession();

      expect(cancelledSession?.status).toBe('cancelled');
      expect(cancelledSession?.metadata.completionReason).toBe('cancelled');
    });
  });

  describe('errorSession', () => {
    it('should mark session as error', () => {
      recorder.startSession('debate-123', mockConfig);

      const errorSession = recorder.errorSession('Test error');

      expect(errorSession?.status).toBe('error');
      expect(errorSession?.metadata.completionReason).toBe('error');
    });
  });

  describe('getAllSessions', () => {
    it('should return all sessions', () => {
      recorder.startSession('debate-1', mockConfig);
      recorder.completeSession('consensus');

      recorder.startSession('debate-2', mockConfig);
      recorder.completeSession('consensus');

      const sessions = recorder.getAllSessions();

      expect(sessions).toHaveLength(2);
    });
  });

  describe('deleteSession', () => {
    it('should delete session by ID', () => {
      const sessionId = recorder.startSession('debate-123', mockConfig);
      recorder.completeSession('consensus');

      const deleted = recorder.deleteSession(sessionId);

      expect(deleted).toBe(true);
      expect(recorder.getSession(sessionId)).toBeNull();
    });

    it('should return false for non-existent session', () => {
      const deleted = recorder.deleteSession('non-existent');

      expect(deleted).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all sessions', () => {
      recorder.startSession('debate-1', mockConfig);
      recorder.completeSession('consensus');
      recorder.startSession('debate-2', mockConfig);

      recorder.clear();

      expect(recorder.getAllSessions()).toHaveLength(0);
      expect(recorder.getCurrentSession()).toBeNull();
    });
  });
});
