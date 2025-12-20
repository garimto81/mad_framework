/**
 * Response Viewer
 *
 * LLM 응답 표시
 */

import { useState } from 'react';
import type { DebateResponse, LLMProvider } from '@shared/types';

interface ResponseViewerProps {
  responses: DebateResponse[];
}

const PROVIDER_COLORS: Record<LLMProvider, string> = {
  chatgpt: 'border-chatgpt',
  claude: 'border-claude',
  gemini: 'border-gemini',
};

export function ResponseViewer({ responses }: ResponseViewerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (responses.length === 0) {
    return (
      <div className="card h-full">
        <h2 className="text-lg font-semibold mb-4">응답 로그</h2>
        <p className="text-gray-500 text-center py-8">응답이 표시됩니다</p>
      </div>
    );
  }

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Show most recent responses first
  const sortedResponses = [...responses].reverse();

  return (
    <div className="card h-full overflow-hidden flex flex-col">
      <h2 className="text-lg font-semibold mb-4">응답 로그</h2>

      <div className="flex-1 overflow-y-auto space-y-3">
        {sortedResponses.map((response) => {
          const id = `${response.sessionId}-${response.iteration}-${response.provider}`;
          const isExpanded = expandedId === id;

          return (
            <div
              key={id}
              className={`border-l-4 ${PROVIDER_COLORS[response.provider]} bg-gray-700/50 rounded-r-lg`}
            >
              {/* Header */}
              <button
                onClick={() => toggleExpand(id)}
                className="w-full p-3 flex items-center justify-between text-left hover:bg-gray-700/30"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium">{response.provider.toUpperCase()}</span>
                  <span className="text-sm text-gray-400">반복 #{response.iteration}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <span className="text-xs">
                    {new Date(response.timestamp).toLocaleTimeString()}
                  </span>
                  <svg
                    className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </button>

              {/* Content */}
              {isExpanded && (
                <div className="px-3 pb-3">
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap bg-gray-800 p-3 rounded overflow-x-auto max-h-64 overflow-y-auto">
                    {response.content}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
