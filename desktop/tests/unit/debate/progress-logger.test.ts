/**
 * ProgressLogger Tests
 *
 * TDD RED Phase: 로그 메시지 출력 테스트
 * - [시간] provider...상태...토큰수 형식
 * - 요소 점수 로그
 * - 순환 감지 로그
 */

import { describe, it, expect, beforeEach, vi, type MockInstance } from 'vitest';
import { ProgressLogger } from '../../../electron/debate/progress-logger';
import type { LLMStatus } from '../../../shared/types';

describe('ProgressLogger', () => {
  let logger: ProgressLogger;
  let consoleSpy: MockInstance;

  beforeEach(() => {
    logger = new ProgressLogger();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
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

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0][0];
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

      const output = consoleSpy.mock.calls[0][0];
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

      const output = consoleSpy.mock.calls[0][0];
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

      const output = consoleSpy.mock.calls[0][0];
      expect(output).toMatch(/12,345,678|12\.345\.678/); // Locale dependent
    });
  });

  describe('logElementScore', () => {
    it('should output element score without completion mark', () => {
      logger.logElementScore('보안', 85, false);

      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('요소[보안]');
      expect(output).toContain('점수: 85점');
      expect(output).not.toContain('✓');
    });

    it('should output element score with completion mark when complete', () => {
      logger.logElementScore('보안', 92, true);

      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('요소[보안]');
      expect(output).toContain('점수: 92점');
      expect(output).toContain('✓ 완성');
    });
  });

  describe('logCycleDetected', () => {
    it('should output cycle detection message', () => {
      logger.logCycleDetected('성능');

      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('요소[성능]');
      expect(output).toContain('순환 감지');
      expect(output).toContain('완성 처리');
    });
  });

  describe('logIteration', () => {
    it('should output iteration header', () => {
      logger.logIteration(5, 'claude');

      const output = consoleSpy.mock.calls[0][0];
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
});
