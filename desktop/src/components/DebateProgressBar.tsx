/**
 * Debate Progress Bar
 *
 * 토론 진행 상태를 시각적으로 표시
 * - Progress bar with animation
 * - Current provider/phase display
 * - Element completion counter
 */

import { useDebateStore } from '../stores/debate-store';

export function DebateProgressBar() {
  const { isRunning, currentProgress, currentStatus } = useDebateStore();

  if (!isRunning || !currentProgress) {
    return null;
  }

  const {
    iteration,
    currentProvider,
    phase,
    totalElements = 0,
    completedElements = 0,
    currentElementName,
    estimatedProgress = 0,
  } = currentProgress;

  // Phase display names
  const phaseNames: Record<string, string> = {
    input: '입력 대기',
    waiting: '응답 대기',
    extracting: '응답 추출',
    scoring: '점수 평가',
    cycle_check: '순환 검사',
  };

  // Provider display names
  const providerNames: Record<string, string> = {
    chatgpt: 'ChatGPT',
    claude: 'Claude',
    gemini: 'Gemini',
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium">토론 진행 중</span>
          <span className="text-gray-400">-</span>
          <span className="text-gray-300">라운드 {iteration}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-400">
            완료된 요소: {completedElements}/{totalElements}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative w-full h-3 bg-gray-700 rounded-full overflow-hidden mb-3">
        <div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${estimatedProgress}%` }}
        />
        <div className="absolute right-2 top-0 h-full flex items-center">
          <span className="text-xs text-white font-medium drop-shadow">
            {estimatedProgress}%
          </span>
        </div>
      </div>

      {/* Status details */}
      <div className="flex flex-wrap gap-4 text-sm">
        {/* Current provider */}
        <div className="flex items-center gap-2">
          <span className="text-gray-400">현재:</span>
          <span className="px-2 py-0.5 bg-gray-700 rounded text-blue-300 font-medium">
            {providerNames[currentProvider] || currentProvider}
          </span>
          {currentStatus?.isWriting && (
            <span className="text-green-400 animate-pulse">응답 생성 중...</span>
          )}
        </div>

        {/* Phase */}
        <div className="flex items-center gap-2">
          <span className="text-gray-400">단계:</span>
          <span className="text-gray-300">{phaseNames[phase] || phase}</span>
        </div>

        {/* Current element */}
        {currentElementName && (
          <div className="flex items-center gap-2">
            <span className="text-gray-400">평가 중:</span>
            <span className="text-yellow-300">{currentElementName}</span>
          </div>
        )}

        {/* Token count from status */}
        {currentStatus && currentStatus.tokenCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-gray-400">토큰:</span>
            <span className="text-gray-300">
              {currentStatus.tokenCount.toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
