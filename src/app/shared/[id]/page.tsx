'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { PropertyData } from '@/types';

interface SharedData {
  address: string;
  coordinates: { lat: number; lng: number };
  score?: number;
  timestamp: string;
  fullData?: PropertyData;
}

export default function SharedPage() {
  const params = useParams();
  const [data, setData] = useState<SharedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSharedData = () => {
      try {
        const id = params.id as string;
        const decoded = JSON.parse(atob(decodeURIComponent(id))) as SharedData;

        // Try to load full data from localStorage
        const shareKey = `drone-sense-share-${id.slice(0, 20)}`;
        const stored = localStorage.getItem(shareKey);

        if (stored) {
          const fullData = JSON.parse(stored);
          setData(fullData);
        } else {
          // Just use the minimal data from URL
          setData(decoded);
        }
      } catch (err) {
        console.error('Failed to load shared data:', err);
        setError('Invalid or expired share link');
      } finally {
        setLoading(false);
      }
    };

    loadSharedData();
  }, [params.id]);

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getScoreLabel = (score: number) => {
    if (score >= 8) return 'Excellent';
    if (score >= 6) return 'Good';
    if (score >= 4) return 'Fair';
    return 'Poor';
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-400';
    if (score >= 6) return 'text-lime-400';
    if (score >= 4) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--accent-cyan)] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="terminal-card p-8 text-center max-w-md">
          <svg
            className="w-16 h-16 mx-auto text-[var(--accent-red)] mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
            Link Not Found
          </h2>
          <p className="text-[var(--text-muted)] mb-6">
            {error || 'This shared analysis could not be found or has expired.'}
          </p>
          <Link href="/" className="btn-primary inline-flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Go to Drone Sense
          </Link>
        </div>
      </div>
    );
  }

  const fullData = data.fullData;
  const analysis = fullData?.analysis;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Shared Analysis
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
          {data.address}
        </h1>
        <p className="text-[var(--text-muted)]">
          Shared on {formatDate(data.timestamp)}
        </p>
      </div>

      {/* Score Card */}
      {data.score != null && (
        <div className="terminal-card mb-8">
          <div className="terminal-header">
            <div className="terminal-dot red"></div>
            <div className="terminal-dot yellow"></div>
            <div className="terminal-dot green"></div>
            <span className="terminal-title">feasibility_score.result</span>
          </div>
          <div className="terminal-body text-center py-8">
            <div className="inline-flex items-center gap-4">
              <div className={`text-6xl font-bold ${getScoreColor(data.score)}`}>
                {data.score.toFixed(1)}
              </div>
              <div className="text-left">
                <p className="text-[var(--text-primary)] font-medium">
                  {getScoreLabel(data.score)}
                </p>
                <p className="text-[var(--text-muted)] text-sm">out of 10</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Location Info */}
      <div className="terminal-card mb-8">
        <div className="terminal-header">
          <div className="terminal-dot red"></div>
          <div className="terminal-dot yellow"></div>
          <div className="terminal-dot green"></div>
          <span className="terminal-title">location_data.info</span>
        </div>
        <div className="terminal-body">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[var(--text-muted)] text-sm">Latitude</p>
              <p className="text-[var(--accent-green)] font-mono">
                {data.coordinates.lat.toFixed(6)}
              </p>
            </div>
            <div>
              <p className="text-[var(--text-muted)] text-sm">Longitude</p>
              <p className="text-[var(--accent-green)] font-mono">
                {data.coordinates.lng.toFixed(6)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Analysis Details (if full data available) */}
      {analysis && (
        <>
          {/* Key Findings */}
          {analysis.keyFindings && analysis.keyFindings.length > 0 && (
            <div className="terminal-card mb-8">
              <div className="terminal-header">
                <div className="terminal-dot red"></div>
                <div className="terminal-dot yellow"></div>
                <div className="terminal-dot green"></div>
                <span className="terminal-title">key_findings.list</span>
              </div>
              <div className="terminal-body">
                <ul className="space-y-2">
                  {analysis.keyFindings.map((finding, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <svg
                        className="w-4 h-4 text-[var(--accent-cyan)] flex-shrink-0 mt-0.5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-[var(--text-secondary)]">{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {analysis.recommendations && analysis.recommendations.length > 0 && (
            <div className="terminal-card mb-8">
              <div className="terminal-header">
                <div className="terminal-dot red"></div>
                <div className="terminal-dot yellow"></div>
                <div className="terminal-dot green"></div>
                <span className="terminal-title">recommendations.list</span>
              </div>
              <div className="terminal-body">
                <ul className="space-y-2">
                  {analysis.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-[var(--accent-orange)]">{idx + 1}.</span>
                      <span className="text-[var(--text-secondary)]">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Business Recommendation */}
          {analysis.businessRecommendation && (
            <div className="terminal-card mb-8">
              <div className="terminal-header">
                <div className="terminal-dot red"></div>
                <div className="terminal-dot yellow"></div>
                <div className="terminal-dot green"></div>
                <span className="terminal-title">ai_recommendation.summary</span>
              </div>
              <div className="terminal-body">
                <p className="text-[var(--text-secondary)]">
                  {analysis.businessRecommendation}
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* CTA */}
      <div className="text-center py-8">
        <p className="text-[var(--text-muted)] mb-4">
          Want to run your own site analysis?
        </p>
        <Link
          href={`/?address=${encodeURIComponent(data.address)}&lat=${data.coordinates.lat}&lng=${data.coordinates.lng}`}
          className="btn-primary inline-flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Analyze This Location
        </Link>
      </div>
    </div>
  );
}
