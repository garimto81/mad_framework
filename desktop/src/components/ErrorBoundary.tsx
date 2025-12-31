/**
 * Error Boundary
 *
 * React 컴포넌트 트리에서 발생한 에러를 잡아서 폴백 UI 표시
 */

import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Error info:', errorInfo);
    this.setState({ errorInfo });
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="h-screen flex items-center justify-center bg-gray-900">
          <div className="max-w-md p-6 bg-gray-800 rounded-lg border border-red-500/50">
            <h2 className="text-xl font-bold text-red-400 mb-4">
              Error Occurred
            </h2>
            <p className="text-gray-300 mb-4">
              {this.state.error?.message || 'An unknown error occurred.'}
            </p>
            {import.meta.env.DEV && this.state.errorInfo && (
              <details className="mb-4">
                <summary className="text-sm text-gray-500 cursor-pointer">
                  Details (Development Mode)
                </summary>
                <pre className="mt-2 p-2 bg-gray-900 rounded text-xs text-gray-400 overflow-auto max-h-40">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
            <button
              onClick={this.handleRetry}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
