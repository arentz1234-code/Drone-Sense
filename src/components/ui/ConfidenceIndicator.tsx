'use client';

import { useState } from 'react';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

interface ConfidenceIndicatorProps {
  level: ConfidenceLevel;
  source?: string;
  tooltip?: string;
  size?: 'sm' | 'md';
}

export function getConfidenceLevel(hasVerifiedData: boolean, hasAnyData: boolean): ConfidenceLevel {
  if (hasVerifiedData) return 'high';
  if (hasAnyData) return 'medium';
  return 'low';
}

export function ConfidenceBadge({ level, source, tooltip, size = 'sm' }: ConfidenceIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const config = {
    high: {
      label: 'Verified',
      color: 'bg-green-500/20 text-green-400 border-green-500/40',
      icon: (
        <svg className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      ),
      description: 'Data from verified official source',
    },
    medium: {
      label: 'Estimated',
      color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
      icon: (
        <svg className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      ),
      description: 'Estimated from available data',
    },
    low: {
      label: 'Limited',
      color: 'bg-red-500/20 text-red-400 border-red-500/40',
      icon: (
        <svg className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      ),
      description: 'Limited data available - use with caution',
    },
  };

  const { label, color, icon, description } = config[level];

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium cursor-help ${color}`}>
        {icon}
        {size === 'md' && label}
      </span>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-48">
          <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg shadow-xl p-2">
            <p className="text-xs font-medium text-[var(--text-primary)]">{label} Data</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{tooltip || description}</p>
            {source && (
              <p className="text-[10px] text-[var(--text-muted)] mt-1 italic">Source: {source}</p>
            )}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[var(--border-color)]" />
        </div>
      )}
    </div>
  );
}

// Data confidence summary for overall score
interface DataConfidenceSummaryProps {
  trafficVerified?: boolean;
  trafficAvailable?: boolean;
  demographicsVerified?: boolean;
  demographicsAvailable?: boolean;
  environmentalVerified?: boolean;
  environmentalAvailable?: boolean;
  marketCompsAvailable?: boolean;
  walkScoreVerified?: boolean;
  crimeDataVerified?: boolean;
}

export function DataConfidenceSummary({
  trafficVerified = false,
  trafficAvailable = false,
  demographicsVerified = false,
  demographicsAvailable = false,
  environmentalVerified = false,
  environmentalAvailable = false,
  marketCompsAvailable = false,
  walkScoreVerified = false,
  crimeDataVerified = false,
}: DataConfidenceSummaryProps) {
  const factors = [
    { name: 'Traffic (VPD)', verified: trafficVerified, available: trafficAvailable, source: 'DOT/FDOT' },
    { name: 'Demographics', verified: demographicsVerified, available: demographicsAvailable, source: 'Census ACS' },
    { name: 'Environmental', verified: environmentalVerified, available: environmentalAvailable, source: 'FEMA/EPA/FWS' },
    { name: 'Market Comps', verified: marketCompsAvailable, available: marketCompsAvailable, source: 'County Records' },
    { name: 'Walk Score', verified: walkScoreVerified, available: true, source: walkScoreVerified ? 'Walk Score API' : 'OSM Estimate' },
    { name: 'Safety/Crime', verified: crimeDataVerified, available: true, source: crimeDataVerified ? 'FBI UCR' : 'State Estimate' },
  ];

  const verifiedCount = factors.filter(f => f.verified).length;
  const availableCount = factors.filter(f => f.available).length;
  const overallConfidence = verifiedCount >= 4 ? 'high' : verifiedCount >= 2 ? 'medium' : 'low';

  return (
    <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <svg className="w-4 h-4 text-[var(--accent-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Data Confidence
        </h4>
        <ConfidenceBadge level={overallConfidence} size="md" tooltip={`${verifiedCount}/${factors.length} data sources verified`} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {factors.map((factor) => (
          <div key={factor.name} className="flex items-center justify-between p-2 bg-[var(--bg-secondary)] rounded text-xs">
            <span className="text-[var(--text-muted)]">{factor.name}</span>
            <ConfidenceBadge
              level={factor.verified ? 'high' : factor.available ? 'medium' : 'low'}
              source={factor.source}
              size="sm"
            />
          </div>
        ))}
      </div>

      <p className="text-[10px] text-[var(--text-muted)] mt-3">
        Scores are most reliable when backed by verified data sources. Estimated data provides directional guidance but should be validated.
      </p>
    </div>
  );
}

export default ConfidenceBadge;
