/**
 * Circuit Breaker Pattern
 *
 * Issue #45: Circuit Breaker 패턴 고도화
 * - 상태 기반: Open/Half-Open/Closed 전이
 * - Provider별 독립 브레이커
 * - 점진적 복구 (exponential backoff)
 * - 상태 이벤트 발생
 */

import type { LLMProvider } from '../../shared/types';

/** Circuit Breaker 상태 */
export type CircuitState = 'closed' | 'open' | 'half-open';

/** Circuit Breaker 이벤트 */
export interface CircuitBreakerEvent {
  provider: LLMProvider;
  previousState: CircuitState;
  newState: CircuitState;
  reason: string;
  timestamp: string;
  metrics: CircuitMetrics;
}

/** Circuit Breaker 메트릭 */
export interface CircuitMetrics {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureTime: string | null;
  lastSuccessTime: string | null;
  lastStateChange: string;
  successRate: number;
}

/** Circuit Breaker 설정 */
export interface CircuitBreakerConfig {
  /** 서킷이 열리는 연속 실패 횟수 (기본: 5) */
  failureThreshold: number;
  /** 서킷 열린 후 half-open 전환 대기 시간 (ms, 기본: 30000) */
  resetTimeout: number;
  /** half-open 상태에서 닫히는 연속 성공 횟수 (기본: 2) */
  successThreshold: number;
  /** 최대 대기 시간 (ms, 기본: 300000 = 5분) */
  maxResetTimeout: number;
  /** 대기 시간 증가 배율 (기본: 2) */
  backoffMultiplier: number;
}

type StateChangeCallback = (event: CircuitBreakerEvent) => void;

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 30000,
  successThreshold: 2,
  maxResetTimeout: 300000,
  backoffMultiplier: 2,
};

/**
 * Circuit Breaker 인스턴스
 *
 * 단일 Provider에 대한 Circuit Breaker 상태를 관리합니다.
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private metrics: CircuitMetrics;
  private config: CircuitBreakerConfig;
  private currentResetTimeout: number;
  private resetTimer: ReturnType<typeof setTimeout> | null = null;
  private callbacks: StateChangeCallback[] = [];

  constructor(
    public readonly provider: LLMProvider,
    config: Partial<CircuitBreakerConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentResetTimeout = this.config.resetTimeout;
    this.metrics = this.createInitialMetrics();
  }

  private createInitialMetrics(): CircuitMetrics {
    return {
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      lastFailureTime: null,
      lastSuccessTime: null,
      lastStateChange: new Date().toISOString(),
      successRate: 100,
    };
  }

  /**
   * 현재 상태 조회
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * 메트릭 조회
   */
  getMetrics(): CircuitMetrics {
    return { ...this.metrics };
  }

  /**
   * 요청 가능 여부 확인
   *
   * - closed: 항상 가능
   * - half-open: 가능 (테스트 요청)
   * - open: 불가능
   */
  canRequest(): boolean {
    return this.state !== 'open';
  }

  /**
   * 성공 기록
   */
  recordSuccess(): void {
    this.metrics.totalRequests++;
    this.metrics.successCount++;
    this.metrics.consecutiveSuccesses++;
    this.metrics.consecutiveFailures = 0;
    this.metrics.lastSuccessTime = new Date().toISOString();
    this.updateSuccessRate();

    console.log(`[CircuitBreaker:${this.provider}] Success recorded. ` +
      `Consecutive: ${this.metrics.consecutiveSuccesses}, State: ${this.state}`);

    if (this.state === 'half-open') {
      if (this.metrics.consecutiveSuccesses >= this.config.successThreshold) {
        this.transitionTo('closed', 'Success threshold reached');
        // 복구 시 타임아웃 리셋
        this.currentResetTimeout = this.config.resetTimeout;
      }
    }
  }

  /**
   * 실패 기록
   */
  recordFailure(reason?: string): void {
    this.metrics.totalRequests++;
    this.metrics.failureCount++;
    this.metrics.consecutiveFailures++;
    this.metrics.consecutiveSuccesses = 0;
    this.metrics.lastFailureTime = new Date().toISOString();
    this.updateSuccessRate();

    console.warn(`[CircuitBreaker:${this.provider}] Failure recorded. ` +
      `Consecutive: ${this.metrics.consecutiveFailures}, Reason: ${reason || 'unknown'}`);

    if (this.state === 'closed') {
      if (this.metrics.consecutiveFailures >= this.config.failureThreshold) {
        this.transitionTo('open', `${this.config.failureThreshold} consecutive failures`);
        this.scheduleReset();
      }
    } else if (this.state === 'half-open') {
      // half-open에서 실패하면 다시 open으로
      this.transitionTo('open', 'Failed during half-open test');
      // 대기 시간 증가 (exponential backoff)
      this.currentResetTimeout = Math.min(
        this.currentResetTimeout * this.config.backoffMultiplier,
        this.config.maxResetTimeout
      );
      this.scheduleReset();
    }
  }

  /**
   * 상태 전이
   */
  private transitionTo(newState: CircuitState, reason: string): void {
    const previousState = this.state;
    if (previousState === newState) return;

    this.state = newState;
    this.metrics.lastStateChange = new Date().toISOString();

    console.log(`[CircuitBreaker:${this.provider}] State transition: ` +
      `${previousState} → ${newState} (${reason})`);

    const event: CircuitBreakerEvent = {
      provider: this.provider,
      previousState,
      newState,
      reason,
      timestamp: this.metrics.lastStateChange,
      metrics: this.getMetrics(),
    };

    // 콜백 실행
    this.callbacks.forEach(cb => {
      try {
        cb(event);
      } catch (error) {
        console.error(`[CircuitBreaker:${this.provider}] Callback error:`, error);
      }
    });
  }

  /**
   * 리셋 타이머 예약
   */
  private scheduleReset(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }

    console.log(`[CircuitBreaker:${this.provider}] Scheduling reset in ${this.currentResetTimeout}ms`);

    this.resetTimer = setTimeout(() => {
      if (this.state === 'open') {
        this.transitionTo('half-open', 'Reset timeout elapsed');
      }
    }, this.currentResetTimeout);
  }

  /**
   * 성공률 업데이트
   */
  private updateSuccessRate(): void {
    if (this.metrics.totalRequests === 0) {
      this.metrics.successRate = 100;
    } else {
      this.metrics.successRate = Math.round(
        (this.metrics.successCount / this.metrics.totalRequests) * 100
      );
    }
  }

  /**
   * 상태 변경 리스너 등록
   */
  onStateChange(callback: StateChangeCallback): () => void {
    this.callbacks.push(callback);
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  /**
   * 수동으로 서킷 열기
   */
  trip(reason: string = 'Manual trip'): void {
    if (this.state !== 'open') {
      this.transitionTo('open', reason);
      this.scheduleReset();
    }
  }

  /**
   * 수동으로 서킷 닫기
   */
  reset(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }

    this.transitionTo('closed', 'Manual reset');
    this.currentResetTimeout = this.config.resetTimeout;
    this.metrics.consecutiveFailures = 0;
    this.metrics.consecutiveSuccesses = 0;
  }

  /**
   * 정리
   */
  dispose(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
    this.callbacks = [];
  }
}

