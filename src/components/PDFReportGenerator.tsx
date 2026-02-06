'use client';

import { useState } from 'react';
import { PropertyData } from '@/app/page';

interface PDFReportGeneratorProps {
  propertyData: PropertyData;
  address: string;
}

export default function PDFReportGenerator({ propertyData, address }: PDFReportGeneratorProps) {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const generateReport = async () => {
    if (!propertyData.analysis) {
      alert('Please run an analysis first');
      return;
    }

    setGenerating(true);
    setProgress(10);

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 80));
      }, 200);

      // Generate the report content
      const reportContent = generateReportContent();

      clearInterval(progressInterval);
      setProgress(90);

      // Create and download the file
      const blob = new Blob([reportContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `site-analysis-report-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setProgress(100);

      // Reset after a brief delay
      setTimeout(() => {
        setGenerating(false);
        setProgress(0);
      }, 1000);
    } catch (error) {
      console.error('Report generation failed:', error);
      alert('Failed to generate report');
      setGenerating(false);
      setProgress(0);
    }
  };

  const generateReportContent = (): string => {
    const { analysis, trafficData, demographicsData, businesses, environmentalRisk, marketComps } = propertyData;
    const now = new Date();

    let report = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                       DRONE SENSE - COMMERCIAL SITE ANALYSIS                 ║
║                              COMPREHENSIVE REPORT                             ║
╚══════════════════════════════════════════════════════════════════════════════╝

Generated: ${now.toLocaleString()}
Property Address: ${address}
${propertyData.coordinates ? `Coordinates: ${propertyData.coordinates.lat.toFixed(6)}, ${propertyData.coordinates.lng.toFixed(6)}` : ''}

================================================================================
                              EXECUTIVE SUMMARY
================================================================================

Viability Score: ${analysis?.viabilityScore || 'N/A'}/10 (${getScoreLabel(analysis?.viabilityScore || 0)})

${analysis?.feasibilityScore ? `
Feasibility Breakdown:
  • Traffic Score: ${analysis.feasibilityScore.breakdown.trafficScore}/10
  • Demographics Score: ${analysis.feasibilityScore.breakdown.demographicsScore}/10
  • Competition Score: ${analysis.feasibilityScore.breakdown.competitionScore}/10
  • Access Score: ${analysis.feasibilityScore.breakdown.accessScore}/10
` : ''}

Key Recommendation: ${analysis?.businessRecommendation || 'N/A'}

================================================================================
                              TRAFFIC ANALYSIS
================================================================================

${trafficData ? `
Estimated VPD: ${trafficData.estimatedVPD.toLocaleString()} vehicles per day
VPD Range: ${trafficData.vpdRange}
Road Type: ${trafficData.roadType}
Traffic Level: ${trafficData.trafficLevel}
Congestion: ${trafficData.congestionPercent}%
` : 'Traffic data not available'}

================================================================================
                           DEMOGRAPHICS ANALYSIS
================================================================================

${demographicsData ? `
Population: ${demographicsData.population?.toLocaleString() || 'N/A'}
Median Household Income: $${demographicsData.medianHouseholdIncome?.toLocaleString() || 'N/A'}
${demographicsData.isCollegeTown ? 'College Town: Yes' : ''}
${demographicsData.multiRadius ? `
Population by Radius:
  • 1 Mile: ${demographicsData.multiRadius.oneMile.population.toLocaleString()}
  • 3 Miles: ${demographicsData.multiRadius.threeMile.population.toLocaleString()}
  • 5 Miles: ${demographicsData.multiRadius.fiveMile.population.toLocaleString()}
` : ''}
` : 'Demographics data not available'}

================================================================================
                             MARKET ANALYSIS
================================================================================

Nearby Businesses: ${businesses?.length || 0}

${businesses && businesses.length > 0 ? `
Top Nearby Businesses:
${businesses.slice(0, 10).map(b => `  • ${b.name} (${b.type}) - ${b.distance}`).join('\n')}
` : ''}

${marketComps && marketComps.length > 0 ? `
Comparable Sales:
${marketComps.slice(0, 5).map(c => `  • ${c.address}: $${c.salePrice.toLocaleString()} ($${c.pricePerSqft}/sqft)`).join('\n')}

Average Price per SqFt: $${Math.round(marketComps.reduce((sum, c) => sum + c.pricePerSqft, 0) / marketComps.length)}
` : ''}

================================================================================
                          ENVIRONMENTAL RISK ASSESSMENT
================================================================================

${environmentalRisk ? `
Overall Risk Score: ${environmentalRisk.overallRiskScore}/100 (${environmentalRisk.overallRiskScore >= 70 ? 'Low Risk' : environmentalRisk.overallRiskScore >= 40 ? 'Moderate Risk' : 'High Risk'})

Flood Zone: ${environmentalRisk.floodZone.zone} (${environmentalRisk.floodZone.risk} risk)
  ${environmentalRisk.floodZone.description}

Wetlands: ${environmentalRisk.wetlands.present ? 'Present within 500m' : 'None detected nearby'}

Brownfields: ${environmentalRisk.brownfields.present ? `${environmentalRisk.brownfields.count} site(s) within 1 mile` : 'None detected'}

Superfund Sites: ${environmentalRisk.superfund.present ? `${environmentalRisk.superfund.count} site(s) nearby` : 'None detected'}

${environmentalRisk.riskFactors && environmentalRisk.riskFactors.length > 0 ? `
Risk Factors:
${environmentalRisk.riskFactors.map(f => `  ⚠ ${f}`).join('\n')}
` : ''}
` : 'Environmental data not available'}

================================================================================
                           BUSINESS SUITABILITY
================================================================================

${analysis?.businessSuitability && analysis.businessSuitability.length > 0 ? `
${analysis.businessSuitability.map(b => `
${b.category}: ${b.suitabilityScore}/10
  ${b.reasoning}
  Available options: ${b.examples.slice(0, 3).join(', ')}
`).join('\n')}
` : 'No suitability analysis available'}

================================================================================
                           RETAILER MATCHES
================================================================================

${analysis?.retailerMatches && analysis.retailerMatches.matches.length > 0 ? `
Total Matches: ${analysis.retailerMatches.totalMatches}

Top Matches:
${analysis.retailerMatches.matches.slice(0, 5).map(r => `
  ${r.name} (${r.category})
  Match Score: ${r.matchScore}%
  ${r.activelyExpanding ? '✓ Actively Expanding' : ''}
  ${r.franchiseAvailable ? '✓ Franchise Available' : ''}
  ${r.totalInvestment ? `Investment: ${r.totalInvestment}` : ''}
`).join('\n')}
` : 'No retailer matches available'}

================================================================================
                              SITE DETAILS
================================================================================

${analysis ? `
Terrain: ${analysis.terrain}
Accessibility: ${analysis.accessibility}
Existing Structures: ${analysis.existingStructures}
Vegetation: ${analysis.vegetation}
Lot Size Estimate: ${analysis.lotSizeEstimate}
` : 'Site details not available'}

================================================================================
                           KEY FINDINGS
================================================================================

${analysis?.keyFindings && analysis.keyFindings.length > 0 ? `
${analysis.keyFindings.map((f, i) => `${i + 1}. ${f}`).join('\n')}
` : 'No key findings available'}

================================================================================
                           RECOMMENDATIONS
================================================================================

${analysis?.recommendations && analysis.recommendations.length > 0 ? `
${analysis.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}
` : 'No recommendations available'}

================================================================================
                           CONSTRUCTION POTENTIAL
================================================================================

${analysis?.constructionPotential || 'Not available'}

================================================================================
                              DISCLAIMER
================================================================================

This report is generated for informational purposes only. All data should be
verified through official sources before making any investment decisions.
Environmental assessments, property values, and market conditions are subject
to change. Consult with qualified professionals before proceeding.

--------------------------------------------------------------------------------
                    Generated by DRONE SENSE AI Site Analysis
                           https://drone-sense.vercel.app
--------------------------------------------------------------------------------
`;

    return report;
  };

  const getScoreLabel = (score: number) => {
    if (score >= 8) return 'Excellent';
    if (score >= 6) return 'Good';
    if (score >= 4) return 'Fair';
    return 'Poor';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Generate PDF Report</h3>
          <p className="text-sm text-[var(--text-muted)]">
            Download a comprehensive analysis report
          </p>
        </div>
        <button
          onClick={generateReport}
          disabled={generating || !propertyData.analysis}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          {generating ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Report
            </>
          )}
        </button>
      </div>

      {generating && (
        <div className="space-y-2">
          <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-blue)] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-[var(--text-muted)] text-center">
            {progress < 30 && 'Gathering data...'}
            {progress >= 30 && progress < 60 && 'Processing analysis...'}
            {progress >= 60 && progress < 90 && 'Generating report...'}
            {progress >= 90 && 'Finalizing...'}
          </p>
        </div>
      )}

      <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
        <h4 className="font-medium mb-2 text-sm">Report Includes:</h4>
        <ul className="grid grid-cols-2 gap-2 text-sm text-[var(--text-secondary)]">
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--accent-green)]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Executive Summary
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--accent-green)]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Traffic Analysis
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--accent-green)]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Demographics
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--accent-green)]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Market Analysis
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--accent-green)]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Risk Assessment
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--accent-green)]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Retailer Matches
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--accent-green)]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Recommendations
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--accent-green)]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Site Details
          </li>
        </ul>
      </div>
    </div>
  );
}
