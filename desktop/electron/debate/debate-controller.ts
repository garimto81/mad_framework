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

// Circuit Breaker 상수
const MAX_ITERATIONS = 100;
const MAX_CONSECUTIVE_EMPTY_RESPONSES = 3;

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
    console.log('[Debate] Starting debate...');
    this.cancelled = false;

    // Check login status
    console.log('[Debate] Checking login status...');
    const loginStatus = await this.browserManager.checkLoginStatus();
    console.log('[Debate] Login status:', loginStatus);

    for (const participant of config.participants) {
      if (!loginStatus[participant]?.isLoggedIn) {
        throw new Error(`Not logged in: ${participant}`);
      }
    }
    console.log('[Debate] All participants logged in');

    // Create debate session
    console.log('[Debate] Creating debate session...');
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
    let consecutiveEmptyResponses = 0;

    // Loop with Circuit Breaker protection
    while (!this.cancelled && iteration < MAX_ITERATIONS) {
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

      // Execute iteration and track empty responses
      const hasValidResponse = await this.executeIteration(iteration, provider, config);

      if (!hasValidResponse) {
        consecutiveEmptyResponses++;
        console.warn(`[Debate] Empty response ${consecutiveEmptyResponses}/${MAX_CONSECUTIVE_EMPTY_RESPONSES}`);

        if (consecutiveEmptyResponses >= MAX_CONSECUTIVE_EMPTY_RESPONSES) {
          console.error(`[Debate] Too many consecutive empty responses, stopping debate`);
          this.eventEmitter.emit('debate:error', {
            sessionId: this.debateId,
            iteration,
            provider,
            error: `Stopped after ${MAX_CONSECUTIVE_EMPTY_RESPONSES} consecutive empty responses`,
          });
          break;
        }
      } else {
        consecutiveEmptyResponses = 0;
      }

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

    // Determine final status
    let finalStatus = 'completed';
    if (this.cancelled) {
      finalStatus = 'cancelled';
    } else if (iteration >= MAX_ITERATIONS) {
      finalStatus = 'max_iterations';
      console.error(`[Debate] Reached maximum iterations (${MAX_ITERATIONS})`);
    } else if (consecutiveEmptyResponses >= MAX_CONSECUTIVE_EMPTY_RESPONSES) {
      finalStatus = 'error';
    }

    await this.repository.updateStatus(this.debateId, finalStatus);

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

  /**
   * Execute a single iteration
   * @returns true if valid response received, false if empty/error
   */
  private async executeIteration(
    iteration: number,
    provider: LLMProvider,
    config: DebateConfig
  ): Promise<boolean> {
    console.log(`[Debate] executeIteration ${iteration} with ${provider}`);
    const adapter = this.browserManager.getAdapter(provider);
    console.log(`[Debate] Got adapter for ${provider}`);

    try {
      // Wait for input ready
      console.log(`[Debate] Waiting for input ready...`);
      await adapter.waitForInputReady();
      console.log(`[Debate] Input ready`);

      // Build and input prompt
      console.log(`[Debate] Getting incomplete elements...`);
      const incompleteElements = await this.repository.getIncompleteElements(this.debateId!);
      console.log(`[Debate] Got ${incompleteElements.length} incomplete elements`);

      const prompt = this.buildPrompt(config, iteration, incompleteElements);
      console.log(`[Debate] Built prompt (${prompt.length} chars)`);

      console.log(`[Debate] Inputting prompt...`);
      await adapter.inputPrompt(prompt);
      console.log(`[Debate] Prompt input done`);

      console.log(`[Debate] Sending message...`);
      await adapter.sendMessage();
      console.log(`[Debate] Message sent`);

      // Wait for response
      console.log(`[Debate] Calling waitForResponse...`);
      await adapter.waitForResponse(120000);
      console.log(`[Debate] waitForResponse completed`);

      // Extract response
      console.log(`[Debate] Extracting response...`);
      const response = await adapter.extractResponse();
      console.log(`[Debate] Response extracted (${response.length} chars)`);

      // Check for empty response (#13)
      if (!response || response.trim().length === 0) {
        console.error(`[Debate] Empty response from ${provider} at iteration ${iteration}`);
        this.eventEmitter.emit('debate:error', {
          sessionId: this.debateId,
          iteration,
          provider,
          error: 'Empty response received',
        });
        return false;
      }

      // Parse and update element scores
      const scores = this.parseElementScores(response);

      // Check if parsing succeeded
      if (scores.length === 0) {
        console.warn(`[Debate] No scores parsed from response at iteration ${iteration}`);
        // Still emit response event but return false for empty scores
        this.eventEmitter.emit('debate:response', {
          sessionId: this.debateId,
          iteration,
          provider,
          content: response,
          timestamp: new Date().toISOString(),
        });
        return false;
      }

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

      return true;
    } catch (error) {
      console.error(`[Debate] Error in iteration ${iteration}:`, error);
      this.eventEmitter.emit('debate:error', {
        sessionId: this.debateId,
        iteration,
        provider,
        error: String(error),
      });
      return false;
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

  // Issue #33: parseElementScores 로버스트화
  private parseElementScores(
    response: string
  ): Array<{ elementName: string; score: number; critique: string }> {
    try {
      // 1. ```json 코드 블록 추출
      let jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      let jsonStr = jsonMatch ? jsonMatch[1] : null;

      // 2. 일반 ``` 코드 블록 시도
      if (!jsonStr) {
        jsonMatch = response.match(/```\s*([\s\S]*?)\s*```/);
        jsonStr = jsonMatch ? jsonMatch[1] : null;
      }

      // 3. JSON 객체 직접 추출 시도 ({ ... "elements" ... })
      if (!jsonStr) {
        const objectMatch = response.match(/\{[\s\S]*"elements"[\s\S]*\}/);
        jsonStr = objectMatch ? objectMatch[0] : null;
      }

      // 4. 배열 직접 추출 시도 ([ ... ] 패턴)
      if (!jsonStr) {
        const arrayMatch = response.match(/\[\s*\{[\s\S]*"name"[\s\S]*\}\s*\]/);
        if (arrayMatch) {
          try {
            const parsedArray = JSON.parse(arrayMatch[0]);
            return this.normalizeElements(parsedArray);
          } catch {
            // 배열 파싱 실패, 다음 시도
          }
        }
      }

      // 5. 최후의 수단: 전체 응답을 JSON으로 시도
      if (!jsonStr) {
        jsonStr = response.trim();
      }

      const parsed = JSON.parse(jsonStr);

      // 6. elements 배열 처리
      if (Array.isArray(parsed.elements)) {
        return this.normalizeElements(parsed.elements);
      }

      // 7. 루트가 배열인 경우
      if (Array.isArray(parsed)) {
        return this.normalizeElements(parsed);
      }

      // 8. 단일 객체인 경우
      if (parsed.name && parsed.score !== undefined) {
        return this.normalizeElements([parsed]);
      }

      console.warn('[Debate] Unexpected JSON structure:', Object.keys(parsed));
      return [];
    } catch (error) {
      console.error('[Debate] JSON parse failed:', error);
      console.error('[Debate] Response preview:', response.substring(0, 200));

      // 9. 정규식 기반 폴백 파싱
      return this.fallbackParse(response);
    }
  }

  // Issue #33: 요소 정규화 헬퍼
  private normalizeElements(
    elements: any[]
  ): Array<{ elementName: string; score: number; critique: string }> {
    return elements
      .filter(e => e && (e.name || e.elementName))
      .map((e: any) => ({
        elementName: e.name || e.elementName || 'unknown',
        score: Number(e.score) || 0,
        critique: e.critique || e.feedback || e.comment || '',
      }));
  }

  // Issue #33: 정규식 기반 폴백 파싱
  private fallbackParse(
    response: string
  ): Array<{ elementName: string; score: number; critique: string }> {
    const results: Array<{ elementName: string; score: number; critique: string }> = [];

    // 패턴: "요소명": 점수, "요소명: 점수", 요소명 - 점수점 등
    const patterns = [
      /["']?([가-힣\w]+)["']?\s*[:：]\s*(\d{1,3})(?:점|점수)?/g,
      /([가-힣\w]+)\s*[-–—]\s*(\d{1,3})(?:점|점수)?/g,
      /([가-힣]+)\s+(\d{1,3})(?:점|\/100)?/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(response)) !== null) {
        const name = match[1];
        const score = parseInt(match[2], 10);

        if (score >= 0 && score <= 100) {
          // 중복 체크
          if (!results.find(r => r.elementName === name)) {
            results.push({
              elementName: name,
              score,
              critique: '', // 폴백에서는 critique 추출 어려움
            });
          }
        }
      }
    }

    if (results.length > 0) {
      console.log('[Debate] Fallback parse succeeded:', results.length, 'elements');
    }

    return results;
  }
}
