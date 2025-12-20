/**
 * Login Status Board
 *
 * LLM 공급자별 로그인 상태 표시
 */

import { useLoginStore } from '../stores/login-store';
import type { LLMProvider } from '@shared/types';

const PROVIDER_LABELS: Record<LLMProvider, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
};

const PROVIDER_COLORS: Record<LLMProvider, string> = {
  chatgpt: 'bg-chatgpt',
  claude: 'bg-claude',
  gemini: 'bg-gemini',
};

export function LoginStatusBoard() {
  const { status, isChecking, checkLoginStatus, openLoginWindow } = useLoginStore();

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">로그인 상태</h2>
        <button
          onClick={checkLoginStatus}
          disabled={isChecking}
          className="text-sm text-blue-400 hover:text-blue-300 disabled:opacity-50"
        >
          {isChecking ? '확인 중...' : '새로고침'}
        </button>
      </div>

      <div className="space-y-3">
        {(Object.keys(status) as LLMProvider[]).map((provider) => (
          <div
            key={provider}
            className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${PROVIDER_COLORS[provider]}`} />
              <span className="font-medium">{PROVIDER_LABELS[provider]}</span>
            </div>

            <div className="flex items-center gap-3">
              {status[provider].isLoggedIn ? (
                <span className="text-green-400 text-sm flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  로그인됨
                </span>
              ) : (
                <button
                  onClick={() => openLoginWindow(provider)}
                  className="text-sm px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded"
                >
                  로그인
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
