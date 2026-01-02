/**
 * Centralized Logger
 *
 * electron-log 래퍼로 프로젝트 전용 설정 적용
 * - 파일 로깅: %APPDATA%/mad-desktop/logs/
 * - 로그 회전: 5MB x 5 파일
 * - 스코프별 prefix 지원
 */

import log from 'electron-log';
import path from 'path';
import { app } from 'electron';

// 로그 파일 경로 설정 (app.getPath는 함수 호출 시점에 실행되어 app ready 이후 호출됨)
let logPath: string | null = null;
log.transports.file.resolvePathFn = () => {
  if (!logPath) {
    logPath = path.join(app.getPath('userData'), 'logs', 'mad-desktop.log');
  }
  return logPath;
};

// 로그 회전: 5MB 최대
log.transports.file.maxSize = 5 * 1024 * 1024;

// 로그 포맷
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
log.transports.console.format = '[{h}:{i}:{s}] [{level}] {text}';

// 기본 로그 레벨
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

// 설정된 logger export
export const logger = log;

// 편의 함수 export
export const info = log.info.bind(log);
export const warn = log.warn.bind(log);
export const error = log.error.bind(log);
export const debug = log.debug.bind(log);

/**
 * 스코프별 로거 생성
 * @param scope 모듈/컴포넌트 이름
 */
export function createScopedLogger(scope: string) {
  return {
    info: (msg: string, ...args: unknown[]) => log.info(`[${scope}] ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) => log.warn(`[${scope}] ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => log.error(`[${scope}] ${msg}`, ...args),
    debug: (msg: string, ...args: unknown[]) => log.debug(`[${scope}] ${msg}`, ...args),
  };
}

/**
 * 로그 파일 경로 반환
 */
export function getLogPath(): string {
  return log.transports.file.getFile().path;
}
