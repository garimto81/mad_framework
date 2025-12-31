/**
 * Debate Controller
 *
 * 무한 반복 토론 실행 및 요소별 점수 관리
 */

import type {
  DebateConfig,
  DebateElement,
  LLMProvider,
  DebateProgressExtended,
  DebateResult,
  ElementScoreUpdate,
  DebateStateSnapshot,
  DebateStartedEvent,
} from '../../shared/types';
import type { BrowserViewManager } from '../browser/browser-view-manager';
import type { CycleDetector } from './cycle-detector';
import type { ProgressLogger } from './progress-logger';
import type { SessionRecorder } from '../session/session-recorder';
import { responseParser, type ParseResult, type ParseMetadata } from './response-parser';
import {
  MAX_ITERATIONS,
  MAX_CONSECUTIVE_EMPTY_RESPONSES,
  RETRY_DELAY_MS,
  LONG_RESPONSE_THRESHOLD,
} from '../constants';
import {
  circuitBreakerManager,
  type CircuitBreaker,
  type CircuitState,
} from '../utils/circuit-breaker';

interface DebateCreateData {
  topic: string;
  context?: string;
  preset: string;
  participants: LLMProvider[];
  judgeProvider: LLMProvider;
  completionThreshold: number;
}

interface ElementVersion {
  score: number;
  content: string;
  provider: LLMProvider;
  iteration: number;
  timestamp: string;
}

interface DebateRepository {
  create: (data: DebateCreateData) => Promise<string>;
  createElements: (debateId: string, elementNames: string[]) => Promise<void>;
  updateElementScore: (
    elementId: string,
    score: number,
    iteration: number,
    content: string,
    provider: LLMProvider
  ) => Promise<void>;
  markElementComplete: (elementId: string, reason: 'threshold' | 'cycle') => Promise<void>;
  getLast3Versions: (elementId: string) => Promise<ElementVersion[]>;
  getIncompleteElements: (debateId: string) => Promise<DebateElement[]>;
  updateIteration: (debateId: string, iteration: number) => Promise<void>;
  updateStatus: (debateId: string, status: string) => Promise<void>;
}

interface EventEmitter {
  emit: (event: string, data: unknown) => void;
  on: (event: string, callback: (data: unknown) => void) => void;
}

const PRESET_ELEMENTS: Record<string, string[]> = {
  code_review: ['보안', '성능', '가독성', '유지보수성'],
  qa_accuracy: ['정확성', '완전성', '명확성'],
  decision: ['장점', '단점', '위험', '기회'],
};

// Circuit Breaker 상수는 ../constants.ts에서 import

export class DebateController {
  private debateId: string | null = null;
  private cancelled: boolean = false;
  private currentIteration: number = 0;
  private currentProvider: LLMProvider | null = null;
  // Issue #34: 상태를 Single Source of Truth로 관리
  private status: DebateStateSnapshot['status'] = 'idle';

  constructor(
    private browserManager: BrowserViewManager,
    private repository: DebateRepository,
    private cycleDetector: CycleDetector,
    private eventEmitter: EventEmitter,
    private progressLogger?: ProgressLogger,
    private sessionRecorder?: SessionRecorder
  ) {
    // Issue #45: Circuit Breaker 상태 변경 이벤트 연결
    circuitBreakerManager.onAnyStateChange((event) => {
      this.eventEmitter.emit('circuit-breaker:state-changed', event);
    });
  }

  // Issue #34: 상태 스냅샷 조회
  getStateSnapshot(): DebateStateSnapshot {
    return {
      debateId: this.debateId,
      isRunning: this.isRunning(),
      currentIteration: this.currentIteration,
      currentProvider: this.currentProvider,
      status: this.status,
    };
  }

  // Issue #34: 상태 변경 시 이벤트 발행
  private emitStateChanged(): void {
    this.eventEmitter.emit('debate:state-changed', this.getStateSnapshot());
  }

  // Issue #33: sleep 헬퍼
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 상태 조회 메서드 (Claude Code 모니터링용)
  isRunning(): boolean {
    return !this.cancelled && this.debateId !== null;
  }

  getCurrentIteration(): number {
    return this.currentIteration;
  }

  getCurrentProvider(): LLMProvider | null {
    return this.currentProvider;
  }

