'use client';

import { useState, useEffect } from 'react';
import { LocationIntelligence as LocationIntelligenceType } from '@/types';
import DataSourceTooltip, { DATA_SOURCES } from '@/components/ui/DataSourceTooltip';

interface LocationIntelligenceProps {
  coordinates: { lat: number; lng: number };
  onDataLoaded?: (data: LocationIntelligenceType) => void;
}

export default function LocationIntelligence({ coordinates, onDataLoaded }: LocationIntelligenceProps) {
  const [data, setData] = useState<LocationIntelligenceType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!coordinates) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/location-intelligence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: coordinates.lat, lng: coordinates.lng }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch location intelligence');
        }

        const result = await response.json();
        setData(result);
        onDataLoaded?.(result);
      } catch (err) {
        console.error('Location intelligence error:', err);
        setError('Failed to load location data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [coordinates?.lat, coordinates?.lng]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-8 bg-[var(--bg-tertiary)] rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-32 bg-[var(--bg-tertiary)] rounded"></div>
            <div className="h-32 bg-[var(--bg-tertiary)] rounded"></div>
            <div className="h-32 bg-[var(--bg-tertiary)] rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const { opportunityZone, daytimePopulation, highwayAccess } = data;

  return (
    <div className="space-y-6">
      {/* Opportunity Zone Banner */}
      {opportunityZone.isInZone && (
        <div className="p-4 bg-green-500/15 border border-green-500/40 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-green-400 flex items-center gap-2">
                Qualified Opportunity Zone
                <span className="px-2 py-0.5 bg-green-500/30 text-green-300 text-xs rounded-full">
                  Tax Incentive
                </span>
              </h4>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                This property is located in a federally designated Opportunity Zone
                {opportunityZone.tractId && ` (Tract: ${opportunityZone.tractId})`}
              </p>
              {opportunityZone.investmentBenefits && (
                <div className="mt-3">
                  <p className="text-xs text-[var(--text-muted)] mb-2">Investment Benefits:</p>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-1">
                    {opportunityZone.investmentBenefits.slice(0, 4).map((benefit, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                        <svg className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Data Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Highway Access */}
        <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold flex items-center gap-2 text-sm">
              <svg className="w-5 h-5 text-[var(--accent-blue)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Highway Access
            </h4>
            {highwayAccess.hasDirectAccess && (
              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                Direct Access
              </span>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--text-muted)]">Nearest Highway</span>
              <span className="text-sm font-semibold text-[var(--accent-cyan)]">
                {highwayAccess.nearestHighway}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--text-muted)]">Distance</span>
              <span className="text-sm font-medium">
                {highwayAccess.distanceMiles.toFixed(1)} miles
              </span>
            </div>
            {highwayAccess.driveTimeMinutes && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-[var(--text-muted)]">Est. Drive Time</span>
                <span className="text-sm font-medium">
                  {highwayAccess.driveTimeMinutes} min
                </span>
              </div>
            )}
            {highwayAccess.interchangeName && (
              <div className="text-xs text-[var(--text-muted)] mt-2 pt-2 border-t border-[var(--border-color)]">
                Nearest: {highwayAccess.interchangeName}
              </div>
            )}
          </div>
        </div>

        {/* Daytime Population */}
        <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold flex items-center gap-2 text-sm">
              <svg className="w-5 h-5 text-[var(--accent-orange)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <DataSourceTooltip source={{ name: 'Census LEHD', description: 'Census Bureau employment data', url: 'https://lehd.ces.census.gov/', type: 'api' }}>
                Daytime Population
              </DataSourceTooltip>
            </h4>
            <span className={`px-2 py-0.5 text-xs rounded-full ${
              daytimePopulation.populationType === 'commercial'
                ? 'bg-blue-500/20 text-blue-400'
                : daytimePopulation.populationType === 'residential'
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {daytimePopulation.populationType.charAt(0).toUpperCase() + daytimePopulation.populationType.slice(1)}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--text-muted)]">Workers (Daytime)</span>
              <span className="text-sm font-semibold text-[var(--accent-green)]">
                {daytimePopulation.totalWorkers.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--text-muted)]">Residents</span>
              <span className="text-sm font-medium">
                {daytimePopulation.totalResidents.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--text-muted)]">Worker/Resident Ratio</span>
              <span className={`text-sm font-medium ${
                daytimePopulation.workerToResidentRatio > 1
                  ? 'text-[var(--accent-green)]'
                  : 'text-[var(--text-secondary)]'
              }`}>
                {daytimePopulation.workerToResidentRatio.toFixed(2)}x
              </span>
            </div>
          </div>

          {daytimePopulation.topIndustries && daytimePopulation.topIndustries.length > 0 && (
            <div className="mt-3 pt-2 border-t border-[var(--border-color)]">
              <p className="text-xs text-[var(--text-muted)] mb-1">Top Industries:</p>
              <div className="flex flex-wrap gap-1">
                {daytimePopulation.topIndustries.slice(0, 3).map((ind, idx) => (
                  <span key={idx} className="px-2 py-0.5 bg-[var(--bg-secondary)] text-xs rounded">
                    {ind.industry}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Opportunity Zone Status (if not in zone) */}
        {!opportunityZone.isInZone && (
          <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold flex items-center gap-2 text-sm">
                <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                <DataSourceTooltip source={{ name: 'Treasury CDFI', description: 'CDFI Fund Opportunity Zone data', url: 'https://www.cdfifund.gov/opportunity-zones', type: 'api' }}>
                  Opportunity Zone
                </DataSourceTooltip>
              </h4>
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              This property is not located in a designated Opportunity Zone.
            </p>
            {opportunityZone.tractId && (
              <p className="text-xs text-[var(--text-muted)] mt-2">
                Census Tract: {opportunityZone.tractId}
              </p>
            )}
          </div>
        )}

        {/* Summary Card (when in OZ) */}
        {opportunityZone.isInZone && (
          <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
            <h4 className="font-semibold text-sm mb-3">Location Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                {highwayAccess.hasDirectAccess ? (
                  <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                )}
                <span className="text-[var(--text-secondary)]">
                  {highwayAccess.hasDirectAccess ? 'Direct highway access' : `${highwayAccess.distanceMiles.toFixed(1)} mi to ${highwayAccess.nearestHighway}`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {daytimePopulation.populationType === 'commercial' ? (
                  <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                )}
                <span className="text-[var(--text-secondary)]">
                  {daytimePopulation.populationType === 'commercial'
                    ? 'High daytime worker population'
                    : daytimePopulation.populationType === 'residential'
                      ? 'Primarily residential area'
                      : 'Mixed use area'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-[var(--text-secondary)]">
                  Opportunity Zone tax benefits available
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
