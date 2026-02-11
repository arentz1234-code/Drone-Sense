import { NextResponse } from 'next/server';
import { getRecommendationsForSite, ALL_BUSINESSES } from '@/data/BusinessIntelligence';

// Business type requirements for scoring
const BUSINESS_TYPE_REQUIREMENTS: Record<string, {
  minVPD: number;
  idealVPD: number;
  cornerPreferred: boolean;
  multipleAccessPreferred: boolean;
  parkingImportance: 'low' | 'medium' | 'high';
  truckAccess: boolean;
  visibilityImportance: 'low' | 'medium' | 'high';
  description: string;
}> = {
  'qsr': {
    minVPD: 20000,
    idealVPD: 30000,
    cornerPreferred: true,
    multipleAccessPreferred: true,
    parkingImportance: 'medium',
    truckAccess: false,
    visibilityImportance: 'high',
    description: 'Quick Service Restaurant / Fast Food',
  },
  'fast_casual': {
    minVPD: 15000,
    idealVPD: 25000,
    cornerPreferred: true,
    multipleAccessPreferred: true,
    parkingImportance: 'medium',
    truckAccess: false,
    visibilityImportance: 'high',
    description: 'Fast Casual Dining',
  },
  'casual_dining': {
    minVPD: 12000,
    idealVPD: 20000,
    cornerPreferred: false,
    multipleAccessPreferred: false,
    parkingImportance: 'high',
    truckAccess: false,
    visibilityImportance: 'medium',
    description: 'Sit-Down Restaurant',
  },
  'retail_strip': {
    minVPD: 18000,
    idealVPD: 28000,
    cornerPreferred: true,
    multipleAccessPreferred: true,
    parkingImportance: 'high',
    truckAccess: false,
    visibilityImportance: 'high',
    description: 'Retail Strip Center',
  },
  'retail_standalone': {
    minVPD: 15000,
    idealVPD: 25000,
    cornerPreferred: true,
    multipleAccessPreferred: false,
    parkingImportance: 'high',
    truckAccess: false,
    visibilityImportance: 'high',
    description: 'Standalone Retail',
  },
  'office': {
    minVPD: 5000,
    idealVPD: 15000,
    cornerPreferred: false,
    multipleAccessPreferred: false,
    parkingImportance: 'high',
    truckAccess: false,
    visibilityImportance: 'low',
    description: 'Office Building',
  },
  'medical': {
    minVPD: 8000,
    idealVPD: 18000,
    cornerPreferred: false,
    multipleAccessPreferred: true,
    parkingImportance: 'high',
    truckAccess: false,
    visibilityImportance: 'medium',
    description: 'Medical / Healthcare Facility',
  },
  'warehouse': {
    minVPD: 2000,
    idealVPD: 8000,
    cornerPreferred: false,
    multipleAccessPreferred: false,
    parkingImportance: 'low',
    truckAccess: true,
    visibilityImportance: 'low',
    description: 'Warehouse / Distribution',
  },
  'industrial': {
    minVPD: 3000,
    idealVPD: 10000,
    cornerPreferred: false,
    multipleAccessPreferred: false,
    parkingImportance: 'medium',
    truckAccess: true,
    visibilityImportance: 'low',
    description: 'Industrial / Manufacturing',
  },
  'gas_station': {
    minVPD: 20000,
    idealVPD: 35000,
    cornerPreferred: true,
    multipleAccessPreferred: true,
    parkingImportance: 'low',
    truckAccess: false,
    visibilityImportance: 'high',
    description: 'Gas Station / Convenience',
  },
  'bank': {
    minVPD: 15000,
    idealVPD: 25000,
    cornerPreferred: true,
    multipleAccessPreferred: true,
    parkingImportance: 'medium',
    truckAccess: false,
    visibilityImportance: 'high',
    description: 'Bank / Financial Services',
  },
  'coffee': {
    minVPD: 18000,
    idealVPD: 28000,
    cornerPreferred: true,
    multipleAccessPreferred: true,
    parkingImportance: 'medium',
    truckAccess: false,
    visibilityImportance: 'high',
    description: 'Coffee Shop / Drive-Thru',
  },
  'hotel': {
    minVPD: 10000,
    idealVPD: 25000,
    cornerPreferred: false,
    multipleAccessPreferred: false,
    parkingImportance: 'high',
    truckAccess: false,
    visibilityImportance: 'medium',
    description: 'Hotel / Hospitality',
  },
  'auto_service': {
    minVPD: 12000,
    idealVPD: 22000,
    cornerPreferred: true,
    multipleAccessPreferred: true,
    parkingImportance: 'high',
    truckAccess: false,
    visibilityImportance: 'high',
    description: 'Auto Service / Car Wash',
  },
};

