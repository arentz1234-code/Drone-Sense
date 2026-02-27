import { NextResponse } from 'next/server';
import { RETAILER_REQUIREMENTS, RetailerRequirements, getRegionFromState, SiteType, getRetailerSiteTypes, SITE_TYPE_LABELS } from '@/data/retailerRequirements';

interface MatchRequest {
  lotSizeAcres: number | null;
  vpd: number | null;
  medianIncome: number | null;
  incomeLevel: 'low' | 'moderate' | 'middle' | 'upper-middle' | 'high' | null;
  population: number | null;
  stateCode: string | null;
  siteType?: SiteType | null;  // Filter by site type
  hasAnchorNearby?: boolean;   // Is there a grocery/big box anchor nearby?
  // Enhanced data from feasibility score
  discretionaryIncome?: number | null;  // Spending power
  consumerSpending?: number | null;     // Total consumer spending in trade area
  environmentalRisk?: {
    floodZone?: { risk: 'low' | 'medium' | 'high' };
    wetlands?: { present: boolean };
    brownfields?: { present: boolean; count: number };
    superfund?: { present: boolean };
    overallRiskScore?: number;
  } | null;
  competitionCount?: number | null;     // Number of nearby businesses
  competitionDensity?: 'low' | 'moderate' | 'high' | 'saturated' | null;
  accessScore?: number | null;          // 0-10 access quality
  walkabilityScore?: number | null;     // 0-100 walk score
  safetyScore?: number | null;          // 0-10 safety rating
  developmentScore?: number | null;     // 0-10 development momentum
  saturationScore?: number | null;      // 0-10 market saturation
  zoning?: string | null;               // Zoning code
  isCornerLot?: boolean;
  hasHighwayAccess?: boolean;
}

export interface RetailerMatch {
  name: string;
  category: string;
  matchScore: number;  // 0-100
  matchDetails: {
    lotSize: { matches: boolean; note: string };
    traffic: { matches: boolean; note: string };
    demographics: { matches: boolean; note: string };
    region: { matches: boolean; note: string };
    siteType?: { matches: boolean; note: string };
    environmental?: { matches: boolean; note: string };
    spending?: { matches: boolean; note: string };
    competition?: { matches: boolean; note: string };
    access?: { matches: boolean; note: string };
    safety?: { matches: boolean; note: string };
  };
  activelyExpanding: boolean;
  franchiseAvailable: boolean;
  corporateOnly: boolean;
  franchiseFee?: number;
  totalInvestment?: string;
  expansionRegions: string[];
  notes?: string;
  // Site type preferences
  siteTypes?: string[];  // Human-readable labels
  prefersAnchoredCenter?: boolean;
}

