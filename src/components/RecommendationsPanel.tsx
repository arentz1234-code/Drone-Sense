'use client';

import { useState, useEffect, useMemo } from 'react';
import { TrafficInfo, ExtendedDemographics, Business, EnvironmentalRisk, AccessPoint } from '@/types';

// Business types for dropdown
const BUSINESS_TYPES = [
  { id: '', label: 'Any / General Analysis' },
  { id: 'qsr', label: 'Quick Service Restaurant (Fast Food)' },
  { id: 'fast_casual', label: 'Fast Casual Dining' },
  { id: 'casual_dining', label: 'Sit-Down Restaurant' },
  { id: 'coffee', label: 'Coffee Shop / Drive-Thru' },
  { id: 'retail_strip', label: 'Retail Strip Center' },
  { id: 'retail_standalone', label: 'Standalone Retail' },
  { id: 'gas_station', label: 'Gas Station / Convenience' },
  { id: 'bank', label: 'Bank / Financial Services' },
  { id: 'office', label: 'Office Building' },
  { id: 'medical', label: 'Medical / Healthcare' },
  { id: 'hotel', label: 'Hotel / Hospitality' },
  { id: 'auto_service', label: 'Auto Service / Car Wash' },
  { id: 'warehouse', label: 'Warehouse / Distribution' },
  { id: 'industrial', label: 'Industrial / Manufacturing' },
];

interface ScoreResult {
  score: 'A' | 'B' | 'C' | 'D' | 'F';
  value: number;
  insight: string;
  recommendation: string;
}

interface RecommendationData {
  overallScore: string;
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  summary: string;
  traffic: ScoreResult;
  access: ScoreResult;
  competition: ScoreResult;
  demographics: ScoreResult;
  siteConditions: ScoreResult;
  suggestedUses: string[];
  concerns: string[];
  strengths: string[];
  marketGaps: string[];
  keyTakeaways: string[];
}

interface RecommendationsPanelProps {
  coordinates: { lat: number; lng: number } | null;
  address: string;
  trafficData: TrafficInfo | null;
  demographicsData: ExtendedDemographics | null;
  businesses: Business[];
  environmentalRisk: EnvironmentalRisk | null;
  accessPoints: AccessPoint[];
  parcelInfo?: {
    acres?: number;
    zoning?: string;
  } | null;
}

function getGradeColor(grade: string): string {
  const g = grade.charAt(0);
  switch (g) {
    case 'A': return 'text-green-400';
    case 'B': return 'text-cyan-400';
    case 'C': return 'text-yellow-400';
    case 'D': return 'text-orange-400';
    case 'F': return 'text-red-400';
    default: return 'text-[var(--text-primary)]';
  }
}

function getGradeBg(grade: string): string {
  const g = grade.charAt(0);
  switch (g) {
    case 'A': return 'bg-green-500/20 border-green-500/30';
    case 'B': return 'bg-cyan-500/20 border-cyan-500/30';
    case 'C': return 'bg-yellow-500/20 border-yellow-500/30';
    case 'D': return 'bg-orange-500/20 border-orange-500/30';
    case 'F': return 'bg-red-500/20 border-red-500/30';
    default: return 'bg-[var(--bg-tertiary)] border-[var(--border-color)]';
  }
}

function getScoreBarColor(value: number): string {
  if (value >= 85) return 'bg-green-500';
  if (value >= 70) return 'bg-cyan-500';
  if (value >= 60) return 'bg-yellow-500';
  if (value >= 50) return 'bg-orange-500';
  return 'bg-red-500';
}

