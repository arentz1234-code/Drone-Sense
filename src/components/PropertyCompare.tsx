'use client';

import { useCallback } from 'react';
import Link from 'next/link';

interface QuickFeasibility {
  parcelId: string;
  address: string;
  coordinates: { lat: number; lng: number };
  lotSize?: number;
  lotSizeAcres?: number;
  score: number;
  factors: {
    trafficScore: number;
    businessDensity: number;
    zoningScore: number;
    accessScore: number;
  };
  zoning?: string;
  nearbyBusinesses?: number;
  estimatedVPD?: number;
}

interface PropertyCompareProps {
  properties: QuickFeasibility[];
  onRemove: (parcelId: string) => void;
  onClear: () => void;
}

// Get color based on score
function getScoreColor(score: number): string {
  if (score >= 8) return 'text-green-400';
  if (score >= 5) return 'text-yellow-400';
  return 'text-red-400';
}

function getScoreBgColor(score: number): string {
  if (score >= 8) return 'bg-green-400/20 border-green-400/50';
  if (score >= 5) return 'bg-yellow-400/20 border-yellow-400/50';
  return 'bg-red-400/20 border-red-400/50';
}

// Get best value indicator
function getBestValue(
  properties: QuickFeasibility[],
  getValue: (p: QuickFeasibility) => number | undefined,
  higherIsBetter: boolean = true
): string | null {
  if (properties.length < 2) return null;

  const values = properties.map(p => getValue(p)).filter((v): v is number => v !== undefined);
  if (values.length < 2) return null;

  const best = higherIsBetter ? Math.max(...values) : Math.min(...values);
  const bestProperty = properties.find(p => getValue(p) === best);

  return bestProperty?.parcelId || null;
}

