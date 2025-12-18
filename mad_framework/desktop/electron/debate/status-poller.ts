/**
 * Status Poller
 *
 * 5초 간격으로 각 LLM 상태 체크
 */

import type { LLMProvider, LLMStatus } from '../../shared/types';
import type { BrowserViewManager } from '../browser/browser-view-manager';
import type { ProgressLogger } from './progress-logger';

type StatusChangeCallback = (status: LLMStatus, previousStatus: LLMStatus | null) => void;

export class StatusPoller {
  readonly pollInterval: number = 5000; // 5초
  private intervalId: NodeJS.Timeout | null = null;
  private activeProviders: LLMProvider[] = ['chatgpt', 'claude', 'gemini'];
  private previousStatuses: Map<LLMProvider, LLMStatus> = new Map();
  private statusChangeCallbacks: StatusChangeCallback[] = [];

  constructor(
    private browserManager: BrowserViewManager,
    private logger: ProgressLogger
  ) {}

  get isRunning(): boolean {
    return this.intervalId !== null;
  }

  start(): void {
    if (this.intervalId) return;

    this.intervalId = setInterval(async () => {
      await this.checkAllStatus();
    }, this.pollInterval);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  setActiveProviders(providers: LLMProvider[]): void {
    this.activeProviders = providers;
  }

  onStatusChange(callback: StatusChangeCallback): void {
    this.statusChangeCallbacks.push(callback);
  }

  async checkStatus(provider: LLMProvider): Promise<LLMStatus> {
    try {
      const adapter = this.browserManager.getAdapter(provider);
      const webContents = this.browserManager.getWebContents(provider);

      const isWriting = await adapter.isWriting();
      const tokenCount = await adapter.getTokenCount();

      return {
        provider,
        isWriting,
        tokenCount,
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        provider,
        isWriting: false,
        tokenCount: 0,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async checkAllStatus(): Promise<void> {
    for (const provider of this.activeProviders) {
      const status = await this.checkStatus(provider);
      const previousStatus = this.previousStatuses.get(provider);

      // Log status
      this.logger.log(status);

      // Check for status change
      if (this.hasStatusChanged(status, previousStatus)) {
        this.statusChangeCallbacks.forEach((cb) => cb(status, previousStatus || null));
      }

      this.previousStatuses.set(provider, status);
    }
  }

  private hasStatusChanged(current: LLMStatus, previous: LLMStatus | undefined): boolean {
    if (!previous) return true;
    return current.isWriting !== previous.isWriting;
  }
}
