/**
 * Electron Constants
 *
 * 앱 전반에서 사용되는 상수 정의
 * Issue #32: Magic Numbers 중앙화
 */

// ============================================================
// Debate Controller Constants
// ============================================================

/** 토론 최대 반복 횟수 (Circuit Breaker) */
export const MAX_ITERATIONS = 100;

/** 연속 빈 응답 최대 허용 횟수 (Issue #33: 3→5) */
export const MAX_CONSECUTIVE_EMPTY_RESPONSES = 5;

/** 빈 응답 시 재시도 전 대기 시간 (ms) */
export const RETRY_DELAY_MS = 2000;

// ============================================================
// Status Poller Constants
// ============================================================

/** 폴링 최소 간격 (ms) */
export const MIN_POLL_INTERVAL = 100;

/** 폴링 최대 간격 (ms) */
export const MAX_POLL_INTERVAL = 30000;

/** 폴링 기본 간격 (ms) */
export const DEFAULT_POLL_INTERVAL = 500;

/** 예상 최대 토큰 수 (진행률 계산용) */
export const ESTIMATED_MAX_TOKENS = 2000;

// ============================================================
// Adapter Timeout Constants
// ============================================================

/** 입력 준비 대기 기본 타임아웃 (ms) */
export const INPUT_READY_TIMEOUT = 10000;

/** 응답 대기 기본 타임아웃 (ms) */
export const RESPONSE_TIMEOUT = 120000;

/** 타이핑 시작 대기 타임아웃 (ms) */
export const TYPING_START_TIMEOUT = 10000;

/** 타이핑 완료 대기 최소 타임아웃 (ms) */
export const TYPING_FINISH_MIN_TIMEOUT = 5000;

// ============================================================
// Adapter Polling Constants
// ============================================================

/** 조건 대기 기본 폴링 간격 (ms) */
export const CONDITION_CHECK_INTERVAL = 500;

/** 타이핑 시작 체크 폴링 간격 (ms) */
export const TYPING_START_CHECK_INTERVAL = 300;

/** 타이핑 시작 체크 최대 시도 횟수 */
export const TYPING_START_MAX_ATTEMPTS = 30;

/** 타이핑 완료 체크 최대 시도 횟수 */
export const TYPING_FINISH_MAX_ATTEMPTS = 120;

/** 조건 대기 기본 최대 시도 횟수 */
export const DEFAULT_MAX_ATTEMPTS = 60;

// ============================================================
// DOM Stabilization Constants
// ============================================================

/** DOM 안정화 대기 시간 (ms) */
export const DOM_STABILIZATION_DELAY = 1000;

/** 최대 백오프 간격 (ms) */
export const MAX_BACKOFF_INTERVAL = 2000;

// ============================================================
// Response Validation Constants
// ============================================================

/** 유효 응답 최소 길이 (자) */
export const MIN_RESPONSE_LENGTH = 5;

/** 긴 응답 임계값 - 형식 검증 우회 (자) */
export const LONG_RESPONSE_THRESHOLD = 200;

// ============================================================
// IPC Handler Constants
// ============================================================

/** BrowserView 생성 후 대기 시간 (ms) */
export const BROWSER_VIEW_CREATION_DELAY = 500;

/** Provider 생성 후 대기 시간 (ms) */
export const PROVIDER_CREATION_DELAY = 1000;

// ============================================================
// Server Port Constants
// ============================================================

/** Vite 개발 서버 포트 */
export const DEV_SERVER_PORT = 7100;
