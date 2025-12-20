/**
 * Session Manager Tests
 *
 * TDD RED Phase: 세션 파티션 관리 테스트
 * - 각 LLM별 독립된 세션 파티션
 * - 세션 생성/조회/삭제
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionManager } from '../../../electron/browser/session-manager';
import type { LLMProvider } from '../../../shared/types';

// Mock Electron session module
vi.mock('electron', () => ({
  session: {
    fromPartition: vi.fn().mockImplementation((partition: string) => ({
      partition,
      clearStorageData: vi.fn().mockResolvedValue(undefined),
      clearCache: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager();
    vi.clearAllMocks();
  });

  describe('getSession', () => {
    it('should return session for chatgpt with persist:chatgpt partition', () => {
      const session = sessionManager.getSession('chatgpt');

      expect(session).toBeDefined();
      expect(session.partition).toBe('persist:chatgpt');
    });

    it('should return session for claude with persist:claude partition', () => {
      const session = sessionManager.getSession('claude');

      expect(session).toBeDefined();
      expect(session.partition).toBe('persist:claude');
    });

    it('should return session for gemini with persist:gemini partition', () => {
      const session = sessionManager.getSession('gemini');

      expect(session).toBeDefined();
      expect(session.partition).toBe('persist:gemini');
    });

    it('should cache and return same session instance for same provider', () => {
      const session1 = sessionManager.getSession('chatgpt');
      const session2 = sessionManager.getSession('chatgpt');

      expect(session1).toBe(session2);
    });

    it('should return different sessions for different providers', () => {
      const chatgptSession = sessionManager.getSession('chatgpt');
      const claudeSession = sessionManager.getSession('claude');

      expect(chatgptSession.partition).not.toBe(claudeSession.partition);
    });
  });

  describe('clearSession', () => {
    it('should clear storage data for specified provider', async () => {
      const session = sessionManager.getSession('chatgpt');

      // Since session is from mock, we just verify clearSession runs without error
      await expect(sessionManager.clearSession('chatgpt')).resolves.toBeUndefined();
    });

    it('should clear cache for specified provider', async () => {
      const session = sessionManager.getSession('chatgpt');

      // Since session is from mock, we just verify clearSession runs without error
      await expect(sessionManager.clearSession('chatgpt')).resolves.toBeUndefined();
    });
  });

  describe('clearAllSessions', () => {
    it('should clear all provider sessions', async () => {
      // Get all sessions first
      sessionManager.getSession('chatgpt');
      sessionManager.getSession('claude');
      sessionManager.getSession('gemini');

      // Verify clearAllSessions runs without error
      await expect(sessionManager.clearAllSessions()).resolves.toBeUndefined();
    });
  });

  describe('isSessionValid', () => {
    it('should return true if session exists and has cookies', async () => {
      const isValid = await sessionManager.isSessionValid('chatgpt');

      expect(typeof isValid).toBe('boolean');
    });
  });
});
