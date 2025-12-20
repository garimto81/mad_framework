/**
 * Element Score Board
 *
 * 토론 요소별 점수 표시
 */

import type { DebateElement } from '@shared/types';

interface ElementScoreBoardProps {
  elements: DebateElement[];
  threshold: number;
}

const STATUS_COLORS: Record<DebateElement['status'], string> = {
  pending: 'bg-gray-500',
  in_progress: 'bg-blue-500',
  completed: 'bg-green-500',
  cycle_detected: 'bg-yellow-500',
};

const STATUS_LABELS: Record<DebateElement['status'], string> = {
  pending: '대기',
  in_progress: '진행 중',
  completed: '완료',
  cycle_detected: '순환 감지',
};

export function ElementScoreBoard({ elements, threshold }: ElementScoreBoardProps) {
  if (elements.length === 0) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">평가 요소</h2>
        <p className="text-gray-500 text-center py-8">토론이 시작되면 표시됩니다</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">평가 요소</h2>

      <div className="space-y-4">
        {elements.map((element) => (
          <div key={element.id} className="bg-gray-700/50 rounded-lg p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">{element.name}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[element.status]} text-white`}
                >
                  {STATUS_LABELS[element.status]}
                </span>
              </div>
              <span
                className={`text-2xl font-bold ${
                  element.currentScore >= threshold ? 'text-green-400' : 'text-white'
                }`}
              >
                {element.currentScore}
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-gray-600 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  element.currentScore >= threshold ? 'bg-green-500' : 'bg-blue-500'
                }`}
                style={{ width: `${element.currentScore}%` }}
              />
            </div>

            {/* Threshold marker */}
            <div className="relative h-0">
              <div
                className="absolute -top-2 w-0.5 h-2 bg-red-500"
                style={{ left: `${threshold}%` }}
              />
            </div>

            {/* Score history */}
            {element.scoreHistory.length > 1 && (
              <div className="mt-3 flex items-center gap-1 text-xs text-gray-400">
                <span>히스토리:</span>
                {element.scoreHistory.map((score, i) => (
                  <span key={i} className="px-1.5 py-0.5 bg-gray-600 rounded">
                    {score}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
