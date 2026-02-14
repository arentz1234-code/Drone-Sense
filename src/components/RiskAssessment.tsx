'use client';

import { EnvironmentalRisk } from '@/types';
import DataSourceTooltip, { DATA_SOURCES } from '@/components/ui/DataSourceTooltip';

interface RiskAssessmentProps {
  coordinates: { lat: number; lng: number };
  environmentalRisk: EnvironmentalRisk | null;
}

export default function RiskAssessment({ coordinates, environmentalRisk }: RiskAssessmentProps) {
  if (!environmentalRisk) {
    return (
      <div className="text-center py-12 text-[var(--text-muted)]">
        <svg className="w-12 h-12 mx-auto mb-4 opacity-50 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <p>Loading environmental risk data...</p>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-cyan-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Low Risk';
    if (score >= 60) return 'Moderate Risk';
    if (score >= 40) return 'Elevated Risk';
    return 'High Risk';
  };

  const getRiskIndicatorClass = (risk: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'low': return 'risk-indicator risk-low';
      case 'medium': return 'risk-indicator risk-medium';
      case 'high': return 'risk-indicator risk-high';
    }
  };

  // Get icon for risk level for WCAG accessibility
  const getRiskIcon = (risk: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'low': return '✓';
      case 'medium': return '△';
      case 'high': return '✕';
    }
  };

  return (
    <div className="space-y-8">
      {/* Overall Risk Score */}
      <div className="flex items-center justify-between p-6 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
        <div>
          <h3 className="text-xl font-bold mb-1">Environmental Risk Score</h3>
          <p className="text-[var(--text-muted)]">{getScoreLabel(environmentalRisk.overallRiskScore)}</p>
        </div>
        <div className="text-right">
          <div className={`text-5xl font-bold ${getScoreColor(environmentalRisk.overallRiskScore)}`}>
            {environmentalRisk.overallRiskScore}
          </div>
          <p className="text-sm text-[var(--text-muted)]">out of 100</p>
        </div>
      </div>

      {/* Risk Factors */}
      {environmentalRisk.riskFactors && environmentalRisk.riskFactors.length > 0 && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <h4 className="font-semibold text-yellow-400 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Risk Factors Identified
          </h4>
          <ul className="space-y-2">
            {environmentalRisk.riskFactors.map((factor, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                <span className="text-yellow-400 mt-1">▸</span>
                {factor}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Individual Risk Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Flood Zone */}
        <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold flex items-center gap-2">
              <svg className="w-5 h-5 text-[var(--accent-blue)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
              <DataSourceTooltip source={DATA_SOURCES.fema}>Flood Zone</DataSourceTooltip>
            </h4>
            <span className={getRiskIndicatorClass(environmentalRisk.floodZone.risk)}>
              <span aria-hidden="true">{getRiskIcon(environmentalRisk.floodZone.risk)}</span>{' '}
              {environmentalRisk.floodZone.risk.toUpperCase()}
            </span>
          </div>
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-[var(--text-muted)]">Zone:</span>{' '}
              <span className="font-medium">{environmentalRisk.floodZone.zone}</span>
            </p>
            <p className="text-[var(--text-secondary)]">{environmentalRisk.floodZone.description}</p>
          </div>
        </div>

        {/* Wetlands */}
        <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold flex items-center gap-2">
              <svg className="w-5 h-5 text-[var(--accent-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              <DataSourceTooltip source={DATA_SOURCES.fws}>Wetlands</DataSourceTooltip>
            </h4>
            <span className={getRiskIndicatorClass(environmentalRisk.wetlands.present ? 'medium' : 'low')}>
              <span aria-hidden="true">{getRiskIcon(environmentalRisk.wetlands.present ? 'medium' : 'low')}</span>{' '}
              {environmentalRisk.wetlands.present ? 'PRESENT' : 'NONE'}
            </span>
          </div>
          <div className="space-y-2 text-sm">
            {environmentalRisk.wetlands.present ? (
              <>
                <p className="text-[var(--text-secondary)]">
                  Wetlands detected within 500m of property
                </p>
                {environmentalRisk.wetlands.types && (
                  <p>
                    <span className="text-[var(--text-muted)]">Types:</span>{' '}
                    {environmentalRisk.wetlands.types.join(', ')}
                  </p>
                )}
              </>
            ) : (
              <p className="text-[var(--text-secondary)]">No wetlands detected nearby</p>
            )}
          </div>
        </div>

        {/* Brownfields */}
        <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold flex items-center gap-2">
              <svg className="w-5 h-5 text-[var(--accent-orange)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <DataSourceTooltip source={DATA_SOURCES.epa}>Brownfields</DataSourceTooltip>
            </h4>
            <span className={getRiskIndicatorClass(environmentalRisk.brownfields.present ? 'medium' : 'low')}>
              <span aria-hidden="true">{getRiskIcon(environmentalRisk.brownfields.present ? 'medium' : 'low')}</span>{' '}
              {environmentalRisk.brownfields.count > 0 ? `${environmentalRisk.brownfields.count} SITES` : 'NONE'}
            </span>
          </div>
          <div className="space-y-2 text-sm">
            {environmentalRisk.brownfields.present && environmentalRisk.brownfields.sites ? (
              <div className="space-y-1">
                {environmentalRisk.brownfields.sites.slice(0, 3).map((site, index) => (
                  <p key={index} className="text-[var(--text-secondary)]">
                    {site.name} ({site.distance.toFixed(1)} mi) - {site.status}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-[var(--text-secondary)]">No brownfield sites detected within 1 mile</p>
            )}
          </div>
        </div>

        {/* Superfund */}
        <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold flex items-center gap-2">
              <svg className="w-5 h-5 text-[var(--accent-red)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <DataSourceTooltip source={DATA_SOURCES.epa}>Superfund Sites</DataSourceTooltip>
            </h4>
            <span className={getRiskIndicatorClass(environmentalRisk.superfund.present ? 'high' : 'low')}>
              <span aria-hidden="true">{getRiskIcon(environmentalRisk.superfund.present ? 'high' : 'low')}</span>{' '}
              {environmentalRisk.superfund.count > 0 ? `${environmentalRisk.superfund.count} SITES` : 'NONE'}
            </span>
          </div>
          <div className="space-y-2 text-sm">
            {environmentalRisk.superfund.present && environmentalRisk.superfund.sites ? (
              <div className="space-y-1">
                {environmentalRisk.superfund.sites.map((site, index) => (
                  <p key={index} className="text-[var(--text-secondary)]">
                    {site.name} ({site.distance.toFixed(1)} mi) - {site.status}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-[var(--text-secondary)]">No Superfund sites detected nearby</p>
            )}
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
        <h4 className="font-semibold mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-[var(--accent-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Recommendations
        </h4>
        <ul className="space-y-2 text-sm">
          {environmentalRisk.overallRiskScore < 60 && (
            <li className="flex items-start gap-2">
              <span className="text-[var(--accent-cyan)] mt-1">▸</span>
              <span>Consider ordering a Phase I Environmental Site Assessment before purchase</span>
            </li>
          )}
          {environmentalRisk.floodZone.risk !== 'low' && (
            <li className="flex items-start gap-2">
              <span className="text-[var(--accent-cyan)] mt-1">▸</span>
              <span>Flood insurance may be required - verify with lender and insurance provider</span>
            </li>
          )}
          {environmentalRisk.wetlands.present && (
            <li className="flex items-start gap-2">
              <span className="text-[var(--accent-cyan)] mt-1">▸</span>
              <span>Consult with environmental attorney regarding wetland buffer requirements</span>
            </li>
          )}
          {environmentalRisk.brownfields.present && (
            <li className="flex items-start gap-2">
              <span className="text-[var(--accent-cyan)] mt-1">▸</span>
              <span>Research brownfield remediation status and potential liability issues</span>
            </li>
          )}
          {environmentalRisk.overallRiskScore >= 80 && (
            <li className="flex items-start gap-2">
              <span className="text-[var(--accent-green)] mt-1">▸</span>
              <span>Environmental profile is favorable - standard due diligence should suffice</span>
            </li>
          )}
        </ul>
      </div>

      {/* Map Reference */}
      <div className="text-center text-sm text-[var(--text-muted)]">
        <p>
          Analysis centered at: {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}
        </p>
        <p className="mt-1">
          Data sources: FEMA NFHL, NWI Wetlands, EPA Brownfields & Superfund databases
        </p>
      </div>
    </div>
  );
}