interface RecommendationRequest {
  businessType?: string | null;
  vpd: number | null;
  accessPointCount: number;
  roadCount: number;
  isCornerLot: boolean;
  hasHighwayAccess: boolean;
  lotSizeAcres: number | null;
  medianIncome: number | null;
  population: number | null;
  nearbyBusinesses: Array<{ name: string; type: string; distance: number }>;
  floodRisk: 'low' | 'medium' | 'high' | null;
  zoning: string | null;
}

interface ScoreResult {
  score: 'A' | 'B' | 'C' | 'D' | 'F';
  value: number;
  insight: string;
  recommendation: string;
}

interface RecommendationResponse {
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

function calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function scoreTraffic(
  vpd: number | null,
  businessType: string | null,
  requirements: typeof BUSINESS_TYPE_REQUIREMENTS[string] | null
): ScoreResult {
  if (vpd === null) {
    return {
      score: 'C',
      value: 70,
      insight: 'Traffic data not available',
      recommendation: 'Obtain official traffic counts from DOT for accurate assessment',
    };
  }

  const minVPD = requirements?.minVPD || 15000;
  const idealVPD = requirements?.idealVPD || 25000;

  let value: number;
  let insight: string;
  let recommendation: string;

  if (vpd >= idealVPD) {
    value = 95;
    insight = `Excellent traffic: ${vpd.toLocaleString()} VPD exceeds ideal threshold of ${idealVPD.toLocaleString()}`;
    recommendation = requirements
      ? `Strong traffic supports ${requirements.description} use`
      : 'Suitable for high-traffic retail, QSR, or drive-thru concepts';
  } else if (vpd >= minVPD) {
    value = 75 + (25 * (vpd - minVPD) / (idealVPD - minVPD));
    insight = `Good traffic: ${vpd.toLocaleString()} VPD meets minimum of ${minVPD.toLocaleString()}`;
    recommendation = requirements
      ? `Traffic adequate for ${requirements.description}, but not ideal`
      : 'Consider concepts with lower traffic requirements or destination-based models';
  } else if (vpd >= minVPD * 0.7) {
    value = 60 + (15 * (vpd - minVPD * 0.7) / (minVPD * 0.3));
    insight = `Below ideal: ${vpd.toLocaleString()} VPD (needs ${minVPD.toLocaleString()}+)`;
    recommendation = requirements
      ? `Traffic may be insufficient for typical ${requirements.description}`
      : 'Better suited for destination concepts or service businesses';
  } else {
    value = Math.max(40, 60 * (vpd / (minVPD * 0.7)));
    insight = `Low traffic: ${vpd.toLocaleString()} VPD significantly below threshold`;
    recommendation = 'Consider office, medical, or destination-based uses';
  }

  return {
    score: calculateGrade(value),
    value: Math.round(value),
    insight,
    recommendation,
  };
}

function scoreAccess(
  accessPointCount: number,
  roadCount: number,
  isCornerLot: boolean,
  hasHighwayAccess: boolean,
  requirements: typeof BUSINESS_TYPE_REQUIREMENTS[string] | null
): ScoreResult {
  let value = 70; // Base score
  const insights: string[] = [];
  const recommendations: string[] = [];

  // Access points scoring
  if (accessPointCount >= 3) {
    value += 15;
    insights.push(`${accessPointCount} access points - excellent ingress/egress`);
  } else if (accessPointCount === 2) {
    value += 10;
    insights.push('Dual access points - good traffic flow');
  } else if (accessPointCount === 1) {
    insights.push('Single access point');
    if (requirements?.multipleAccessPreferred) {
      recommendations.push('Consider shared access agreement with adjacent parcel');
    }
  }

  // Road count
  if (roadCount >= 2) {
    value += 10;
    insights.push(`Frontage on ${roadCount} roads`);
  }

  // Corner lot
  if (isCornerLot) {
    value += 10;
    insights.push('Corner lot with high visibility');
  } else if (requirements?.cornerPreferred) {
    value -= 5;
    recommendations.push('Corner location would improve visibility');
  }

  // Highway access
  if (hasHighwayAccess) {
    value += 5;
    insights.push('Highway visibility/access');
  } else if (requirements?.truckAccess) {
    value -= 10;
    recommendations.push('Verify truck access routes for deliveries');
  }

  return {
    score: calculateGrade(Math.min(100, value)),
    value: Math.min(100, Math.round(value)),
    insight: insights.join('. ') || 'Standard access configuration',
    recommendation: recommendations.join('. ') || 'Access meets typical requirements',
  };
}

function scoreCompetition(
  nearbyBusinesses: Array<{ name: string; type: string; distance: number }>,
  businessType: string | null
): { result: ScoreResult; gaps: string[] } {
  const gaps: string[] = [];
  let value = 75; // Base neutral score

  // Count businesses by type
  const typeCounts: Record<string, number> = {};
  const closeCompetitors: string[] = [];

  for (const biz of nearbyBusinesses) {
    const type = biz.type.toLowerCase();
    typeCounts[type] = (typeCounts[type] || 0) + 1;

    // Track very close competitors (within 0.5 miles)
    if (biz.distance < 0.5) {
      closeCompetitors.push(biz.name);
    }
  }

  // Analyze saturation
  const totalNearby = nearbyBusinesses.length;
  let insight: string;
  let recommendation: string;

  if (totalNearby === 0) {
    value = 65;
    insight = 'No nearby businesses detected - unproven market';
    recommendation = 'Conduct market study to validate demand';
    gaps.push('Limited commercial development in area');
  } else if (totalNearby <= 5) {
    value = 80;
    insight = `Light commercial activity (${totalNearby} businesses nearby)`;
    recommendation = 'Opportunity to establish market presence';
  } else if (totalNearby <= 15) {
    value = 90;
    insight = `Healthy commercial mix (${totalNearby} businesses) - proven market`;
    recommendation = 'Area has established customer traffic patterns';
  } else if (totalNearby <= 30) {
    value = 75;
    insight = `Competitive market (${totalNearby} businesses nearby)`;
    recommendation = 'Differentiation strategy important';
  } else {
    value = 60;
    insight = `High density commercial area (${totalNearby}+ businesses)`;
    recommendation = 'Market may be saturated - unique concept required';
  }

  // Check for specific gaps
  const hasGrocery = nearbyBusinesses.some(b =>
    b.type.toLowerCase().includes('grocery') || b.type.toLowerCase().includes('supermarket')
  );
  const hasPharmacy = nearbyBusinesses.some(b =>
    b.type.toLowerCase().includes('pharmacy') || b.type.toLowerCase().includes('drugstore')
  );
  const hasBank = nearbyBusinesses.some(b =>
    b.type.toLowerCase().includes('bank')
  );
  const hasCoffee = nearbyBusinesses.some(b =>
    b.type.toLowerCase().includes('coffee') || b.name.toLowerCase().includes('starbucks')
  );
  const hasGas = nearbyBusinesses.some(b =>
    b.type.toLowerCase().includes('gas') || b.type.toLowerCase().includes('fuel')
  );

  if (!hasGrocery && totalNearby > 5) gaps.push('No grocery store within search radius');
  if (!hasPharmacy && totalNearby > 5) gaps.push('No pharmacy nearby');
  if (!hasBank && totalNearby > 10) gaps.push('No bank/financial services');
  if (!hasCoffee && totalNearby > 8) gaps.push('No coffee shop');
  if (!hasGas && totalNearby > 10) gaps.push('No gas station/convenience');

  // Adjust for close competitors if business type specified
  if (closeCompetitors.length > 3) {
    value -= 10;
    insight += `. ${closeCompetitors.length} direct competitors within 0.5 miles`;
  }

  return {
    result: {
      score: calculateGrade(value),
      value: Math.round(value),
      insight,
      recommendation,
    },
    gaps,
  };
}

function scoreDemographics(
  medianIncome: number | null,
  population: number | null,
  businessType: string | null
): ScoreResult {
  if (!medianIncome && !population) {
    return {
      score: 'C',
      value: 70,
      insight: 'Demographics data not available',
      recommendation: 'Obtain census data for trade area analysis',
    };
  }

  let value = 70;
  const insights: string[] = [];
  const recommendations: string[] = [];

  // Income analysis
  if (medianIncome) {
    if (medianIncome >= 100000) {
      value += 15;
      insights.push(`Affluent area ($${(medianIncome / 1000).toFixed(0)}K median income)`);
      recommendations.push('Supports premium positioning and higher price points');
    } else if (medianIncome >= 75000) {
      value += 10;
      insights.push(`Upper-middle income area ($${(medianIncome / 1000).toFixed(0)}K)`);
    } else if (medianIncome >= 50000) {
      value += 5;
      insights.push(`Middle income area ($${(medianIncome / 1000).toFixed(0)}K)`);
    } else if (medianIncome >= 35000) {
      insights.push(`Moderate income area ($${(medianIncome / 1000).toFixed(0)}K)`);
      recommendations.push('Value-oriented concepts perform well');
    } else {
      value -= 5;
      insights.push(`Lower income area ($${(medianIncome / 1000).toFixed(0)}K)`);
      recommendations.push('Focus on value/discount concepts');
    }
  }

  // Population analysis
  if (population) {
    if (population >= 50000) {
      value += 15;
      insights.push(`Strong population base (${(population / 1000).toFixed(0)}K within trade area)`);
    } else if (population >= 25000) {
      value += 10;
      insights.push(`Good population (${(population / 1000).toFixed(0)}K in trade area)`);
    } else if (population >= 10000) {
      value += 5;
      insights.push(`Moderate population (${(population / 1000).toFixed(0)}K)`);
    } else {
      insights.push(`Limited population base (${(population / 1000).toFixed(0)}K)`);
      recommendations.push('May need to draw from wider trade area');
    }
  }

  return {
    score: calculateGrade(Math.min(100, value)),
    value: Math.min(100, Math.round(value)),
    insight: insights.join('. ') || 'Demographics data limited',
    recommendation: recommendations.join('. ') || 'Demographics support standard commercial development',
  };
}

function scoreSiteConditions(
  lotSizeAcres: number | null,
  floodRisk: 'low' | 'medium' | 'high' | null,
  zoning: string | null,
  requirements: typeof BUSINESS_TYPE_REQUIREMENTS[string] | null
): ScoreResult {
  let value = 80;
  const insights: string[] = [];
  const recommendations: string[] = [];

  // Lot size
  if (lotSizeAcres !== null) {
    if (lotSizeAcres >= 2) {
      value += 10;
      insights.push(`Large lot (${lotSizeAcres.toFixed(2)} acres) - flexible development options`);
    } else if (lotSizeAcres >= 1) {
      value += 5;
      insights.push(`Standard lot size (${lotSizeAcres.toFixed(2)} acres)`);
    } else if (lotSizeAcres >= 0.5) {
      insights.push(`Compact lot (${lotSizeAcres.toFixed(2)} acres)`);
      recommendations.push('May limit building footprint or parking');
    } else {
      value -= 10;
      insights.push(`Small lot (${lotSizeAcres.toFixed(2)} acres)`);
      recommendations.push('Limited to smaller footprint concepts');
    }
  }

  // Flood risk
  if (floodRisk === 'high') {
    value -= 20;
    insights.push('High flood risk zone');
    recommendations.push('Flood insurance required, elevated construction may be needed');
  } else if (floodRisk === 'medium') {
    value -= 10;
    insights.push('Moderate flood risk');
    recommendations.push('Consider flood mitigation measures');
  } else if (floodRisk === 'low') {
    value += 5;
    insights.push('Low flood risk - favorable');
  }

  // Zoning
  if (zoning) {
    const zoningUpper = zoning.toUpperCase();
    if (zoningUpper.includes('C') || zoningUpper.includes('COMMERCIAL')) {
      value += 5;
      insights.push(`Commercial zoning (${zoning})`);
    } else if (zoningUpper.includes('MIXED') || zoningUpper.includes('MU')) {
      insights.push(`Mixed-use zoning (${zoning})`);
    } else if (zoningUpper.includes('I') || zoningUpper.includes('INDUSTRIAL')) {
      insights.push(`Industrial zoning (${zoning})`);
      if (requirements && !requirements.truckAccess) {
        recommendations.push('Verify permitted uses under industrial zoning');
      }
    } else {
      recommendations.push(`Verify ${zoning} zoning permits intended use`);
    }
  }

  return {
    score: calculateGrade(Math.min(100, value)),
    value: Math.min(100, Math.round(value)),
    insight: insights.join('. ') || 'Site conditions appear standard',
    recommendation: recommendations.join('. ') || 'No significant site concerns identified',
  };
}

function generateSuggestedUses(
  vpd: number | null,
  lotSizeAcres: number | null,
  medianIncome: number | null,
  nearbyBusinesses: Array<{ name: string; type: string }>,
  isCornerLot: boolean
): string[] {
  const suggestions: string[] = [];
  const existingTypes = new Set(nearbyBusinesses.map(b => b.type.toLowerCase()));

  // High traffic suggestions
  if (vpd && vpd >= 25000) {
    if (isCornerLot) suggestions.push('Drive-Thru QSR');
    suggestions.push('Fast Casual Restaurant');
    suggestions.push('Coffee Shop with Drive-Thru');
    if (!existingTypes.has('gas')) suggestions.push('Gas Station/Convenience');
  } else if (vpd && vpd >= 15000) {
    suggestions.push('Fast Casual Restaurant');
    suggestions.push('Retail Strip Center');
    if (!existingTypes.has('bank')) suggestions.push('Bank Branch');
    suggestions.push('Medical/Dental Office');
  } else if (vpd && vpd >= 8000) {
    suggestions.push('Professional Office');
    suggestions.push('Medical Clinic');
    suggestions.push('Service Business');
    suggestions.push('Specialty Retail');
  } else {
    suggestions.push('Office Building');
    suggestions.push('Light Industrial');
    suggestions.push('Warehouse/Distribution');
    suggestions.push('Self-Storage');
  }

  // Income-based additions
  if (medianIncome && medianIncome >= 85000) {
    suggestions.push('Upscale Dining');
    suggestions.push('Boutique Retail');
    suggestions.push('Fitness/Wellness Center');
  }

  // Lot size considerations
  if (lotSizeAcres && lotSizeAcres >= 3) {
    suggestions.push('Multi-Tenant Retail Center');
    suggestions.push('Hotel/Extended Stay');
  }

  // Deduplicate and limit
  return [...new Set(suggestions)].slice(0, 8);
}

function generateConcerns(
  trafficScore: ScoreResult,
  accessScore: ScoreResult,
  competitionScore: ScoreResult,
  demographicsScore: ScoreResult,
  siteScore: ScoreResult
): string[] {
  const concerns: string[] = [];

  if (trafficScore.value < 70) {
    concerns.push('Traffic volume below typical retail thresholds');
  }
  if (accessScore.value < 70) {
    concerns.push('Access configuration may limit customer convenience');
  }
  if (competitionScore.value < 65) {
    concerns.push('High competition or unproven market');
  }
  if (demographicsScore.value < 70) {
    concerns.push('Demographics may limit target customer base');
  }
  if (siteScore.value < 70) {
    concerns.push('Site conditions require additional due diligence');
  }

  return concerns;
}

function generateStrengths(
  trafficScore: ScoreResult,
  accessScore: ScoreResult,
  competitionScore: ScoreResult,
  demographicsScore: ScoreResult,
  siteScore: ScoreResult,
  isCornerLot: boolean,
  hasHighwayAccess: boolean
): string[] {
  const strengths: string[] = [];

  if (trafficScore.value >= 85) {
    strengths.push('Excellent traffic volume');
  }
  if (accessScore.value >= 85) {
    strengths.push('Superior access and visibility');
  }
  if (competitionScore.value >= 85) {
    strengths.push('Proven commercial market');
  }
  if (demographicsScore.value >= 85) {
    strengths.push('Strong demographic profile');
  }
  if (siteScore.value >= 85) {
    strengths.push('Favorable site conditions');
  }
  if (isCornerLot) {
    strengths.push('Corner lot visibility');
  }
  if (hasHighwayAccess) {
    strengths.push('Highway exposure');
  }

  return strengths;
}

function generateKeyTakeaways(
  overallScore: number,
  trafficScore: ScoreResult,
  competitionScore: ScoreResult,
  suggestedUses: string[],
  concerns: string[]
): string[] {
  const takeaways: string[] = [];

  if (overallScore >= 80) {
    takeaways.push('Site shows strong potential for commercial development');
  } else if (overallScore >= 70) {
    takeaways.push('Site is viable with appropriate concept selection');
  } else if (overallScore >= 60) {
    takeaways.push('Site has limitations - careful concept selection required');
  } else {
    takeaways.push('Site faces significant challenges - specialized use recommended');
  }

  if (trafficScore.value >= 85) {
    takeaways.push(`High traffic (${trafficScore.insight.split(':')[1]?.trim() || 'strong volume'}) supports retail/restaurant use`);
  }

  if (suggestedUses.length > 0) {
    takeaways.push(`Best suited for: ${suggestedUses.slice(0, 3).join(', ')}`);
  }

  if (concerns.length > 0) {
    takeaways.push(`Primary concern: ${concerns[0]}`);
  }

  return takeaways.slice(0, 5);
}

export async function POST(request: Request) {
  try {
    const body: RecommendationRequest = await request.json();

    const {
      businessType,
      vpd,
      accessPointCount,
      roadCount,
      isCornerLot,
      hasHighwayAccess,
      lotSizeAcres,
      medianIncome,
      population,
      nearbyBusinesses,
      floodRisk,
      zoning,
    } = body;

    // Normalize businessType (convert undefined to null)
    const normalizedBusinessType = businessType ?? null;

    // Get business type requirements if specified
    const requirements = normalizedBusinessType ? BUSINESS_TYPE_REQUIREMENTS[normalizedBusinessType] : null;

    // Calculate individual scores
    const trafficScore = scoreTraffic(vpd, normalizedBusinessType, requirements);
    const accessScore = scoreAccess(accessPointCount, roadCount, isCornerLot, hasHighwayAccess, requirements);
    const { result: competitionScore, gaps } = scoreCompetition(nearbyBusinesses || [], normalizedBusinessType);
    const demographicsScore = scoreDemographics(medianIncome, population, normalizedBusinessType);
    const siteScore = scoreSiteConditions(lotSizeAcres, floodRisk, zoning, requirements);

    // Calculate overall score (weighted average)
    const overallValue = Math.round(
      trafficScore.value * 0.30 +
      accessScore.value * 0.20 +
      competitionScore.value * 0.15 +
      demographicsScore.value * 0.20 +
      siteScore.value * 0.15
    );

    const overallGrade = calculateGrade(overallValue);

    // Generate recommendations
    const suggestedUses = generateSuggestedUses(
      vpd,
      lotSizeAcres,
      medianIncome,
      nearbyBusinesses || [],
      isCornerLot
    );

    const concerns = generateConcerns(
      trafficScore,
      accessScore,
      competitionScore,
      demographicsScore,
      siteScore
    );

    const strengths = generateStrengths(
      trafficScore,
      accessScore,
      competitionScore,
      demographicsScore,
      siteScore,
      isCornerLot,
      hasHighwayAccess
    );

    const keyTakeaways = generateKeyTakeaways(
      overallValue,
      trafficScore,
      competitionScore,
      suggestedUses,
      concerns
    );

    // Generate summary
    let summary: string;
    if (overallGrade === 'A') {
      summary = 'Excellent commercial location with strong fundamentals across all metrics';
    } else if (overallGrade === 'B') {
      summary = `Strong ${businessType ? BUSINESS_TYPE_REQUIREMENTS[businessType]?.description || 'commercial' : 'commercial'} location with ${strengths[0]?.toLowerCase() || 'solid fundamentals'}`;
    } else if (overallGrade === 'C') {
      summary = `Viable location with opportunities and challenges - ${concerns[0]?.toLowerCase() || 'careful planning recommended'}`;
    } else if (overallGrade === 'D') {
      summary = `Location has significant limitations - ${concerns[0]?.toLowerCase() || 'specialized use required'}`;
    } else {
      summary = 'Location faces substantial challenges for typical commercial development';
    }

    const response: RecommendationResponse = {
      overallScore: `${overallGrade}${overallValue >= 95 ? '+' : overallValue >= 87 ? '+' : overallValue >= 83 ? '' : overallValue >= 77 ? '-' : ''}`,
      overallGrade,
      summary,
      traffic: trafficScore,
      access: accessScore,
      competition: competitionScore,
      demographics: demographicsScore,
      siteConditions: siteScore,
      suggestedUses,
      concerns,
      strengths,
      marketGaps: gaps,
      keyTakeaways,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Recommendations API error:', error);
    return NextResponse.json({
      error: 'Failed to generate recommendations',
      message: String(error),
    }, { status: 500 });
  }
}

// Export business types for UI dropdown
export const BUSINESS_TYPES = Object.entries(BUSINESS_TYPE_REQUIREMENTS).map(([id, req]) => ({
  id,
  label: req.description,
}));
