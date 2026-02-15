import { TrafficInfo, ExtendedDemographics, Business, EnvironmentalRisk, MarketComp, FeasibilityScore, AccessPoint, LocationIntelligence, SelectedParcel } from '@/types';

interface ParcelInfo {
  acres?: number;
  sqft?: number;
  zoning?: string;
  landUse?: string;
}

export function calculateFeasibilityScore(
  trafficData: TrafficInfo | null,
  demographicsData: ExtendedDemographics | null,
  nearbyBusinesses: Business[],
  environmentalRisk: EnvironmentalRisk | null,
  marketComps: MarketComp[] | null,
  accessPoints?: AccessPoint[],
  locationIntelligence?: LocationIntelligence | null,
  parcelInfo?: ParcelInfo | null
): FeasibilityScore {
  let trafficScore = 5;
  let demographicsScore = 5;
  let competitionScore = 5;
  let accessScore = 5;
  let environmentalScore = 5;
  let marketScore = 5;
  let economicScore = 5;
  let siteScore = 5;

  let trafficDetail = 'No traffic data available';
  let demographicsDetail = 'No demographics data available';
  let competitionDetail = 'No nearby business data';
  let accessDetail = 'Unable to assess access';
  let environmentalDetail = 'No environmental data available';
  let marketDetail = 'No market comp data available';
  let economicDetail = 'No economic data available';
  let siteDetail = 'No site data available';

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

  // ACCESS SCORE (0-10) - Based on access points + highway access
  if (accessPoints && accessPoints.length > 0) {
    const uniqueRoads = new Set(accessPoints.map(ap => ap.roadName)).size;
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

  // Highway access bonus from location intelligence
  if (locationIntelligence?.highwayAccess) {
    const hwAccess = locationIntelligence.highwayAccess;
    if (hwAccess.hasDirectAccess || hwAccess.distanceMiles <= 0.5) {
      accessScore = Math.min(10, accessScore + 1);
      accessDetail += ` + Direct ${hwAccess.nearestHighway} access`;
    } else if (hwAccess.distanceMiles <= 2) {
      accessScore = Math.min(10, accessScore + 0.5);
      accessDetail += ` + ${hwAccess.nearestHighway} ${hwAccess.distanceMiles.toFixed(1)} mi`;
    }
  }

  // DEMOGRAPHICS SCORE (0-10) - Income, employment, population, education, age
  if (demographicsData) {
    const income = demographicsData.medianHouseholdIncome ?? 0;
    const employment = demographicsData.employmentRate || 0;
    const population = demographicsData.population ?? 0;
    const isCollegeTown = demographicsData.isCollegeTown || false;
    const collegePercent = demographicsData.collegeEnrollmentPercent || 0;
    const growthTrend = demographicsData.growthTrend || 0;
    const educationLevels = demographicsData.educationLevels || [];
    const ageDistribution = demographicsData.ageDistribution || [];

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

    // Education bonus - higher education correlates with spending power
    let educationBonus = 0;
    const bachelorsPlus = educationLevels
      .filter(e => e.level.includes("Bachelor") || e.level.includes("Graduate"))
      .reduce((sum, e) => sum + e.percent, 0);
    if (bachelorsPlus >= 40) educationBonus = 1;
    else if (bachelorsPlus >= 25) educationBonus = 0.5;

    // Growth trend bonus
    let growthBonus = 0;
    if (growthTrend >= 2) growthBonus = 0.5;
    else if (growthTrend >= 1) growthBonus = 0.25;

    // Working age population bonus (25-64 age group)
    let workingAgeBonus = 0;
    const workingAge = ageDistribution
      .filter(a => {
        const age = a.age.toLowerCase();
        return age.includes('25-') || age.includes('35-') || age.includes('45-') || age.includes('55-');
      })
      .reduce((sum, a) => sum + a.percent, 0);
    if (workingAge >= 50) workingAgeBonus = 0.5;
    else if (workingAge >= 40) workingAgeBonus = 0.25;

    demographicsScore = Math.min(10, Math.round((incomeScore + employmentBonus + populationBonus + educationBonus + growthBonus + workingAgeBonus) * 10) / 10);

    if (isCollegeTown) {
      demographicsDetail = `College Town (${collegePercent}% students) - Strong spending power, $${income.toLocaleString()} median, ${population.toLocaleString()} pop`;
    } else {
      demographicsDetail = `$${income.toLocaleString()} median income, ${population.toLocaleString()} pop, ${employment}% employed`;
      if (bachelorsPlus > 0) {
        demographicsDetail += `, ${bachelorsPlus}% college educated`;
      }
      if (growthTrend > 0) {
        demographicsDetail += `, ${growthTrend}% growth`;
      }
    }
  }

  // ECONOMIC SCORE (0-10) - Consumer spending power + income distribution
  if (demographicsData) {
    const consumerSpending = demographicsData.consumerSpending || 0;
    const incomeDistribution = demographicsData.incomeDistribution || [];

    // Consumer spending score (3-mile radius)
    let spendingScore = 5;
    if (consumerSpending >= 800000000) { // $800M+
      spendingScore = 10;
    } else if (consumerSpending >= 500000000) { // $500M+
      spendingScore = 9;
    } else if (consumerSpending >= 300000000) { // $300M+
      spendingScore = 8;
    } else if (consumerSpending >= 200000000) { // $200M+
      spendingScore = 7;
    } else if (consumerSpending >= 100000000) { // $100M+
      spendingScore = 6;
    } else if (consumerSpending >= 50000000) { // $50M+
      spendingScore = 5;
    } else if (consumerSpending > 0) {
      spendingScore = 4;
    }

    // Income distribution bonus - higher income brackets
    let highIncomeBonus = 0;
    const highIncomePercent = incomeDistribution
      .filter(i => i.range.includes('$100K') || i.range.includes('$150K') || i.range.includes('$200K'))
      .reduce((sum, i) => sum + i.percent, 0);
    if (highIncomePercent >= 30) highIncomeBonus = 1;
    else if (highIncomePercent >= 20) highIncomeBonus = 0.5;

    economicScore = Math.min(10, Math.round((spendingScore + highIncomeBonus) * 10) / 10);

    // Format spending for display
    const spendingFormatted = consumerSpending >= 1000000000
      ? `$${(consumerSpending / 1000000000).toFixed(1)}B`
      : consumerSpending >= 1000000
        ? `$${(consumerSpending / 1000000).toFixed(1)}M`
        : `$${consumerSpending.toLocaleString()}`;

    economicDetail = `${spendingFormatted} consumer spending (3-mi)`;
    if (highIncomePercent > 0) {
      economicDetail += `, ${highIncomePercent}% high-income households`;
    }
  }

  // SITE SCORE (0-10) - Lot size + zoning + daytime population
  if (parcelInfo || locationIntelligence) {
    let lotScore = 5;
    let zoningScore = 5;
    let daytimeScore = 5;
    const siteDetails: string[] = [];

    // Lot size scoring
    if (parcelInfo?.acres) {
      const acres = parcelInfo.acres;
      if (acres >= 2 && acres <= 10) {
        lotScore = 9; // Ideal for most commercial
        siteDetails.push(`${acres.toFixed(2)} acres (ideal)`);
      } else if (acres >= 1 && acres < 2) {
        lotScore = 8; // Good for smaller retail
        siteDetails.push(`${acres.toFixed(2)} acres (good)`);
      } else if (acres >= 0.5 && acres < 1) {
        lotScore = 6; // Limited options
        siteDetails.push(`${acres.toFixed(2)} acres (limited)`);
      } else if (acres > 10) {
        lotScore = 8; // Large site - good for big box or multi-tenant
        siteDetails.push(`${acres.toFixed(2)} acres (large site)`);
      } else {
        lotScore = 4; // Too small
        siteDetails.push(`${acres.toFixed(2)} acres (small)`);
      }
    } else if (parcelInfo?.sqft) {
      const sqft = parcelInfo.sqft;
      const acres = sqft / 43560;
      if (acres >= 2 && acres <= 10) {
        lotScore = 9;
        siteDetails.push(`${sqft.toLocaleString()} sqft (ideal)`);
      } else if (acres >= 1) {
        lotScore = 8;
        siteDetails.push(`${sqft.toLocaleString()} sqft (good)`);
      } else if (acres >= 0.5) {
        lotScore = 6;
        siteDetails.push(`${sqft.toLocaleString()} sqft (limited)`);
      } else {
        lotScore = 4;
        siteDetails.push(`${sqft.toLocaleString()} sqft (small)`);
      }
    }

    // Zoning scoring
    if (parcelInfo?.zoning) {
      const zoning = parcelInfo.zoning.toUpperCase();
      if (zoning.includes('C-') || zoning.includes('COM') || zoning.includes('COMMERCIAL') || zoning.includes('B-')) {
        zoningScore = 10;
        siteDetails.push(`${parcelInfo.zoning} (commercial)`);
      } else if (zoning.includes('MU') || zoning.includes('MIXED') || zoning.includes('PUD')) {
        zoningScore = 9;
        siteDetails.push(`${parcelInfo.zoning} (mixed-use)`);
      } else if (zoning.includes('O-') || zoning.includes('OFFICE')) {
        zoningScore = 7;
        siteDetails.push(`${parcelInfo.zoning} (office)`);
      } else if (zoning.includes('I-') || zoning.includes('IND')) {
        zoningScore = 6;
        siteDetails.push(`${parcelInfo.zoning} (industrial)`);
      } else if (zoning.includes('R-') || zoning.includes('RES')) {
        zoningScore = 3;
        siteDetails.push(`${parcelInfo.zoning} (residential - rezoning needed)`);
      } else {
        zoningScore = 5;
        siteDetails.push(`${parcelInfo.zoning}`);
      }
    }

    // Daytime population scoring from location intelligence
    if (locationIntelligence?.daytimePopulation) {
      const dayPop = locationIntelligence.daytimePopulation;
      if (dayPop.populationType === 'commercial') {
        daytimeScore = 9;
        siteDetails.push(`Commercial area (${dayPop.workerToResidentRatio.toFixed(1)}x workers)`);
      } else if (dayPop.populationType === 'mixed') {
        daytimeScore = 7;
        siteDetails.push(`Mixed use area`);
      } else {
        daytimeScore = 5;
        siteDetails.push(`Residential area`);
      }
    }

    // Opportunity Zone bonus
    if (locationIntelligence?.opportunityZone?.isInZone) {
      siteDetails.push('Opportunity Zone');
    }

    // Calculate weighted site score
    const hasLot = parcelInfo?.acres || parcelInfo?.sqft;
    const hasZoning = parcelInfo?.zoning;
    const hasDaytime = locationIntelligence?.daytimePopulation;

    if (hasLot && hasZoning && hasDaytime) {
      siteScore = Math.round((lotScore * 0.4 + zoningScore * 0.4 + daytimeScore * 0.2) * 10) / 10;
    } else if (hasLot && hasZoning) {
      siteScore = Math.round((lotScore * 0.5 + zoningScore * 0.5) * 10) / 10;
    } else if (hasLot) {
      siteScore = lotScore;
    } else if (hasZoning) {
      siteScore = zoningScore;
    } else if (hasDaytime) {
      siteScore = daytimeScore;
    }

    // Opportunity Zone bonus
    if (locationIntelligence?.opportunityZone?.isInZone) {
      siteScore = Math.min(10, siteScore + 0.5);
    }

    siteDetail = siteDetails.length > 0 ? siteDetails.join(', ') : 'Limited site data';
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
  // Adjusted weights to include new categories
  const weights = {
    traffic: 0.20,
    demographics: 0.15,
    economic: 0.15,
    competition: 0.10,
    access: 0.10,
    site: 0.10,
    environmental: 0.10,
    market: 0.10
  };

  const overall = Math.round(
    (trafficScore * weights.traffic +
    demographicsScore * weights.demographics +
    economicScore * weights.economic +
    competitionScore * weights.competition +
    accessScore * weights.access +
    siteScore * weights.site +
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
      trafficScore: Math.round(trafficScore * 10) / 10,
      demographicsScore: Math.round(demographicsScore * 10) / 10,
      competitionScore: Math.round(competitionScore * 10) / 10,
      accessScore: Math.round(accessScore * 10) / 10,
      environmentalScore: Math.round(environmentalScore * 10) / 10,
      marketScore: Math.round(marketScore * 10) / 10,
      economicScore: Math.round(economicScore * 10) / 10,
      siteScore: Math.round(siteScore * 10) / 10
    },
    details: {
      traffic: trafficDetail,
      demographics: demographicsDetail,
      competition: competitionDetail,
      environmental: environmentalDetail,
      market: marketDetail,
      access: accessDetail,
      economic: economicDetail,
      site: siteDetail
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
