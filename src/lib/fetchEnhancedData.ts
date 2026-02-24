/**
 * Enhanced Data Fetcher
 *
 * Fetches all new data sources in parallel for property analysis:
 * - Walk Score (pedestrian traffic)
 * - Crime Data (safety)
 * - Building Permits (development pipeline)
 * - Drive-Time Isochrones (accurate trade areas)
 * - Vacancy Data (market saturation)
 *
 * Usage:
 *   const enhancedData = await fetchEnhancedData(lat, lng, address);
 */

import {
  WalkScoreData,
  CrimeData,
  BuildingPermitsData,
  IsochroneData,
  VacancyData,
} from '@/types';

export interface EnhancedDataResult {
  walkScore: WalkScoreData | null;
  crimeData: CrimeData | null;
  buildingPermits: BuildingPermitsData | null;
  isochrone: IsochroneData | null;
  vacancyData: VacancyData | null;
  // Combined scores for quick access
  compositeScores: {
    pedestrianScore: number; // 0-100
    safetyScore: number; // 0-100
    developmentMomentum: number; // 0-100
    marketOpportunity: number; // 0-100 (inverse of saturation)
  };
  // Flags for what data is available
  dataAvailability: {
    walkScore: boolean;
    crimeData: boolean;
    buildingPermits: boolean;
    isochrone: boolean;
    vacancyData: boolean;
  };
}

