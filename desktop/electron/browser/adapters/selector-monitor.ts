/**
 * Selector Monitor
 *
 * Issue #43: 셀렉터 폴백 체인 시스템 고도화
 * - 셀렉터 유효성 검증
 * - 성공률 추적 및 로깅
 * - 실패 경고 이벤트
 */

import type { LLMProvider } from '../../../shared/types';
import type { SelectorSet, ProviderSelectors } from './types';
import { getSelectorSets } from './selector-config';

/** 셀렉터 사용 통계 */
export interface SelectorStats {
  selector: string;
  attempts: number;
  successes: number;
  failures: number;
  successRate: number;
  lastUsed: string | null;
  lastSuccess: string | null;
  lastFailure: string | null;
}

/** 셀렉터 세트 유효성 검증 결과 */
export interface SelectorValidationResult {
  selectorType: keyof ProviderSelectors;
  isValid: boolean;
  workingSelector: string | null;
  testedSelectors: Array<{
    selector: string;
    exists: boolean;
  }>;
  timestamp: string;
}

/** Provider 셀렉터 전체 검증 결과 */
export interface ProviderValidationResult {
  provider: LLMProvider;
  timestamp: string;
  results: SelectorValidationResult[];
  overallHealth: 'healthy' | 'degraded' | 'critical';
  workingPercentage: number;
}

/** 셀렉터 실패 이벤트 */
export interface SelectorFailureEvent {
  provider: LLMProvider;
  selectorType: keyof ProviderSelectors;
  primary: string;
  fallbacksTried: string[];
  timestamp: string;
  context?: string;
}

type SelectorFailureCallback = (event: SelectorFailureEvent) => void;

/**
 * 셀렉터 모니터 클래스
 *
 * 각 Provider의 셀렉터 사용을 추적하고 성공률을 기록합니다.
 */
export class SelectorMonitor {
  private static instance: SelectorMonitor;

  /** Provider별 셀렉터 통계 */
  private stats: Map<string, SelectorStats> = new Map();

  /** 실패 이벤트 콜백 */
  private failureCallbacks: SelectorFailureCallback[] = [];

  /** 검증 결과 캐시 */
  private validationCache: Map<LLMProvider, ProviderValidationResult> = new Map();

  private constructor() {}

  static getInstance(): SelectorMonitor {
    if (!SelectorMonitor.instance) {
      SelectorMonitor.instance = new SelectorMonitor();
    }
    return SelectorMonitor.instance;
  }

  /**
   * 셀렉터 사용 성공 기록
   */
  recordSuccess(provider: LLMProvider, selectorType: string, selector: string): void {
    const key = this.getKey(provider, selectorType, selector);
    const stats = this.getOrCreateStats(key, selector);

    stats.attempts++;
    stats.successes++;
    stats.successRate = (stats.successes / stats.attempts) * 100;
    stats.lastUsed = new Date().toISOString();
    stats.lastSuccess = stats.lastUsed;

    console.log(
      `[SelectorMonitor] Success: ${provider}/${selectorType} → ${selector} ` +
      `(${stats.successRate.toFixed(1)}% success rate)`
    );
  }

  /**
   * 셀렉터 사용 실패 기록
   */
  recordFailure(
    provider: LLMProvider,
    selectorType: string,
    selector: string,
    context?: string
  ): void {
    const key = this.getKey(provider, selectorType, selector);
    const stats = this.getOrCreateStats(key, selector);

    stats.attempts++;
    stats.failures++;
    stats.successRate = (stats.successes / stats.attempts) * 100;
    stats.lastUsed = new Date().toISOString();
    stats.lastFailure = stats.lastUsed;

    console.warn(
      `[SelectorMonitor] Failure: ${provider}/${selectorType} → ${selector} ` +
      `(${stats.successRate.toFixed(1)}% success rate)` +
      (context ? ` [${context}]` : '')
    );
  }

