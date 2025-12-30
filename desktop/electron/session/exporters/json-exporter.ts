/**
 * JSON Exporter
 *
 * Issue #25: 세션을 JSON 형식으로 내보내기
 */

import * as fs from 'fs';
import * as path from 'path';
import type { SessionRecord, ExportOptions, JsonExportResult } from '../types';

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
