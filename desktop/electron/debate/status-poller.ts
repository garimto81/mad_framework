/**
 * Status Poller
 *
 * Configurable interval polling for LLM status
 * Default: 500ms (configurable 100ms - 30000ms)
 */

import type { LLMProvider, LLMStatus, DetailedStatus } from '../../shared/types';
import type { BrowserViewManager } from '../browser/browser-view-manager';
import type { ProgressLogger } from './progress-logger';

type StatusChangeCallback = (status: LLMStatus, previousStatus: LLMStatus | null) => void;
type DetailedStatusCallback = (status: DetailedStatus) => void;

const MIN_POLL_INTERVAL = 100;
const MAX_POLL_INTERVAL = 30000;
const DEFAULT_POLL_INTERVAL = 500;

// Estimated max tokens for progress calculation
const ESTIMATED_MAX_TOKENS = 2000;

export class StatusPoller {
  private _pollInterval: number = DEFAULT_POLL_INTERVAL;
  private intervalId: NodeJS.Timeout | null = null;
  private activeProviders: LLMProvider[] = ['chatgpt', 'claude', 'gemini'];
  private previousStatuses: Map<LLMProvider, LLMStatus> = new Map();
  private previousTokenCounts: Map<LLMProvider, number> = new Map();
  private statusChangeCallbacks: StatusChangeCallback[] = [];
  private detailedStatusCallbacks: DetailedStatusCallback[] = [];

  constructor(
    private browserManager: BrowserViewManager,
    private logger: ProgressLogger
  ) {}

  get pollInterval(): number {
    return this._pollInterval;
  }

  setPollInterval(ms: number): void {
    this._pollInterval = Math.min(MAX_POLL_INTERVAL, Math.max(MIN_POLL_INTERVAL, ms));

    // Restart polling if already running
    if (this.intervalId) {
      this.stop();
      this.start();
    }
  }

  get isRunning(): boolean {
    return this.intervalId !== null;
  }

  start(): void {
    if (this.intervalId) return;

    this.intervalId = setInterval(async () => {
      await this.checkAllStatus();
    }, this._pollInterval);
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

  onDetailedStatusUpdate(callback: DetailedStatusCallback): void {
    this.detailedStatusCallbacks.push(callback);
  }

  async checkStatus(provider: LLMProvider): Promise<LLMStatus> {
    try {
      const adapter = this.browserManager.getAdapter(provider);

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

  async getDetailedStatus(provider: LLMProvider): Promise<DetailedStatus> {
    const status = await this.checkStatus(provider);

    // Store current token count for next comparison
    this.previousTokenCounts.set(provider, status.tokenCount);

    // Calculate responseProgress
    let responseProgress: number;

    if (!status.isWriting) {
      // Writing complete
      responseProgress = 100;
    } else if (status.tokenCount === 0) {
      // Just started
      responseProgress = 0;
    } else {
      // Estimate progress based on token count
      // Using a simple heuristic: tokenCount / ESTIMATED_MAX_TOKENS * 100
      // Capped at 95% while still writing
      responseProgress = Math.min(95, Math.round((status.tokenCount / ESTIMATED_MAX_TOKENS) * 100));
    }

    return {
      ...status,
      responseProgress,
    };
  }

  private async checkAllStatus(): Promise<void> {
    for (const provider of this.activeProviders) {
      const detailedStatus = await this.getDetailedStatus(provider);
      const previousStatus = this.previousStatuses.get(provider);

      // Log status
      this.logger.log(detailedStatus);

      // Call detailed status callbacks
      this.detailedStatusCallbacks.forEach((cb) => cb(detailedStatus));

      // Check for status change
      if (this.hasStatusChanged(detailedStatus, previousStatus)) {
        this.statusChangeCallbacks.forEach((cb) => cb(detailedStatus, previousStatus || null));
      }

      this.previousStatuses.set(provider, detailedStatus);
    }
  }

  private hasStatusChanged(current: LLMStatus, previous: LLMStatus | undefined): boolean {
    if (!previous) return true;
    return current.isWriting !== previous.isWriting;
  }
}