  /**
   * 모든 폴백 실패 시 이벤트 발생
   */
  recordAllFallbacksFailed(
    provider: LLMProvider,
    selectorType: keyof ProviderSelectors,
    selectorSet: SelectorSet,
    context?: string
  ): void {
    const event: SelectorFailureEvent = {
      provider,
      selectorType,
      primary: selectorSet.primary,
      fallbacksTried: selectorSet.fallbacks,
      timestamp: new Date().toISOString(),
      context,
    };

    console.error(
      `[SelectorMonitor] ALL FALLBACKS FAILED: ${provider}/${selectorType}\n` +
      `  Primary: ${selectorSet.primary}\n` +
      `  Fallbacks: ${selectorSet.fallbacks.join(', ')}`
    );

    // 콜백 실행
    this.failureCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('[SelectorMonitor] Callback error:', error);
      }
    });
  }

  /**
   * 실패 이벤트 리스너 등록
   */
  onFailure(callback: SelectorFailureCallback): () => void {
    this.failureCallbacks.push(callback);
    return () => {
      const index = this.failureCallbacks.indexOf(callback);
      if (index > -1) {
        this.failureCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Provider 전체 셀렉터 유효성 검증
   *
   * 각 셀렉터 타입에 대해 최소 하나의 작동하는 셀렉터가 있는지 확인
   */
  async validateProvider(
    provider: LLMProvider,
    executeScript: <T>(script: string) => Promise<T>
  ): Promise<ProviderValidationResult> {
    const selectorSets = getSelectorSets(provider);
    const results: SelectorValidationResult[] = [];
    const selectorTypes: (keyof ProviderSelectors)[] = [
      'inputTextarea',
      'sendButton',
      'stopButton',
      'responseContainer',
      'typingIndicator',
      'loginCheck',
    ];

    for (const selectorType of selectorTypes) {
      const selectorSet = selectorSets[selectorType];
      const testedSelectors: SelectorValidationResult['testedSelectors'] = [];
      let workingSelector: string | null = null;

      // Primary 먼저 테스트
      const allSelectors = [selectorSet.primary, ...selectorSet.fallbacks];

      for (const selector of allSelectors) {
        try {
          const exists = await executeScript<boolean>(
            `!!document.querySelector('${selector}')`
          );
          testedSelectors.push({ selector, exists });

          if (exists && !workingSelector) {
            workingSelector = selector;
          }
        } catch {
          testedSelectors.push({ selector, exists: false });
        }
      }

      results.push({
        selectorType,
        isValid: workingSelector !== null,
        workingSelector,
        testedSelectors,
        timestamp: new Date().toISOString(),
      });
    }

    // 전체 건강 상태 계산
    const workingCount = results.filter(r => r.isValid).length;
    const totalCount = results.length;
    const workingPercentage = (workingCount / totalCount) * 100;

    let overallHealth: ProviderValidationResult['overallHealth'];
    if (workingPercentage >= 80) {
      overallHealth = 'healthy';
    } else if (workingPercentage >= 50) {
      overallHealth = 'degraded';
    } else {
      overallHealth = 'critical';
    }

    const result: ProviderValidationResult = {
      provider,
      timestamp: new Date().toISOString(),
      results,
      overallHealth,
      workingPercentage,
    };

    // 캐시에 저장
    this.validationCache.set(provider, result);

    console.log(
      `[SelectorMonitor] Validation: ${provider} → ${overallHealth} ` +
      `(${workingPercentage.toFixed(0)}% working)`
    );

    return result;
  }

  /**
   * 캐시된 검증 결과 가져오기
   */
  getCachedValidation(provider: LLMProvider): ProviderValidationResult | null {
    return this.validationCache.get(provider) || null;
  }

  /**
   * Provider별 통계 요약 가져오기
   */
  getProviderStats(provider: LLMProvider): Map<string, SelectorStats> {
    const result = new Map<string, SelectorStats>();
    const prefix = `${provider}/`;

    this.stats.forEach((stats, key) => {
      if (key.startsWith(prefix)) {
        result.set(key.slice(prefix.length), stats);
      }
    });

    return result;
  }

  /**
   * 전체 통계 요약
   */
  getAllStats(): Record<LLMProvider, Record<string, SelectorStats>> {
    const result: Record<string, Record<string, SelectorStats>> = {};

    this.stats.forEach((stats, key) => {
      const [provider, ...rest] = key.split('/');
      const selectorKey = rest.join('/');

      if (!result[provider]) {
        result[provider] = {};
      }
      result[provider][selectorKey] = stats;
    });

    return result as Record<LLMProvider, Record<string, SelectorStats>>;
  }

  /**
   * 성공률이 낮은 셀렉터 목록
   */
  getLowPerformingSelectors(threshold: number = 50): SelectorStats[] {
    return Array.from(this.stats.values())
      .filter(stats => stats.attempts > 0 && stats.successRate < threshold)
      .sort((a, b) => a.successRate - b.successRate);
  }

  /**
   * 통계 리셋
   */
  reset(): void {
    this.stats.clear();
    this.validationCache.clear();
    console.log('[SelectorMonitor] Stats reset');
  }

  /**
   * 통계 JSON 내보내기
   */
  exportStats(): string {
    return JSON.stringify({
      stats: Object.fromEntries(this.stats),
      validationCache: Object.fromEntries(this.validationCache),
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }

  private getKey(provider: LLMProvider, selectorType: string, selector: string): string {
    // 셀렉터 자체를 해시하여 짧게 만듦
    const selectorHash = selector.slice(0, 30).replace(/[^\w]/g, '_');
    return `${provider}/${selectorType}/${selectorHash}`;
  }

  private getOrCreateStats(key: string, selector: string): SelectorStats {
    let stats = this.stats.get(key);
    if (!stats) {
      stats = {
        selector,
        attempts: 0,
        successes: 0,
        failures: 0,
        successRate: 0,
        lastUsed: null,
        lastSuccess: null,
        lastFailure: null,
      };
      this.stats.set(key, stats);
    }
    return stats;
  }
}

// 싱글톤 인스턴스 내보내기
export const selectorMonitor = SelectorMonitor.getInstance();
