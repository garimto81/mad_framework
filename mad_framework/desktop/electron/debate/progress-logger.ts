/**
 * Progress Logger
 *
 * 로그 메시지 출력
 * 형식: [시간] provider...상태...토큰수
 */

import type { LLMStatus, LLMProvider } from '../../shared/types';

export class ProgressLogger {
  log(status: LLMStatus): void {
    const time = this.formatTime(status.timestamp);
    const state = status.isWriting ? '진행중' : '완료';
    const tokens = status.tokenCount.toLocaleString();

    console.log(`[${time}] ${status.provider}...${state}...${tokens}`);
  }

  logElementScore(elementName: string, score: number, isComplete: boolean): void {
    const time = this.formatTime(new Date().toISOString());
    const completeMark = isComplete ? ' ✓ 완성' : '';

    console.log(`[${time}] 요소[${elementName}] 점수: ${score}점${completeMark}`);
  }

  logCycleDetected(elementName: string): void {
    const time = this.formatTime(new Date().toISOString());
    console.log(`[${time}] 요소[${elementName}] 순환 감지 → 완성 처리`);
  }

  logIteration(iteration: number, provider: LLMProvider): void {
    const time = this.formatTime(new Date().toISOString());
    console.log(`[${time}] === 반복 #${iteration} (${provider}) ===`);
  }

  logDebateStart(topic: string): void {
    const time = this.formatTime(new Date().toISOString());
    console.log(`[${time}] 토론 시작: ${topic}`);
  }

  logDebateComplete(totalIterations: number): void {
    const time = this.formatTime(new Date().toISOString());
    console.log(`[${time}] 토론 완료 (총 ${totalIterations}회 반복)`);
  }

  private formatTime(isoString: string): string {
    return new Date(isoString).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
}
