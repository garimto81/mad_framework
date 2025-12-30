/**
 * JSON Exporter Tests
 *
 * Issue #25: Session Recording & Export
 */

import { describe, it, expect } from 'vitest';
import { exportToJson, getDefaultJsonFilename } from '../../../electron/session/exporters/json-exporter';
import type { SessionRecord } from '../../../electron/session/types';

describe('JsonExporter', () => {
  const mockSession: SessionRecord = {
    id: 'session-123456-abc123',
    debateId: 'debate-789',
    startedAt: '2025-12-30T10:00:00.000Z',
    endedAt: '2025-12-30T10:15:00.000Z',
    status: 'completed',
    config: {
      topic: 'Test Topic',
      context: 'Test Context',
      preset: 'code_review',
      participants: ['chatgpt', 'claude'],
      judgeProvider: 'gemini',
      completionThreshold: 90,
    },
    messages: [
      {
        id: 'msg-1',
        timestamp: '2025-12-30T10:00:05.000Z',
        provider: 'chatgpt',
        role: 'user',
        content: 'Test prompt',
        tokenCount: 5,
        iteration: 1,
      },
      {
        id: 'msg-2',
        timestamp: '2025-12-30T10:00:30.000Z',
        provider: 'chatgpt',
        role: 'assistant',
        content: 'Test response',
        tokenCount: 10,
        iteration: 1,
      },
    ],
    elements: [],
    metadata: {
      totalTokens: 15,
      totalIterations: 1,
      providersUsed: ['chatgpt', 'claude'],
      completionReason: 'consensus',
    },
  };

  describe('exportToJson', () => {
    it('should export session as valid JSON', () => {
      const json = exportToJson(mockSession);
      const parsed = JSON.parse(json);

      expect(parsed.session.id).toBe('session-123456-abc123');
      expect(parsed.session.debateId).toBe('debate-789');
      expect(parsed.session.status).toBe('completed');
    });

    it('should include all messages', () => {
      const json = exportToJson(mockSession);
      const parsed = JSON.parse(json);

      expect(parsed.messages).toHaveLength(2);
      expect(parsed.messages[0].role).toBe('user');
      expect(parsed.messages[1].role).toBe('assistant');
    });

    it('should include config', () => {
      const json = exportToJson(mockSession);
      const parsed = JSON.parse(json);

      expect(parsed.config.topic).toBe('Test Topic');
      expect(parsed.config.preset).toBe('code_review');
      expect(parsed.config.participants).toEqual(['chatgpt', 'claude']);
    });

    it('should include metadata by default', () => {
      const json = exportToJson(mockSession);
      const parsed = JSON.parse(json);

      expect(parsed.metadata.totalTokens).toBe(15);
      expect(parsed.metadata.completionReason).toBe('consensus');
    });

    it('should exclude metadata when option is false', () => {
      const json = exportToJson(mockSession, { includeMetadata: false });
      const parsed = JSON.parse(json);

      expect(parsed.metadata).toEqual({});
    });

    it('should use custom indent', () => {
      const json4 = exportToJson(mockSession, { indent: 4 });
      const json0 = exportToJson(mockSession, { indent: 0 });

      expect(json4.includes('    ')).toBe(true);
      expect(json0.includes('\n')).toBe(false);
    });

    it('should format dates as ISO by default', () => {
      const json = exportToJson(mockSession);
      const parsed = JSON.parse(json);

      expect(parsed.session.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should format dates as unix when specified', () => {
      const json = exportToJson(mockSession, { dateFormat: 'unix' });
      const parsed = JSON.parse(json);

      expect(parsed.session.startedAt).toMatch(/^\d+$/);
    });
  });

  describe('getDefaultJsonFilename', () => {
    it('should generate filename with date and session ID', () => {
      const filename = getDefaultJsonFilename(mockSession);

      expect(filename).toMatch(/^mad-session-\d{8}-\d{6}-[a-z0-9]+\.json$/);
      expect(filename).toContain('abc123');
    });
  });
});
