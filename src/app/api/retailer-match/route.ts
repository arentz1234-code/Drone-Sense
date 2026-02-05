import { NextResponse } from 'next/server';
import { RETAILER_REQUIREMENTS, RetailerRequirements, getRegionFromState } from '@/data/retailerRequirements';

interface MatchRequest {
  lotSizeAcres: number | null;
  vpd: number | null;
  medianIncome: number | null;
  incomeLevel: 'low' | 'moderate' | 'middle' | 'upper-middle' | 'high' | null;
  population: number | null;
  stateCode: string | null;
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
  };
  activelyExpanding: boolean;
  franchiseAvailable: boolean;
  corporateOnly: boolean;
  franchiseFee?: number;
  totalInvestment?: string;
  expansionRegions: string[];
  notes?: string;
}

function calculateMatch(
  retailer: RetailerRequirements,
  site: MatchRequest
): RetailerMatch | null {
  const matchDetails = {
    lotSize: { matches: false, note: '' },
    traffic: { matches: false, note: '' },
    demographics: { matches: false, note: '' },
    region: { matches: false, note: '' },
  };

  let totalScore = 0;
  let weightedFactors = 0;

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

  // === REGION MATCHING (20% weight) ===
  const regionWeight = 20;
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

  // Calculate final score
  const finalScore = weightedFactors > 0
    ? Math.round((totalScore / weightedFactors) * 100)
    : 50;

  // Only return if score is reasonable
  if (finalScore < 30) {
    return null;
  }

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