async function fetchWithTimeout<T>(
  url: string,
  body: object,
  timeoutMs: number = 10000
): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`API error: ${url} returned ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`Timeout fetching ${url}`);
    } else {
      console.error(`Error fetching ${url}:`, error);
    }
    return null;
  }
}

export async function fetchEnhancedData(
  lat: number,
  lng: number,
  address?: string
): Promise<EnhancedDataResult> {
  const baseUrl = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_BASE_URL || '';

  // Fetch all data sources in parallel
  const [walkScore, crimeData, buildingPermits, isochrone, vacancyData] = await Promise.all([
    fetchWithTimeout<WalkScoreData>(`${baseUrl}/api/walkscore`, { lat, lng, address }),
    fetchWithTimeout<CrimeData>(`${baseUrl}/api/crime`, { lat, lng }),
    fetchWithTimeout<BuildingPermitsData>(`${baseUrl}/api/building-permits`, { lat, lng }),
    fetchWithTimeout<IsochroneData>(`${baseUrl}/api/isochrone`, { lat, lng }),
    fetchWithTimeout<VacancyData>(`${baseUrl}/api/vacancy`, { lat, lng }),
  ]);

  // Calculate composite scores
  const pedestrianScore = walkScore?.walkScore ?? 25; // Default to car-dependent
  const safetyScore = crimeData?.safetyScore ?? 50; // Default to average
  const developmentMomentum = buildingPermits?.developmentMomentum ?? 50;

  // Market opportunity is inverse of saturation (low saturation = high opportunity)
  const marketOpportunity = vacancyData
    ? Math.max(0, 100 - vacancyData.marketSaturationScore)
    : 50;

  return {
    walkScore,
    crimeData,
    buildingPermits,
    isochrone,
    vacancyData,
    compositeScores: {
      pedestrianScore,
      safetyScore,
      developmentMomentum,
      marketOpportunity,
    },
    dataAvailability: {
      walkScore: walkScore !== null,
      crimeData: crimeData !== null,
      buildingPermits: buildingPermits !== null,
      isochrone: isochrone !== null,
      vacancyData: vacancyData !== null,
    },
  };
}

/**
 * Calculate an enhanced feasibility score adjustment based on new data
 * This can be added to the existing feasibility score
 */
export function calculateEnhancedScoreAdjustment(data: EnhancedDataResult): {
  adjustment: number; // -10 to +10 points
  factors: string[];
} {
  let adjustment = 0;
  const factors: string[] = [];

  // Walk Score impact (for retail/restaurant sites)
  if (data.walkScore) {
    if (data.walkScore.walkScore >= 90) {
      adjustment += 3;
      factors.push('Excellent walkability boosts foot traffic potential');
    } else if (data.walkScore.walkScore >= 70) {
      adjustment += 1;
      factors.push('Good walkability supports pedestrian traffic');
    } else if (data.walkScore.walkScore < 30) {
      adjustment -= 1;
      factors.push('Low walkability - car-dependent location');
    }
  }

  // Safety impact
  if (data.crimeData) {
    if (data.crimeData.safetyScore >= 80) {
      adjustment += 2;
      factors.push('Low crime area favorable for business');
    } else if (data.crimeData.safetyScore < 40) {
      adjustment -= 3;
      factors.push('High crime area may deter customers and increase costs');
    }
  }

  // Development momentum impact
  if (data.buildingPermits) {
    if (data.buildingPermits.yoyChange.trend === 'growing') {
      adjustment += 1;
      factors.push('Growing area with active development');
    } else if (data.buildingPermits.yoyChange.trend === 'declining') {
      adjustment -= 1;
      factors.push('Declining development activity');
    }
  }

  // Market saturation impact
  if (data.vacancyData) {
    if (data.vacancyData.saturationLevel === 'undersupplied') {
      adjustment += 2;
      factors.push('Undersupplied market presents opportunity');
    } else if (data.vacancyData.saturationLevel === 'oversupplied') {
      adjustment -= 2;
      factors.push('Oversupplied market increases competition risk');
    }
  }

  // Cap adjustment at +/- 10
  adjustment = Math.max(-10, Math.min(10, adjustment));

  return { adjustment, factors };
}

/**
 * Get business-type-specific insights from enhanced data
 */
export function getBusinessTypeInsights(
  data: EnhancedDataResult,
  businessType: 'retail' | 'restaurant' | 'office' | 'medical' | 'industrial'
): string[] {
  const insights: string[] = [];

  switch (businessType) {
    case 'retail':
    case 'restaurant':
      // Walk score is critical
      if (data.walkScore) {
        if (data.walkScore.retailViability === 'excellent') {
          insights.push('Excellent location for walk-in retail traffic');
        } else if (data.walkScore.retailViability === 'poor') {
          insights.push('Consider drive-thru or destination retail model');
        }
      }
      // Market saturation
      if (data.vacancyData?.sectors) {
        const sector = businessType === 'restaurant' ? 'foodService' : 'retail';
        const saturation = data.vacancyData.sectors[sector].saturation;
        if (saturation === 'low') {
          insights.push(`${businessType === 'restaurant' ? 'Food service' : 'Retail'} undersupplied in area`);
        } else if (saturation === 'high') {
          insights.push(`High ${businessType === 'restaurant' ? 'restaurant' : 'retail'} competition - differentiation needed`);
        }
      }
      break;

    case 'office':
      // Safety matters for office
      if (data.crimeData?.safetyGrade === 'A' || data.crimeData?.safetyGrade === 'B') {
        insights.push('Safe area attractive for professional tenants');
      }
      if (data.vacancyData?.sectors.professional.saturation === 'low') {
        insights.push('Professional services undersupplied - office demand likely');
      }
      break;

    case 'medical':
      // Healthcare saturation
      if (data.vacancyData?.sectors.healthcare.saturation === 'low') {
        insights.push('Healthcare services undersupplied - strong demand signal');
      }
      if (data.walkScore?.transitAccessible) {
        insights.push('Transit access benefits medical office accessibility');
      }
      break;

    case 'industrial':
      // Development momentum matters
      if (data.buildingPermits?.marketAnalysis.populationGrowthSignal === 'strong') {
        insights.push('Population growth supports industrial/distribution demand');
      }
      break;
  }

  // Add safety considerations for all types
  if (data.crimeData?.businessImpact.securityRecommendations) {
    const topRec = data.crimeData.businessImpact.securityRecommendations[0];
    if (topRec && !topRec.includes('Basic')) {
      insights.push(topRec);
    }
  }

  return insights;
}
