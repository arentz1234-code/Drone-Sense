import { PropertyData, AnalysisResult, TrafficInfo, ExtendedDemographics, EnvironmentalRisk, MarketComp } from '@/app/page';

export interface ReportSection {
  title: string;
  content: string;
}

export interface ReportData {
  address: string;
  generatedAt: Date;
  coordinates?: { lat: number; lng: number };
  sections: ReportSection[];
}

export function generateReportData(propertyData: PropertyData, address: string): ReportData {
  const sections: ReportSection[] = [];

  // Executive Summary
  if (propertyData.analysis) {
    sections.push({
      title: 'Executive Summary',
      content: generateExecutiveSummary(propertyData.analysis),
    });
  }

  // Traffic Analysis
  if (propertyData.trafficData) {
    sections.push({
      title: 'Traffic Analysis',
      content: generateTrafficSection(propertyData.trafficData),
    });
  }

  // Demographics
  if (propertyData.demographicsData) {
    sections.push({
      title: 'Demographics Analysis',
      content: generateDemographicsSection(propertyData.demographicsData),
    });
  }

  // Market Analysis
  if (propertyData.businesses && propertyData.businesses.length > 0) {
    sections.push({
      title: 'Market Analysis',
      content: generateMarketSection(propertyData.businesses, propertyData.marketComps),
    });
  }

  // Environmental Risk
  if (propertyData.environmentalRisk) {
    sections.push({
      title: 'Environmental Risk Assessment',
      content: generateEnvironmentalSection(propertyData.environmentalRisk),
    });
  }

  // Business Suitability
  if (propertyData.analysis?.businessSuitability) {
    sections.push({
      title: 'Business Suitability',
      content: generateSuitabilitySection(propertyData.analysis.businessSuitability),
    });
  }

  // Retailer Matches
  if (propertyData.analysis?.retailerMatches) {
    sections.push({
      title: 'Retailer Matches',
      content: generateRetailerSection(propertyData.analysis.retailerMatches),
    });
  }

  // Recommendations
  if (propertyData.analysis) {
    sections.push({
      title: 'Recommendations',
      content: generateRecommendationsSection(propertyData.analysis),
    });
  }

  return {
    address,
    generatedAt: new Date(),
    coordinates: propertyData.coordinates || undefined,
    sections,
  };
}

function generateExecutiveSummary(analysis: AnalysisResult): string {
  const lines = [
    `Viability Score: ${analysis.viabilityScore}/10 (${getScoreLabel(analysis.viabilityScore)})`,
  ];

  if (analysis.feasibilityScore) {
    lines.push('');
    lines.push('Feasibility Breakdown:');
    lines.push(`  Traffic: ${analysis.feasibilityScore.breakdown.trafficScore}/10`);
    lines.push(`  Demographics: ${analysis.feasibilityScore.breakdown.demographicsScore}/10`);
    lines.push(`  Competition: ${analysis.feasibilityScore.breakdown.competitionScore}/10`);
    lines.push(`  Access: ${analysis.feasibilityScore.breakdown.accessScore}/10`);
  }

  lines.push('');
  lines.push('Site Assessment:');
  lines.push(`  Terrain: ${analysis.terrain}`);
  lines.push(`  Accessibility: ${analysis.accessibility}`);
  lines.push(`  Lot Size: ${analysis.lotSizeEstimate}`);

  return lines.join('\n');
}

function generateTrafficSection(traffic: TrafficInfo): string {
  return [
    `Estimated VPD: ${traffic.estimatedVPD.toLocaleString()} vehicles per day`,
    `VPD Range: ${traffic.vpdRange}`,
    `Road Type: ${traffic.roadType}`,
    `Traffic Level: ${traffic.trafficLevel}`,
    `Congestion: ${traffic.congestionPercent}%`,
  ].join('\n');
}

function generateDemographicsSection(demographics: ExtendedDemographics): string {
  const lines = [
    `Population: ${demographics.population?.toLocaleString() || 'N/A'}`,
    `Median Income: $${demographics.medianHouseholdIncome?.toLocaleString() || 'N/A'}`,
  ];

  if (demographics.isCollegeTown) {
    lines.push('College Town: Yes');
  }

  if (demographics.multiRadius) {
    lines.push('');
    lines.push('Population by Radius:');
    lines.push(`  1 Mile: ${demographics.multiRadius.oneMile.population.toLocaleString()}`);
    lines.push(`  3 Miles: ${demographics.multiRadius.threeMile.population.toLocaleString()}`);
    lines.push(`  5 Miles: ${demographics.multiRadius.fiveMile.population.toLocaleString()}`);
  }

  if (demographics.growthTrend) {
    lines.push('');
    lines.push(`Growth Trend: +${demographics.growthTrend}% annually`);
  }

  if (demographics.consumerSpending) {
    lines.push(`Consumer Spending Power: $${(demographics.consumerSpending / 1000000).toFixed(1)}M`);
  }

  return lines.join('\n');
}

