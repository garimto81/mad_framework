/**
 * In-Memory Debate Repository
 *
 * 토론 데이터를 메모리에 저장/관리
 */

import type { DebateElement, LLMProvider } from '../../shared/types';

interface DebateData {
  id: string;
  topic: string;
  context?: string;
  preset: string;
  participants: LLMProvider[];
  judgeProvider: LLMProvider;
  completionThreshold: number;
  status: 'pending' | 'running' | 'completed' | 'cancelled';
  currentIteration: number;
  createdAt: string;
}

interface ElementData {
  id: string;
  debateId: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cycle_detected';
  currentScore: number;
  completionReason?: 'threshold' | 'cycle';
}

interface ElementVersionData {
  id: string;
  elementId: string;
  iteration: number;
  score: number;
  content: string;
  provider: string;
  timestamp: string;
}

export class InMemoryRepository {
  private debates: Map<string, DebateData> = new Map();
  private elements: Map<string, ElementData> = new Map();
  private elementVersions: Map<string, ElementVersionData[]> = new Map();

  async create(data: {
    topic: string;
    context?: string;
    preset: string;
    participants: LLMProvider[];
    judgeProvider: LLMProvider;
    completionThreshold: number;
  }): Promise<string> {
    const id = `debate-${Date.now()}`;
    this.debates.set(id, {
      id,
      ...data,
      status: 'running',
      currentIteration: 0,
      createdAt: new Date().toISOString(),
    });
    console.log(`[Repository] Created debate: ${id}`);
    return id;
  }

  async createElements(debateId: string, elementNames: string[]): Promise<void> {
    for (const name of elementNames) {
      const id = `element-${debateId}-${name}`;
      this.elements.set(id, {
        id,
        debateId,
        name,
        status: 'in_progress',
        currentScore: 0,
      });
      this.elementVersions.set(id, []);
      console.log(`[Repository] Created element: ${id} (${name})`);
    }
  }

  async updateElementScore(
    elementId: string,
    score: number,
    iteration: number,
    content: string,
    provider: string
  ): Promise<void> {
    const element = this.elements.get(elementId);
    if (element) {
      element.currentScore = score;
      element.status = 'in_progress';
      this.elements.set(elementId, element);

      const versions = this.elementVersions.get(elementId) || [];
      versions.push({
        id: `version-${elementId}-${iteration}`,
        elementId,
        iteration,
        score,
        content,
        provider,
        timestamp: new Date().toISOString(),
      });
      this.elementVersions.set(elementId, versions);

      console.log(`[Repository] Updated element ${elementId}: score=${score}, iteration=${iteration}`);
    }
  }

  async markElementComplete(elementId: string, reason: 'threshold' | 'cycle'): Promise<void> {
    const element = this.elements.get(elementId);
    if (element) {
      element.status = reason === 'cycle' ? 'cycle_detected' : 'completed';
      element.completionReason = reason;
      this.elements.set(elementId, element);
      console.log(`[Repository] Marked element complete: ${elementId} (${reason})`);
    }
  }

  async getLast3Versions(elementId: string): Promise<ElementVersionData[]> {
    const versions = this.elementVersions.get(elementId) || [];
    return versions.slice(-3);
  }

  async getIncompleteElements(debateId: string): Promise<DebateElement[]> {
    const result: DebateElement[] = [];

    for (const [, element] of this.elements) {
      if (element.debateId === debateId && element.status === 'in_progress') {
        const versions = this.elementVersions.get(element.id) || [];
        result.push({
          id: element.id,
          name: element.name,
          status: element.status,
          currentScore: element.currentScore,
          scoreHistory: versions.map(v => v.score),
          versionHistory: versions.map(v => ({
            iteration: v.iteration,
            content: v.content,
            score: v.score,
            timestamp: v.timestamp,
            provider: v.provider as LLMProvider,
          })),
        });
      }
    }

    console.log(`[Repository] getIncompleteElements(${debateId}): ${result.length} elements`);
    return result;
  }

  async updateIteration(debateId: string, iteration: number): Promise<void> {
    const debate = this.debates.get(debateId);
    if (debate) {
      debate.currentIteration = iteration;
      this.debates.set(debateId, debate);
    }
  }

  async updateStatus(debateId: string, status: string): Promise<void> {
    const debate = this.debates.get(debateId);
    if (debate) {
      debate.status = status as DebateData['status'];
      this.debates.set(debateId, debate);
      console.log(`[Repository] Updated debate status: ${debateId} -> ${status}`);
    }
  }

  // Helper: get all elements for a debate
  async getAllElements(debateId: string): Promise<DebateElement[]> {
    const result: DebateElement[] = [];

    for (const [, element] of this.elements) {
      if (element.debateId === debateId) {
        const versions = this.elementVersions.get(element.id) || [];
        result.push({
          id: element.id,
          name: element.name,
          status: element.status,
          currentScore: element.currentScore,
          scoreHistory: versions.map(v => v.score),
          versionHistory: versions.map(v => ({
            iteration: v.iteration,
            content: v.content,
            score: v.score,
            timestamp: v.timestamp,
            provider: v.provider as LLMProvider,
          })),
          completionReason: element.completionReason,
        });
      }
    }

    return result;
  }

  // Clear all data
  clear(): void {
    this.debates.clear();
    this.elements.clear();
    this.elementVersions.clear();
    console.log('[Repository] Cleared all data');
  }
}