export default function RecommendationsPanel({
  coordinates,
  address,
  trafficData,
  demographicsData,
  businesses,
  environmentalRisk,
  accessPoints,
  parcelInfo,
}: RecommendationsPanelProps) {
  const [selectedBusinessType, setSelectedBusinessType] = useState('');
  const [recommendations, setRecommendations] = useState<RecommendationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Calculate derived data
  const derivedData = useMemo(() => {
    // Primary VPD from access points
    const primaryVpd = accessPoints.length > 0
      ? Math.max(...accessPoints.map(ap => ap.vpd || ap.estimatedVpd || 0))
      : trafficData?.estimatedVPD || null;

    // Count unique roads
    const uniqueRoads = new Set(accessPoints.map(ap => ap.roadName)).size;

    // Check for corner lot (2+ roads)
    const isCornerLot = uniqueRoads >= 2;

    // Check for highway access
    const hasHighwayAccess = accessPoints.some(ap =>
      ap.roadType?.includes('trunk') ||
      ap.roadType?.includes('motorway') ||
      ap.roadType?.includes('primary')
    );

    // Format nearby businesses
    const nearbyBusinesses = businesses.map(b => ({
      name: b.name,
      type: b.type || 'business',
      distance: b.distance || 0,
    }));

    // Flood risk
    const floodRisk = environmentalRisk?.floodZone?.risk as 'low' | 'medium' | 'high' | null;

    return {
      vpd: primaryVpd,
      accessPointCount: accessPoints.length,
      roadCount: uniqueRoads,
      isCornerLot,
      hasHighwayAccess,
      lotSizeAcres: parcelInfo?.acres || null,
      medianIncome: demographicsData?.medianHouseholdIncome || null,
      population: demographicsData?.population || null,
      nearbyBusinesses,
      floodRisk,
      zoning: parcelInfo?.zoning || null,
    };
  }, [accessPoints, trafficData, businesses, environmentalRisk, demographicsData, parcelInfo]);

  // Fetch recommendations when data changes
  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!coordinates) return;

      // Need at least some data
      const hasData = derivedData.vpd || derivedData.medianIncome || derivedData.nearbyBusinesses.length > 0;
      if (!hasData) return;

      setLoading(true);
      try {
        const response = await fetch('/api/recommendations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessType: selectedBusinessType || null,
            ...derivedData,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setRecommendations(data);
        }
      } catch (err) {
        console.error('Failed to fetch recommendations:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [coordinates, selectedBusinessType, derivedData]);

  if (!coordinates) {
    return (
      <div className="text-center py-12 text-[var(--text-muted)]">
        <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        <p>Enter an address to view AI recommendations</p>
      </div>
    );
  }

  const ScoreCard = ({ title, result, icon }: { title: string; result: ScoreResult; icon: React.ReactNode }) => {
    const isExpanded = expandedSection === title;

    return (
      <div
        className={`p-4 rounded-lg border cursor-pointer transition-all ${getGradeBg(result.score)} ${isExpanded ? 'ring-2 ring-[var(--accent-cyan)]' : ''}`}
        onClick={() => setExpandedSection(isExpanded ? null : title)}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-medium text-sm">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${getGradeColor(result.score)}`}>
              {result.score}
            </span>
            <svg
              className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Score bar */}
        <div className="h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all ${getScoreBarColor(result.value)}`}
            style={{ width: `${result.value}%` }}
          />
        </div>

        <p className="text-xs text-[var(--text-secondary)]">{result.insight}</p>

        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
            <p className="text-sm text-[var(--text-primary)]">
              <span className="font-medium text-[var(--accent-cyan)]">Recommendation:</span> {result.recommendation}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Business Type Selector */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-[var(--text-secondary)]">
          Intended Use:
        </label>
        <select
          value={selectedBusinessType}
          onChange={(e) => setSelectedBusinessType(e.target.value)}
          className="flex-1 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-cyan)]"
        >
          {BUSINESS_TYPES.map((type) => (
            <option key={type.id} value={type.id}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <svg className="animate-spin w-8 h-8 text-[var(--accent-cyan)]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
        </div>
      )}

      {!loading && recommendations && (
        <>
          {/* Overall Score */}
          <div className={`p-6 rounded-xl border-2 ${getGradeBg(recommendations.overallGrade)}`}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-1">Overall Site Rating</h3>
                <p className="text-sm text-[var(--text-secondary)]">{recommendations.summary}</p>
              </div>
              <div className="text-center">
                <div className={`text-5xl font-bold ${getGradeColor(recommendations.overallGrade)}`}>
                  {recommendations.overallScore}
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1">Site Grade</p>
              </div>
            </div>
          </div>

          {/* Key Takeaways */}
          {recommendations.keyTakeaways.length > 0 && (
            <div className="p-4 bg-[var(--accent-cyan)]/10 rounded-lg border border-[var(--accent-cyan)]/30">
              <h4 className="font-semibold text-[var(--accent-cyan)] mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Key Takeaways
              </h4>
              <ul className="space-y-2">
                {recommendations.keyTakeaways.map((takeaway, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-[var(--accent-cyan)] mt-0.5">•</span>
                    <span>{takeaway}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Score Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <ScoreCard
              title="Traffic"
              result={recommendations.traffic}
              icon={
                <svg className="w-5 h-5 text-[var(--accent-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              }
            />
            <ScoreCard
              title="Access"
              result={recommendations.access}
              icon={
                <svg className="w-5 h-5 text-[var(--accent-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              }
            />
            <ScoreCard
              title="Competition"
              result={recommendations.competition}
              icon={
                <svg className="w-5 h-5 text-[var(--accent-orange)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              }
            />
            <ScoreCard
              title="Demographics"
              result={recommendations.demographics}
              icon={
                <svg className="w-5 h-5 text-[var(--accent-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
            />
            <ScoreCard
              title="Site Conditions"
              result={recommendations.siteConditions}
              icon={
                <svg className="w-5 h-5 text-[var(--accent-blue)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                </svg>
              }
            />
          </div>

          {/* Suggested Uses */}
          {recommendations.suggestedUses.length > 0 && (
            <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-[var(--accent-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Suggested Uses
              </h4>
              <div className="flex flex-wrap gap-2">
                {recommendations.suggestedUses.map((use, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-full text-sm font-medium text-green-400"
                  >
                    {use}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Strengths and Concerns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Strengths */}
            {recommendations.strengths.length > 0 && (
              <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                <h4 className="font-semibold text-green-400 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Strengths
                </h4>
                <ul className="space-y-1">
                  {recommendations.strengths.map((strength, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-green-400">+</span>
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Concerns */}
            {recommendations.concerns.length > 0 && (
              <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                <h4 className="font-semibold text-red-400 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Concerns
                </h4>
                <ul className="space-y-1">
                  {recommendations.concerns.map((concern, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-red-400">!</span>
                      <span>{concern}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Market Gaps */}
          {recommendations.marketGaps.length > 0 && (
            <div className="p-4 bg-[var(--accent-purple)]/10 rounded-lg border border-[var(--accent-purple)]/30">
              <h4 className="font-semibold text-[var(--accent-purple)] mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Market Gaps Identified
              </h4>
              <ul className="space-y-1">
                {recommendations.marketGaps.map((gap, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-[var(--accent-purple)]">→</span>
                    <span>{gap}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Data Sources Note */}
          <p className="text-xs text-[var(--text-muted)] text-center">
            Recommendations based on: Traffic ({derivedData.vpd?.toLocaleString() || 'N/A'} VPD) •
            {derivedData.accessPointCount} access points •
            {derivedData.nearbyBusinesses.length} nearby businesses •
            ${(derivedData.medianIncome ? derivedData.medianIncome / 1000 : 0).toFixed(0)}K median income
          </p>
        </>
      )}

      {!loading && !recommendations && (
        <div className="text-center py-8 text-[var(--text-muted)]">
          <p>Loading data to generate recommendations...</p>
        </div>
      )}
    </div>
  );
}
