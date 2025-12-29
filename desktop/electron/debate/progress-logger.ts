/**
 * Progress Logger
 *
 * 로그 메시지 출력 + 메모리 저장 + 파일 출력
 * 형식: [시간] provider...상태...토큰수
 *
 * Issue #28 개선: Claude Code가 로그 파일로 앱 상태 모니터링 가능
 */

import * as fs from 'fs';
import * as path from 'path';
import type { LLMStatus, LLMProvider, ProgressLog } from '../../shared/types';

const MAX_LOGS = 1000;

export class ProgressLogger {
  private logs: ProgressLog[] = [];
  private logIdCounter = 0;
  private logFilePath: string | null = null;

  /**
   * 파일 로깅 활성화
   * @param logDir 로그 디렉토리 경로
   */
  enableFileLogging(logDir: string): void {
    try {
      // 디렉토리 생성 (없으면)
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const logPath = path.join(logDir, 'debate-latest.jsonl');

      // 기존 파일 백업
      if (fs.existsSync(logPath)) {
        const stats = fs.statSync(logPath);
        const backupName = `debate-${stats.mtime.getTime()}.jsonl`;
        const backupPath = path.join(logDir, backupName);
        fs.renameSync(logPath, backupPath);
        console.log(`[ProgressLogger] Backed up to: ${backupName}`);
      }

      this.logFilePath = logPath;
      console.log(`[ProgressLogger] File logging enabled: ${logPath}`);
    } catch (error) {
      console.error('[ProgressLogger] Failed to enable file logging:', error);
    }
  }

  log(status: LLMStatus): void {
    const time = this.formatTime(status.timestamp);
    const state = status.isWriting ? '진행중' : '완료';
    const tokens = status.tokenCount.toLocaleString();

    console.log(`[${time}] ${status.provider}...${state}...${tokens}`);

    // Store in memory
    this.addLog({
      id: this.generateId(),
      timestamp: status.timestamp,
      type: 'status',
      provider: status.provider,
      data: {
        isWriting: status.isWriting,
        tokenCount: status.tokenCount,
      },
    });
  }

  logElementScore(elementName: string, score: number, isComplete: boolean): void {
    const time = this.formatTime(new Date().toISOString());
    const completeMark = isComplete ? ' ✓ 완성' : '';

    console.log(`[${time}] 요소[${elementName}] 점수: ${score}점${completeMark}`);

    this.addLog({
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      type: 'score',
      data: {
        elementName,
        score,
        isComplete,
      },
    });
  }

  logCycleDetected(elementName: string): void {
    const time = this.formatTime(new Date().toISOString());
    console.log(`[${time}] 요소[${elementName}] 순환 감지 → 완성 처리`);

    this.addLog({
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      type: 'cycle',
      data: {
        elementName,
      },
    });
  }

  logIteration(iteration: number, provider: LLMProvider): void {
    const time = this.formatTime(new Date().toISOString());
    console.log(`[${time}] === 반복 #${iteration} (${provider}) ===`);

    this.addLog({
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      type: 'iteration',
      provider,
      data: {
        iteration,
      },
    });
  }

  logDebateStart(topic: string): void {
    const time = this.formatTime(new Date().toISOString());
    console.log(`[${time}] 토론 시작: ${topic}`);

    this.addLog({
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      type: 'iteration', // Using iteration type for start
      data: {
        topic,
        event: 'start',
      },
    });
  }

  logDebateComplete(totalIterations: number): void {
    const time = this.formatTime(new Date().toISOString());
    console.log(`[${time}] 토론 완료 (총 ${totalIterations}회 반복)`);

    this.addLog({
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      type: 'complete',
      data: {
        totalIterations,
      },
    });
  }

  // In-memory storage methods
  getLogs(limit?: number): ProgressLog[] {
    // Return in reverse chronological order (most recent first)
    const reversed = [...this.logs].reverse();
    return limit ? reversed.slice(0, limit) : reversed;
  }

  getLogsByType(type: ProgressLog['type']): ProgressLog[] {
    return this.logs.filter((log) => log.type === type).reverse();
  }

  clear(): void {
    this.logs = [];
    this.logIdCounter = 0;
  }

  private addLog(log: ProgressLog): void {
    this.logs.push(log);

    // 파일 출력 (활성화된 경우)
    if (this.logFilePath) {
      try {
        fs.appendFileSync(this.logFilePath, JSON.stringify(log) + '\n');
      } catch (error) {
        console.error('[ProgressLogger] File write failed:', error);
      }
    }

    // FIFO: Remove oldest logs if exceeding max
    if (this.logs.length > MAX_LOGS) {
      this.logs = this.logs.slice(-MAX_LOGS);
    }
  }

  private generateId(): string {
    return `log-${++this.logIdCounter}-${Date.now()}`;
  }

  private formatTime(isoString: string): string {
    return new Date(isoString).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
}
