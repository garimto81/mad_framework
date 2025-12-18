/**
 * Debate Controller
 *
 * 무한 반복 토론 실행 및 요소별 점수 관리
 */

import type {
  DebateConfig,
  DebateSession,
  DebateElement,
  LLMProvider,
  DebateProgress,
  DebateResult,
  ElementScoreUpdate,
} from '../../shared/types';
import type { BrowserViewManager } from '../browser/browser-view-manager';
import type { CycleDetector } from './cycle-detector';

interface DebateRepository {
  create: (data: any) => Promise<string>;
  createElements: (debateId: string, elementNames: string[]) => Promise<void>;
  updateElementScore: (
    elementId: string,
    score: number,
    iteration: number,
    content: string,
    provider: string
  ) => Promise<void>;
  markElementComplete: (elementId: string, reason: 'threshold' | 'cycle') => Promise<void>;
  getLast3Versions: (elementId: string) => Promise<any[]>;
  getIncompleteElements: (debateId: string) => Promise<DebateElement[]>;
  updateIteration: (debateId: string, iteration: number) => Promise<void>;
  updateStatus: (debateId: string, status: string) => Promise<void>;
}

interface EventEmitter {
  emit: (event: string, data: any) => void;
  on: (event: string, callback: (data: any) => void) => void;
}

const PRESET_ELEMENTS: Record<string, string[]> = {
  code_review: ['보안', '성능', '가독성', '유지보수성'],
  qa_accuracy: ['정확성', '완전성', '명확성'],
  decision: ['장점', '단점', '위험', '기회'],
};

export class DebateController {
  private debateId: string | null = null;
  private cancelled: boolean = false;

  constructor(
    private browserManager: BrowserViewManager,
    private repository: DebateRepository,
    private cycleDetector: CycleDetector,
    private eventEmitter: EventEmitter
  ) {}

  async start(config: DebateConfig): Promise<void> {
    this.cancelled = false;

    // Check login status
    const loginStatus = await this.browserManager.checkLoginStatus();
    for (const participant of config.participants) {
      if (!loginStatus[participant]?.isLoggedIn) {
        throw new Error(`Not logged in: ${participant}`);
      }
    }

    // Create debate session
    this.debateId = await this.repository.create({
      topic: config.topic,
      context: config.context,
      preset: config.preset,
      participants: config.participants,
      judgeProvider: config.judgeProvider,
      completionThreshold: config.completionThreshold,
    });

    // Create elements based on preset
    const elementNames = this.getElementNames(config.preset);
    await this.repository.createElements(this.debateId, elementNames);

    let iteration = 0;
    let participantIndex = 0;

    // INFINITE LOOP until all elements complete
    while (!this.cancelled) {
      iteration++;
      const provider = config.participants[participantIndex % config.participants.length];

      await this.repository.updateIteration(this.debateId, iteration);

      // Emit progress event
      this.eventEmitter.emit('debate:progress', {
        sessionId: this.debateId,
        iteration,
        currentProvider: provider,
        phase: 'input',
      } as DebateProgress);

      // Execute iteration
      await this.executeIteration(iteration, provider, config);

      // Check for incomplete elements
      const incompleteElements = await this.repository.getIncompleteElements(this.debateId);

      if (incompleteElements.length === 0) {
        // All elements complete → End debate
        break;
      }

      // Check cycle detection for elements with 3+ versions
      await this.checkCycleDetection(config, incompleteElements);

      // Re-check after cycle detection
      const stillIncomplete = await this.repository.getIncompleteElements(this.debateId);
      if (stillIncomplete.length === 0) {
        break;
      }

      participantIndex++;
    }

    // Debate complete
    await this.repository.updateStatus(this.debateId, this.cancelled ? 'cancelled' : 'completed');

    this.eventEmitter.emit('debate:complete', {
      sessionId: this.debateId,
      totalIterations: iteration,
      completedAt: new Date().toISOString(),
    } as DebateResult);
  }

  cancel(): void {
    this.cancelled = true;
  }

  private getElementNames(preset: string): string[] {
    return PRESET_ELEMENTS[preset] || ['일반'];
  }

