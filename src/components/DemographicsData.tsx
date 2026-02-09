'use client';

import { useState, useEffect } from 'react';
import { DemographicsData as DemographicsDataType } from '@/types/demographics';

interface DemographicsDataProps {
  coordinates: { lat: number; lng: number } | null;
  onDataLoad?: (data: DemographicsDataType | null) => void;
}

export default function DemographicsData({ coordinates, onDataLoad }: DemographicsDataProps) {
  const [loading, setLoading] = useState(false);
  const [demographics, setDemographics] = useState<DemographicsDataType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDemographics = async () => {
    if (!coordinates) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/demographics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinates }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || data.error || 'Failed to fetch demographics');
        setDemographics(null);
        onDataLoad?.(null);
      } else {
        setDemographics(data);
        onDataLoad?.(data);
      }
    } catch (err) {
      setError('Failed to fetch demographics data');
      setDemographics(null);
      onDataLoad?.(null);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch when coordinates change
  useEffect(() => {
    if (coordinates) {
      fetchDemographics();
    }
  }, [coordinates?.lat, coordinates?.lng]);

  const getIncomeLevelColor = (level: string) => {
    switch (level) {
      case 'low':
        return 'text-[var(--accent-red)]';
      case 'moderate':
        return 'text-[var(--accent-yellow)]';
      case 'middle':
        return 'text-[var(--accent-cyan)]';
      case 'upper-middle':
        return 'text-[var(--accent-green)]';
      case 'high':
        return 'text-[var(--accent-purple)]';
      default:
        return 'text-[var(--text-primary)]';
    }
  };

  const getIncomeLevelBg = (level: string) => {
    switch (level) {
      case 'low':
        return 'bg-red-500/20 border-red-500/30';
      case 'moderate':
        return 'bg-yellow-500/20 border-yellow-500/30';
      case 'middle':
        return 'bg-cyan-500/20 border-cyan-500/30';
      case 'upper-middle':
        return 'bg-green-500/20 border-green-500/30';
      case 'high':
        return 'bg-purple-500/20 border-purple-500/30';
      default:
        return 'bg-[var(--bg-tertiary)] border-[var(--border-color)]';
    }
  };

  const formatIncome = (income: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(income);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[var(--text-primary)]">Demographics</h3>
        <button
          onClick={fetchDemographics}
          disabled={loading || !coordinates}
          className="btn-secondary text-xs py-1 px-3 flex items-center gap-1"
        >
          {loading ? (
            <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
          ) : (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          Refresh
        </button>
      </div>

      {/* No Location Warning */}
      {!coordinates && (
        <div className="text-center py-8 border border-dashed border-[var(--border-color)] rounded-lg">
          <svg className="w-10 h-10 mx-auto mb-2 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-[var(--text-muted)] text-sm">
            Enter an address to get demographics
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-[var(--accent-red)]/10 border border-[var(--accent-red)]/30 rounded-lg">
          <p className="text-[var(--accent-red)] text-sm">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && coordinates && (
        <div className="text-center py-6 text-[var(--text-muted)] text-sm">
          <svg className="animate-spin w-6 h-6 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          Loading demographics...
        </div>
      )}

      {/* Demographics Data */}
      {demographics && !loading && (
        <div className="space-y-4">
          {/* College Town Indicator */}
          {demographics.isCollegeTown && (
            <div className="p-3 rounded-lg border bg-purple-500/20 border-purple-500/30">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                </svg>
                <div>
                  <p className="font-semibold text-purple-300">College Town Market</p>
                  <p className="text-xs text-purple-300/80">
                    {demographics.nearbyUniversities && demographics.nearbyUniversities.length > 0 ? (
                      <>Near {demographics.nearbyUniversities[0].name} ({demographics.collegeEnrollment.toLocaleString()} students)</>
                    ) : (
                      <>{demographics.collegeEnrollmentPercent}% students ({demographics.collegeEnrollment.toLocaleString()} enrolled)</>
                    )}
                  </p>
                </div>
              </div>
              <p className="text-xs text-purple-300/70 mt-2">
                Student spending power often exceeds census income data due to parental support and financial aid.
              </p>
            </div>
          )}

          {/* Income Level - Prominent Display */}
          <div className={`p-4 rounded-lg border ${getIncomeLevelBg(demographics.incomeLevel)}`}>
            <div className="text-center">
              <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Median Household Income</span>
              <p className={`text-3xl font-bold ${getIncomeLevelColor(demographics.incomeLevel)}`}>
                {formatIncome(demographics.medianHouseholdIncome)}
              </p>
              <p className={`text-sm font-medium mt-1 ${getIncomeLevelColor(demographics.incomeLevel)}`}>
                {demographics.incomeLevel.replace('-', ' ').toUpperCase()} INCOME AREA
                {demographics.isCollegeTown && (
                  <span className="text-purple-400 ml-2">(Student-skewed)</span>
                )}
              </p>
            </div>
          </div>

          {/* Consumer Profile */}
          <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-[var(--accent-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-xs text-[var(--text-muted)] uppercase">Consumer Profile</span>
            </div>
            <p className="font-semibold text-[var(--accent-cyan)]">{demographics.consumerProfile.type}</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">{demographics.consumerProfile.description}</p>
          </div>

          {/* Key Stats Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-[var(--bg-tertiary)] rounded border border-[var(--border-color)]">
              <span className="text-xs text-[var(--text-muted)]">Population</span>
              <p className="font-semibold">{demographics.population.toLocaleString()}</p>
            </div>
            <div className="p-2 bg-[var(--bg-tertiary)] rounded border border-[var(--border-color)]">
              <span className="text-xs text-[var(--text-muted)]">Median Age</span>
              <p className="font-semibold">{demographics.medianAge} years</p>
            </div>
            <div className="p-2 bg-[var(--bg-tertiary)] rounded border border-[var(--border-color)]">
              <span className="text-xs text-[var(--text-muted)]">Education (BA+)</span>
              <p className="font-semibold">{demographics.educationBachelorsOrHigher}%</p>
            </div>
            <div className="p-2 bg-[var(--bg-tertiary)] rounded border border-[var(--border-color)]">
              <span className="text-xs text-[var(--text-muted)]">Employment</span>
              <p className="font-semibold">{demographics.employmentRate}%</p>
            </div>
          </div>

          {/* Preferred Businesses */}
          <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
            <span className="text-xs text-[var(--text-muted)] uppercase">Businesses That Fit This Area</span>
            <div className="flex flex-wrap gap-1 mt-2">
              {demographics.consumerProfile.preferredBusinesses.slice(0, 8).map((business, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-1 bg-[var(--accent-cyan)]/20 text-[var(--accent-cyan)] rounded"
                >
                  {business}
                </span>
              ))}
              {demographics.consumerProfile.preferredBusinesses.length > 8 && (
                <span className="text-xs px-2 py-1 text-[var(--text-muted)]">
                  +{demographics.consumerProfile.preferredBusinesses.length - 8} more
                </span>
              )}
            </div>
          </div>

          {/* Source */}
          <p className="text-xs text-[var(--text-muted)] text-center">
            Source: {demographics.source}
          </p>
        </div>
      )}
    </div>
  );
}
