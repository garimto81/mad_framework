/**
 * Main Layout
 *
 * 앱 전체 레이아웃
 */

import { useState } from 'react';
import { useDebateStore } from '../stores/debate-store';
import { useLoginStore } from '../stores/login-store';
import { useBrowserStore } from '../stores/browser-store';
import { LoginStatusBoard } from '../components/LoginStatusBoard';
import { DebateConfigPanel } from '../components/DebateConfigPanel';
import { DebateProgressBar } from '../components/DebateProgressBar';
import { ElementScoreBoard } from '../components/ElementScoreBoard';
import { IterationViewer } from '../components/IterationViewer';
import { ResponseViewer } from '../components/ResponseViewer';
import { DebateControlPanel } from '../components/DebateControlPanel';
import type { DebateConfig } from '@shared/types';

const PROVIDER_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
};

type View = 'config' | 'debate';

export function MainLayout() {
  const [view, setView] = useState<View>('config');
  const {
    session,
    isRunning,
    currentProgress,
    elements,
    responses,
    startDebate,
    cancelDebate,
  } = useDebateStore();
  const { closeLoginWindow } = useLoginStore();
  const { visibleView, viewMode, hideView } = useBrowserStore();

  const handleStartDebate = async (config: DebateConfig) => {
    await startDebate(config);
    setView('debate');
  };

  const handleBack = () => {
    setView('config');
  };

  // BrowserView에서 메인으로 돌아가기
  const handleBackToMain = async () => {
    if (viewMode === 'debate' && isRunning) {
      // 토론 중이면 취소
      await cancelDebate();
    }
    await hideView();
    // 로그인 모드였으면 로그인 상태도 정리
    if (viewMode === 'login') {
      await closeLoginWindow();
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <header className="h-14 flex items-center justify-between px-6 bg-gray-800/50 border-b border-gray-700 relative z-50">
        <div className="flex items-center gap-3">
          {visibleView ? (
            <>
              <span className="text-sm text-gray-400">
                {PROVIDER_LABELS[visibleView]}{' '}
                {viewMode === 'login' ? '로그인 중' : '토론 중'}
              </span>
              <button
                onClick={handleBackToMain}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                메인으로
              </button>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-white">MAD</h1>
              <span className="text-sm text-gray-400">Multi-Agent Debate</span>
            </>
          )}
        </div>

        {view === 'debate' && !visibleView && (
          <DebateControlPanel onStart={handleBack} />
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {view === 'config' ? (
          <div className="h-full p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto grid grid-cols-3 gap-6">
              {/* Left: Login Status */}
              <div className="col-span-1">
                <LoginStatusBoard />
              </div>

              {/* Right: Config Form */}
              <div className="col-span-2">
                <div className="card">
                  <h2 className="text-lg font-semibold mb-6">토론 설정</h2>
                  <DebateConfigPanel
                    onStart={handleStartDebate}
                    disabled={isRunning}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col p-4">
            {/* Progress Bar */}
            <DebateProgressBar />

            {/* Main content grid */}
            <div className="flex-1 grid grid-cols-12 gap-4 overflow-hidden">
              {/* Left Sidebar: Status */}
              <div className="col-span-3 space-y-4 overflow-y-auto">
                <IterationViewer
                  progress={currentProgress}
                  isRunning={isRunning}
                />
              <ElementScoreBoard
                elements={elements}
                threshold={session?.config.completionThreshold ?? 90}
              />
            </div>

            {/* Main: Responses */}
            <div className="col-span-6 overflow-hidden">
              <ResponseViewer responses={responses} />
            </div>

            {/* Right Sidebar: Mini Login Status */}
            <div className="col-span-3 overflow-y-auto">
              <LoginStatusBoard />

              {/* Session Info */}
              {session && (
                <div className="card mt-4">
                  <h3 className="text-sm font-semibold mb-3 text-gray-400">세션 정보</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">주제</span>
                      <span className="text-right max-w-32 truncate">
                        {session.config.topic}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">프리셋</span>
                      <span>{session.config.preset}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">임계값</span>
                      <span>{session.config.completionThreshold}점</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">시작</span>
                      <span>
                        {new Date(session.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Back button */}
              {!isRunning && (
                <button
                  onClick={handleBack}
                  className="btn btn-secondary w-full mt-4"
                >
                  ← 설정으로 돌아가기
                </button>
              )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