export default function PropertyCompare({ properties, onRemove, onClear }: PropertyCompareProps) {
  const exportToCSV = useCallback(() => {
    if (properties.length === 0) return;

    const headers = [
      'Address',
      'Parcel ID',
      'Feasibility Score',
      'Estimated VPD',
      'Lot Size (acres)',
      'Zoning',
      'Nearby Businesses',
      'Traffic Score',
      'Business Density Score',
      'Zoning Score',
      'Access Score',
      'Latitude',
      'Longitude',
    ];

    const rows = properties.map(p => [
      `"${p.address}"`,
      p.parcelId,
      p.score.toFixed(1),
      p.estimatedVPD || '',
      p.lotSizeAcres?.toFixed(2) || '',
      p.zoning || '',
      p.nearbyBusinesses ?? '',
      p.factors.trafficScore.toFixed(1),
      p.factors.businessDensity.toFixed(1),
      p.factors.zoningScore.toFixed(1),
      p.factors.accessScore.toFixed(1),
      p.coordinates.lat,
      p.coordinates.lng,
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `property-comparison-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [properties]);

  if (properties.length === 0) {
    return (
      <div className="terminal-card">
        <div className="terminal-header">
          <div className="terminal-dot red"></div>
          <div className="terminal-dot yellow"></div>
          <div className="terminal-dot green"></div>
          <span className="terminal-title">property_compare.module</span>
        </div>
        <div className="terminal-body">
          <div className="text-center py-8 text-[var(--text-muted)]">
            <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p>No properties selected for comparison</p>
            <p className="text-sm mt-2">Click &ldquo;Add to Compare&rdquo; on properties to compare them side by side</p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate best values for highlighting
  const bestScore = getBestValue(properties, p => p.score, true);
  const bestVPD = getBestValue(properties, p => p.estimatedVPD, true);
  const bestAcres = getBestValue(properties, p => p.lotSizeAcres, true);
  const bestBusinesses = getBestValue(properties, p => p.nearbyBusinesses, true);
  const bestTraffic = getBestValue(properties, p => p.factors.trafficScore, true);

  const CompareRow = ({
    label,
    getValue,
    format,
    bestId,
  }: {
    label: string;
    getValue: (p: QuickFeasibility) => string | number | undefined;
    format?: (value: string | number | undefined) => string;
    bestId?: string | null;
  }) => (
    <tr className="border-b border-[var(--border-color)]">
      <td className="py-2 px-3 text-xs text-[var(--text-muted)] font-medium bg-[var(--bg-secondary)]">
        {label}
      </td>
      {properties.map((property) => {
        const value = getValue(property);
        const displayValue = format ? format(value) : (value ?? 'N/A');
        const isBest = bestId === property.parcelId;

        return (
          <td
            key={property.parcelId}
            className={`py-2 px-3 text-sm text-center ${
              isBest ? 'bg-green-400/10 text-green-400 font-medium' : ''
            }`}
          >
            {displayValue}
            {isBest && <span className="ml-1 text-xs">*</span>}
          </td>
        );
      })}
    </tr>
  );

  return (
    <div className="terminal-card">
      <div className="terminal-header">
        <div className="terminal-dot red"></div>
        <div className="terminal-dot yellow"></div>
        <div className="terminal-dot green"></div>
        <span className="terminal-title">property_compare.module</span>
      </div>
      <div className="terminal-body">
        {/* Header with actions */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Compare Properties</h3>
            <span className="text-sm text-[var(--text-muted)]">({properties.length}/4)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportToCSV}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
            <button
              onClick={onClear}
              className="text-sm text-red-400 hover:text-red-300 px-3 py-1.5"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                <th className="py-2 px-3 text-left text-xs text-[var(--text-muted)] font-medium bg-[var(--bg-secondary)] w-32">
                  Property
                </th>
                {properties.map((property) => (
                  <th key={property.parcelId} className="py-2 px-3 text-center min-w-[180px]">
                    <div className="flex flex-col items-center gap-1">
                      <button
                        onClick={() => onRemove(property.parcelId)}
                        className="self-end text-red-400 hover:text-red-300 p-1 -mr-1 -mt-1"
                        title="Remove from comparison"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <p className="text-xs font-medium truncate max-w-[160px]" title={property.address}>
                        {property.address}
                      </p>
                      <Link
                        href={`/?lat=${property.coordinates.lat}&lng=${property.coordinates.lng}`}
                        className="text-xs text-[var(--accent-cyan)] hover:underline"
                      >
                        View Details
                      </Link>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Overall Score - highlighted */}
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]">
                <td className="py-3 px-3 text-xs text-[var(--text-muted)] font-bold bg-[var(--bg-secondary)]">
                  Overall Score
                </td>
                {properties.map((property) => (
                  <td key={property.parcelId} className="py-3 px-3 text-center">
                    <span
                      className={`inline-block px-3 py-1 rounded border text-lg font-bold ${getScoreColor(property.score)} ${getScoreBgColor(property.score)}`}
                    >
                      {property.score.toFixed(1)}
                    </span>
                    {bestScore === property.parcelId && (
                      <span className="ml-2 text-xs text-green-400">Best</span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Key Metrics */}
              <CompareRow
                label="Estimated VPD"
                getValue={(p) => p.estimatedVPD}
                format={(v) => (v as number)?.toLocaleString() || 'N/A'}
                bestId={bestVPD}
              />
              <CompareRow
                label="Lot Size"
                getValue={(p) => p.lotSizeAcres}
                format={(v) => (v as number)?.toFixed(2) + ' acres' || 'N/A'}
                bestId={bestAcres}
              />
              <CompareRow
                label="Zoning"
                getValue={(p) => p.zoning || 'N/A'}
              />
              <CompareRow
                label="Nearby Businesses"
                getValue={(p) => p.nearbyBusinesses}
                format={(v) => String(v ?? 'N/A')}
                bestId={bestBusinesses}
              />

              {/* Score Breakdown Header */}
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
                <td colSpan={properties.length + 1} className="py-2 px-3 text-xs font-medium text-[var(--text-muted)]">
                  Score Breakdown
                </td>
              </tr>

              <CompareRow
                label="Traffic Score"
                getValue={(p) => p.factors.trafficScore}
                format={(v) => (v as number)?.toFixed(1) || 'N/A'}
                bestId={bestTraffic}
              />
              <CompareRow
                label="Business Density"
                getValue={(p) => p.factors.businessDensity}
                format={(v) => (v as number)?.toFixed(1) || 'N/A'}
              />
              <CompareRow
                label="Zoning Score"
                getValue={(p) => p.factors.zoningScore}
                format={(v) => (v as number)?.toFixed(1) || 'N/A'}
              />
              <CompareRow
                label="Access Score"
                getValue={(p) => p.factors.accessScore}
                format={(v) => (v as number)?.toFixed(1) || 'N/A'}
              />

              {/* Location */}
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
                <td colSpan={properties.length + 1} className="py-2 px-3 text-xs font-medium text-[var(--text-muted)]">
                  Location
                </td>
              </tr>

              <CompareRow
                label="Parcel ID"
                getValue={(p) => p.parcelId}
              />
              <CompareRow
                label="Coordinates"
                getValue={(p) => `${p.coordinates.lat.toFixed(4)}, ${p.coordinates.lng.toFixed(4)}`}
              />
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-4 pt-4 border-t border-[var(--border-color)] text-xs text-[var(--text-muted)]">
          <span className="text-green-400">*</span> indicates best value in comparison
        </div>
      </div>
    </div>
  );
}
