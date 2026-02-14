import { TrafficInfo, ExtendedDemographics, Business, EnvironmentalRisk, MarketComp, FeasibilityScore, AccessPoint } from '@/types';

export function calculateFeasibilityScore(
  trafficData: TrafficInfo | null,
  demographicsData: ExtendedDemographics | null,
  nearbyBusinesses: Business[],
  environmentalRisk: EnvironmentalRisk | null,
  marketComps: MarketComp[] | null,
  accessPoints?: AccessPoint[]
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

  // TRAFFIC SCORE (0-10) - Use access points VPD if available (more accurate)
  let primaryVpd = 0;
  let totalVpd = 0;
  let vpdSource = 'estimated';
  let primaryRoadName = '';

  // Calculate VPD from access points if available
  if (accessPoints && accessPoints.length > 0) {
    // Get unique roads with their best VPD
    const roadVPDs = new Map<string, { vpd: number; source: string; type: string }>();
    for (const ap of accessPoints) {
      const existing = roadVPDs.get(ap.roadName);
      const apVpd = ap.vpd || ap.estimatedVpd || 0;
      if (!existing || apVpd > existing.vpd) {
        roadVPDs.set(ap.roadName, {
          vpd: apVpd,
          source: ap.vpdSource || 'estimated',
          type: ap.roadType || 'unknown'
        });
      }
    }

    // Find primary (highest VPD) road and calculate total
    for (const [roadName, data] of roadVPDs) {
      totalVpd += data.vpd;
      if (data.vpd > primaryVpd) {
        primaryVpd = data.vpd;
        primaryRoadName = roadName;
        vpdSource = data.source;
      }
    }
  }

  // Fall back to trafficData if no access points
  if (primaryVpd === 0 && trafficData && trafficData.estimatedVPD != null) {
    primaryVpd = trafficData.estimatedVPD;
    totalVpd = trafficData.estimatedVPD;
    primaryRoadName = trafficData.roadType || 'Unknown';
  }

  // Score based on primary road VPD
  if (primaryVpd > 0) {
    const sourceLabel = vpdSource === 'fdot' ? ' (FDOT official)' : ' (estimated)';
    if (primaryVpd >= 30000) {
      trafficScore = 10;
      trafficDetail = `Excellent traffic: ${primaryVpd.toLocaleString()} VPD${sourceLabel} - supports all business types`;
    } else if (primaryVpd >= 20000) {
      trafficScore = 9;
      trafficDetail = `Very high traffic: ${primaryVpd.toLocaleString()} VPD${sourceLabel} - ideal for most retail`;
    } else if (primaryVpd >= 15000) {
      trafficScore = 8;
      trafficDetail = `High traffic: ${primaryVpd.toLocaleString()} VPD${sourceLabel} - supports drive-thru concepts`;
    } else if (primaryVpd >= 10000) {
      trafficScore = 6;
      trafficDetail = `Moderate traffic: ${primaryVpd.toLocaleString()} VPD${sourceLabel} - suitable for quick service`;
    } else if (primaryVpd >= 5000) {
      trafficScore = 4;
      trafficDetail = `Low-moderate traffic: ${primaryVpd.toLocaleString()} VPD${sourceLabel} - limits options`;
    } else {
      trafficScore = 2;
      trafficDetail = `Low traffic: ${primaryVpd.toLocaleString()} VPD${sourceLabel} - local service only`;
    }

    if (primaryRoadName) {
      trafficDetail += ` (${primaryRoadName})`;
    }
  }

  // ACCESS SCORE (0-10) - Based on access points
  if (accessPoints && accessPoints.length > 0) {
    const uniqueRoads = new Set(accessPoints.map(ap => ap.roadName)).size;
    const hasFdotData = accessPoints.some(ap => ap.vpdSource === 'fdot');
    const hasPrimaryRoad = accessPoints.some(ap =>
      ap.roadType === 'primary' || ap.roadType === 'secondary' || ap.roadType === 'trunk'
    );

    // Base score on number of access roads
    if (uniqueRoads >= 3) {
      accessScore = 9;
      accessDetail = `Excellent access: ${uniqueRoads} roads provide multiple entry points`;
    } else if (uniqueRoads === 2) {
      accessScore = 8;
      accessDetail = `Good access: ${uniqueRoads} roads - corner lot or dual access`;
    } else {
      accessScore = 6;
      accessDetail = `Single road access from ${primaryRoadName || 'nearby road'}`;
    }

    // Bonus for major roads
    if (hasPrimaryRoad) {
      accessScore = Math.min(10, accessScore + 1);
      accessDetail += ' + major road frontage';
    }

    // Add total exposure info
    if (totalVpd > primaryVpd) {
      accessDetail += ` (${totalVpd.toLocaleString()} total VPD exposure)`;
    }
  } else if (trafficData) {
    // Fall back to road type from traffic data
    const roadType = trafficData.roadType || 'Unknown';
    if (roadType.toLowerCase().includes('primary') || roadType.toLowerCase().includes('major')) {
      accessScore = 8;
      accessDetail = `${roadType} with high visibility`;
    } else if (roadType.toLowerCase().includes('secondary')) {
      accessScore = 6;
      accessDetail = `${roadType} - good local access`;
    } else {
      accessScore = 4;
      accessDetail = `${roadType} - limited visibility`;
    }
  }

  // DEMOGRAPHICS SCORE (0-10)
  if (demographicsData) {
    const income = demographicsData.medianHouseholdIncome ?? 0;
    const employment = demographicsData.employmentRate || 0;
    const population = demographicsData.population ?? 0;
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
    (trafficScore * weights.traffic +
    demographicsScore * weights.demographics +
    competitionScore * weights.competition +
    accessScore * weights.access +
    environmentalScore * weights.environmental +
    marketScore * weights.market) * 10
  ) / 10;

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

/**
 * Get score label and icon for WCAG accessibility
 * Returns label (Poor/Fair/Good/Excellent) and icon symbol
 */
export function getScoreLabelAndIcon(score: number): { label: string; icon: string } {
  if (score >= 8) return { label: 'Excellent', icon: '✓' };
  if (score >= 6) return { label: 'Good', icon: '○' };
  if (score >= 4) return { label: 'Fair', icon: '△' };
  return { label: 'Poor', icon: '✕' };
}
