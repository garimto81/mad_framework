/**
 * InMemoryRepository Tests
 *
 * 토론 데이터 저장소 테스트
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository } from '../../../electron/debate/in-memory-repository';

describe('InMemoryRepository', () => {
  let repository: InMemoryRepository;

  beforeEach(() => {
    repository = new InMemoryRepository();
  });

  describe('create', () => {
    it('should create a new debate and return id', async () => {
      const id = await repository.create({
        topic: 'Test topic',
        context: 'Test context',
        preset: 'technical',
        participants: ['chatgpt', 'claude'],
        judgeProvider: 'gemini',
        completionThreshold: 90,
      });

      expect(id).toMatch(/^debate-\d+$/);
    });

    it('should create debate without context', async () => {
      const id = await repository.create({
        topic: 'Test topic',
        preset: 'technical',
        participants: ['chatgpt'],
        judgeProvider: 'claude',
        completionThreshold: 85,
      });

      expect(id).toBeDefined();
    });
  });

  describe('createElements', () => {
    it('should create elements for a debate', async () => {
      const debateId = await repository.create({
        topic: 'Test',
        preset: 'technical',
        participants: ['chatgpt'],
        judgeProvider: 'claude',
        completionThreshold: 90,
      });

      await repository.createElements(debateId, ['Element1', 'Element2', 'Element3']);

      const elements = await repository.getIncompleteElements(debateId);
      expect(elements).toHaveLength(3);
      expect(elements.map(e => e.name)).toEqual(['Element1', 'Element2', 'Element3']);
    });

    it('should initialize elements with in_progress status', async () => {
      const debateId = await repository.create({
        topic: 'Test',
        preset: 'technical',
        participants: ['chatgpt'],
        judgeProvider: 'claude',
        completionThreshold: 90,
      });

      await repository.createElements(debateId, ['Element1']);

      const elements = await repository.getIncompleteElements(debateId);
      expect(elements[0].status).toBe('in_progress');
      expect(elements[0].currentScore).toBe(0);
    });
  });

  describe('updateElementScore', () => {
    it('should update element score and create version', async () => {
      const debateId = await repository.create({
        topic: 'Test',
        preset: 'technical',
        participants: ['chatgpt'],
        judgeProvider: 'claude',
        completionThreshold: 90,
      });

      await repository.createElements(debateId, ['Element1']);
      const elements = await repository.getIncompleteElements(debateId);
      const elementId = elements[0].id;

      await repository.updateElementScore(elementId, 75, 1, 'Content v1', 'chatgpt');

      const updated = await repository.getIncompleteElements(debateId);
      expect(updated[0].currentScore).toBe(75);
      expect(updated[0].scoreHistory).toEqual([75]);
      expect(updated[0].versionHistory).toHaveLength(1);
    });

    it('should accumulate version history', async () => {
      const debateId = await repository.create({
        topic: 'Test',
        preset: 'technical',
        participants: ['chatgpt'],
        judgeProvider: 'claude',
        completionThreshold: 90,
      });

      await repository.createElements(debateId, ['Element1']);
      const elements = await repository.getIncompleteElements(debateId);
      const elementId = elements[0].id;

      await repository.updateElementScore(elementId, 70, 1, 'Content v1', 'chatgpt');
      await repository.updateElementScore(elementId, 80, 2, 'Content v2', 'claude');
      await repository.updateElementScore(elementId, 85, 3, 'Content v3', 'chatgpt');

      const updated = await repository.getIncompleteElements(debateId);
      expect(updated[0].scoreHistory).toEqual([70, 80, 85]);
      expect(updated[0].versionHistory).toHaveLength(3);
    });
  });

  describe('markElementComplete', () => {
    it('should mark element as completed with threshold reason', async () => {
      const debateId = await repository.create({
        topic: 'Test',
        preset: 'technical',
        participants: ['chatgpt'],
        judgeProvider: 'claude',
        completionThreshold: 90,
      });

      await repository.createElements(debateId, ['Element1']);
      const elements = await repository.getIncompleteElements(debateId);
      const elementId = elements[0].id;

      await repository.markElementComplete(elementId, 'threshold');

      // Element should no longer be in incomplete list
      const incomplete = await repository.getIncompleteElements(debateId);
      expect(incomplete).toHaveLength(0);

      // But should be in all elements with completed status
      const all = await repository.getAllElements(debateId);
      expect(all[0].status).toBe('completed');
      expect(all[0].completionReason).toBe('threshold');
    });

    it('should mark element as cycle_detected with cycle reason', async () => {
      const debateId = await repository.create({
        topic: 'Test',
        preset: 'technical',
        participants: ['chatgpt'],
        judgeProvider: 'claude',
        completionThreshold: 90,
      });

      await repository.createElements(debateId, ['Element1']);
      const elements = await repository.getIncompleteElements(debateId);
      const elementId = elements[0].id;

      await repository.markElementComplete(elementId, 'cycle');

      const all = await repository.getAllElements(debateId);
      expect(all[0].status).toBe('cycle_detected');
      expect(all[0].completionReason).toBe('cycle');
    });
  });

  describe('getLast3Versions', () => {
    it('should return last 3 versions', async () => {
      const debateId = await repository.create({
        topic: 'Test',
        preset: 'technical',
        participants: ['chatgpt'],
        judgeProvider: 'claude',
        completionThreshold: 90,
      });

      await repository.createElements(debateId, ['Element1']);
      const elements = await repository.getIncompleteElements(debateId);
      const elementId = elements[0].id;

      // Add 5 versions
      for (let i = 1; i <= 5; i++) {
        await repository.updateElementScore(elementId, 70 + i, i, `Content v${i}`, 'chatgpt');
      }

      const last3 = await repository.getLast3Versions(elementId);
      expect(last3).toHaveLength(3);
      expect(last3.map(v => v.iteration)).toEqual([3, 4, 5]);
    });

    it('should return empty array for non-existent element', async () => {
      const versions = await repository.getLast3Versions('non-existent');
      expect(versions).toEqual([]);
    });

    it('should return all versions if less than 3', async () => {
      const debateId = await repository.create({
        topic: 'Test',
        preset: 'technical',
        participants: ['chatgpt'],
        judgeProvider: 'claude',
        completionThreshold: 90,
      });

      await repository.createElements(debateId, ['Element1']);
      const elements = await repository.getIncompleteElements(debateId);
      const elementId = elements[0].id;

      await repository.updateElementScore(elementId, 75, 1, 'Content v1', 'chatgpt');
      await repository.updateElementScore(elementId, 80, 2, 'Content v2', 'claude');

      const versions = await repository.getLast3Versions(elementId);
      expect(versions).toHaveLength(2);
    });
  });

  describe('updateIteration', () => {
    it('should update debate iteration', async () => {
      const debateId = await repository.create({
        topic: 'Test',
        preset: 'technical',
        participants: ['chatgpt'],
        judgeProvider: 'claude',
        completionThreshold: 90,
      });

      await repository.updateIteration(debateId, 5);
      // No direct way to verify, but should not throw
    });

    it('should handle non-existent debate gracefully', async () => {
      // Should not throw
      await repository.updateIteration('non-existent', 5);
    });
  });

  describe('updateStatus', () => {
    it('should update debate status', async () => {
      const debateId = await repository.create({
        topic: 'Test',
        preset: 'technical',
        participants: ['chatgpt'],
        judgeProvider: 'claude',
        completionThreshold: 90,
      });

      await repository.updateStatus(debateId, 'completed');
      // No direct getter, but should not throw
    });

    it('should handle non-existent debate gracefully', async () => {
      await repository.updateStatus('non-existent', 'completed');
    });
  });

  describe('getAllElements', () => {
    it('should return all elements regardless of status', async () => {
      const debateId = await repository.create({
        topic: 'Test',
        preset: 'technical',
        participants: ['chatgpt'],
        judgeProvider: 'claude',
        completionThreshold: 90,
      });

      await repository.createElements(debateId, ['Element1', 'Element2']);
      const elements = await repository.getIncompleteElements(debateId);

      // Complete one element
      await repository.markElementComplete(elements[0].id, 'threshold');

      const all = await repository.getAllElements(debateId);
      expect(all).toHaveLength(2);

      const incomplete = await repository.getIncompleteElements(debateId);
      expect(incomplete).toHaveLength(1);
    });
  });

  describe('clear', () => {
    it('should clear all data', async () => {
      const debateId = await repository.create({
        topic: 'Test',
        preset: 'technical',
        participants: ['chatgpt'],
        judgeProvider: 'claude',
        completionThreshold: 90,
      });

      await repository.createElements(debateId, ['Element1']);

      repository.clear();

      const elements = await repository.getAllElements(debateId);
      expect(elements).toHaveLength(0);
    });
  });
});
