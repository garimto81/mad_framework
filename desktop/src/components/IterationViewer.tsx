/**
 * Iteration Viewer
 *
 * 현재 토론 반복 진행 상황
 */

import type { DebateProgress, LLMProvider } from '@shared/types';

interface IterationViewerProps {
  progress: DebateProgress | null;
  isRunning: boolean;
}

const PROVIDER_COLORS: Record<LLMProvider, string> = {
  chatgpt: 'text-chatgpt',
  claude: 'text-claude',
  gemini: 'text-gemini',
};

const PHASE_LABELS: Record<DebateProgress['phase'], string> = {
  input: '입력 준비',
  waiting: '응답 대기',
  extracting: '응답 추출',
  scoring: '점수 계산',
  cycle_check: '순환 검사',
};

export function IterationViewer({ progress, isRunning }: IterationViewerProps) {
  if (!isRunning && !progress) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">진행 상황</h2>
        <p className="text-gray-500 text-center py-8">토론이 시작되면 표시됩니다</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">진행 상황</h2>

      <div className="space-y-4">
        {/* Iteration counter */}
        <div className="text-center py-6 bg-gray-700/50 rounded-lg">
          <div className="text-4xl font-bold mb-1">
            {progress?.iteration ?? 0}
          </div>
          <div className="text-sm text-gray-400">반복</div>
        </div>

        {/* Current provider */}
        {progress && (
          <>
            <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-400">현재 참여자</span>
              <span className={`font-medium ${PROVIDER_COLORS[progress.currentProvider]}`}>
                {progress.currentProvider.toUpperCase()}
              </span>
            </div>

            {/* Current phase */}
            <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-400">현재 단계</span>
              <span className="flex items-center gap-2">
                {isRunning && (
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                )}
                <span className="font-medium">{PHASE_LABELS[progress.phase]}</span>
              </span>
            </div>
          </>
        )}

        {/* Running indicator */}
        {isRunning && (
          <div className="flex items-center justify-center gap-2 text-blue-400 py-2">
            <svg
              className="w-5 h-5 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>토론 진행 중...</span>
          </div>
        )}
      </div>
    </div>
  );
}