function generateMarketSection(
  businesses: { name: string; type: string; distance: string }[],
  comps: MarketComp[] | null
): string {
  const lines = [`Total Nearby Businesses: ${businesses.length}`];

  // Business breakdown by type
  const typeCount = businesses.reduce((acc, b) => {
    acc[b.type] = (acc[b.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  lines.push('');
  lines.push('Business Distribution:');
  Object.entries(typeCount).forEach(([type, count]) => {
    lines.push(`  ${type}: ${count}`);
  });

  if (comps && comps.length > 0) {
    lines.push('');
    lines.push('Comparable Sales:');
    const avgPrice = Math.round(comps.reduce((sum, c) => sum + c.pricePerSqft, 0) / comps.length);
    lines.push(`  Average Price/SqFt: $${avgPrice}`);
    lines.push(`  Number of Comps: ${comps.length}`);
  }

  return lines.join('\n');
}

function generateEnvironmentalSection(risk: EnvironmentalRisk): string {
  const lines = [
    `Overall Risk Score: ${risk.overallRiskScore}/100`,
    '',
    `Flood Zone: ${risk.floodZone.zone} (${risk.floodZone.risk} risk)`,
    `  ${risk.floodZone.description}`,
    '',
    `Wetlands: ${risk.wetlands.present ? 'Present nearby' : 'None detected'}`,
    `Brownfields: ${risk.brownfields.count > 0 ? `${risk.brownfields.count} site(s)` : 'None detected'}`,
    `Superfund: ${risk.superfund.count > 0 ? `${risk.superfund.count} site(s)` : 'None detected'}`,
  ];

  if (risk.riskFactors && risk.riskFactors.length > 0) {
    lines.push('');
    lines.push('Risk Factors:');
    risk.riskFactors.forEach(factor => {
      lines.push(`  - ${factor}`);
    });
  }

  return lines.join('\n');
}

function generateSuitabilitySection(
  suitability: { category: string; suitabilityScore: number; reasoning: string; examples: string[] }[]
): string {
  const lines: string[] = [];

  suitability.slice(0, 8).forEach(item => {
    lines.push(`${item.category}: ${item.suitabilityScore}/10`);
    lines.push(`  ${item.reasoning}`);
    if (item.examples.length > 0) {
      lines.push(`  Examples: ${item.examples.slice(0, 3).join(', ')}`);
    }
    lines.push('');
  });

  return lines.join('\n');
}

function generateRetailerSection(
  matches: { matches: { name: string; category: string; matchScore: number; activelyExpanding: boolean }[]; totalMatches: number }
): string {
  const lines = [`Total Matches: ${matches.totalMatches}`];
  lines.push('');
  lines.push('Top Matches:');

  matches.matches.slice(0, 5).forEach(match => {
    lines.push(`  ${match.name} (${match.category})`);
    lines.push(`    Match Score: ${match.matchScore}%`);
    if (match.activelyExpanding) {
      lines.push('    Status: Actively Expanding');
    }
    lines.push('');
  });

  return lines.join('\n');
}

function generateRecommendationsSection(analysis: AnalysisResult): string {
  const lines: string[] = [];

  if (analysis.keyFindings && analysis.keyFindings.length > 0) {
    lines.push('Key Findings:');
    analysis.keyFindings.forEach((finding, i) => {
      lines.push(`  ${i + 1}. ${finding}`);
    });
    lines.push('');
  }

  if (analysis.recommendations && analysis.recommendations.length > 0) {
    lines.push('Recommendations:');
    analysis.recommendations.forEach((rec, i) => {
      lines.push(`  ${i + 1}. ${rec}`);
    });
    lines.push('');
  }

  lines.push('Construction Potential:');
  lines.push(`  ${analysis.constructionPotential}`);

  return lines.join('\n');
}

function getScoreLabel(score: number): string {
  if (score >= 8) return 'Excellent';
  if (score >= 6) return 'Good';
  if (score >= 4) return 'Fair';
  return 'Poor';
}

export function formatReportAsText(reportData: ReportData): string {
  const header = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                       DRONE SENSE - COMMERCIAL SITE ANALYSIS                 ║
╚══════════════════════════════════════════════════════════════════════════════╝

Property: ${reportData.address}
Generated: ${reportData.generatedAt.toLocaleString()}
${reportData.coordinates ? `Coordinates: ${reportData.coordinates.lat.toFixed(6)}, ${reportData.coordinates.lng.toFixed(6)}` : ''}

`;

  const sections = reportData.sections.map(section => {
    const divider = '='.repeat(80);
    return `${divider}
${section.title.toUpperCase()}
${divider}

${section.content}

`;
  }).join('');

  const footer = `
${'='.repeat(80)}
DISCLAIMER
${'='.repeat(80)}

This report is for informational purposes only. Verify all data through official
sources before making investment decisions. Environmental assessments and market
conditions are subject to change.

--------------------------------------------------------------------------------
Generated by DRONE SENSE AI Site Analysis
--------------------------------------------------------------------------------
`;

  return header + sections + footer;
}
