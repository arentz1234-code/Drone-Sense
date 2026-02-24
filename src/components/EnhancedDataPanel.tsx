'use client';

import { WalkScoreData, CrimeData, BuildingPermitsData, VacancyData, IsochroneData } from '@/types';

interface EnhancedDataPanelProps {
  walkScore: WalkScoreData | null;
  crimeData: CrimeData | null;
  buildingPermits: BuildingPermitsData | null;
  vacancyData: VacancyData | null;
  isochrone: IsochroneData | null;
  isLoading?: boolean;
}

function DataSourceBadge({ source, isEstimated }: { source: string; isEstimated: boolean }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
      isEstimated
        ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/30'
        : 'bg-green-500/10 text-green-500 border border-green-500/30'
    }`}>
      {isEstimated ? 'Estimated' : source}
    </span>
  );
}

function ScoreCircle({ score, label, color }: { score: number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg"
        style={{ backgroundColor: color }}
      >
        {score}
      </div>
      <span className="text-xs text-[var(--text-muted)] mt-1">{label}</span>
    </div>
  );
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e'; // green
  if (score >= 60) return '#06b6d4'; // cyan
  if (score >= 40) return '#eab308'; // yellow
  return '#ef4444'; // red
}

function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A': return '#22c55e';
    case 'B': return '#06b6d4';
    case 'C': return '#eab308';
    case 'D': return '#f97316';
    default: return '#ef4444';
  }
}

export default function EnhancedDataPanel({
  walkScore,
  crimeData,
  buildingPermits,
  vacancyData,
  isochrone,
  isLoading = false,
}: EnhancedDataPanelProps) {
  if (isLoading) {
    return (
      <div className="p-6 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
        <div className="flex items-center justify-center gap-2">
          <svg className="animate-spin w-5 h-5 text-[var(--accent-cyan)]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          <span className="text-[var(--text-muted)]">Loading enhanced data...</span>
        </div>
      </div>
    );
  }

  const hasAnyData = walkScore || crimeData || buildingPermits || vacancyData || isochrone;

  if (!hasAnyData) {
    return (
      <div className="p-6 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
        <div className="text-center text-[var(--text-muted)]">
          <p>Enhanced data not yet loaded. Enter an address to fetch walkability, safety, and market data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Walk Score Section */}
      {walkScore && (
        <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Walkability & Transit
            </h4>
            <DataSourceBadge
              source="Walk Score API"
              isEstimated={walkScore.recommendations?.[0]?.includes('estimate') || false}
            />
          </div>
          <div className="flex gap-6 justify-center mb-3">
            <ScoreCircle score={walkScore.walkScore} label="Walk" color={getScoreColor(walkScore.walkScore)} />
            {walkScore.transitScore && (
              <ScoreCircle score={walkScore.transitScore} label="Transit" color={getScoreColor(walkScore.transitScore)} />
            )}
            {walkScore.bikeScore && (
              <ScoreCircle score={walkScore.bikeScore} label="Bike" color={getScoreColor(walkScore.bikeScore)} />
            )}
          </div>
          <p className="text-xs text-[var(--text-secondary)] text-center">{walkScore.walkDescription}</p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: walkScore.retailViability === 'excellent' ? 'rgba(34, 197, 94, 0.1)' :
                  walkScore.retailViability === 'good' ? 'rgba(6, 182, 212, 0.1)' :
                  walkScore.retailViability === 'fair' ? 'rgba(234, 179, 8, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: walkScore.retailViability === 'excellent' ? '#22c55e' :
                  walkScore.retailViability === 'good' ? '#06b6d4' :
                  walkScore.retailViability === 'fair' ? '#eab308' : '#ef4444',
              }}
            >
              {walkScore.retailViability.charAt(0).toUpperCase() + walkScore.retailViability.slice(1)} Retail Viability
            </span>
          </div>
        </div>
      )}

      {/* Crime / Safety Section */}
      {crimeData && (
        <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Safety & Crime
            </h4>
            <DataSourceBadge
              source={crimeData.source}
              isEstimated={crimeData.source?.includes('estimate') || crimeData.source?.includes('average') || false}
            />
          </div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl"
                style={{ backgroundColor: getGradeColor(crimeData.safetyGrade) }}
              >
                {crimeData.safetyGrade}
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Safety Grade</p>
                <p className="text-xs text-[var(--text-muted)]">Score: {crimeData.safetyScore}/100</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-[var(--text-secondary)]">vs National Avg</p>
              <p className={`text-xs font-medium ${
                crimeData.vsNationalAverage === 'lower' ? 'text-green-500' :
                crimeData.vsNationalAverage === 'average' ? 'text-yellow-500' : 'text-red-500'
              }`}>
                {crimeData.vsNationalAverage.charAt(0).toUpperCase() + crimeData.vsNationalAverage.slice(1)}
              </p>
            </div>
          </div>
          {crimeData.businessImpact.securityRecommendations.length > 0 && (
            <div className="mt-2 text-xs text-[var(--text-muted)]">
              <span className="font-medium">Recommendation:</span> {crimeData.businessImpact.securityRecommendations[0]}
            </div>
          )}
        </div>
      )}

      {/* Building Permits / Development Section */}
      {buildingPermits && (
        <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Development Activity
            </h4>
            <DataSourceBadge
              source="Census BPS"
              isEstimated={buildingPermits.currentYear?.totalUnits === 500}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-[var(--accent-cyan)]">{buildingPermits.currentYear.totalUnits.toLocaleString()}</p>
              <p className="text-xs text-[var(--text-muted)]">New Units ({buildingPermits.currentYear.year})</p>
            </div>
            <div className="text-center">
              <p className={`text-2xl font-bold ${
                buildingPermits.yoyChange.trend === 'growing' ? 'text-green-500' :
                buildingPermits.yoyChange.trend === 'declining' ? 'text-red-500' : 'text-yellow-500'
              }`}>
                {buildingPermits.yoyChange.unitsPercent > 0 ? '+' : ''}{buildingPermits.yoyChange.unitsPercent.toFixed(1)}%
              </p>
              <p className="text-xs text-[var(--text-muted)]">YoY Change</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2">
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: buildingPermits.yoyChange.trend === 'growing' ? 'rgba(34, 197, 94, 0.1)' :
                  buildingPermits.yoyChange.trend === 'declining' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(234, 179, 8, 0.1)',
                color: buildingPermits.yoyChange.trend === 'growing' ? '#22c55e' :
                  buildingPermits.yoyChange.trend === 'declining' ? '#ef4444' : '#eab308',
              }}
            >
              {buildingPermits.momentumDescription}
            </span>
          </div>
        </div>
      )}

      {/* Market Saturation Section */}
      {vacancyData && (
        <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Market Saturation
            </h4>
            <DataSourceBadge
              source="Google Places"
              isEstimated={false}
            />
          </div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className={`text-lg font-bold ${
                vacancyData.saturationLevel === 'undersupplied' ? 'text-green-500' :
                vacancyData.saturationLevel === 'balanced' ? 'text-cyan-500' :
                vacancyData.saturationLevel === 'saturated' ? 'text-yellow-500' : 'text-red-500'
              }`}>
                {vacancyData.saturationLevel.charAt(0).toUpperCase() + vacancyData.saturationLevel.slice(1)}
              </p>
              <p className="text-xs text-[var(--text-muted)]">{vacancyData.establishments.total.toLocaleString()} establishments</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-[var(--text-secondary)]">Saturation Score</p>
              <p className="text-lg font-bold text-[var(--text-primary)]">{vacancyData.marketSaturationScore}/100</p>
            </div>
          </div>
          {vacancyData.opportunities.undersuppliedSectors.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-[var(--text-muted)] mb-1">Undersupplied Sectors:</p>
              <div className="flex flex-wrap gap-1">
                {vacancyData.opportunities.undersuppliedSectors.slice(0, 3).map((sector) => (
                  <span
                    key={sector}
                    className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/30"
                  >
                    {sector}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Drive-Time / Trade Area Section */}
      {isochrone && (
        <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Drive-Time Trade Areas
            </h4>
            <DataSourceBadge
              source={isochrone.source?.includes('TomTom') ? 'TomTom' : 'Estimated'}
              isEstimated={isochrone.source?.includes('Estimated') || isochrone.source?.includes('unavailable') || false}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-lg bg-[var(--bg-secondary)]">
              <p className="text-xs text-[var(--text-muted)]">5 min</p>
              <p className="text-sm font-bold text-[var(--accent-cyan)]">
                {isochrone.tradeAreaAnalysis.fiveMinute.estimatedPopulation.toLocaleString()}
              </p>
              <p className="text-xs text-[var(--text-muted)]">pop.</p>
            </div>
            <div className="p-2 rounded-lg bg-[var(--bg-secondary)]">
              <p className="text-xs text-[var(--text-muted)]">10 min</p>
              <p className="text-sm font-bold text-[var(--accent-cyan)]">
                {isochrone.tradeAreaAnalysis.tenMinute.estimatedPopulation.toLocaleString()}
              </p>
              <p className="text-xs text-[var(--text-muted)]">pop.</p>
            </div>
            <div className="p-2 rounded-lg bg-[var(--bg-secondary)]">
              <p className="text-xs text-[var(--text-muted)]">15 min</p>
              <p className="text-sm font-bold text-[var(--accent-cyan)]">
                {isochrone.tradeAreaAnalysis.fifteenMinute.estimatedPopulation.toLocaleString()}
              </p>
              <p className="text-xs text-[var(--text-muted)]">pop.</p>
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)] text-center mt-2">
            {isochrone.radiusComparison.urbanDensity.charAt(0).toUpperCase() + isochrone.radiusComparison.urbanDensity.slice(1)} density area
          </p>
        </div>
      )}
    </div>
  );
}
