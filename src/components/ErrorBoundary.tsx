'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-6 m-4 bg-red-900/20 border border-red-500/50 rounded-lg">
          <h2 className="text-xl font-bold text-red-400 mb-4">Something went wrong</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-red-300 font-semibold">Error:</p>
              <pre className="mt-1 p-3 bg-black/50 rounded text-xs text-red-200 overflow-auto max-h-32">
                {this.state.error?.message || 'Unknown error'}
              </pre>
            </div>
            {this.state.error?.stack && (
              <div>
                <p className="text-sm text-red-300 font-semibold">Stack trace:</p>
                <pre className="mt-1 p-3 bg-black/50 rounded text-xs text-gray-400 overflow-auto max-h-48">
                  {this.state.error.stack}
                </pre>
              </div>
            )}
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null });
                window.location.reload();
              }}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
