'use client';

import { useMemo } from 'react';
import { TrafficInfo, ExtendedDemographics, Business, EnvironmentalRisk, MarketComp, AccessPoint, LocationIntelligence } from '@/types';
import { calculateFeasibilityScore, getScoreColor, getRatingColor, getScoreLabelAndIcon } from '@/utils/feasibilityScore';

interface ParcelInfo {
  acres?: number;
  sqft?: number;
  zoning?: string;
  landUse?: string;
}

interface LiveFeasibilityScoreProps {
  trafficData: TrafficInfo | null;
  demographicsData: ExtendedDemographics | null;
  businesses: Business[];
  environmentalRisk: EnvironmentalRisk | null;
  marketComps: MarketComp[] | null;
  accessPoints?: AccessPoint[];
  locationIntelligence?: LocationIntelligence | null;
  parcelInfo?: ParcelInfo | null;
  isVisible?: boolean;
}

export default function LiveFeasibilityScore({
  trafficData,
  demographicsData,
  businesses,
  environmentalRisk,
  marketComps,
  accessPoints = [],
  locationIntelligence,
  parcelInfo,
  isVisible = true,
}: LiveFeasibilityScoreProps) {
  const feasibilityScore = useMemo(() => {
    try {
      return calculateFeasibilityScore(
        trafficData,
        demographicsData,
        businesses,
        environmentalRisk,
        marketComps,
        accessPoints,
        locationIntelligence,
        parcelInfo
      );
    } catch (err) {
      console.error('Error calculating feasibility score:', err);
      return {
        overall: 0,
        breakdown: {
          trafficScore: 0,
          demographicsScore: 0,
          competitionScore: 0,
          accessScore: 0,
          environmentalScore: 0,
          marketScore: 0,
          economicScore: 0,
          siteScore: 0,
        },
        details: {
          traffic: 'Error calculating',
          demographics: 'Error calculating',
          competition: 'Error calculating',
          access: 'Error calculating',
          environmental: 'Error calculating',
          market: 'Error calculating',
          economic: 'Error calculating',
          site: 'Error calculating',
        },
        rating: 'Poor' as const,
      };
    }
  }, [trafficData, demographicsData, businesses, environmentalRisk, marketComps, accessPoints, locationIntelligence, parcelInfo]);

  // Count available data sources
  const dataSources = useMemo(() => {
    return {
      traffic: !!trafficData || accessPoints.length > 0,
      demographics: !!demographicsData,
      competition: businesses.length > 0,
      environmental: !!environmentalRisk,
      market: !!marketComps && marketComps.length > 0,
      economic: !!demographicsData?.consumerSpending,
      site: !!parcelInfo || !!locationIntelligence,
    };
  }, [trafficData, demographicsData, businesses, environmentalRisk, marketComps, accessPoints, parcelInfo, locationIntelligence]);

  const availableCount = Object.values(dataSources).filter(Boolean).length;
  const totalSources = 7;

  if (!isVisible) return null;

  const scoreBreakdown = [
    { key: 'traffic', label: 'Traffic', score: feasibilityScore.breakdown.trafficScore, weight: '20%', available: dataSources.traffic },
    { key: 'demographics', label: 'Demographics', score: feasibilityScore.breakdown.demographicsScore, weight: '15%', available: dataSources.demographics },
    { key: 'economic', label: 'Economic', score: feasibilityScore.breakdown.economicScore, weight: '15%', available: dataSources.economic },
    { key: 'competition', label: 'Competition', score: feasibilityScore.breakdown.competitionScore, weight: '10%', available: dataSources.competition },
    { key: 'access', label: 'Access', score: feasibilityScore.breakdown.accessScore, weight: '10%', available: dataSources.traffic },
    { key: 'site', label: 'Site', score: feasibilityScore.breakdown.siteScore, weight: '10%', available: dataSources.site },
    { key: 'environmental', label: 'Environmental', score: feasibilityScore.breakdown.environmentalScore, weight: '10%', available: dataSources.environmental },
    { key: 'market', label: 'Market', score: feasibilityScore.breakdown.marketScore, weight: '10%', available: dataSources.market },
  ];

  return (
    <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-[var(--text-primary)]">Live Feasibility Score</h3>
          <p className="text-xs text-[var(--text-muted)]">
            {availableCount}/{totalSources} data sources loaded
          </p>
        </div>

        {/* Main Score Circle */}
        <div className="relative">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{
              background: `conic-gradient(${getScoreColor(feasibilityScore.overall)} ${feasibilityScore.overall * 10}%, var(--bg-secondary) 0%)`,
            }}
          >
            <div className="w-12 h-12 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center">
              <span
                className="text-xl font-bold"
                style={{ color: getScoreColor(feasibilityScore.overall) }}
              >
                {(feasibilityScore.overall ?? 0).toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Rating Badge */}
      <div className="flex items-center gap-2 mb-4">
        <span
          className="px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1"
          style={{
            backgroundColor: `${getRatingColor(feasibilityScore.rating)}20`,
            color: getRatingColor(feasibilityScore.rating),
            border: `1px solid ${getRatingColor(feasibilityScore.rating)}40`
          }}
        >
          <span aria-hidden="true">{getScoreLabelAndIcon(feasibilityScore.overall).icon}</span>
          {feasibilityScore.rating}
        </span>
        <span className="text-xs text-[var(--text-muted)]">
          {availableCount < totalSources ? 'Preliminary score - more data loading...' : 'All data loaded'}
        </span>
      </div>

      {/* Score Breakdown */}
      <div className="space-y-2">
        {scoreBreakdown.map((item) => (
          <div key={item.key} className="flex items-center gap-2">
            <div className="w-24 text-xs text-[var(--text-secondary)]">
              {item.label}
              <span className="text-[var(--text-muted)] ml-1">({item.weight})</span>
            </div>
            <div className="flex-1 h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${item.score * 10}%`,
                  backgroundColor: item.available ? getScoreColor(item.score) : 'var(--text-muted)',
                  opacity: item.available ? 1 : 0.3,
                }}
              />
            </div>
            <div
              className="w-8 text-right text-xs font-medium"
              style={{ color: item.available ? getScoreColor(item.score) : 'var(--text-muted)' }}
            >
              {(item.score ?? 0).toFixed(1)}
            </div>
            {!item.available && (
              <svg className="w-3 h-3 text-[var(--text-muted)] animate-pulse" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
            )}
          </div>
        ))}
      </div>

      {/* Details Accordion */}
      <details className="mt-4">
        <summary className="text-xs text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-secondary)]">
          View score details
        </summary>
        <div className="mt-2 space-y-2 text-xs">
          {Object.entries(feasibilityScore.details).map(([key, detail]) => (
            <div key={key} className="p-2 bg-[var(--bg-secondary)] rounded">
              <span className="font-medium text-[var(--text-secondary)] capitalize">{key}:</span>
              <span className="text-[var(--text-muted)] ml-1">{detail}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
