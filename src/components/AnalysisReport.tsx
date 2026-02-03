'use client';

import { AnalysisResult } from '@/app/page';

interface AnalysisReportProps {
  analysis: AnalysisResult;
  address: string;
}

export default function AnalysisReport({ analysis, address }: AnalysisReportProps) {
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
      {/* Header with Score */}
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
          <p className="text-sm mt-2 font-medium">{getScoreLabel(analysis.viabilityScore)}</p>
          <p className="text-xs text-[var(--text-muted)]">Viability Score</p>
        </div>
      </div>

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
            Business Suitability by Traffic (VPD)
          </h3>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            Suitability scores based on traffic volume requirements for each business type
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {analysis.businessSuitability.map((item, index) => (
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
                <p className="text-xs text-[var(--text-secondary)]">
                  Examples: {item.examples.slice(0, 3).join(', ')}
                </p>
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
