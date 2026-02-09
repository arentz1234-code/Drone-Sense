import { TrafficInfo, ExtendedDemographics, Business, EnvironmentalRisk, MarketComp, FeasibilityScore } from '@/types';

export function calculateFeasibilityScore(
  trafficData: TrafficInfo | null,
  demographicsData: ExtendedDemographics | null,
  nearbyBusinesses: Business[],
  environmentalRisk: EnvironmentalRisk | null,
  marketComps: MarketComp[] | null
): FeasibilityScore {
  let trafficScore = 5;
  let demographicsScore = 5;
  let competitionScore = 5;
  let accessScore = 5;
  let environmentalScore = 5;
  let marketScore = 5;

  let trafficDetail = 'No traffic data available';
  let demographicsDetail = 'No demographics data available';
  let competitionDetail = 'No nearby business data';
  let accessDetail = 'Unable to assess access';
  let environmentalDetail = 'No environmental data available';
  let marketDetail = 'No market comp data available';

  // Track which data sources are available
  const dataAvailable = {
    traffic: !!trafficData,
    demographics: !!demographicsData,
    competition: nearbyBusinesses.length > 0,
    environmental: !!environmentalRisk,
    market: !!marketComps && marketComps.length > 0,
  };

  // TRAFFIC SCORE (0-10)
  if (trafficData) {
    const vpd = trafficData.estimatedVPD;
    if (vpd >= 30000) {
      trafficScore = 10;
      trafficDetail = `Excellent traffic: ${vpd.toLocaleString()} VPD supports all business types`;
    } else if (vpd >= 20000) {
      trafficScore = 9;
      trafficDetail = `Very high traffic: ${vpd.toLocaleString()} VPD ideal for most retail`;
    } else if (vpd >= 15000) {
      trafficScore = 8;
      trafficDetail = `High traffic: ${vpd.toLocaleString()} VPD supports drive-thru concepts`;
    } else if (vpd >= 10000) {
      trafficScore = 6;
      trafficDetail = `Moderate traffic: ${vpd.toLocaleString()} VPD suitable for quick service`;
    } else if (vpd >= 5000) {
      trafficScore = 4;
      trafficDetail = `Low-moderate traffic: ${vpd.toLocaleString()} VPD limits options`;
    } else {
      trafficScore = 2;
      trafficDetail = `Low traffic: ${vpd.toLocaleString()} VPD - local service only`;
    }

    // Road type affects access score
    if (trafficData.roadType.includes('Major') || trafficData.roadType.includes('Motorway')) {
      accessScore = Math.min(10, 7 + 2);
      accessDetail = `${trafficData.roadType} with high visibility`;
    } else if (trafficData.roadType.includes('Secondary')) {
      accessScore = 6;
      accessDetail = `${trafficData.roadType} - good local access`;
    } else {
      accessScore = 4;
      accessDetail = `${trafficData.roadType} - limited visibility`;
    }
  }

  // DEMOGRAPHICS SCORE (0-10)
  if (demographicsData) {
    const income = demographicsData.medianHouseholdIncome;
    const employment = demographicsData.employmentRate || 0;
    const population = demographicsData.population;
    const isCollegeTown = demographicsData.isCollegeTown || false;
    const collegePercent = demographicsData.collegeEnrollmentPercent || 0;

    let incomeScore = 5;
    if (isCollegeTown) {
      if (collegePercent >= 25) {
        incomeScore = 8;
      } else if (collegePercent >= 15) {
        incomeScore = 7.5;
      } else {
        incomeScore = 7;
      }
    } else {
      if (income >= 85000) incomeScore = 9;
      else if (income >= 65000) incomeScore = 8;
      else if (income >= 50000) incomeScore = 7;
      else if (income >= 35000) incomeScore = 5;
      else incomeScore = 4;
    }

    const employmentBonus = isCollegeTown
      ? 0.5
      : (employment >= 95 ? 1 : employment >= 90 ? 0.5 : 0);

    const populationBonus = population >= 5000 ? 1 : population >= 2000 ? 0.5 : 0;

    demographicsScore = Math.min(10, Math.round(incomeScore + employmentBonus + populationBonus));

    if (isCollegeTown) {
      demographicsDetail = `College Town (${collegePercent}% students) - Strong spending power, $${income.toLocaleString()} median, ${population.toLocaleString()} pop`;
    } else {
      demographicsDetail = `$${income.toLocaleString()} median income, ${population.toLocaleString()} pop, ${employment}% employed`;
    }
  }

  // COMPETITION SCORE (0-10)
  if (nearbyBusinesses.length > 0) {
    const businessCount = nearbyBusinesses.length;

    const typeCount: Record<string, number> = {};
    nearbyBusinesses.forEach(b => {
      const type = b.type || 'Other';
      typeCount[type] = (typeCount[type] || 0) + 1;
    });

    const uniqueTypes = Object.keys(typeCount).length;

    if (businessCount >= 5 && businessCount <= 20 && uniqueTypes >= 3) {
      competitionScore = 9;
      competitionDetail = `Healthy mix: ${businessCount} businesses, ${uniqueTypes} categories - proven commercial area`;
    } else if (businessCount >= 3 && businessCount <= 30) {
      competitionScore = 7;
      competitionDetail = `Good activity: ${businessCount} businesses nearby - established area`;
    } else if (businessCount > 30) {
      competitionScore = 5;
      competitionDetail = `High density: ${businessCount} businesses - competitive market`;
    } else if (businessCount < 3) {
      competitionScore = 4;
      competitionDetail = `Limited activity: Only ${businessCount} businesses - unproven area`;
    }

    const hasAnchor = nearbyBusinesses.some(b =>
      ['walmart', 'target', 'costco', 'home depot', 'lowes', 'publix', 'kroger'].some(
        anchor => b.name.toLowerCase().includes(anchor)
      )
    );
    if (hasAnchor) {
      competitionScore = Math.min(10, competitionScore + 1);
      competitionDetail += ' + anchor tenant present';
    }
  }

  // ENVIRONMENTAL SCORE (0-10)
  if (environmentalRisk) {
    const riskScore = environmentalRisk.overallRiskScore;
    environmentalScore = Math.round(riskScore / 10);

    const riskFactors: string[] = [];

    if (environmentalRisk.floodZone.risk === 'high') {
      riskFactors.push('High flood risk');
      environmentalScore = Math.max(0, environmentalScore - 2);
    } else if (environmentalRisk.floodZone.risk === 'medium') {
      riskFactors.push('Moderate flood risk');
      environmentalScore = Math.max(0, environmentalScore - 1);
    }

    if (environmentalRisk.wetlands.present) {
      riskFactors.push('Wetlands present');
      environmentalScore = Math.max(0, environmentalScore - 1);
    }

    if (environmentalRisk.brownfields.present) {
      const count = environmentalRisk.brownfields.count || 1;
      riskFactors.push(`${count} brownfield site(s) nearby`);
      environmentalScore = Math.max(0, environmentalScore - 1);
    }

    if (environmentalRisk.superfund.present) {
      const count = environmentalRisk.superfund.count || 1;
      riskFactors.push(`${count} Superfund site(s) nearby`);
      environmentalScore = Math.max(0, environmentalScore - 2);
    }

    environmentalScore = Math.min(10, Math.max(0, environmentalScore));

    if (riskFactors.length === 0) {
      environmentalDetail = `Low environmental risk (${riskScore}/100) - Clear for development`;
    } else {
      environmentalDetail = `Environmental concerns: ${riskFactors.join(', ')} (Risk: ${riskScore}/100)`;
    }
  }

  // MARKET SCORE (0-10)
  if (marketComps && marketComps.length > 0) {
    const avgPricePerSqft = marketComps.reduce((sum, c) => sum + c.pricePerSqft, 0) / marketComps.length;
    const compCount = marketComps.length;

    if (compCount >= 5) {
      marketScore = 8;
      marketDetail = `Strong market: ${compCount} recent sales, avg $${Math.round(avgPricePerSqft)}/sqft`;
    } else if (compCount >= 3) {
      marketScore = 7;
      marketDetail = `Good market: ${compCount} recent sales, avg $${Math.round(avgPricePerSqft)}/sqft`;
    } else {
      marketScore = 5;
      marketDetail = `Limited data: ${compCount} recent sales, avg $${Math.round(avgPricePerSqft)}/sqft`;
    }

    if (avgPricePerSqft >= 200) {
      marketScore = Math.min(10, marketScore + 2);
      marketDetail += ' - Premium market';
    } else if (avgPricePerSqft >= 150) {
      marketScore = Math.min(10, marketScore + 1);
      marketDetail += ' - Strong market';
    }
  }

  // Calculate overall score (weighted average)
  const weights = {
    traffic: 0.25,
    demographics: 0.20,
    competition: 0.15,
    access: 0.15,
    environmental: 0.15,
    market: 0.10
  };

  const overall = Math.round(
    trafficScore * weights.traffic +
    demographicsScore * weights.demographics +
    competitionScore * weights.competition +
    accessScore * weights.access +
    environmentalScore * weights.environmental +
    marketScore * weights.market
  );

  let rating: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  if (overall >= 8) rating = 'Excellent';
  else if (overall >= 6) rating = 'Good';
  else if (overall >= 4) rating = 'Fair';
  else rating = 'Poor';

  return {
    overall,
    breakdown: {
      trafficScore,
      demographicsScore,
      competitionScore,
      accessScore,
      environmentalScore,
      marketScore
    },
    details: {
      traffic: trafficDetail,
      demographics: demographicsDetail,
      competition: competitionDetail,
      environmental: environmentalDetail,
      market: marketDetail,
      access: accessDetail
    },
    rating
  };
}

export function getScoreColor(score: number): string {
  if (score >= 8) return 'var(--accent-green)';
  if (score >= 6) return 'var(--accent-cyan)';
  if (score >= 4) return '#eab308';
  return 'var(--accent-red)';
}

export function getRatingColor(rating: string): string {
  switch (rating) {
    case 'Excellent': return 'var(--accent-green)';
    case 'Good': return 'var(--accent-cyan)';
    case 'Fair': return '#eab308';
    case 'Poor': return 'var(--accent-red)';
    default: return 'var(--text-muted)';
  }
}
