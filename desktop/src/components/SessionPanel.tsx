/**
 * Session Panel
 *
 * Issue #25 P2: 세션 목록 및 내보내기 UI
 */

import { useEffect, useState } from 'react';
import { useSessionStore, useFilteredSessions } from '../stores/session-store';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: '진행중', color: 'bg-blue-500' },
  completed: { label: '완료', color: 'bg-green-500' },
  cancelled: { label: '취소됨', color: 'bg-yellow-500' },
  error: { label: '오류', color: 'bg-red-500' },
};

const PRESET_LABELS: Record<string, string> = {
  code_review: '코드 리뷰',
  qa_accuracy: 'QA 정확도',
  decision: '의사 결정',
};

interface SessionPanelProps {
  onClose?: () => void;
}

export function SessionPanel({ onClose }: SessionPanelProps) {
  const {
    isLoading,
    error,
    selectedSessionId,
    selectedSession,
    searchQuery,
    filterStatus,
    loadSessions,
    selectSession,
    deleteSession,
    exportToJson,
    exportToMarkdown,
    setSearchQuery,
    setFilterStatus,
  } = useSessionStore();

  const filteredSessions = useFilteredSessions();
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleExportJson = async (sessionId: string) => {
    const result = await exportToJson(sessionId);
    if (result.success) {
      setExportMessage(`JSON 내보내기 완료: ${result.path}`);
    } else {
      setExportMessage(`내보내기 실패: ${result.error}`);
    }
    setTimeout(() => setExportMessage(null), 3000);
  };

  const handleExportMarkdown = async (sessionId: string) => {
    const result = await exportToMarkdown(sessionId);
    if (result.success) {
      setExportMessage(`Markdown 내보내기 완료: ${result.path}`);
    } else {
      setExportMessage(`내보내기 실패: ${result.error}`);
    }
    setTimeout(() => setExportMessage(null), 3000);
  };

  const handleDelete = async (sessionId: string) => {
    if (deleteConfirm === sessionId) {
      await deleteSession(sessionId);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(sessionId);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (startedAt: string, endedAt?: string) => {
    if (!endedAt) return '-';
    const start = new Date(startedAt).getTime();
    const end = new Date(endedAt).getTime();
    const durationMs = end - start;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}분 ${seconds}초`;
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold">세션 기록</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded"
            aria-label="닫기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="p-4 border-b border-gray-700 space-y-3">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="주제 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 pl-10 text-sm focus:outline-none focus:border-blue-500"
          />
          <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Status filter */}
        <div className="flex gap-2">
          {['all', 'completed', 'active', 'cancelled', 'error'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status as typeof filterStatus)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                filterStatus === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {status === 'all' ? '전체' : STATUS_LABELS[status]?.label || status}
            </button>
          ))}
        </div>
      </div>

      {/* Export message toast */}
      {exportMessage && (
        <div className="mx-4 mt-2 p-3 bg-gray-800 border border-gray-600 rounded-lg text-sm">
          {exportMessage}
        </div>
      )}

      {/* Session list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red-400">{error}</div>
        ) : filteredSessions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {searchQuery || filterStatus !== 'all' ? (
              <p>검색 결과가 없습니다</p>
            ) : (
              <p>저장된 세션이 없습니다</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                className={`p-4 cursor-pointer transition-colors ${
                  selectedSessionId === session.id
                    ? 'bg-gray-800'
                    : 'hover:bg-gray-800/50'
                }`}
                onClick={() => selectSession(session.id)}
              >
                {/* Session header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`w-2 h-2 rounded-full ${STATUS_LABELS[session.status]?.color || 'bg-gray-500'}`}
                      />
                      <span className="text-xs text-gray-400">
                        {PRESET_LABELS[session.config.preset] || session.config.preset}
                      </span>
                    </div>
                    <p className="font-medium truncate" title={session.config.topic}>
                      {session.config.topic}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500 ml-2">
                    {formatDate(session.startedAt)}
                  </span>
                </div>

                {/* Session meta */}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>{session.metadata.totalIterations} 라운드</span>
                  <span>{session.metadata.totalTokens.toLocaleString()} 토큰</span>
                  <span>{formatDuration(session.startedAt, session.endedAt)}</span>
                </div>

                {/* Actions (shown when selected) */}
                {selectedSessionId === session.id && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExportJson(session.id);
                      }}
                      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
                    >
                      JSON
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExportMarkdown(session.id);
                      }}
                      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
                    >
                      Markdown
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(session.id);
                      }}
                      className={`px-3 py-1.5 rounded text-xs transition-colors ${
                        deleteConfirm === session.id
                          ? 'bg-red-600 hover:bg-red-500'
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      {deleteConfirm === session.id ? '확인' : '삭제'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Session detail panel (when selected) */}
      {selectedSession && (
        <div className="border-t border-gray-700 p-4 bg-gray-800/50 max-h-64 overflow-y-auto">
          <h3 className="font-semibold mb-3">세션 상세</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">세션 ID</span>
              <span className="font-mono text-xs">{selectedSession.id.slice(0, 20)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">참가자</span>
              <span>{selectedSession.config.participants.join(', ')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">메시지 수</span>
              <span>{selectedSession.messages.length}개</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">종료 사유</span>
              <span>{selectedSession.metadata.completionReason || '-'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
