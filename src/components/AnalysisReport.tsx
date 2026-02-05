'use client';

import { useState } from 'react';
import { AnalysisResult } from '@/app/page';

interface AnalysisReportProps {
  analysis: AnalysisResult;
  address: string;
}

export default function AnalysisReport({ analysis, address }: AnalysisReportProps) {
  const [showAllSuitability, setShowAllSuitability] = useState(false);
  const INITIAL_SUITABILITY_COUNT = 4;
  const getScoreColor = (score: number) => {
    if (score >= 8) return 'from-green-400 to-emerald-500';
    if (score >= 6) return 'from-cyan-400 to-blue-500';
    if (score >= 4) return 'from-yellow-400 to-orange-500';
    return 'from-red-400 to-rose-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 8) return 'Excellent';
    if (score >= 6) return 'Good';
    if (score >= 4) return 'Fair';
    return 'Poor';
  };

  const getSuitabilityColor = (score: number) => {
    if (score >= 8) return 'bg-green-500';
    if (score >= 6) return 'bg-cyan-500';
    if (score >= 4) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getSuitabilityBg = (score: number) => {
    if (score >= 8) return 'bg-green-500/10 border-green-500/30';
    if (score >= 6) return 'bg-cyan-500/10 border-cyan-500/30';
    if (score >= 4) return 'bg-yellow-500/10 border-yellow-500/30';
    return 'bg-red-500/10 border-red-500/30';
  };

  const handleExportPDF = () => {
    // Create business suitability section if available
    const suitabilitySection = analysis.businessSuitability && analysis.businessSuitability.length > 0
      ? `
      BUSINESS SUITABILITY BY TRAFFIC (VPD)
      -------------------------------------
      ${analysis.businessSuitability.map(item =>
        `${item.category}: ${item.suitabilityScore}/10
       ${item.reasoning}
       Examples: ${item.examples.join(', ')}`
      ).join('\n\n')}`
      : '';

    // Create a printable version
    const printContent = `
      DRONE SENSE - SITE ANALYSIS REPORT
      ===================================

      Property: ${address}
      Generated: ${new Date().toLocaleString()}

      VIABILITY SCORE: ${analysis.viabilityScore}/10 (${getScoreLabel(analysis.viabilityScore)})

      SITE ANALYSIS
      -------------
      Terrain: ${analysis.terrain}
      Accessibility: ${analysis.accessibility}
      Existing Structures: ${analysis.existingStructures}
      Vegetation: ${analysis.vegetation}
      Lot Size Estimate: ${analysis.lotSizeEstimate}

      BUSINESS RECOMMENDATION
      -----------------------
      ${analysis.businessRecommendation}
      ${suitabilitySection}

      CONSTRUCTION POTENTIAL
      ----------------------
      ${analysis.constructionPotential}

      KEY FINDINGS
      ------------
      ${analysis.keyFindings.map((f, i) => `${i + 1}. ${f}`).join('\n')}

      RECOMMENDATIONS
      ---------------
      ${analysis.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}
    `;

    const blob = new Blob([printContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `site-analysis-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Header with Feasibility Score */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold mb-1">Site Analysis Report</h2>
          <p className="text-[var(--text-muted)] text-sm">{address}</p>
          <p className="text-[var(--text-muted)] text-xs mt-1">
            Generated: {new Date().toLocaleString()}
          </p>
        </div>
        <div className="text-center">
          <div className={`w-24 h-24 rounded-2xl bg-gradient-to-br ${getScoreColor(analysis.viabilityScore)} flex items-center justify-center`}>
            <span className="text-4xl font-bold text-white">{analysis.viabilityScore}</span>
          </div>
          <p className="text-sm mt-2 font-medium">{analysis.feasibilityScore?.rating || getScoreLabel(analysis.viabilityScore)}</p>
          <p className="text-xs text-[var(--text-muted)]">Feasibility Score</p>
        </div>
      </div>

      {/* Feasibility Score Breakdown */}
      {analysis.feasibilityScore && (
        <div className="mb-8 p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--accent-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Feasibility Score Breakdown
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Traffic Score */}
            <div className="text-center">
              <div className="relative w-16 h-16 mx-auto mb-2">
                <svg className="w-16 h-16 transform -rotate-90">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="var(--bg-secondary)" strokeWidth="6" />
                  <circle
                    cx="32" cy="32" r="28" fill="none"
                    stroke={analysis.feasibilityScore.breakdown.trafficScore >= 7 ? '#22c55e' : analysis.feasibilityScore.breakdown.trafficScore >= 5 ? '#eab308' : '#ef4444'}
                    strokeWidth="6"
                    strokeDasharray={`${analysis.feasibilityScore.breakdown.trafficScore * 17.6} 176`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
                  {analysis.feasibilityScore.breakdown.trafficScore}
                </span>
              </div>
              <p className="text-xs font-medium text-[var(--accent-cyan)]">Traffic</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">{analysis.feasibilityScore.details.traffic.split(' - ')[0]}</p>
            </div>

            {/* Demographics Score */}
            <div className="text-center">
              <div className="relative w-16 h-16 mx-auto mb-2">
                <svg className="w-16 h-16 transform -rotate-90">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="var(--bg-secondary)" strokeWidth="6" />
                  <circle
                    cx="32" cy="32" r="28" fill="none"
                    stroke={analysis.feasibilityScore.breakdown.demographicsScore >= 7 ? '#22c55e' : analysis.feasibilityScore.breakdown.demographicsScore >= 5 ? '#eab308' : '#ef4444'}
                    strokeWidth="6"
                    strokeDasharray={`${analysis.feasibilityScore.breakdown.demographicsScore * 17.6} 176`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
                  {analysis.feasibilityScore.breakdown.demographicsScore}
                </span>
              </div>
              <p className="text-xs font-medium text-[var(--accent-green)]">Demographics</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">{analysis.feasibilityScore.details.demographics.split(' - ')[0]}</p>
            </div>

            {/* Competition Score */}
            <div className="text-center">
              <div className="relative w-16 h-16 mx-auto mb-2">
                <svg className="w-16 h-16 transform -rotate-90">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="var(--bg-secondary)" strokeWidth="6" />
                  <circle
                    cx="32" cy="32" r="28" fill="none"
                    stroke={analysis.feasibilityScore.breakdown.competitionScore >= 7 ? '#22c55e' : analysis.feasibilityScore.breakdown.competitionScore >= 5 ? '#eab308' : '#ef4444'}
                    strokeWidth="6"
                    strokeDasharray={`${analysis.feasibilityScore.breakdown.competitionScore * 17.6} 176`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
                  {analysis.feasibilityScore.breakdown.competitionScore}
                </span>
              </div>
              <p className="text-xs font-medium text-[var(--accent-orange)]">Competition</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">{analysis.feasibilityScore.details.competition.split(' - ')[0]}</p>
            </div>

            {/* Access Score */}
            <div className="text-center">
              <div className="relative w-16 h-16 mx-auto mb-2">
                <svg className="w-16 h-16 transform -rotate-90">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="var(--bg-secondary)" strokeWidth="6" />
                  <circle
                    cx="32" cy="32" r="28" fill="none"
                    stroke={analysis.feasibilityScore.breakdown.accessScore >= 7 ? '#22c55e' : analysis.feasibilityScore.breakdown.accessScore >= 5 ? '#eab308' : '#ef4444'}
                    strokeWidth="6"
                    strokeDasharray={`${analysis.feasibilityScore.breakdown.accessScore * 17.6} 176`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
                  {analysis.feasibilityScore.breakdown.accessScore}
                </span>
              </div>
              <p className="text-xs font-medium text-[var(--accent-blue)]">Access</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">{analysis.feasibilityScore.details.access.split(' - ')[0]}</p>
            </div>
          </div>

          {/* Details */}
          <div className="mt-4 pt-4 border-t border-[var(--border-color)] grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            <p><span className="text-[var(--accent-cyan)]">Traffic:</span> {analysis.feasibilityScore.details.traffic}</p>
            <p><span className="text-[var(--accent-green)]">Demographics:</span> {analysis.feasibilityScore.details.demographics}</p>
            <p><span className="text-[var(--accent-orange)]">Competition:</span> {analysis.feasibilityScore.details.competition}</p>
            <p><span className="text-[var(--accent-blue)]">Access:</span> {analysis.feasibilityScore.details.access}</p>
          </div>
        </div>
      )}

      {/* District Type Indicator */}
      {analysis.districtType && (
        <div className={`mb-8 p-4 rounded-lg border ${
          analysis.districtType === 'historic_downtown'
            ? 'bg-amber-500/10 border-amber-500/30'
            : analysis.districtType === 'college_campus'
            ? 'bg-purple-500/10 border-purple-500/30'
            : analysis.districtType === 'highway_corridor'
            ? 'bg-blue-500/10 border-blue-500/30'
            : 'bg-[var(--bg-tertiary)] border-[var(--border-color)]'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              analysis.districtType === 'historic_downtown'
                ? 'bg-amber-500/20'
                : analysis.districtType === 'college_campus'
                ? 'bg-purple-500/20'
                : analysis.districtType === 'highway_corridor'
                ? 'bg-blue-500/20'
                : 'bg-[var(--accent-cyan)]/20'
            }`}>
              {analysis.districtType === 'historic_downtown' ? (
                <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              ) : analysis.districtType === 'college_campus' ? (
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                </svg>
              ) : analysis.districtType === 'highway_corridor' ? (
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-[var(--accent-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
              )}
            </div>
            <div>
              <h3 className={`font-semibold ${
                analysis.districtType === 'historic_downtown' ? 'text-amber-400' :
                analysis.districtType === 'college_campus' ? 'text-purple-400' :
                analysis.districtType === 'highway_corridor' ? 'text-blue-400' :
                'text-[var(--accent-cyan)]'
              }`}>
                {analysis.districtType === 'historic_downtown' ? 'Historic Downtown District' :
                 analysis.districtType === 'college_campus' ? 'College Campus Area' :
                 analysis.districtType === 'highway_corridor' ? 'Highway Corridor' :
                 analysis.districtType === 'suburban_retail' ? 'Suburban Retail' :
                 'Neighborhood Commercial'}
              </h3>
              <p className="text-sm text-[var(--text-secondary)]">{analysis.districtDescription}</p>
            </div>
          </div>
        </div>
      )}

      {/* Downtown-Specific Recommendations */}
      {analysis.downtownRecommendations && (
        <div className="mb-8 p-4 bg-amber-500/5 rounded-lg border border-amber-500/20">
          <h3 className="text-lg font-semibold mb-4 text-amber-400 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            Downtown-Appropriate Businesses
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <h4 className="text-xs text-amber-400/70 uppercase tracking-wider mb-2">Dining</h4>
              <div className="space-y-1">
                {analysis.downtownRecommendations.dining.slice(0, 4).map((item, i) => (
                  <p key={i} className="text-sm text-[var(--text-secondary)]">{item}</p>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-xs text-amber-400/70 uppercase tracking-wider mb-2">Retail</h4>
              <div className="space-y-1">
                {analysis.downtownRecommendations.retail.slice(0, 4).map((item, i) => (
                  <p key={i} className="text-sm text-[var(--text-secondary)]">{item}</p>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-xs text-amber-400/70 uppercase tracking-wider mb-2">Services</h4>
              <div className="space-y-1">
                {analysis.downtownRecommendations.services.slice(0, 4).map((item, i) => (
                  <p key={i} className="text-sm text-[var(--text-secondary)]">{item}</p>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-xs text-amber-400/70 uppercase tracking-wider mb-2">Entertainment</h4>
              <div className="space-y-1">
                {analysis.downtownRecommendations.entertainment.slice(0, 4).map((item, i) => (
                  <p key={i} className="text-sm text-[var(--text-secondary)]">{item}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Selections Summary */}
      {((analysis.businessSuitability?.length ?? 0) > 0 || (analysis.retailerMatches?.matches?.length ?? 0) > 0) && (
        <div className="mb-8 p-4 bg-gradient-to-br from-[var(--accent-cyan)]/10 to-[var(--accent-green)]/10 rounded-lg border border-[var(--accent-cyan)]/30">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--accent-yellow)]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            Top Selections for This Site
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top Business Categories */}
            {analysis.businessSuitability && analysis.businessSuitability.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-[var(--accent-cyan)] mb-2 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  Best Business Categories
                </h4>
                <div className="space-y-2">
                  {[...analysis.businessSuitability]
                    .sort((a, b) => b.suitabilityScore - a.suitabilityScore)
                    .slice(0, 3)
                    .map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-[var(--bg-primary)]/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            index === 0 ? 'bg-yellow-500 text-black' :
                            index === 1 ? 'bg-gray-300 text-black' :
                            'bg-amber-700 text-white'
                          }`}>
                            {index + 1}
                          </span>
                          <span className="text-sm font-medium">{item.category}</span>
                        </div>
                        <span className={`text-sm font-bold ${
                          item.suitabilityScore >= 8 ? 'text-green-400' :
                          item.suitabilityScore >= 6 ? 'text-cyan-400' : 'text-yellow-400'
                        }`}>
                          {item.suitabilityScore}/10
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Top Retailer Matches */}
            {analysis.retailerMatches && analysis.retailerMatches.matches.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-[var(--accent-purple)] mb-2 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Best Retailer Matches
                </h4>
                <div className="space-y-2">
                  {analysis.retailerMatches.matches
                    .slice(0, 3)
                    .map((retailer, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-[var(--bg-primary)]/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            index === 0 ? 'bg-yellow-500 text-black' :
                            index === 1 ? 'bg-gray-300 text-black' :
                            'bg-amber-700 text-white'
                          }`}>
                            {index + 1}
                          </span>
                          <div>
                            <span className="text-sm font-medium">{retailer.name}</span>
                            <span className="text-xs text-[var(--text-muted)] ml-2">{retailer.category}</span>
                          </div>
                        </div>
                        <span className={`text-sm font-bold ${
                          retailer.matchScore >= 70 ? 'text-green-400' :
                          retailer.matchScore >= 50 ? 'text-cyan-400' : 'text-yellow-400'
                        }`}>
                          {retailer.matchScore}%
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Site Analysis Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-[var(--accent-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
            </svg>
            <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Terrain</span>
          </div>
          <p className="text-sm">{analysis.terrain}</p>
        </div>

        <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-[var(--accent-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Accessibility</span>
          </div>
          <p className="text-sm">{analysis.accessibility}</p>
        </div>

        <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-[var(--accent-orange)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Structures</span>
          </div>
          <p className="text-sm">{analysis.existingStructures}</p>
        </div>

        <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-[var(--accent-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Vegetation</span>
          </div>
          <p className="text-sm">{analysis.vegetation}</p>
        </div>

        <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-[var(--accent-blue)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Lot Size</span>
          </div>
          <p className="text-sm">{analysis.lotSizeEstimate}</p>
        </div>
      </div>

      {/* Top Recommendations - Not In Area */}
      {analysis.topRecommendations && analysis.topRecommendations.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--accent-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Top Recommendations (Not Currently in Area)
          </h3>
          <div className="flex flex-wrap gap-2">
            {analysis.topRecommendations.slice(0, 10).map((rec, index) => (
              <span
                key={index}
                className="px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-full text-sm font-medium text-green-400"
              >
                {rec}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Business Recommendation */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-[var(--accent-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Business Recommendation
        </h3>
        <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border-l-4 border-[var(--accent-cyan)]">
          <p className="text-[var(--text-primary)]">{analysis.businessRecommendation}</p>
        </div>
      </div>

      {/* Business Suitability by VPD */}
      {analysis.businessSuitability && analysis.businessSuitability.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--accent-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Business Suitability Analysis
            <span className="text-xs text-[var(--text-muted)] font-normal ml-2">
              ({analysis.businessSuitability.length} categories)
            </span>
          </h3>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            Suitability scores based on traffic volume, demographics, and lot size requirements
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(showAllSuitability
              ? analysis.businessSuitability
              : analysis.businessSuitability.slice(0, INITIAL_SUITABILITY_COUNT)
            ).map((item, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${getSuitabilityBg(item.suitabilityScore)}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{item.category}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getSuitabilityColor(item.suitabilityScore)} rounded-full transition-all`}
                        style={{ width: `${item.suitabilityScore * 10}%` }}
                      />
                    </div>
                    <span className={`text-sm font-bold ${
                      item.suitabilityScore >= 8 ? 'text-green-400' :
                      item.suitabilityScore >= 6 ? 'text-cyan-400' :
                      item.suitabilityScore >= 4 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {item.suitabilityScore}/10
                    </span>
                  </div>
                </div>
                <p className="text-xs text-[var(--text-muted)] mb-1">{item.reasoning}</p>
                {item.lotSizeIssue && (
                  <p className="text-xs text-orange-400 mb-1 font-medium flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {item.lotSizeIssue}
                  </p>
                )}
                {item.existingInArea && item.existingInArea.length > 0 && (
                  <p className="text-xs text-red-400 mb-1">
                    Already in area: {item.existingInArea.join(', ')}
                  </p>
                )}
                <p className="text-xs text-[var(--text-secondary)]">
                  Available: {item.examples.slice(0, 3).join(', ')}
                </p>
              </div>
            ))}
          </div>
          {analysis.businessSuitability.length > INITIAL_SUITABILITY_COUNT && (
            <button
              onClick={() => setShowAllSuitability(!showAllSuitability)}
              className="mt-4 w-full py-2 px-4 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center justify-center gap-2"
            >
              {showAllSuitability ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                  Show Less
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  Show More ({analysis.businessSuitability.length - INITIAL_SUITABILITY_COUNT} more)
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Retailer Expansion Intelligence */}
      {analysis.retailerMatches && analysis.retailerMatches.matches.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--accent-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Retailer Expansion Intelligence
          </h3>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            {analysis.retailerMatches.totalMatches} retailers actively expanding match this site's characteristics
          </p>
          <div className="space-y-3">
            {analysis.retailerMatches.matches.slice(0, 10).map((retailer, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  retailer.matchScore >= 70 ? 'bg-green-500/10 border-green-500/30' :
                  retailer.matchScore >= 50 ? 'bg-cyan-500/10 border-cyan-500/30' :
                  'bg-yellow-500/10 border-yellow-500/30'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-base">{retailer.name}</h4>
                    <p className="text-xs text-[var(--text-muted)]">{retailer.category}</p>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${
                      retailer.matchScore >= 70 ? 'text-green-400' :
                      retailer.matchScore >= 50 ? 'text-cyan-400' : 'text-yellow-400'
                    }`}>
                      {retailer.matchScore}%
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">Match</p>
                  </div>
                </div>

                {/* Match Details Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 text-xs">
                  <div className={`px-2 py-1 rounded ${retailer.matchDetails.lotSize.matches ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                    <span className="font-medium">Lot:</span> {retailer.matchDetails.lotSize.matches ? '✓' : '✗'}
                  </div>
                  <div className={`px-2 py-1 rounded ${retailer.matchDetails.traffic.matches ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                    <span className="font-medium">Traffic:</span> {retailer.matchDetails.traffic.matches ? '✓' : '✗'}
                  </div>
                  <div className={`px-2 py-1 rounded ${retailer.matchDetails.demographics.matches ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                    <span className="font-medium">Demo:</span> {retailer.matchDetails.demographics.matches ? '✓' : '✗'}
                  </div>
                  <div className={`px-2 py-1 rounded ${retailer.matchDetails.region.matches ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                    <span className="font-medium">Region:</span> {retailer.matchDetails.region.matches ? '✓' : '✗'}
                  </div>
                </div>

                {/* Expansion & Franchise Info */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {retailer.activelyExpanding && (
                    <span className="px-2 py-0.5 bg-green-500/30 text-green-300 text-xs rounded-full font-medium">
                      Actively Expanding
                    </span>
                  )}
                  {retailer.franchiseAvailable && (
                    <span className="px-2 py-0.5 bg-blue-500/30 text-blue-300 text-xs rounded-full">
                      Franchise Available
                    </span>
                  )}
                  {retailer.corporateOnly && (
                    <span className="px-2 py-0.5 bg-purple-500/30 text-purple-300 text-xs rounded-full">
                      Corporate Only
                    </span>
                  )}
                </div>

                {/* Investment Info */}
                <div className="text-xs text-[var(--text-muted)] space-y-1">
                  {retailer.franchiseFee && (
                    <p>Franchise Fee: ${retailer.franchiseFee.toLocaleString()}</p>
                  )}
                  {retailer.totalInvestment && (
                    <p>Total Investment: {retailer.totalInvestment}</p>
                  )}
                  <p>Target Regions: {retailer.expansionRegions.join(', ')}</p>
                  {retailer.notes && (
                    <p className="italic text-[var(--accent-cyan)]">{retailer.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Construction Potential */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-[var(--accent-orange)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          Construction Potential
        </h3>
        <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg">
          <p className="text-[var(--text-primary)]">{analysis.constructionPotential}</p>
        </div>
      </div>

      {/* Key Findings & Recommendations */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--accent-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Key Findings
          </h3>
          <ul className="space-y-2">
            {analysis.keyFindings.map((finding, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <span className="text-[var(--accent-green)] mt-1">▸</span>
                <span>{finding}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--accent-blue)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Recommendations
          </h3>
          <ul className="space-y-2">
            {analysis.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <span className="text-[var(--accent-blue)] mt-1">▸</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Export Button */}
      <div className="flex justify-end pt-4 border-t border-[var(--border-color)]">
        <button onClick={handleExportPDF} className="btn-secondary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export Report
        </button>
      </div>
    </div>
  );
}
