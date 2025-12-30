/**
 * Debate Control Panel
 *
 * 토론 시작/중지 컨트롤
 */

import { useDebateStore } from '../stores/debate-store';

interface DebateControlPanelProps {
  onStart: () => void;
}

export function DebateControlPanel({ onStart }: DebateControlPanelProps) {
  const { isRunning, session, error, cancelDebate, resetDebate } = useDebateStore();

  return (
    <div className="flex items-center gap-3">
      {/* Status indicator */}
      {session && (
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`w-2 h-2 rounded-full ${
              isRunning
                ? 'bg-green-500 animate-pulse'
                : session.status === 'completed'
                  ? 'bg-blue-500'
                  : 'bg-gray-500'
            }`}
          />
          <span className="text-gray-400">
            {isRunning
              ? '진행 중'
              : session.status === 'completed'
                ? '완료'
                : session.status === 'cancelled'
                  ? '취소됨'
                  : session.status === 'error'
                    ? '오류'
                    : '대기'}
          </span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <span className="text-red-400 text-sm flex-1">{error}</span>
      )}

      {/* Control buttons */}
      <div className="flex gap-2 ml-auto">
        {!isRunning && !session && (
          <button onClick={onStart} className="btn btn-primary">
            토론 시작
          </button>
        )}

        {isRunning && (
          <button onClick={cancelDebate} className="btn btn-danger">
            중지
          </button>
        )}

        {!isRunning && session && (
          <button onClick={resetDebate} className="btn btn-secondary">
            초기화
          </button>
        )}
      </div>
    </div>
  );
}
