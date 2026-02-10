'use client';

import { useSearchHistory, SearchHistoryItem } from '@/hooks/useSearchHistory';
import Link from 'next/link';
import { useState } from 'react';

export default function HistoryPage() {
  const { searchHistory, isLoading, deleteHistoryItem, clearHistory } = useSearchHistory();
  const [confirmClear, setConfirmClear] = useState(false);

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getScoreBadgeClass = (score: number | null) => {
    if (score === null) return 'bg-gray-500/20 text-gray-400';
    if (score >= 8) return 'bg-green-500/20 text-green-400';
    if (score >= 6) return 'bg-lime-500/20 text-lime-400';
    if (score >= 4) return 'bg-yellow-500/20 text-yellow-400';
    return 'bg-red-500/20 text-red-400';
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    deleteHistoryItem(id);
  };

  const handleClearAll = () => {
    if (confirmClear) {
      clearHistory();
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--accent-cyan)] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Search History</h1>
          <p className="text-[var(--text-muted)] mt-1">
            {searchHistory.length} {searchHistory.length === 1 ? 'search' : 'searches'} recorded
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-[var(--accent-cyan)] hover:underline flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Analysis
          </Link>
          {searchHistory.length > 0 && (
            <button
              onClick={handleClearAll}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                confirmClear
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)]'
              }`}
            >
              {confirmClear ? 'Click again to confirm' : 'Clear All'}
            </button>
          )}
        </div>
      </div>

      {searchHistory.length === 0 ? (
        <div className="terminal-card p-12 text-center">
          <svg
            className="w-16 h-16 mx-auto text-[var(--text-muted)] mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">No Search History</h3>
          <p className="text-[var(--text-muted)] mb-6">
            Your analyzed locations will appear here.
          </p>
          <Link
            href="/"
            className="btn-primary inline-flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Start Analyzing
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {searchHistory.map((item) => (
            <Link
              key={item.id}
              href={`/?address=${encodeURIComponent(item.address)}&lat=${item.coordinates.lat}&lng=${item.coordinates.lng}`}
              className="terminal-card p-4 hover:border-[var(--accent-cyan)] transition-all group relative"
            >
              <button
                onClick={(e) => handleDelete(e, item.id)}
                className="absolute top-3 right-3 p-1.5 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>

              {item.thumbnail ? (
                <div className="w-full h-32 rounded-lg overflow-hidden mb-3 bg-[var(--bg-tertiary)]">
                  <img
                    src={item.thumbnail}
                    alt={item.address}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-full h-32 rounded-lg mb-3 bg-[var(--bg-tertiary)] flex items-center justify-center">
                  <svg className="w-12 h-12 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              )}

              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-[var(--text-primary)] truncate group-hover:text-[var(--accent-cyan)] transition-colors">
                    {item.address}
                  </h3>
                  <p className="text-sm text-[var(--text-muted)] mt-1">
                    {formatDate(item.timestamp)}
                  </p>
                </div>
                {item.feasibilityScore !== null && (
                  <span className={`px-2.5 py-1 rounded-full text-sm font-medium ${getScoreBadgeClass(item.feasibilityScore)}`}>
                    {item.feasibilityScore.toFixed(1)}
                  </span>
                )}
              </div>

              <div className="mt-3 flex items-center gap-4 text-xs text-[var(--text-muted)]">
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  {item.coordinates.lat.toFixed(4)}, {item.coordinates.lng.toFixed(4)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