function calculateMatch(
  retailer: RetailerRequirements,
  site: MatchRequest
): RetailerMatch | null {
  const matchDetails: {
    lotSize: { matches: boolean; note: string };
    traffic: { matches: boolean; note: string };
    demographics: { matches: boolean; note: string };
    region: { matches: boolean; note: string };
    siteType?: { matches: boolean; note: string };
    environmental?: { matches: boolean; note: string };
    spending?: { matches: boolean; note: string };
    competition?: { matches: boolean; note: string };
    access?: { matches: boolean; note: string };
    safety?: { matches: boolean; note: string };
  } = {
    lotSize: { matches: false, note: '' },
    traffic: { matches: false, note: '' },
    demographics: { matches: false, note: '' },
    region: { matches: false, note: '' },
  };

  let totalScore = 0;
  let weightedFactors = 0;

  // Get site type preferences for this retailer
  const siteTypeInfo = retailer.siteTypes
    ? { siteTypes: retailer.siteTypes, prefersAnchoredCenter: retailer.prefersAnchoredCenter || false }
    : getRetailerSiteTypes(retailer.name);

  // === SITE TYPE MATCHING (15% weight if specified) ===
  if (site.siteType && siteTypeInfo) {
    const siteTypeWeight = 15;
    weightedFactors += siteTypeWeight;

    const siteTypeMatches = siteTypeInfo.siteTypes.includes(site.siteType);
    const siteTypeLabels = siteTypeInfo.siteTypes.map(st => SITE_TYPE_LABELS[st] || st);

    if (siteTypeMatches) {
      matchDetails.siteType = {
        matches: true,
        note: `Suitable for ${SITE_TYPE_LABELS[site.siteType]}. Accepts: ${siteTypeLabels.join(', ')}`
      };
      totalScore += siteTypeWeight;
    } else {
      matchDetails.siteType = {
        matches: false,
        note: `Prefers: ${siteTypeLabels.join(', ')}. May not be ideal for ${SITE_TYPE_LABELS[site.siteType]}.`
      };
      // Don't completely disqualify, but significant penalty
      totalScore += siteTypeWeight * 0.2;
    }

    // Bonus/penalty for anchored center preference
    if (site.hasAnchorNearby !== undefined) {
      if (siteTypeInfo.prefersAnchoredCenter && site.hasAnchorNearby) {
        totalScore += 3; // Bonus for being in preferred anchored location
      } else if (siteTypeInfo.prefersAnchoredCenter && !site.hasAnchorNearby) {
        totalScore -= 2; // Slight penalty for missing preferred anchor
      }
    }
  }

  // === LOT SIZE MATCHING (30% weight) ===
  if (site.lotSizeAcres !== null) {
    const lotWeight = 30;
    weightedFactors += lotWeight;

    if (site.lotSizeAcres >= retailer.minLotSize && site.lotSizeAcres <= retailer.maxLotSize * 1.5) {
      // Perfect fit
      matchDetails.lotSize.matches = true;
      matchDetails.lotSize.note = `${retailer.minLotSize}-${retailer.maxLotSize} acres needed, site has ${site.lotSizeAcres.toFixed(1)} acres`;
      totalScore += lotWeight;
    } else if (site.lotSizeAcres >= retailer.minLotSize * 0.8) {
      // Close fit
      matchDetails.lotSize.matches = true;
      matchDetails.lotSize.note = `Site is slightly small (${site.lotSizeAcres.toFixed(1)} vs ${retailer.minLotSize} min)`;
      totalScore += lotWeight * 0.6;
    } else {
      // Too small
      matchDetails.lotSize.matches = false;
      matchDetails.lotSize.note = `Site too small: needs ${retailer.minLotSize}+ acres, has ${site.lotSizeAcres.toFixed(1)}`;
      // If lot is way too small, eliminate entirely
      if (site.lotSizeAcres < retailer.minLotSize * 0.5) {
        return null; // Disqualify
      }
      totalScore += lotWeight * 0.2;
    }
  } else {
    matchDetails.lotSize.note = 'Lot size not available';
  }

  // === TRAFFIC/VPD MATCHING (25% weight) ===
  if (site.vpd !== null) {
    const vpdWeight = 25;
    weightedFactors += vpdWeight;

    if (site.vpd >= retailer.idealVPD) {
      matchDetails.traffic.matches = true;
      matchDetails.traffic.note = `Excellent: ${site.vpd.toLocaleString()} VPD (ideal is ${retailer.idealVPD.toLocaleString()}+)`;
      totalScore += vpdWeight;
    } else if (site.vpd >= retailer.minVPD) {
      matchDetails.traffic.matches = true;
      matchDetails.traffic.note = `Good: ${site.vpd.toLocaleString()} VPD meets minimum of ${retailer.minVPD.toLocaleString()}`;
      totalScore += vpdWeight * 0.7;
    } else if (site.vpd >= retailer.minVPD * 0.7) {
      matchDetails.traffic.matches = false;
      matchDetails.traffic.note = `Below ideal: ${site.vpd.toLocaleString()} VPD (needs ${retailer.minVPD.toLocaleString()}+)`;
      totalScore += vpdWeight * 0.3;
    } else {
      matchDetails.traffic.matches = false;
      matchDetails.traffic.note = `Insufficient: ${site.vpd.toLocaleString()} VPD (needs ${retailer.minVPD.toLocaleString()}+)`;
    }
  } else {
    matchDetails.traffic.note = 'Traffic data not available';
  }

  // === DEMOGRAPHICS MATCHING (25% weight) ===
  const demoWeight = 25;
  weightedFactors += demoWeight;
  let demoScore = 0;
  const demoNotes: string[] = [];

  // Income level match
  if (site.incomeLevel && retailer.incomePreference.includes(site.incomeLevel)) {
    demoScore += 0.4;
    demoNotes.push(`Income level (${site.incomeLevel}) matches target`);
  } else if (site.incomeLevel) {
    demoNotes.push(`Income level (${site.incomeLevel}) may not be ideal`);
  }

  // Median income check
  if (site.medianIncome !== null) {
    if (retailer.minMedianIncome && site.medianIncome < retailer.minMedianIncome) {
      demoNotes.push(`Income below minimum ($${site.medianIncome.toLocaleString()} vs $${retailer.minMedianIncome.toLocaleString()})`);
    } else if (retailer.maxMedianIncome && site.medianIncome > retailer.maxMedianIncome) {
      demoNotes.push(`Income above target ($${site.medianIncome.toLocaleString()} vs $${retailer.maxMedianIncome.toLocaleString()} max)`);
    } else if (retailer.minMedianIncome && site.medianIncome >= retailer.minMedianIncome) {
      demoScore += 0.3;
    } else {
      demoScore += 0.2; // No specific requirement, partial credit
    }
  }

  // Population check
  if (site.population !== null) {
    if (site.population >= retailer.minPopulation) {
      demoScore += 0.3;
      demoNotes.push(`Population (${site.population.toLocaleString()}) meets minimum`);
    } else if (site.population >= retailer.minPopulation * 0.7) {
      demoScore += 0.15;
      demoNotes.push(`Population slightly below target (${site.population.toLocaleString()} vs ${retailer.minPopulation.toLocaleString()})`);
    } else {
      demoNotes.push(`Population too low (${site.population.toLocaleString()} vs ${retailer.minPopulation.toLocaleString()} needed)`);
    }
  }

  matchDetails.demographics.matches = demoScore >= 0.5;
  matchDetails.demographics.note = demoNotes.join('; ') || 'Demographics data not available';
  totalScore += demoWeight * demoScore;

  // === REGION MATCHING (15% weight - reduced to make room for new factors) ===
  const regionWeight = 15;
  weightedFactors += regionWeight;

  if (site.stateCode) {
    const siteRegions = getRegionFromState(site.stateCode);
    const expandingInRegion = retailer.expansionRegions.some(r =>
      r === 'National' || siteRegions.includes(r) || r === site.stateCode
    );

    if (expandingInRegion) {
      matchDetails.region.matches = true;
      if (retailer.expansionRegions.includes('National')) {
        matchDetails.region.note = 'Expanding nationally';
      } else {
        matchDetails.region.note = `Actively targeting: ${retailer.expansionRegions.join(', ')}`;
      }
      totalScore += regionWeight;
    } else {
      matchDetails.region.matches = false;
      matchDetails.region.note = `Not currently expanding in this region (targeting: ${retailer.expansionRegions.join(', ')})`;
      totalScore += regionWeight * 0.2; // Still possible, just not priority
    }
  } else {
    matchDetails.region.note = 'Location data not available';
    totalScore += regionWeight * 0.5; // Neutral
  }

  // === ENVIRONMENTAL RISK (10% weight) - Critical gate for many retailers ===
  if (site.environmentalRisk) {
    const envWeight = 10;
    weightedFactors += envWeight;
    const env = site.environmentalRisk;
    const envIssues: string[] = [];

    // High flood risk is a dealbreaker for most retailers
    if (env.floodZone?.risk === 'high') {
      matchDetails.environmental = {
        matches: false,
        note: 'High flood risk zone - most retailers avoid'
      };
      totalScore += envWeight * 0.1; // Nearly disqualifying
      // Return null for QSR and convenience - they won't build in flood zones
      if (retailer.category.includes('QSR') || retailer.category.includes('CONVENIENCE')) {
        return null;
      }
    } else if (env.brownfields?.present || env.superfund?.present) {
      envIssues.push(env.brownfields?.present ? `${env.brownfields.count} brownfield sites nearby` : '');
      envIssues.push(env.superfund?.present ? 'Superfund site nearby' : '');
      matchDetails.environmental = {
        matches: false,
        note: `Environmental concerns: ${envIssues.filter(Boolean).join(', ')}`
      };
      totalScore += envWeight * 0.3;
    } else if (env.floodZone?.risk === 'medium') {
      matchDetails.environmental = {
        matches: true,
        note: 'Moderate flood risk - manageable with mitigation'
      };
      totalScore += envWeight * 0.7;
    } else {
      matchDetails.environmental = {
        matches: true,
        note: 'Low environmental risk - clear for development'
      };
      totalScore += envWeight;
    }
  }

  // === SPENDING POWER (10% weight) - Discretionary income and consumer spending ===
  if (site.discretionaryIncome !== null && site.discretionaryIncome !== undefined) {
    const spendWeight = 10;
    weightedFactors += spendWeight;

    const di = site.discretionaryIncome;
    const spending = site.consumerSpending;

    // Higher-end retailers need more discretionary income
    const isHighEnd = retailer.category.includes('BEAUTY') ||
                      retailer.category.includes('FITNESS') ||
                      retailer.category.includes('SPECIALTY');
    const minDiscretionary = isHighEnd ? 30000 : 15000;

    if (di >= minDiscretionary * 1.5) {
      matchDetails.spending = {
        matches: true,
        note: `Strong spending power: $${di.toLocaleString()} discretionary income${spending ? `, $${(spending / 1000000).toFixed(0)}M consumer spending` : ''}`
      };
      totalScore += spendWeight;
    } else if (di >= minDiscretionary) {
      matchDetails.spending = {
        matches: true,
        note: `Good spending power: $${di.toLocaleString()} discretionary income`
      };
      totalScore += spendWeight * 0.7;
    } else {
      matchDetails.spending = {
        matches: false,
        note: `Limited spending: $${di.toLocaleString()} discretionary (${isHighEnd ? 'premium concept needs more' : 'below typical thresholds'})`
      };
      totalScore += spendWeight * 0.3;
    }
  }

  // === COMPETITION/SATURATION (8% weight) ===
  if (site.competitionDensity || site.saturationScore !== null) {
    const compWeight = 8;
    weightedFactors += compWeight;

    const saturation = site.saturationScore ?? 5;
    const density = site.competitionDensity;

    // Most retailers want some competition (proven market) but not too much
    if (saturation >= 7 || density === 'low') {
      matchDetails.competition = {
        matches: true,
        note: `Undersupplied market - opportunity for new entrants (${site.competitionCount || 'few'} competitors)`
      };
      totalScore += compWeight;
    } else if (saturation >= 5 || density === 'moderate') {
      matchDetails.competition = {
        matches: true,
        note: `Balanced market - healthy competition level`
      };
      totalScore += compWeight * 0.8;
    } else if (saturation >= 3 || density === 'high') {
      matchDetails.competition = {
        matches: false,
        note: `Competitive market - differentiation required`
      };
      totalScore += compWeight * 0.5;
    } else {
      matchDetails.competition = {
        matches: false,
        note: `Saturated market - high competition risk`
      };
      totalScore += compWeight * 0.2;
    }
  }

  // === ACCESS QUALITY (7% weight) ===
  if (site.accessScore !== null && site.accessScore !== undefined) {
    const accessWeight = 7;
    weightedFactors += accessWeight;

    const accessNotes: string[] = [];
    if (site.isCornerLot) accessNotes.push('corner lot');
    if (site.hasHighwayAccess) accessNotes.push('highway access');

    // QSR and drive-thru concepts need excellent access
    const needsGreatAccess = retailer.category.includes('QSR') ||
                             retailer.category.includes('COFFEE') ||
                             retailer.category.includes('CONVENIENCE');
    const minAccess = needsGreatAccess ? 7 : 5;

    if (site.accessScore >= 8) {
      matchDetails.access = {
        matches: true,
        note: `Excellent access (${site.accessScore}/10)${accessNotes.length ? ` - ${accessNotes.join(', ')}` : ''}`
      };
      totalScore += accessWeight;
    } else if (site.accessScore >= minAccess) {
      matchDetails.access = {
        matches: true,
        note: `Good access (${site.accessScore}/10)${accessNotes.length ? ` - ${accessNotes.join(', ')}` : ''}`
      };
      totalScore += accessWeight * 0.7;
    } else {
      matchDetails.access = {
        matches: false,
        note: `Limited access (${site.accessScore}/10)${needsGreatAccess ? ' - QSR/drive-thru needs better access' : ''}`
      };
      totalScore += accessWeight * 0.3;
      // QSR concepts really need good access
      if (needsGreatAccess && site.accessScore < 5) {
        totalScore -= 5; // Additional penalty
      }
    }
  }

  // === SAFETY/CRIME (5% weight) ===
  if (site.safetyScore !== null && site.safetyScore !== undefined) {
    const safetyWeight = 5;
    weightedFactors += safetyWeight;

    if (site.safetyScore >= 7) {
      matchDetails.safety = {
        matches: true,
        note: `Safe area (${site.safetyScore}/10) - low crime impact on operations`
      };
      totalScore += safetyWeight;
    } else if (site.safetyScore >= 5) {
      matchDetails.safety = {
        matches: true,
        note: `Moderate safety (${site.safetyScore}/10) - standard security measures`
      };
      totalScore += safetyWeight * 0.7;
    } else {
      matchDetails.safety = {
        matches: false,
        note: `Safety concerns (${site.safetyScore}/10) - may affect insurance/operations`
      };
      totalScore += safetyWeight * 0.3;
    }
  }

  // === WALKABILITY BONUS (only for certain categories) ===
  if (site.walkabilityScore !== null && site.walkabilityScore !== undefined) {
    // Walkability matters for coffee shops, restaurants, fitness
    const walkMatters = retailer.category.includes('COFFEE') ||
                        retailer.category.includes('RESTAURANT') ||
                        retailer.category.includes('FITNESS') ||
                        retailer.category.includes('SALON');

    if (walkMatters && site.walkabilityScore >= 70) {
      totalScore += 3; // Bonus points for walkable locations
    }
  }

  // === DEVELOPMENT MOMENTUM BONUS ===
  if (site.developmentScore !== null && site.developmentScore !== undefined && site.developmentScore >= 7) {
    // Growing areas are attractive
    totalScore += 2; // Bonus for high-growth areas
  }

  // Calculate final score
  const finalScore = weightedFactors > 0
    ? Math.round((totalScore / weightedFactors) * 100)
    : 50;

  // Only return if score is reasonable
  if (finalScore < 30) {
    return null;
  }

  // Get site type info for output
  const siteTypeInfoForOutput = retailer.siteTypes
    ? { siteTypes: retailer.siteTypes, prefersAnchoredCenter: retailer.prefersAnchoredCenter || false }
    : getRetailerSiteTypes(retailer.name);

  return {
    name: retailer.name,
    category: retailer.category,
    matchScore: finalScore,
    matchDetails,
    activelyExpanding: retailer.activelyExpanding,
    franchiseAvailable: retailer.franchiseAvailable,
    corporateOnly: retailer.corporateOnly,
    franchiseFee: retailer.franchiseFee,
    totalInvestment: retailer.totalInvestmentMin && retailer.totalInvestmentMax
      ? `$${(retailer.totalInvestmentMin / 1000000).toFixed(1)}M - $${(retailer.totalInvestmentMax / 1000000).toFixed(1)}M`
      : undefined,
    expansionRegions: retailer.expansionRegions,
    notes: retailer.notes,
    // Site type preferences
    siteTypes: siteTypeInfoForOutput?.siteTypes.map(st => SITE_TYPE_LABELS[st] || st),
    prefersAnchoredCenter: siteTypeInfoForOutput?.prefersAnchoredCenter,
  };
}

export async function POST(request: Request) {
  try {
    const body: MatchRequest = await request.json();

    // Calculate matches for all retailers
    const matches: RetailerMatch[] = [];

    for (const retailer of RETAILER_REQUIREMENTS) {
      // Only include actively expanding retailers by default
      if (!retailer.activelyExpanding) continue;

      const match = calculateMatch(retailer, body);
      if (match) {
        matches.push(match);
      }
    }

    // Sort by match score descending
    matches.sort((a, b) => b.matchScore - a.matchScore);

    // Return top 20 matches
    return NextResponse.json({
      matches: matches.slice(0, 20),
      totalMatches: matches.length,
      totalRetailersInDatabase: RETAILER_REQUIREMENTS.length,
    });

  } catch (error) {
    console.error('Retailer match API error:', error);
    return NextResponse.json({
      error: 'Failed to match retailers',
      message: String(error),
    }, { status: 500 });
  }
}