/**
 * Circuit Breaker Manager
 *
 * 모든 Provider의 Circuit Breaker를 관리합니다.
 */
export class CircuitBreakerManager {
  private static instance: CircuitBreakerManager;
  private breakers: Map<LLMProvider, CircuitBreaker> = new Map();
  private globalCallbacks: StateChangeCallback[] = [];
  private config: CircuitBreakerConfig;

  private constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  static getInstance(config?: Partial<CircuitBreakerConfig>): CircuitBreakerManager {
    if (!CircuitBreakerManager.instance) {
      CircuitBreakerManager.instance = new CircuitBreakerManager(config);
    }
    return CircuitBreakerManager.instance;
  }

  /**
   * Provider용 Circuit Breaker 가져오기
   */
  getBreaker(provider: LLMProvider): CircuitBreaker {
    let breaker = this.breakers.get(provider);
    if (!breaker) {
      breaker = new CircuitBreaker(provider, this.config);

      // 글로벌 콜백 연결
      this.globalCallbacks.forEach(cb => {
        breaker!.onStateChange(cb);
      });

      this.breakers.set(provider, breaker);
    }
    return breaker;
  }

  /**
   * 모든 브레이커 상태 조회
   */
  getAllStates(): Record<LLMProvider, { state: CircuitState; metrics: CircuitMetrics }> {
    const result: Record<string, { state: CircuitState; metrics: CircuitMetrics }> = {};

    this.breakers.forEach((breaker, provider) => {
      result[provider] = {
        state: breaker.getState(),
        metrics: breaker.getMetrics(),
      };
    });

    return result as Record<LLMProvider, { state: CircuitState; metrics: CircuitMetrics }>;
  }

  /**
   * 모든 브레이커의 상태 변경 리스너 등록
   */
  onAnyStateChange(callback: StateChangeCallback): () => void {
    this.globalCallbacks.push(callback);

    // 기존 브레이커에도 등록
    this.breakers.forEach(breaker => {
      breaker.onStateChange(callback);
    });

    return () => {
      const index = this.globalCallbacks.indexOf(callback);
      if (index > -1) {
        this.globalCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * 모든 브레이커 리셋
   */
  resetAll(): void {
    this.breakers.forEach(breaker => {
      breaker.reset();
    });
  }

  /**
   * 특정 Provider 브레이커 리셋
   */
  resetProvider(provider: LLMProvider): void {
    const breaker = this.breakers.get(provider);
    if (breaker) {
      breaker.reset();
    }
  }

  /**
   * 정리
   */
  dispose(): void {
    this.breakers.forEach(breaker => {
      breaker.dispose();
    });
    this.breakers.clear();
    this.globalCallbacks = [];
  }

  /**
   * 통계 요약
   */
  getSummary(): {
    totalProviders: number;
    closedCount: number;
    openCount: number;
    halfOpenCount: number;
  } {
    let closedCount = 0;
    let openCount = 0;
    let halfOpenCount = 0;

    this.breakers.forEach(breaker => {
      switch (breaker.getState()) {
        case 'closed':
          closedCount++;
          break;
        case 'open':
          openCount++;
          break;
        case 'half-open':
          halfOpenCount++;
          break;
      }
    });

    return {
      totalProviders: this.breakers.size,
      closedCount,
      openCount,
      halfOpenCount,
    };
  }
}

// 싱글톤 내보내기
export const circuitBreakerManager = CircuitBreakerManager.getInstance();
