/**
 * JSON Exporter
 *
 * Issue #25: 세션을 JSON 형식으로 내보내기
 * P2: 부분 내보내기 지원
 */

import * as fs from 'fs';
import * as path from 'path';
import type { SessionRecord, ExportOptions, JsonExportResult, PartialExportOptions } from '../types';

/**
 * 세션을 JSON 형식으로 내보내기
 */
export function exportToJson(
  session: SessionRecord,
  options: ExportOptions = {}
): string {
  const { indent = 2, includeMetadata = true } = options;

  const result: JsonExportResult = {
    session: {
      id: session.id,
      debateId: session.debateId,
      startedAt: formatDate(session.startedAt, options.dateFormat),
      endedAt: session.endedAt ? formatDate(session.endedAt, options.dateFormat) : undefined,
      status: session.status,
    },
    config: session.config,
    messages: session.messages.map((msg) => ({
      ...msg,
      timestamp: formatDate(msg.timestamp, options.dateFormat),
    })),
    elements: session.elements,
    metadata: includeMetadata ? session.metadata : ({} as typeof session.metadata),
  };

  return JSON.stringify(result, null, indent);
}

/**
 * 세션을 JSON 파일로 저장
 */
export async function exportToJsonFile(
  session: SessionRecord,
  outputPath: string,
  options: ExportOptions = {}
): Promise<void> {
  const json = exportToJson(session, options);

  // 디렉토리가 없으면 생성
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, json, 'utf-8');
  console.log(`[JsonExporter] Exported session to: ${outputPath}`);
}

/**
 * 기본 내보내기 파일명 생성
 */
export function getDefaultJsonFilename(session: SessionRecord): string {
  const date = new Date(session.startedAt);
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = date.toISOString().slice(11, 19).replace(/:/g, '');
  return `mad-session-${dateStr}-${timeStr}-${session.id.slice(-6)}.json`;
}

/**
 * 부분 내보내기 (P2)
 * 특정 iteration, provider, role, 시간 범위로 필터링
 */
export function exportToJsonPartial(
  session: SessionRecord,
  options: PartialExportOptions = {}
): string {
  const { indent = 2, includeMetadata = true, iterations, providers, roles, fromTime, toTime } = options;

  // 메시지 필터링
  let filteredMessages = session.messages;

  if (iterations && iterations.length > 0) {
    filteredMessages = filteredMessages.filter((msg) => iterations.includes(msg.iteration));
  }

  if (providers && providers.length > 0) {
    filteredMessages = filteredMessages.filter((msg) => providers.includes(msg.provider));
  }

  if (roles && roles.length > 0) {
    filteredMessages = filteredMessages.filter((msg) => roles.includes(msg.role));
  }

  if (fromTime) {
    const fromDate = new Date(fromTime).getTime();
    filteredMessages = filteredMessages.filter((msg) => new Date(msg.timestamp).getTime() >= fromDate);
  }

  if (toTime) {
    const toDate = new Date(toTime).getTime();
    filteredMessages = filteredMessages.filter((msg) => new Date(msg.timestamp).getTime() <= toDate);
  }

  // 필터링된 메타데이터 재계산
  const filteredMetadata = {
    totalTokens: filteredMessages.reduce((sum, msg) => sum + (msg.tokenCount || 0), 0),
    totalIterations: Math.max(0, ...filteredMessages.map((msg) => msg.iteration)),
    providersUsed: [...new Set(filteredMessages.map((msg) => msg.provider))],
    completionReason: session.metadata.completionReason,
  };

  const result: JsonExportResult = {
    session: {
      id: session.id,
      debateId: session.debateId,
      startedAt: formatDate(session.startedAt, options.dateFormat),
      endedAt: session.endedAt ? formatDate(session.endedAt, options.dateFormat) : undefined,
      status: session.status,
    },
    config: session.config,
    messages: filteredMessages.map((msg) => ({
      ...msg,
      timestamp: formatDate(msg.timestamp, options.dateFormat),
    })),
    elements: session.elements,
    metadata: includeMetadata ? filteredMetadata : ({} as typeof session.metadata),
  };

  return JSON.stringify(result, null, indent);
}

/**
 * 부분 내보내기를 파일로 저장 (P2)
 */
export async function exportToJsonFilePartial(
  session: SessionRecord,
  outputPath: string,
  options: PartialExportOptions = {}
): Promise<void> {
  const json = exportToJsonPartial(session, options);

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, json, 'utf-8');
  console.log(`[JsonExporter] Exported partial session to: ${outputPath}`);
}

/**
 * 날짜 형식 변환
 */
function formatDate(
  dateStr: string,
  format: ExportOptions['dateFormat'] = 'ISO'
): string {
  const date = new Date(dateStr);

  switch (format) {
    case 'locale':
      return date.toLocaleString();
    case 'unix':
      return String(Math.floor(date.getTime() / 1000));
    case 'ISO':
    default:
      return date.toISOString();
  }
}
