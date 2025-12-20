/**
 * Session Manager
 *
 * 각 LLM별 독립된 세션 파티션 관리
 */

import type { LLMProvider } from '../../shared/types';

// Mock session type for testing
interface Session {
  partition: string;
  clearStorageData: () => Promise<void>;
  clearCache: () => Promise<void>;
}

const SESSION_PARTITIONS: Record<LLMProvider, string> = {
  chatgpt: 'persist:chatgpt',
  claude: 'persist:claude',
  gemini: 'persist:gemini',
};

export class SessionManager {
  private sessions: Map<LLMProvider, Session> = new Map();

  getSession(provider: LLMProvider): Session {
    if (!this.sessions.has(provider)) {
      const partition = SESSION_PARTITIONS[provider];
      // In real implementation, this would use electron.session.fromPartition
      // For now, we create a mock session for testing
      const session: Session = {
        partition,
        clearStorageData: async () => {},
        clearCache: async () => {},
      };

      // Try to use electron if available
      try {
        const { session: electronSession } = require('electron');
        const realSession = electronSession.fromPartition(partition);
        this.sessions.set(provider, realSession);
        return realSession;
      } catch {
        // Electron not available (testing environment)
        this.sessions.set(provider, session);
      }
    }
    return this.sessions.get(provider)!;
  }

  async clearSession(provider: LLMProvider): Promise<void> {
    const session = this.getSession(provider);
    await session.clearStorageData();
    await session.clearCache();
  }

  async clearAllSessions(): Promise<void> {
    const providers: LLMProvider[] = ['chatgpt', 'claude', 'gemini'];
    await Promise.all(providers.map((p) => this.clearSession(p)));
  }

  async isSessionValid(provider: LLMProvider): Promise<boolean> {
    const session = this.getSession(provider);
    // In real implementation, check if session has valid cookies
    return !!session;
  }
}
