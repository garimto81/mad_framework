/**
 * SessionRepository - SQLite 기반 세션 영구 저장소
 *
 * Issue #25 P2: 세션 데이터를 SQLite에 저장하여 앱 재시작 후에도 유지
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import { app } from 'electron';
import type { SessionRecord, MessageRecord, SessionMetadata } from './types';
import type { DebateConfig, DebateElement, LLMProvider } from '../../shared/types';

export interface SessionQueryOptions {
  includeMessages?: boolean;
  limit?: number;
  offset?: number;
}

export interface SessionSearchOptions {
  query?: string;
  preset?: string;
  status?: SessionRecord['status'];
  provider?: LLMProvider;
  startDate?: string;
  endDate?: string;
}

export class SessionRepository {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const defaultPath = app?.getPath
      ? path.join(app.getPath('userData'), 'sessions.db')
      : dbPath || ':memory:';

    this.db = new Database(dbPath || defaultPath);
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        debate_id TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        status TEXT NOT NULL,
        config_json TEXT NOT NULL,
        elements_json TEXT NOT NULL DEFAULT '[]',
        metadata_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        provider TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        token_count INTEGER,
        iteration INTEGER NOT NULL,
        element_id TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
    `);

    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');
  }

  saveSession(session: SessionRecord): void {
    const upsert = this.db.prepare(`
      INSERT INTO sessions (id, debate_id, started_at, ended_at, status, config_json, elements_json, metadata_json)
      VALUES (@id, @debateId, @startedAt, @endedAt, @status, @configJson, @elementsJson, @metadataJson)
      ON CONFLICT(id) DO UPDATE SET
        debate_id = @debateId,
        started_at = @startedAt,
        ended_at = @endedAt,
        status = @status,
        config_json = @configJson,
        elements_json = @elementsJson,
        metadata_json = @metadataJson
    `);

    const deleteMessages = this.db.prepare('DELETE FROM messages WHERE session_id = ?');
    const insertMessage = this.db.prepare(`
      INSERT INTO messages (id, session_id, timestamp, provider, role, content, token_count, iteration, element_id)
      VALUES (@id, @sessionId, @timestamp, @provider, @role, @content, @tokenCount, @iteration, @elementId)
    `);

    const transaction = this.db.transaction(() => {
      upsert.run({
        id: session.id,
        debateId: session.debateId,
        startedAt: session.startedAt,
        endedAt: session.endedAt || null,
        status: session.status,
        configJson: JSON.stringify(session.config),
        elementsJson: JSON.stringify(session.elements),
        metadataJson: JSON.stringify(session.metadata),
      });

      // 메시지 재저장
      deleteMessages.run(session.id);
      for (const message of session.messages) {
        insertMessage.run({
          id: message.id,
          sessionId: session.id,
          timestamp: message.timestamp,
          provider: message.provider,
          role: message.role,
          content: message.content,
          tokenCount: message.tokenCount || null,
          iteration: message.iteration,
          elementId: message.elementId || null,
        });
      }
    });

    transaction();
  }

  getSession(sessionId: string): SessionRecord | null {
    const session = this.db
      .prepare(
        `SELECT id, debate_id, started_at, ended_at, status, config_json, elements_json, metadata_json
         FROM sessions WHERE id = ?`
      )
      .get(sessionId) as
      | {
          id: string;
          debate_id: string;
          started_at: string;
          ended_at: string | null;
          status: string;
          config_json: string;
          elements_json: string;
          metadata_json: string;
        }
      | undefined;

    if (!session) return null;

    const messages = this.db
      .prepare(
        `SELECT id, timestamp, provider, role, content, token_count, iteration, element_id
         FROM messages WHERE session_id = ? ORDER BY timestamp ASC`
      )
      .all(sessionId) as Array<{
      id: string;
      timestamp: string;
      provider: string;
      role: string;
      content: string;
      token_count: number | null;
      iteration: number;
      element_id: string | null;
    }>;

    return this.mapSessionRow(session, messages);
  }

  getAllSessions(options: SessionQueryOptions = {}): SessionRecord[] {
    const { includeMessages = false, limit, offset } = options;

    let query = `
      SELECT id, debate_id, started_at, ended_at, status, config_json, elements_json, metadata_json
      FROM sessions ORDER BY started_at DESC
    `;

    if (limit) {
      query += ` LIMIT ${limit}`;
      if (offset) {
        query += ` OFFSET ${offset}`;
      }
    }

    const rows = this.db.prepare(query).all() as Array<{
      id: string;
      debate_id: string;
      started_at: string;
      ended_at: string | null;
      status: string;
      config_json: string;
      elements_json: string;
      metadata_json: string;
    }>;

    return rows.map((row) => {
      const messages = includeMessages ? this.getMessagesForSession(row.id) : [];
      return this.mapSessionRow(row, messages);
    });
  }

  deleteSession(sessionId: string): boolean {
    const result = this.db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    return result.changes > 0;
  }

  searchSessions(options: SessionSearchOptions): SessionRecord[] {
    const conditions: string[] = [];
    const params: Record<string, string> = {};

    if (options.query) {
      conditions.push(`(
        config_json LIKE @query
        OR EXISTS (SELECT 1 FROM messages m WHERE m.session_id = sessions.id AND m.content LIKE @query)
      )`);
      params.query = `%${options.query}%`;
    }

    if (options.preset) {
      conditions.push(`json_extract(config_json, '$.preset') = @preset`);
      params.preset = options.preset;
    }

    if (options.status) {
      conditions.push('status = @status');
      params.status = options.status;
    }

    if (options.provider) {
      conditions.push(`json_extract(metadata_json, '$.providersUsed') LIKE @provider`);
      params.provider = `%${options.provider}%`;
    }

    if (options.startDate) {
      conditions.push('started_at >= @startDate');
      params.startDate = options.startDate;
    }

    if (options.endDate) {
      conditions.push('started_at <= @endDate');
      params.endDate = options.endDate;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT id, debate_id, started_at, ended_at, status, config_json, elements_json, metadata_json
      FROM sessions ${whereClause} ORDER BY started_at DESC
    `;

    const rows = this.db.prepare(query).all(params) as Array<{
      id: string;
      debate_id: string;
      started_at: string;
      ended_at: string | null;
      status: string;
      config_json: string;
      elements_json: string;
      metadata_json: string;
    }>;

    return rows.map((row) => this.mapSessionRow(row, []));
  }

  getSessionCount(status?: SessionRecord['status']): number {
    let query = 'SELECT COUNT(*) as count FROM sessions';
    const params: Record<string, string> = {};

    if (status) {
      query += ' WHERE status = @status';
      params.status = status;
    }

    const result = this.db.prepare(query).get(params) as { count: number };
    return result.count;
  }

  clear(): void {
    this.db.exec('DELETE FROM sessions');
  }

  addMessage(sessionId: string, message: MessageRecord): boolean {
    // 세션 존재 확인
    const session = this.db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId);
    if (!session) return false;

    const insert = this.db.prepare(`
      INSERT INTO messages (id, session_id, timestamp, provider, role, content, token_count, iteration, element_id)
      VALUES (@id, @sessionId, @timestamp, @provider, @role, @content, @tokenCount, @iteration, @elementId)
    `);

    insert.run({
      id: message.id,
      sessionId,
      timestamp: message.timestamp,
      provider: message.provider,
      role: message.role,
      content: message.content,
      tokenCount: message.tokenCount || null,
      iteration: message.iteration,
      elementId: message.elementId || null,
    });

    return true;
  }

  close(): void {
    this.db.close();
  }

  private getMessagesForSession(sessionId: string): Array<{
    id: string;
    timestamp: string;
    provider: string;
    role: string;
    content: string;
    token_count: number | null;
    iteration: number;
    element_id: string | null;
  }> {
    return this.db
      .prepare(
        `SELECT id, timestamp, provider, role, content, token_count, iteration, element_id
         FROM messages WHERE session_id = ? ORDER BY timestamp ASC`
      )
      .all(sessionId) as Array<{
      id: string;
      timestamp: string;
      provider: string;
      role: string;
      content: string;
      token_count: number | null;
      iteration: number;
      element_id: string | null;
    }>;
  }

  private mapSessionRow(
    row: {
      id: string;
      debate_id: string;
      started_at: string;
      ended_at: string | null;
      status: string;
      config_json: string;
      elements_json: string;
      metadata_json: string;
    },
    messageRows: Array<{
      id: string;
      timestamp: string;
      provider: string;
      role: string;
      content: string;
      token_count: number | null;
      iteration: number;
      element_id: string | null;
    }>
  ): SessionRecord {
    return {
      id: row.id,
      debateId: row.debate_id,
      startedAt: row.started_at,
      endedAt: row.ended_at || undefined,
      status: row.status as SessionRecord['status'],
      config: JSON.parse(row.config_json) as DebateConfig,
      elements: JSON.parse(row.elements_json) as DebateElement[],
      metadata: JSON.parse(row.metadata_json) as SessionMetadata,
      messages: messageRows.map((msg) => ({
        id: msg.id,
        timestamp: msg.timestamp,
        provider: msg.provider as LLMProvider,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        tokenCount: msg.token_count || undefined,
        iteration: msg.iteration,
        elementId: msg.element_id || undefined,
      })),
    };
  }
}

// 싱글톤 인스턴스
let instance: SessionRepository | null = null;

export function getSessionRepository(): SessionRepository {
  if (!instance) {
    instance = new SessionRepository();
  }
  return instance;
}

export function closeSessionRepository(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}
