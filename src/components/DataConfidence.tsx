'use client';

import { useState } from 'react';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

interface DataConfidenceProps {
  level: ConfidenceLevel;
  source?: string;
  fetchDate?: string | Date;
  verifyUrl?: string;
  compact?: boolean;
  className?: string;
}

const confidenceConfig = {
  high: {
    label: 'High Confidence',
    color: 'var(--accent-green)',
    bgColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
    description: 'Data from official or verified sources',
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ),
  },
  medium: {
    label: 'Medium Confidence',
    color: 'var(--accent-orange)',
    bgColor: 'rgba(249, 115, 22, 0.1)',
    borderColor: 'rgba(249, 115, 22, 0.3)',
    description: 'Data from reliable but unofficial sources',
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    ),
  },
  low: {
    label: 'Low Confidence',
    color: 'var(--accent-red)',
    bgColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    description: 'Estimated or inferred data',
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    ),
  },
};

export default function DataConfidence({
  level,
  source,
  fetchDate,
  verifyUrl,
  compact = false,
  className = '',
}: DataConfidenceProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const config = confidenceConfig[level];

  const formatDate = (date: string | Date) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1 relative ${className}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span style={{ color: config.color }}>{config.icon}</span>

        {showTooltip && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50">
            <div
              className="px-3 py-2 rounded-lg text-xs whitespace-nowrap"
              style={{
                backgroundColor: config.bgColor,
                border: `1px solid ${config.borderColor}`,
                color: config.color,
              }}
            >
              <div className="font-medium">{config.label}</div>
              {source && (
                <div className="text-[var(--text-muted)] mt-0.5">
                  Source: {source}
                </div>
              )}
            </div>
            <div
              className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 -mt-1"
              style={{ backgroundColor: config.bgColor, borderColor: config.borderColor }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${className}`}
      style={{
        backgroundColor: config.bgColor,
        border: `1px solid ${config.borderColor}`,
      }}
    >
      <span style={{ color: config.color }}>{config.icon}</span>
      <span style={{ color: config.color }} className="font-medium">
        {config.label}
      </span>

      {(source || fetchDate || verifyUrl) && (
        <div className="flex items-center gap-2 ml-2 pl-2 border-l border-[var(--border-color)]">
          {source && (
            <span className="text-xs text-[var(--text-muted)]">
              {source}
            </span>
          )}
          {fetchDate && (
            <span className="text-xs text-[var(--text-muted)]">
              {formatDate(fetchDate)}
            </span>
          )}
          {verifyUrl && (
            <a
              href={verifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--accent-cyan)] hover:underline flex items-center gap-1"
            >
              Verify
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// Inline confidence badge for use in data displays
export function ConfidenceBadge({
  level,
  size = 'sm',
}: {
  level: ConfidenceLevel;
  size?: 'xs' | 'sm';
}) {
  const config = confidenceConfig[level];
  const iconSize = size === 'xs' ? 'w-3 h-3' : 'w-4 h-4';

  return (
    <span
      className={`inline-flex items-center ${iconSize}`}
      style={{ color: config.color }}
      title={`${config.label}: ${config.description}`}
    >
      {config.icon}
    </span>
  );
}

// Helper to determine confidence level based on source
export function getConfidenceLevel(source?: string): ConfidenceLevel {
  if (!source) return 'low';

  const sourceLower = source.toLowerCase();

  // High confidence sources
  if (
    sourceLower.includes('official') ||
    sourceLower.includes('government') ||
    sourceLower.includes('census') ||
    sourceLower.includes('fema') ||
    sourceLower.includes('usgs') ||
    sourceLower.includes('county')
  ) {
    return 'high';
  }

  // Medium confidence sources
  if (
    sourceLower.includes('api') ||
    sourceLower.includes('google') ||
    sourceLower.includes('osm') ||
    sourceLower.includes('openstreetmap') ||
    sourceLower.includes('zillow') ||
    sourceLower.includes('realtor')
  ) {
    return 'medium';
  }

  // Low confidence for estimated/inferred
  if (
    sourceLower.includes('estimated') ||
    sourceLower.includes('inferred') ||
    sourceLower.includes('calculated') ||
    sourceLower.includes('approximat')
  ) {
    return 'low';
  }

  return 'medium';
}