  async start(config: DebateConfig): Promise<void> {
    console.log('[Debate] Starting debate...');
    this.cancelled = false;
    this.currentIteration = 0;
    this.currentProvider = null;
    // Issue #34: 상태 변경 및 이벤트 발행
    this.status = 'starting';
    this.emitStateChanged();

    // 로그 기록
    this.progressLogger?.logDebateStart(config.topic);

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

    // Issue #25: 세션 레코딩 시작
    this.sessionRecorder?.startSession(this.debateId, config);

    // Issue #34: debate:started 이벤트 발행 (실제 세션 ID 전달)
    const startedEvent: DebateStartedEvent = {
      sessionId: this.debateId,
      config,
      createdAt: new Date().toISOString(),
    };
    this.eventEmitter.emit('debate:started', startedEvent);

    // Issue #34: 상태를 running으로 변경
    this.status = 'running';
    this.emitStateChanged();

    let iteration = 0;
    let participantIndex = 0;
    let consecutiveEmptyResponses = 0;

    // Loop with Circuit Breaker protection
    while (!this.cancelled && iteration < MAX_ITERATIONS) {
      iteration++;
      const provider = config.participants[participantIndex % config.participants.length];

      // 상태 업데이트 (Claude Code 모니터링용)
      this.currentIteration = iteration;
      this.currentProvider = provider;

      // 로그 기록
      this.progressLogger?.logIteration(iteration, provider);

      await this.repository.updateIteration(this.debateId, iteration);

      // Get element counts for progress
      const allElements = this.getElementNames(config.preset);
      let incompleteElements = await this.repository.getIncompleteElements(this.debateId);
      const completedCount = allElements.length - incompleteElements.length;
      const estimatedProgress = Math.round((completedCount / allElements.length) * 100);

      // Emit extended progress event
      this.eventEmitter.emit('debate:progress', {
        sessionId: this.debateId,
        iteration,
        currentProvider: provider,
        phase: 'input',
        totalElements: allElements.length,
        completedElements: completedCount,
        currentElementName: incompleteElements[0]?.name,
        estimatedProgress,
      } as DebateProgressExtended);

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

      // Re-check for incomplete elements after iteration
      incompleteElements = await this.repository.getIncompleteElements(this.debateId);

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
    let finalStatus: DebateStateSnapshot['status'] = 'completed';
    if (this.cancelled) {
      finalStatus = 'cancelled';
    } else if (iteration >= MAX_ITERATIONS) {
      finalStatus = 'error';
      console.error(`[Debate] Reached maximum iterations (${MAX_ITERATIONS})`);
    } else if (consecutiveEmptyResponses >= MAX_CONSECUTIVE_EMPTY_RESPONSES) {
      finalStatus = 'error';
    }

    await this.repository.updateStatus(this.debateId, finalStatus);

    // 로그 기록
    this.progressLogger?.logDebateComplete(iteration);

    // Issue #25: 세션 레코딩 완료
    if (this.cancelled) {
      this.sessionRecorder?.cancelSession();
    } else if (finalStatus === 'error') {
      this.sessionRecorder?.errorSession('Debate ended with error');
    } else {
      const completionReason = iteration >= MAX_ITERATIONS ? 'maxIterations' : 'consensus';
      this.sessionRecorder?.completeSession(completionReason);
    }

    // 이벤트 발행 (debateId 리셋 전에)
    this.eventEmitter.emit('debate:complete', {
      sessionId: this.debateId,
      totalIterations: iteration,
      completedAt: new Date().toISOString(),
    } as DebateResult);

    // Issue #34: 상태 리셋 및 이벤트 발행
    this.status = finalStatus;
    this.currentIteration = 0;
    this.currentProvider = null;
    this.debateId = null;
    this.emitStateChanged();
  }

  cancel(): void {
    this.cancelled = true;
    // Issue #34: 취소 시 상태 변경
    this.status = 'cancelled';
    this.emitStateChanged();
    // Issue #25: 세션 취소는 start() 종료 시 처리됨
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

    // Issue #45: Circuit Breaker 체크
    const breaker = circuitBreakerManager.getBreaker(provider);
    if (!breaker.canRequest()) {
      console.warn(`[Debate] Circuit breaker OPEN for ${provider}, skipping iteration`);
      this.eventEmitter.emit('debate:circuit-open', {
        sessionId: this.debateId,
        iteration,
        provider,
        metrics: breaker.getMetrics(),
      });
      return false;
    }

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

      // Issue #25: user 프롬프트 기록
      this.sessionRecorder?.recordMessage(provider, 'user', prompt, iteration);

      console.log(`[Debate] Inputting prompt...`);
      await adapter.inputPrompt(prompt);
      console.log(`[Debate] Prompt input done`);

      console.log(`[Debate] Sending message...`);
      await adapter.sendMessage();
      console.log(`[Debate] Message sent`);

      // Wait for response with retry logic (Issue #33)
      console.log(`[Debate] Calling waitForResponse...`);
      await adapter.waitForResponse(120000);
      console.log(`[Debate] waitForResponse completed`);

      // Extract response with retry (Issue #33)
      console.log(`[Debate] Extracting response...`);
      let response = await adapter.extractResponse();
      console.log(`[Debate] Response extracted (${response.length} chars)`);

      // Issue #33: 응답이 비어있으면 재시도 1회
      if (!response || response.trim().length === 0) {
        console.warn(`[Debate] Empty response, retrying after ${RETRY_DELAY_MS}ms...`);
        await this.sleep(RETRY_DELAY_MS);
        response = await adapter.extractResponse();
        console.log(`[Debate] Retry response (${response.length} chars)`);
      }

      // Check for empty response after retry
      if (!response || response.trim().length === 0) {
        console.error(`[Debate] Empty response from ${provider} at iteration ${iteration}`);
        // Issue #45: 빈 응답도 실패로 기록
        breaker.recordFailure('Empty response');
        this.eventEmitter.emit('debate:error', {
          sessionId: this.debateId,
          iteration,
          provider,
          error: 'Empty response received',
        });
        return false;
      }

      // Issue #25: assistant 응답 기록
      this.sessionRecorder?.recordMessage(provider, 'assistant', response, iteration);

      // Issue #44: 향상된 응답 파서 사용
      const parseResult = responseParser.parse(response);
      const scores = parseResult.elements;
      const parseMetadata = parseResult.metadata;

      // 파싱 메타데이터 로깅
      console.log(`[Debate] Parse result: stage=${parseMetadata.stage} (${parseMetadata.stageDescription}), ` +
        `confidence=${parseMetadata.confidence}%, elements=${parseMetadata.elementsFound}, ` +
        `partial=${parseMetadata.isPartial}, time=${parseMetadata.parseTimeMs}ms`);

      if (parseMetadata.warnings.length > 0) {
        console.warn(`[Debate] Parse warnings:`, parseMetadata.warnings);
      }

      // Issue #33 + #44: 파싱 실패해도 응답이 충분히 길면 부분 성공으로 처리
      if (scores.length === 0) {
        console.warn(`[Debate] No scores parsed from response at iteration ${iteration}`);

        // 응답이 LONG_RESPONSE_THRESHOLD자 이상이면 LLM이 형식 없이 응답한 것으로 간주
        // → 에러가 아닌 경고로 처리하고 다음 iteration에서 재요청
        if (response.trim().length >= LONG_RESPONSE_THRESHOLD) {
          console.log(`[Debate] Long response without parseable scores, will retry next iteration`);
          this.eventEmitter.emit('debate:response', {
            sessionId: this.debateId,
            iteration,
            provider,
            content: response,
            parseMetadata,
            timestamp: new Date().toISOString(),
          });
          // 긴 응답은 유효한 것으로 간주 (consecutiveEmptyResponses 증가 안 함)
          return true;
        }

        // 짧은 응답이면 빈 응답으로 처리
        this.eventEmitter.emit('debate:response', {
          sessionId: this.debateId,
          iteration,
          provider,
          content: response,
          parseMetadata,
          timestamp: new Date().toISOString(),
        });
        return false;
      }

      // 부분 파싱 경고
      if (parseMetadata.isPartial) {
        console.warn(`[Debate] Partial parse: only ${scores.length} elements extracted with low confidence (${parseMetadata.confidence}%)`);
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

      // Emit response event with parse metadata
      this.eventEmitter.emit('debate:response', {
        sessionId: this.debateId,
        iteration,
        provider,
        content: response,
        parseMetadata,
        timestamp: new Date().toISOString(),
      });

      // Issue #45: 성공 기록
      breaker.recordSuccess();
      return true;
    } catch (error) {
      console.error(`[Debate] Error in iteration ${iteration}:`, error);
      // Issue #45: 에러도 실패로 기록
      breaker.recordFailure(String(error));
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

  // Issue #44: 파서 통계 조회
  getParseStats() {
    return responseParser.getStageStats();
  }

  // Issue #44: 파서 실패 로그 조회
  getParseFailureLogs() {
    return responseParser.getFailureLogs();
  }

  // Issue #45: Circuit Breaker 상태 조회
  getCircuitBreakerStates() {
    return circuitBreakerManager.getAllStates();
  }

  // Issue #45: Circuit Breaker 요약
  getCircuitBreakerSummary() {
    return circuitBreakerManager.getSummary();
  }

  // Issue #45: 특정 Provider Circuit Breaker 리셋
  resetCircuitBreaker(provider: LLMProvider) {
    circuitBreakerManager.resetProvider(provider);
  }

  // Issue #45: 모든 Circuit Breaker 리셋
  resetAllCircuitBreakers() {
    circuitBreakerManager.resetAll();
  }
}
