/**
 * Adaptive Timeout Manager
 *
 * Issue #46: 타임아웃 전략 적응형 개선
 * - 이전 응답 시간 기반 동적 조정
 * - Provider별 프로파일 학습
 * - 예상 완료 시간 계산
 */

import type { LLMProvider } from '../../shared/types';
import {
  RESPONSE_TIMEOUT,
  INPUT_READY_TIMEOUT,
} from '../constants';

/** 응답 시간 기록 */
export interface ResponseTimeRecord {
  provider: LLMProvider;
  timestamp: string;
  responseTimeMs: number;
  promptLength: number;
  responseLength: number;
  success: boolean;
}

/** Provider 프로파일 */
export interface ProviderProfile {
  provider: LLMProvider;
  sampleCount: number;
  averageResponseTimeMs: number;
  minResponseTimeMs: number;
  maxResponseTimeMs: number;
  p50ResponseTimeMs: number;
  p90ResponseTimeMs: number;
  p99ResponseTimeMs: number;
  successRate: number;
  lastUpdated: string;
  /** 평균 응답 속도 (chars/sec) */
  averageResponseSpeed: number;
}

/** 타임아웃 예측 결과 */
export interface TimeoutPrediction {
  provider: LLMProvider;
  recommendedTimeoutMs: number;
  estimatedResponseTimeMs: number;
  confidence: 'high' | 'medium' | 'low';
  basedOnSamples: number;
  reason: string;
}

/** 타임아웃 설정 */
export interface AdaptiveTimeoutConfig {
  /** 최소 타임아웃 (ms) */
  minTimeout: number;
  /** 최대 타임아웃 (ms) */
  maxTimeout: number;
  /** 안전 마진 배율 (권장 시간 * margin) */
  safetyMargin: number;
  /** 최소 샘플 수 (이 이하면 기본값 사용) */
  minSamples: number;
  /** 최대 기록 수 (오래된 것 제거) */
  maxHistory: number;
  /** 기본 입력 타임아웃 (ms) */
  defaultInputTimeout: number;
  /** 기본 응답 타임아웃 (ms) */
  defaultResponseTimeout: number;
}

const DEFAULT_CONFIG: AdaptiveTimeoutConfig = {
  minTimeout: 5000,
  maxTimeout: 300000, // 5분
  safetyMargin: 1.5,
  minSamples: 3,
  maxHistory: 100,
  defaultInputTimeout: INPUT_READY_TIMEOUT,
  defaultResponseTimeout: RESPONSE_TIMEOUT,
};

/**
 * 적응형 타임아웃 매니저
 *
 * Provider별 응답 시간을 학습하고 최적 타임아웃을 계산합니다.
 */
export class AdaptiveTimeoutManager {
  private static instance: AdaptiveTimeoutManager;

  /** Provider별 응답 시간 기록 */
  private history: Map<LLMProvider, ResponseTimeRecord[]> = new Map();

  /** Provider별 프로파일 캐시 */
  private profileCache: Map<LLMProvider, ProviderProfile> = new Map();

  private config: AdaptiveTimeoutConfig;

