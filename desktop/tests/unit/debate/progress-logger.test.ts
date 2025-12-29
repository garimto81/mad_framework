/**
 * ProgressLogger Tests
 *
 * TDD RED Phase: 로그 메시지 출력 테스트
 * - [시간] provider...상태...토큰수 형식
 * - 요소 점수 로그
 * - 순환 감지 로그
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { LLMStatus } from '../../../shared/types';

// Mock electron-log before importing ProgressLogger (vi.hoisted for correct hoisting)
const { mockLogInfo, mockLogError } = vi.hoisted(() => ({
  mockLogInfo: vi.fn(),
  mockLogError: vi.fn(),
}));

vi.mock('../../../electron/utils/logger', () => ({
  createScopedLogger: () => ({
    info: mockLogInfo,
    warn: vi.fn(),
    error: mockLogError,
    debug: vi.fn(),
  }),
}));

import { ProgressLogger } from '../../../electron/debate/progress-logger';

describe('ProgressLogger', () => {
  let logger: ProgressLogger;

  beforeEach(() => {
    logger = new ProgressLogger();
    vi.clearAllMocks();
  });

  describe('log', () => {
    it('should output in format: [시간] provider...상태...토큰수', () => {
      const status: LLMStatus = {
        provider: 'chatgpt',
        isWriting: true,
        tokenCount: 1234,
        timestamp: '2025-12-18T12:34:56.000Z',
      };

      logger.log(status);

      expect(mockLogInfo).toHaveBeenCalled();
      const output = mockLogInfo.mock.calls[0][0];
      // Time format can include locale-specific markers like "오후"
      expect(output).toMatch(/\[.*\d{2}:\d{2}:\d{2}.*\]/);
      expect(output).toContain('chatgpt');
      expect(output).toContain('진행중');
      expect(output).toContain('1,234');
    });

    it('should show "완료" when not writing', () => {
      const status: LLMStatus = {
        provider: 'claude',
        isWriting: false,
        tokenCount: 3789,
        timestamp: '2025-12-18T12:34:56.000Z',
      };

      logger.log(status);

      const output = mockLogInfo.mock.calls[0][0];
      expect(output).toContain('완료');
    });

    it('should show "진행중" when writing', () => {
      const status: LLMStatus = {
        provider: 'gemini',
        isWriting: true,
        tokenCount: 512,
        timestamp: '2025-12-18T12:34:56.000Z',
      };

      logger.log(status);

      const output = mockLogInfo.mock.calls[0][0];
      expect(output).toContain('진행중');
    });

    it('should format token count with locale string', () => {
      const status: LLMStatus = {
        provider: 'chatgpt',
        isWriting: false,
        tokenCount: 12345678,
        timestamp: '2025-12-18T12:34:56.000Z',
      };

      logger.log(status);

      const output = mockLogInfo.mock.calls[0][0];
      expect(output).toMatch(/12,345,678|12\.345\.678/); // Locale dependent
    });
  });

  describe('logElementScore', () => {
    it('should output element score without completion mark', () => {
      logger.logElementScore('보안', 85, false);

      const output = mockLogInfo.mock.calls[0][0];
      expect(output).toContain('요소[보안]');
      expect(output).toContain('점수: 85점');
      expect(output).not.toContain('✓');
    });

    it('should output element score with completion mark when complete', () => {
      logger.logElementScore('보안', 92, true);

      const output = mockLogInfo.mock.calls[0][0];
      expect(output).toContain('요소[보안]');
      expect(output).toContain('점수: 92점');
      expect(output).toContain('✓ 완성');
    });
  });

  describe('logCycleDetected', () => {
    it('should output cycle detection message', () => {
      logger.logCycleDetected('성능');

      const output = mockLogInfo.mock.calls[0][0];
      expect(output).toContain('요소[성능]');
      expect(output).toContain('순환 감지');
      expect(output).toContain('완성 처리');
    });
  });

  describe('logIteration', () => {
    it('should output iteration header', () => {
      logger.logIteration(5, 'claude');

      const output = mockLogInfo.mock.calls[0][0];
      expect(output).toContain('반복 #5');
      expect(output).toContain('claude');
    });
  });

  describe('formatTime', () => {
    it('should format ISO string to HH:MM:SS', () => {
      const formatted = logger['formatTime']('2025-12-18T14:30:45.000Z');

      // Time zone dependent, but should have time format
      expect(formatted).toMatch(/\d{2}:\d{2}:\d{2}/);
    });
  });

  // Issue #13: New tests for in-memory storage
  describe('in-memory storage', () => {
    it('should store logs in memory', () => {
      const status: LLMStatus = {
        provider: 'chatgpt',
        isWriting: true,
        tokenCount: 100,
        timestamp: '2025-12-21T10:00:00.000Z',
      };

      logger.log(status);

      const logs = logger.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].type).toBe('status');
      expect(logs[0].provider).toBe('chatgpt');
    });

    it('should return logs in reverse chronological order', () => {
      const status1: LLMStatus = {
        provider: 'chatgpt',
        isWriting: true,
        tokenCount: 100,
        timestamp: '2025-12-21T10:00:00.000Z',
      };
      const status2: LLMStatus = {
        provider: 'claude',
        isWriting: false,
        tokenCount: 200,
        timestamp: '2025-12-21T10:00:01.000Z',
      };

      logger.log(status1);
      logger.log(status2);

      const logs = logger.getLogs();
      expect(logs[0].provider).toBe('claude'); // Most recent first
      expect(logs[1].provider).toBe('chatgpt');
    });

    it('should limit logs returned by limit parameter', () => {
      for (let i = 0; i < 10; i++) {
        logger.log({
          provider: 'chatgpt',
          isWriting: true,
          tokenCount: i * 100,
          timestamp: new Date().toISOString(),
        });
      }

      const logs = logger.getLogs(5);
      expect(logs.length).toBe(5);
    });

    it('should enforce maxLogs limit (FIFO)', () => {
      const maxLogs = 1000;

      // Add more than maxLogs entries
      for (let i = 0; i < maxLogs + 100; i++) {
        logger.log({
          provider: 'chatgpt',
          isWriting: true,
          tokenCount: i,
          timestamp: new Date().toISOString(),
        });
      }

      const logs = logger.getLogs();
      expect(logs.length).toBeLessThanOrEqual(maxLogs);
    });

    it('should clear all logs', () => {
      logger.log({
        provider: 'chatgpt',
        isWriting: true,
        tokenCount: 100,
        timestamp: new Date().toISOString(),
      });

      logger.clear();

      const logs = logger.getLogs();
      expect(logs.length).toBe(0);
    });
  });

  describe('logEntry for different types', () => {
    it('should store score log with correct type', () => {
      logger.logElementScore('보안', 85, false);

      const logs = logger.getLogs();
      expect(logs[0].type).toBe('score');
      expect(logs[0].data).toEqual(
        expect.objectContaining({
          elementName: '보안',
          score: 85,
          isComplete: false,
        })
      );
    });

    it('should store cycle log with correct type', () => {
      logger.logCycleDetected('성능');

      const logs = logger.getLogs();
      expect(logs[0].type).toBe('cycle');
      expect(logs[0].data).toEqual(
        expect.objectContaining({
          elementName: '성능',
        })
      );
    });

    it('should store iteration log with correct type', () => {
      logger.logIteration(5, 'claude');

      const logs = logger.getLogs();
      expect(logs[0].type).toBe('iteration');
      expect(logs[0].provider).toBe('claude');
      expect(logs[0].data).toEqual(
        expect.objectContaining({
          iteration: 5,
        })
      );
    });

    it('should store debate complete log', () => {
      logger.logDebateComplete(10);

      const logs = logger.getLogs();
      expect(logs[0].type).toBe('complete');
      expect(logs[0].data).toEqual(
        expect.objectContaining({
          totalIterations: 10,
        })
      );
    });
  });

  describe('getLogsByType', () => {
    it('should filter logs by type', () => {
      logger.log({
        provider: 'chatgpt',
        isWriting: true,
        tokenCount: 100,
        timestamp: new Date().toISOString(),
      });
      logger.logElementScore('보안', 85, false);
      logger.logCycleDetected('성능');

      const scoreLogs = logger.getLogsByType('score');
      expect(scoreLogs.length).toBe(1);
      expect(scoreLogs[0].type).toBe('score');

      const cycleLogs = logger.getLogsByType('cycle');
      expect(cycleLogs.length).toBe(1);
      expect(cycleLogs[0].type).toBe('cycle');
    });
  });
});
