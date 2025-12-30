/**
 * Session Store
 *
 * Issue #25 P2: 세션 목록 및 내보내기 상태 관리 (Zustand)
 */

import { create } from 'zustand';
import { ipc } from '../lib/ipc';

interface SessionRecord {
  id: string;
  debateId: string;
  startedAt: string;
  endedAt?: string;
  status: 'active' | 'completed' | 'cancelled' | 'error';
  config: {
    topic: string;
    preset: string;
    participants: string[];
  };
  messages: unknown[];
  elements: unknown[];
  metadata: {
    totalTokens: number;
    totalIterations: number;
    providersUsed: string[];
    completionReason?: string;
  };
}

interface SessionState {
  // Session list
  sessions: SessionRecord[];
  isLoading: boolean;
  error: string | null;

  // Selected session
  selectedSessionId: string | null;
  selectedSession: SessionRecord | null;

  // Search/Filter state
  searchQuery: string;
  filterStatus: 'all' | 'active' | 'completed' | 'cancelled' | 'error';
  filterPreset: string | null;

  // Actions
  loadSessions: () => Promise<void>;
  selectSession: (sessionId: string | null) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<boolean>;
  exportToJson: (sessionId: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  exportToMarkdown: (sessionId: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  clearAllSessions: () => Promise<void>;

  // Filter actions
  setSearchQuery: (query: string) => void;
  setFilterStatus: (status: SessionState['filterStatus']) => void;
  setFilterPreset: (preset: string | null) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  // Initial state
  sessions: [],
  isLoading: false,
  error: null,
  selectedSessionId: null,
  selectedSession: null,
  searchQuery: '',
  filterStatus: 'all',
  filterPreset: null,

  // Actions
  loadSessions: async () => {
    set({ isLoading: true, error: null });
    try {
      const sessions = await ipc.session.list();
      set({ sessions, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  selectSession: async (sessionId: string | null) => {
    if (!sessionId) {
      set({ selectedSessionId: null, selectedSession: null });
      return;
    }

    set({ selectedSessionId: sessionId });
    try {
      const session = await ipc.session.get(sessionId);
      set({ selectedSession: session as SessionRecord | null });
    } catch (error) {
      console.error('Failed to load session:', error);
      set({ selectedSession: null });
    }
  },

  deleteSession: async (sessionId: string) => {
    try {
      const result = await ipc.session.delete(sessionId);
      if (result.success) {
        // Reload sessions list
        await get().loadSessions();
        // Clear selection if deleted session was selected
        if (get().selectedSessionId === sessionId) {
          set({ selectedSessionId: null, selectedSession: null });
        }
      }
      return result.success;
    } catch (error) {
      console.error('Failed to delete session:', error);
      return false;
    }
  },

  exportToJson: async (sessionId: string) => {
    try {
      return await ipc.session.exportJson(sessionId);
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  exportToMarkdown: async (sessionId: string) => {
    try {
      return await ipc.session.exportMarkdown(sessionId);
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  clearAllSessions: async () => {
    try {
      await ipc.session.clear();
      set({ sessions: [], selectedSessionId: null, selectedSession: null });
    } catch (error) {
      console.error('Failed to clear sessions:', error);
    }
  },

  // Filter actions
  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  setFilterStatus: (status: SessionState['filterStatus']) => {
    set({ filterStatus: status });
  },

  setFilterPreset: (preset: string | null) => {
    set({ filterPreset: preset });
  },
}));

// Selector for filtered sessions
export function useFilteredSessions() {
  const sessions = useSessionStore((state) => state.sessions);
  const searchQuery = useSessionStore((state) => state.searchQuery);
  const filterStatus = useSessionStore((state) => state.filterStatus);
  const filterPreset = useSessionStore((state) => state.filterPreset);

  return sessions.filter((session) => {
    // Status filter
    if (filterStatus !== 'all' && session.status !== filterStatus) {
      return false;
    }

    // Preset filter
    if (filterPreset && session.config.preset !== filterPreset) {
      return false;
    }

    // Search query (topic)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const topic = session.config.topic?.toLowerCase() || '';
      if (!topic.includes(query)) {
        return false;
      }
    }

    return true;
  });
}