  private async executeIteration(
    iteration: number,
    provider: LLMProvider,
    config: DebateConfig
  ): Promise<void> {
    const adapter = this.browserManager.getAdapter(provider);

    try {
      // Wait for input ready
      await adapter.waitForInputReady();

      // Build and input prompt
      const incompleteElements = await this.repository.getIncompleteElements(this.debateId!);
      const prompt = this.buildPrompt(config, iteration, incompleteElements);

      await adapter.inputPrompt(prompt);
      await adapter.sendMessage();

      // Wait for response
      await adapter.waitForResponse(120000);

      // Extract response
      const response = await adapter.extractResponse();

      // Parse and update element scores
      const scores = this.parseElementScores(response);

      for (const score of scores) {
        const element = incompleteElements.find((e) => e.name === score.elementName);
        if (element) {
          await this.repository.updateElementScore(
            element.id,
            score.score,
            iteration,
            score.critique,
            provider
          );

          // Check threshold
          if (score.score >= config.completionThreshold) {
            await this.repository.markElementComplete(element.id, 'threshold');

            this.eventEmitter.emit('debate:element-complete', {
              elementId: element.id,
              elementName: element.name,
              reason: 'threshold',
              score: score.score,
            });
          }

          // Emit score update
          this.eventEmitter.emit('debate:element-score', {
            elementId: element.id,
            elementName: element.name,
            score: score.score,
            critique: score.critique,
            iteration,
          } as ElementScoreUpdate);
        }
      }

      // Emit response event
      this.eventEmitter.emit('debate:response', {
        sessionId: this.debateId,
        iteration,
        provider,
        content: response,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.eventEmitter.emit('debate:error', {
        sessionId: this.debateId,
        iteration,
        provider,
        error: String(error),
      });
    }
  }

  private async checkCycleDetection(
    config: DebateConfig,
    incompleteElements: DebateElement[]
  ): Promise<void> {
    for (const element of incompleteElements) {
      const last3Versions = await this.repository.getLast3Versions(element.id);

      if (last3Versions.length >= 3) {
        const isCycle = await this.cycleDetector.detectCycle(config.judgeProvider, last3Versions);

        if (isCycle) {
          await this.repository.markElementComplete(element.id, 'cycle');

          this.eventEmitter.emit('debate:cycle-detected', {
            elementId: element.id,
            elementName: element.name,
          });
        }
      }
    }
  }

  private buildPrompt(
    config: DebateConfig,
    iteration: number,
    incompleteElements: DebateElement[]
  ): string {
    const elementList = incompleteElements.map((e) => `- ${e.name}`).join('\n');

    if (iteration === 1) {
      return `# 토론 주제
${config.topic}

# 컨텍스트
${config.context || '없음'}

# 평가할 요소
${elementList}

각 요소에 대해 분석하고 0-100점으로 점수를 매겨주세요.
90점 이상이면 해당 요소는 완성으로 처리됩니다.

응답 형식 (JSON):
\`\`\`json
{
  "elements": [
    {"name": "요소명", "score": 점수, "critique": "비평 및 개선점"}
  ]
}
\`\`\``;
    }

    return `# 이전 분석 검토 및 개선

아직 완성되지 않은 요소:
${elementList}

각 요소를 다시 분석하고 개선점을 제시해주세요.
90점 이상이면 해당 요소는 완성으로 처리됩니다.

응답 형식 (JSON):
\`\`\`json
{
  "elements": [
    {"name": "요소명", "score": 점수, "critique": "비평 및 개선점"}
  ]
}
\`\`\``;
  }

  private parseElementScores(
    response: string
  ): Array<{ elementName: string; score: number; critique: string }> {
    try {
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : response;

      const parsed = JSON.parse(jsonStr.trim());

      if (Array.isArray(parsed.elements)) {
        return parsed.elements.map((e: any) => ({
          elementName: e.name,
          score: Number(e.score) || 0,
          critique: e.critique || '',
        }));
      }

      return [];
    } catch {
      return [];
    }
  }
}