  private constructor(config: Partial<AdaptiveTimeoutConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  static getInstance(config?: Partial<AdaptiveTimeoutConfig>): AdaptiveTimeoutManager {
    if (!AdaptiveTimeoutManager.instance) {
      AdaptiveTimeoutManager.instance = new AdaptiveTimeoutManager(config);
    }
    return AdaptiveTimeoutManager.instance;
  }

  /**
   * 응답 시간 기록
   */
  recordResponseTime(
    provider: LLMProvider,
    responseTimeMs: number,
    promptLength: number,
    responseLength: number,
    success: boolean
  ): void {
    const record: ResponseTimeRecord = {
      provider,
      timestamp: new Date().toISOString(),
      responseTimeMs,
      promptLength,
      responseLength,
      success,
    };

    let records = this.history.get(provider);
    if (!records) {
      records = [];
      this.history.set(provider, records);
    }

    records.push(record);

    // 최대 기록 수 제한
    if (records.length > this.config.maxHistory) {
      records.shift();
    }

    // 프로파일 캐시 무효화
    this.profileCache.delete(provider);

    console.log(
      `[AdaptiveTimeout] Recorded: ${provider} ${responseTimeMs}ms ` +
      `(prompt: ${promptLength}, response: ${responseLength}, success: ${success})`
    );
  }

  /**
   * Provider 프로파일 조회
   */
  getProfile(provider: LLMProvider): ProviderProfile | null {
    // 캐시된 프로파일 확인
    const cached = this.profileCache.get(provider);
    if (cached) {
      return cached;
    }

    const records = this.history.get(provider);
    if (!records || records.length === 0) {
      return null;
    }

    // 성공한 기록만 사용
    const successRecords = records.filter(r => r.success);
    if (successRecords.length === 0) {
      return null;
    }

    // 응답 시간 정렬
    const times = successRecords.map(r => r.responseTimeMs).sort((a, b) => a - b);

    // 통계 계산
    const sum = times.reduce((a, b) => a + b, 0);
    const avg = sum / times.length;

    // 평균 응답 속도 계산
    const totalChars = successRecords.reduce((sum, r) => sum + r.responseLength, 0);
    const totalTime = successRecords.reduce((sum, r) => sum + r.responseTimeMs, 0);
    const avgSpeed = totalTime > 0 ? (totalChars / totalTime) * 1000 : 0; // chars/sec

    const profile: ProviderProfile = {
      provider,
      sampleCount: successRecords.length,
      averageResponseTimeMs: Math.round(avg),
      minResponseTimeMs: times[0],
      maxResponseTimeMs: times[times.length - 1],
      p50ResponseTimeMs: this.percentile(times, 50),
      p90ResponseTimeMs: this.percentile(times, 90),
      p99ResponseTimeMs: this.percentile(times, 99),
      successRate: Math.round((successRecords.length / records.length) * 100),
      lastUpdated: new Date().toISOString(),
      averageResponseSpeed: Math.round(avgSpeed),
    };

    // 캐시에 저장
    this.profileCache.set(provider, profile);

    return profile;
  }

  /**
   * 타임아웃 예측
   */
  predictTimeout(
    provider: LLMProvider,
    promptLength?: number
  ): TimeoutPrediction {
    const profile = this.getProfile(provider);

    // 샘플이 부족하면 기본값 사용
    if (!profile || profile.sampleCount < this.config.minSamples) {
      return {
        provider,
        recommendedTimeoutMs: this.config.defaultResponseTimeout,
        estimatedResponseTimeMs: this.config.defaultResponseTimeout / 2,
        confidence: 'low',
        basedOnSamples: profile?.sampleCount || 0,
        reason: `샘플 부족 (${profile?.sampleCount || 0}/${this.config.minSamples}), 기본값 사용`,
      };
    }

    // p90 기반 타임아웃 계산 (90%의 요청이 이 시간 내에 완료)
    let estimatedTime = profile.p90ResponseTimeMs;

    // 프롬프트 길이 기반 조정 (선택적)
    if (promptLength && profile.averageResponseSpeed > 0) {
      // 예상 응답 길이 추정 (프롬프트의 2배 정도로 가정)
      const estimatedResponseLength = promptLength * 2;
      const timeBasedOnSpeed = (estimatedResponseLength / profile.averageResponseSpeed) * 1000;
      estimatedTime = Math.max(estimatedTime, timeBasedOnSpeed);
    }

    // 안전 마진 적용
    let recommendedTimeout = Math.round(estimatedTime * this.config.safetyMargin);

    // 범위 제한
    recommendedTimeout = Math.max(recommendedTimeout, this.config.minTimeout);
    recommendedTimeout = Math.min(recommendedTimeout, this.config.maxTimeout);

    // 신뢰도 결정
    let confidence: 'high' | 'medium' | 'low';
    if (profile.sampleCount >= 10 && profile.successRate >= 80) {
      confidence = 'high';
    } else if (profile.sampleCount >= 5 && profile.successRate >= 60) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    return {
      provider,
      recommendedTimeoutMs: recommendedTimeout,
      estimatedResponseTimeMs: Math.round(estimatedTime),
      confidence,
      basedOnSamples: profile.sampleCount,
      reason: `p90=${profile.p90ResponseTimeMs}ms, 마진=${this.config.safetyMargin}x`,
    };
  }

  /**
   * 예상 완료 시간 계산
   */
  estimateCompletionTime(
    provider: LLMProvider,
    elapsedMs: number,
    currentResponseLength: number
  ): {
    estimatedTotalMs: number;
    estimatedRemainingMs: number;
    progress: number;
    confidence: 'high' | 'medium' | 'low';
  } {
    const profile = this.getProfile(provider);

    if (!profile || profile.sampleCount < this.config.minSamples) {
      // 기본 추정 (평균 응답 시간 기준)
      const defaultTotal = this.config.defaultResponseTimeout / 2;
      const progress = Math.min((elapsedMs / defaultTotal) * 100, 95);
      return {
        estimatedTotalMs: defaultTotal,
        estimatedRemainingMs: Math.max(defaultTotal - elapsedMs, 0),
        progress: Math.round(progress),
        confidence: 'low',
      };
    }

    // 응답 속도 기반 추정
    if (currentResponseLength > 0 && elapsedMs > 1000) {
      const currentSpeed = (currentResponseLength / elapsedMs) * 1000; // chars/sec

      // 평균 응답 길이 추정
      const avgResponseLength = this.getAverageResponseLength(provider);
      if (avgResponseLength > 0) {
        const estimatedTotal = (avgResponseLength / currentSpeed) * 1000;
        const progress = Math.min((currentResponseLength / avgResponseLength) * 100, 95);

        return {
          estimatedTotalMs: Math.round(estimatedTotal),
          estimatedRemainingMs: Math.max(Math.round(estimatedTotal - elapsedMs), 0),
          progress: Math.round(progress),
          confidence: 'medium',
        };
      }
    }

    // 시간 기반 추정
    const estimatedTotal = profile.averageResponseTimeMs;
    const progress = Math.min((elapsedMs / estimatedTotal) * 100, 95);

    return {
      estimatedTotalMs: estimatedTotal,
      estimatedRemainingMs: Math.max(estimatedTotal - elapsedMs, 0),
      progress: Math.round(progress),
      confidence: profile.sampleCount >= 10 ? 'high' : 'medium',
    };
  }

  /**
   * 평균 응답 길이 조회
   */
  private getAverageResponseLength(provider: LLMProvider): number {
    const records = this.history.get(provider);
    if (!records || records.length === 0) {
      return 0;
    }

    const successRecords = records.filter(r => r.success && r.responseLength > 0);
    if (successRecords.length === 0) {
      return 0;
    }

    const total = successRecords.reduce((sum, r) => sum + r.responseLength, 0);
    return Math.round(total / successRecords.length);
  }

  /**
   * 백분위 계산
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0];

    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (lower === upper) {
      return sorted[lower];
    }

    return Math.round(sorted[lower] * (1 - weight) + sorted[upper] * weight);
  }

  /**
   * 모든 프로파일 조회
   */
  getAllProfiles(): Record<LLMProvider, ProviderProfile> {
    const result: Partial<Record<LLMProvider, ProviderProfile>> = {};

    this.history.forEach((_, provider) => {
      const profile = this.getProfile(provider);
      if (profile) {
        result[provider] = profile;
      }
    });

    return result as Record<LLMProvider, ProviderProfile>;
  }

  /**
   * 통계 요약
   */
  getSummary(): {
    totalRecords: number;
    providers: LLMProvider[];
    avgResponseTimeByProvider: Record<LLMProvider, number>;
  } {
    let totalRecords = 0;
    const providers: LLMProvider[] = [];
    const avgResponseTimeByProvider: Partial<Record<LLMProvider, number>> = {};

    this.history.forEach((records, provider) => {
      totalRecords += records.length;
      providers.push(provider);

      const profile = this.getProfile(provider);
      if (profile) {
        avgResponseTimeByProvider[provider] = profile.averageResponseTimeMs;
      }
    });

    return {
      totalRecords,
      providers,
      avgResponseTimeByProvider: avgResponseTimeByProvider as Record<LLMProvider, number>,
    };
  }

  /**
   * 기록 초기화
   */
  reset(): void {
    this.history.clear();
    this.profileCache.clear();
    console.log('[AdaptiveTimeout] History reset');
  }

  /**
   * Provider별 기록 초기화
   */
  resetProvider(provider: LLMProvider): void {
    this.history.delete(provider);
    this.profileCache.delete(provider);
    console.log(`[AdaptiveTimeout] Reset: ${provider}`);
  }

  /**
   * 기록 JSON 내보내기
   */
  exportHistory(): string {
    const data: Record<LLMProvider, ResponseTimeRecord[]> = {};

    this.history.forEach((records, provider) => {
      data[provider] = records;
    });

    return JSON.stringify({
      history: data,
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }

  /**
   * 기록 JSON 가져오기
   */
  importHistory(json: string): void {
    try {
      const data = JSON.parse(json);
      if (data.history) {
        Object.entries(data.history).forEach(([provider, records]) => {
          this.history.set(provider as LLMProvider, records as ResponseTimeRecord[]);
        });
        this.profileCache.clear();
        console.log('[AdaptiveTimeout] History imported');
      }
    } catch (error) {
      console.error('[AdaptiveTimeout] Import failed:', error);
    }
  }
}

// 싱글톤 내보내기
export const adaptiveTimeoutManager = AdaptiveTimeoutManager.getInstance();
