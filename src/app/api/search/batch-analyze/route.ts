import { NextRequest, NextResponse } from 'next/server';

interface ParcelInput {
  parcelId: string;
  address: string;
  coordinates: { lat: number; lng: number };
  lotSize?: number;
  zoning?: string;
  landUse?: string;
  landUseCode?: string;
  owner?: string;
  yearBuilt?: number;
  buildingSqFt?: number;
  propertyType?: string;
}

interface QuickFeasibility {
  parcelId: string;
  address: string;
  coordinates: { lat: number; lng: number };
  lotSize?: number;
  lotSizeAcres?: number;
  score: number;
  factors: {
    // Core 8 factors (same as single property analysis)
    trafficScore: number;
    demographicsScore: number;
    economicScore: number;
    competitionScore: number;
    accessScore: number;
    siteScore: number;
    environmentalScore: number;
    marketScore: number;
    // Enhanced scores for additional insights
    walkabilityScore: number;
    safetyScore: number;
    developmentScore: number;
    saturationScore: number;
    // Legacy fields for UI compatibility
    businessDensity: number;
    zoningScore: number;
    lotSizeScore: number;
  };
  zoning?: string;
  nearbyBusinesses?: number;
  estimatedVPD?: number;
  medianIncome?: number;
  population?: number;
  // Property context fields
  landUse?: string;
  landUseCode?: string;
  owner?: string;
  yearBuilt?: number;
  buildingSqFt?: number;
  propertyType?: string;
  occupancyStatus?: 'occupied' | 'vacant' | 'unknown';
}

interface BatchAnalyzeRequest {
  parcels: ParcelInput[];
  minScore?: number;
  fastMode?: boolean;
  searchCenter?: { lat: number; lng: number };
}

interface DemographicsData {
  population: number;
  medianHouseholdIncome: number;
  employmentRate: number;
  isCollegeTown?: boolean;
  collegeEnrollmentPercent?: number;
}

interface AreaEnhancedData {
  walkScore: number;
  transitScore: number | null;
  retailViability: 'excellent' | 'good' | 'fair' | 'poor';
  safetyScore: number;
  safetyGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  developmentMomentum: number;
  developmentTrend: 'growing' | 'stable' | 'declining';
  saturationScore: number;
  saturationLevel: 'undersupplied' | 'balanced' | 'saturated' | 'oversupplied';
  marketCompCount: number;
  avgPricePerSqft: number;
}

interface CacheEntry {
  data: QuickFeasibility;
  timestamp: number;
}

// In-memory cache with TTL
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const analysisCache = new Map<string, CacheEntry>();

const BATCH_SIZE = 15;
const BATCH_DELAY = 25;

function getCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

function cleanCache(): void {
  const now = Date.now();
  for (const [key, entry] of analysisCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      analysisCache.delete(key);
    }
  }
}

// Fetch FDOT VPD data and calculate traffic/access scores
// Uses the same FDOT query and scoring logic as access-points API
async function fetchTrafficAndAccessScores(lat: number, lng: number): Promise<{
  trafficScore: number;
  accessScore: number;
  vpd: number;
  roadName: string;
  roadType: string;
}> {
  try {
    // Step 1: Find nearby roads using OSM - check for service roads first (for accuracy)
    // If there are service roads very close (within 30m), the parcel is likely accessed via them
    const osmQuery = `
      [out:json][timeout:15];
      way(around:75,${lat},${lng})["highway"];
      out tags;
    `;

    let roadName = 'Unknown';
    let roadType = 'residential';
    let hasNearbyServiceRoad = false;

    try {
      const osmResponse = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: `data=${encodeURIComponent(osmQuery)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: AbortSignal.timeout(12000),
      });

      if (osmResponse.ok) {
        const osmData = await osmResponse.json();
        const roads = osmData.elements || [];

        // First check if there are service roads nearby (within the point's immediate area)
        // This suggests the parcel is accessed via parking lot/service road, not directly from main road
        for (const road of roads) {
          const highway = road.tags?.highway;
          if (highway === 'service' || highway === 'driveway' || highway === 'parking_aisle') {
            hasNearbyServiceRoad = true;
            break;
          }
        }

        // If service roads exist, the actual access is likely via service road
        // Use more conservative traffic estimate to match access-points API behavior
        if (hasNearbyServiceRoad) {
          // Find the main road name for reference
          for (const road of roads) {
            if (road.tags?.name && road.tags?.highway !== 'service') {
              roadName = road.tags.name;
              break;
            }
          }
          roadType = 'service'; // Access is via service road
        } else {
          // No service roads - find the best named road (prefer higher-class roads)
          const roadPriority: Record<string, number> = {
            motorway: 10, trunk: 9, primary: 8, secondary: 7,
            tertiary: 6, residential: 3, unclassified: 2
          };

          let bestPriority = 0;
          for (const road of roads) {
            const highway = road.tags?.highway;
            const name = road.tags?.name;
            if (name && highway && roadPriority[highway]) {
              if (roadPriority[highway] > bestPriority) {
                bestPriority = roadPriority[highway];
                roadName = name;
                roadType = highway;
              }
            }
          }
        }
      }
    } catch (osmError) {
      console.log('[BatchAnalyze] OSM query failed, continuing with FDOT only');
    }

    // Step 2: Query FDOT for VPD at this location
    // Use same parameters as access-points API
    const radius = 0.002; // ~220m search radius
    const mapExtent = `${lng - radius},${lat - radius},${lng + radius},${lat + radius}`;
    const fdotUrl = `https://gis.fdot.gov/arcgis/rest/services/FTO/fto_PROD/MapServer/identify?` +
      `geometry=${lng},${lat}&geometryType=esriGeometryPoint&sr=4326&` +
      `layers=all:7&tolerance=50&mapExtent=${mapExtent}&imageDisplay=400,400,96&` +
      `returnGeometry=false&f=json`;

    let vpd = 0;
    let vpdSource = 'estimated';

    try {
      const fdotResponse = await fetch(fdotUrl, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });

      if (fdotResponse.ok) {
        const fdotData = await fdotResponse.json();
        if (fdotData.results && fdotData.results.length > 0) {
          // Find the best match - ONLY use if road name matches (consistent with access-points API)
          const normalizedRoadName = roadName.toLowerCase().replace(/[^a-z0-9]/g, '');

          for (const result of fdotData.results) {
            const attrs = result.attributes;
            if (attrs && attrs.AADT && Number(attrs.AADT) > 0) {
              const aadt = Number(attrs.AADT);
              const fdotRoadName = (attrs.ROAD_NAME || attrs.ROADNAME || '').toLowerCase().replace(/[^a-z0-9]/g, '');

              // Only use FDOT data if road names match (same behavior as access-points API)
              // This prevents picking up data from nearby major roads when we're on a local street
              if (normalizedRoadName && fdotRoadName &&
                  (fdotRoadName.includes(normalizedRoadName) || normalizedRoadName.includes(fdotRoadName))) {
                vpd = aadt;
                vpdSource = 'fdot';
                break;
              }
              // Do NOT use FDOT data without road name match - fall through to OSM estimate
            }
          }
        }
      }
    } catch (fdotError) {
      console.log('[BatchAnalyze] FDOT query failed');
    }

    // Step 3: If no FDOT data, estimate based on road type (same as access-points API)
    if (vpd === 0) {
      const vpdEstimates: Record<string, number> = {
        motorway: 75000, trunk: 35000, primary: 20000, secondary: 10000,
        tertiary: 5000, residential: 1500, unclassified: 2000, service: 200
      };
      vpd = vpdEstimates[roadType] || 2000;
      vpdSource = 'estimated';
    }

    // Step 4: Calculate traffic score (same thresholds as feasibilityScore.ts)
    let trafficScore = 5;
    if (vpd >= 30000) trafficScore = 10;
    else if (vpd >= 20000) trafficScore = 9;
    else if (vpd >= 15000) trafficScore = 8;
    else if (vpd >= 10000) trafficScore = 6;
    else if (vpd >= 5000) trafficScore = 4;
    else if (vpd > 0) trafficScore = 2;

    // Step 5: Calculate access score based on road type
    let accessScore = 5;
    if (roadType === 'primary' || roadType === 'trunk' || roadType === 'motorway') {
      accessScore = 8;
    } else if (roadType === 'secondary') {
      accessScore = 7;
    } else if (roadType === 'tertiary') {
      accessScore = 6;
    } else if (roadType === 'residential') {
      accessScore = 4;
    }

    console.log(`[BatchAnalyze] Traffic: ${roadName} (${roadType}) - ${vpd} VPD (${vpdSource}) = score ${trafficScore}`);

    return { trafficScore, accessScore, vpd, roadName, roadType };
  } catch (error) {
    console.error('[BatchAnalyze] Error fetching traffic data:', error);
    return { trafficScore: 5, accessScore: 5, vpd: 0, roadName: 'Unknown', roadType: 'unknown' };
  }
}

async function getEstimatedVPD(lat: number, lng: number): Promise<{ vpd: number; roadType: string }> {
  try {
    const radius = 100;
    const query = `
      [out:json][timeout:10];
      way(around:${radius},${lat},${lng})["highway"];
      out tags;
    `;

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return { vpd: 10000, roadType: 'Unknown' };
    }

    const data = await response.json();
    const roads = data.elements || [];

    const vpdEstimates: Record<string, { vpd: number; type: string }> = {
      motorway: { vpd: 50000, type: 'Highway/Interstate' },
      trunk: { vpd: 35000, type: 'Major Highway' },
      primary: { vpd: 25000, type: 'Primary Arterial' },
      secondary: { vpd: 15000, type: 'Secondary Arterial' },
      tertiary: { vpd: 8000, type: 'Collector Road' },
      residential: { vpd: 3000, type: 'Residential Street' },
      unclassified: { vpd: 5000, type: 'Local Road' },
    };

    let maxVpd = 5000;
    let bestRoadType = 'Local Road';

    for (const road of roads) {
      const highway = road.tags?.highway;
      if (highway && vpdEstimates[highway]) {
        if (vpdEstimates[highway].vpd > maxVpd) {
          maxVpd = vpdEstimates[highway].vpd;
          bestRoadType = vpdEstimates[highway].type;
        }
      }
    }

    return { vpd: maxVpd, roadType: bestRoadType };
  } catch (error) {
    console.error('Error getting VPD estimate:', error);
    return { vpd: 10000, roadType: 'Unknown' };
  }
}

// Fetch nearby business data with occupancy check
async function fetchNearbyBusinessData(lat: number, lng: number): Promise<{ count: number; hasBusinessAtLocation: boolean; businessName?: string; hasAnchor: boolean }> {
  try {
    const query = `
      [out:json][timeout:10];
      (
        node["shop"](around:500,${lat},${lng});
        node["amenity"~"restaurant|fast_food|cafe|bank|pharmacy|fuel|hospital|clinic"](around:500,${lat},${lng});
        node["office"](around:500,${lat},${lng});
        way["shop"](around:500,${lat},${lng});
        way["amenity"~"restaurant|fast_food|cafe|bank|pharmacy|fuel|hospital|clinic"](around:500,${lat},${lng});
        way["office"](around:500,${lat},${lng});
      );
      out body center;
    `;

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return { count: 10, hasBusinessAtLocation: false, hasAnchor: false };
    }

    const data = await response.json();
    const elements = data.elements || [];
    const count = elements.length;

    let hasBusinessAtLocation = false;
    let businessName: string | undefined;
    let hasAnchor = false;

    const anchorNames = ['walmart', 'target', 'costco', 'home depot', 'lowes', 'publix', 'kroger', 'whole foods', 'trader joe', 'safeway', 'albertsons'];

    for (const el of elements) {
      const name = (el.tags?.name || el.tags?.brand || '').toLowerCase();

      // Check for anchor stores
      if (anchorNames.some(anchor => name.includes(anchor))) {
        hasAnchor = true;
      }

      // Check if business is at exact location
      let elLat: number, elLng: number;
      if (el.type === 'node') {
        elLat = el.lat;
        elLng = el.lon;
      } else if (el.type === 'way' && el.center) {
        elLat = el.center.lat;
        elLng = el.center.lon;
      } else {
        continue;
      }

      const dLat = (elLat - lat) * 111320;
      const dLng = (elLng - lng) * 111320 * Math.cos(lat * Math.PI / 180);
      const distance = Math.sqrt(dLat * dLat + dLng * dLng);

      if (distance <= 30) {
        hasBusinessAtLocation = true;
        businessName = el.tags?.name || el.tags?.brand || el.tags?.operator;
      }
    }

    return { count, hasBusinessAtLocation, businessName, hasAnchor };
  } catch (error) {
    console.error('Error getting business data:', error);
    return { count: 10, hasBusinessAtLocation: false, hasAnchor: false };
  }
}

// Fetch demographics for search area
async function fetchAreaDemographics(lat: number, lng: number): Promise<DemographicsData | null> {
  try {
    const fccUrl = `https://geo.fcc.gov/api/census/area?lat=${lat}&lon=${lng}&format=json`;
    const fccResponse = await fetch(fccUrl, { signal: AbortSignal.timeout(10000) });

    if (!fccResponse.ok) return null;

    const fccData = await fccResponse.json();
    const fips = fccData.results?.[0]?.block_fips;

    if (!fips) return null;

    const stateFips = fips.substring(0, 2);
    const countyFips = fips.substring(2, 5);
    const tractFips = fips.substring(5, 11);

    const censusUrl = `https://api.census.gov/data/2022/acs/acs5?get=B01003_001E,B19013_001E,B23025_002E,B23025_005E,B14001_002E,B01001_001E&for=tract:${tractFips}&in=state:${stateFips}&in=county:${countyFips}`;

    const censusResponse = await fetch(censusUrl, { signal: AbortSignal.timeout(10000) });
    if (!censusResponse.ok) return null;

    const censusData = await censusResponse.json();
    if (!censusData || censusData.length < 2) return null;

    const values = censusData[1];
    const population = parseInt(values[0]) || 0;
    const medianIncome = parseInt(values[1]) || 50000;
    const laborForce = parseInt(values[2]) || 1;
    const unemployed = parseInt(values[3]) || 0;
    const collegeEnrolled = parseInt(values[4]) || 0;
    const totalPop = parseInt(values[5]) || population;

    const employmentRate = laborForce > 0 ? Math.round(((laborForce - unemployed) / laborForce) * 100) : 90;
    const collegePercent = totalPop > 0 ? Math.round((collegeEnrolled / totalPop) * 100) : 0;
    const isCollegeTown = collegePercent >= 15;

    return {
      population,
      medianHouseholdIncome: medianIncome,
      employmentRate,
      isCollegeTown,
      collegeEnrollmentPercent: collegePercent,
    };
  } catch (error) {
    console.error('Error fetching demographics:', error);
    return null;
  }
}

// Fetch area-level enhanced data (Walk Score, Crime, Permits, Vacancy, Market Comps)
async function fetchAreaEnhancedData(lat: number, lng: number): Promise<AreaEnhancedData | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const body = JSON.stringify({ lat, lng });
    const headers = { 'Content-Type': 'application/json' };

    const [walkScoreRes, crimeRes, permitsRes, vacancyRes, compsRes] = await Promise.allSettled([
      fetch(`${baseUrl}/api/walkscore`, { method: 'POST', headers, body, signal: AbortSignal.timeout(10000) }),
      fetch(`${baseUrl}/api/crime`, { method: 'POST', headers, body, signal: AbortSignal.timeout(10000) }),
      fetch(`${baseUrl}/api/building-permits`, { method: 'POST', headers, body, signal: AbortSignal.timeout(10000) }),
      fetch(`${baseUrl}/api/vacancy`, { method: 'POST', headers, body, signal: AbortSignal.timeout(10000) }),
      fetch(`${baseUrl}/api/market-comps`, { method: 'POST', headers, body, signal: AbortSignal.timeout(10000) }),
    ]);

    // Default values
    let walkScore = 50;
    let transitScore: number | null = null;
    let retailViability: 'excellent' | 'good' | 'fair' | 'poor' = 'fair';
    let safetyScore = 50;
    let safetyGrade: 'A' | 'B' | 'C' | 'D' | 'F' = 'C';
    let developmentMomentum = 50;
    let developmentTrend: 'growing' | 'stable' | 'declining' = 'stable';
    let saturationScore = 50;
    let saturationLevel: 'undersupplied' | 'balanced' | 'saturated' | 'oversupplied' = 'balanced';
    let marketCompCount = 0;
    let avgPricePerSqft = 0;

    // Parse each response in its own try-catch so one failure doesn't affect others

    // Parse Walk Score
    if (walkScoreRes.status === 'fulfilled' && walkScoreRes.value.ok) {
      try {
        const data = await walkScoreRes.value.json();
        walkScore = data.walkScore || 50;
        transitScore = data.transitScore || null;
        retailViability = data.retailViability || 'fair';
      } catch (e) {
        console.log('[BatchAnalyze] Walk Score parse error:', e);
      }
    }

    // Parse Crime data
    if (crimeRes.status === 'fulfilled' && crimeRes.value.ok) {
      try {
        const data = await crimeRes.value.json();
        safetyScore = data.safetyScore || 50;
        safetyGrade = data.safetyGrade || 'C';
      } catch (e) {
        console.log('[BatchAnalyze] Crime parse error:', e);
      }
    }

    // Parse Building Permits
    if (permitsRes.status === 'fulfilled' && permitsRes.value.ok) {
      try {
        const data = await permitsRes.value.json();
        developmentMomentum = data.developmentMomentum || 50;
        developmentTrend = data.yoyChange?.trend || 'stable';
      } catch (e) {
        console.log('[BatchAnalyze] Permits parse error:', e);
      }
    }

    // Parse Vacancy data
    if (vacancyRes.status === 'fulfilled' && vacancyRes.value.ok) {
      try {
        const data = await vacancyRes.value.json();
        saturationScore = data.marketSaturationScore || 50;
        saturationLevel = data.saturationLevel || 'balanced';
      } catch (e) {
        console.log('[BatchAnalyze] Vacancy parse error:', e);
      }
    }

    // Parse Market Comps
    if (compsRes.status === 'fulfilled' && compsRes.value.ok) {
      try {
        const data = await compsRes.value.json();
        const comps = data.comps || [];
        marketCompCount = comps.length;
        // Use pre-calculated avgPricePerSqft from marketStats if available
        if (data.marketStats?.avgPricePerSqft) {
          avgPricePerSqft = data.marketStats.avgPricePerSqft;
        } else if (comps.length > 0) {
          avgPricePerSqft = comps.reduce((sum: number, c: { pricePerSqft: number }) => sum + (c.pricePerSqft || 0), 0) / comps.length;
        }
        console.log(`[BatchAnalyze] Market comps: ${marketCompCount} comps, $${avgPricePerSqft}/sqft`);
      } catch (e) {
        console.log('[BatchAnalyze] Market comps parse error:', e);
      }
    } else {
      console.log(`[BatchAnalyze] Market comps fetch failed: ${compsRes.status === 'rejected' ? compsRes.reason : 'not ok'}`);
    }

    return {
      walkScore,
      transitScore,
      retailViability,
      safetyScore,
      safetyGrade,
      developmentMomentum,
      developmentTrend,
      saturationScore,
      saturationLevel,
      marketCompCount,
      avgPricePerSqft,
    };
  } catch (error) {
    console.error('Error fetching enhanced data:', error);
    return null;
  }
}

// Calculate scores using the SAME logic as single parcel analysis (feasibilityScore.ts)
function calculateScores(
  trafficScore: number,  // Pre-calculated from access points
  accessScore: number,   // Pre-calculated from access points
  businessCount: number,
  hasAnchor: boolean,
  demographics: DemographicsData | null,
  enhanced: AreaEnhancedData | null,
  lotSizeSqFt: number | undefined,
  zoning: string | undefined
): {
  trafficScore: number;
  demographicsScore: number;
  economicScore: number;
  competitionScore: number;
  accessScore: number;
  siteScore: number;
  environmentalScore: number;
  marketScore: number;
  // Legacy/enhanced scores for UI
  walkabilityScore: number;
  safetyScore: number;
  developmentScore: number;
  saturationScore: number;
  zoningScore: number;
  lotSizeScore: number;
} {
  // TRAFFIC SCORE and ACCESS SCORE are now pre-calculated from access points
  // This ensures they match the single property analysis exactly

  // DEMOGRAPHICS SCORE (0-10) - Match single property logic exactly
  let demographicsScore = 5;
  if (demographics) {
    const { medianHouseholdIncome: income, employmentRate, population, isCollegeTown, collegeEnrollmentPercent } = demographics;

    let incomeScore = 5;
    if (isCollegeTown) {
      if ((collegeEnrollmentPercent || 0) >= 25) incomeScore = 8;
      else if ((collegeEnrollmentPercent || 0) >= 15) incomeScore = 7.5;
      else incomeScore = 7;
    } else {
      if (income >= 85000) incomeScore = 9;
      else if (income >= 65000) incomeScore = 8;
      else if (income >= 50000) incomeScore = 7;
      else if (income >= 35000) incomeScore = 5;
      else incomeScore = 4;
    }

    const employmentBonus = isCollegeTown ? 0.5 : (employmentRate >= 95 ? 1 : employmentRate >= 90 ? 0.5 : 0);
    const populationBonus = population >= 5000 ? 1 : population >= 2000 ? 0.5 : 0;

    demographicsScore = Math.min(10, Math.round((incomeScore + employmentBonus + populationBonus) * 10) / 10);
  }

  // ECONOMIC SCORE (0-10) - Estimate consumer spending from demographics
  // Single property uses actual consumer spending data, we estimate from income + population
  let economicScore = 5;
  if (demographics) {
    const { medianHouseholdIncome: income, population } = demographics;

    // Estimate consumer spending: higher income + higher population = more spending
    // This approximates what single property does with actual consumer spending data
    const estimatedSpending = income * population * 0.6; // Rough spending estimate

    if (estimatedSpending >= 800000000) economicScore = 10;
    else if (estimatedSpending >= 500000000) economicScore = 9;
    else if (estimatedSpending >= 300000000) economicScore = 8;
    else if (estimatedSpending >= 200000000) economicScore = 7;
    else if (estimatedSpending >= 100000000) economicScore = 6;
    else if (estimatedSpending >= 50000000) economicScore = 5;
    else if (estimatedSpending > 0) economicScore = 4;

    // High income bonus (matches single property logic)
    if (income >= 100000) economicScore = Math.min(10, economicScore + 1);
    else if (income >= 75000) economicScore = Math.min(10, economicScore + 0.5);
  }

  // COMPETITION SCORE (0-10) - Match single property logic
  let competitionScore = 5;
  if (businessCount >= 5 && businessCount <= 20) {
    competitionScore = 9;
  } else if (businessCount >= 3 && businessCount <= 30) {
    competitionScore = 7;
  } else if (businessCount > 30) {
    competitionScore = 5;
  } else if (businessCount < 3) {
    competitionScore = 4;
  }
  if (hasAnchor) {
    competitionScore = Math.min(10, competitionScore + 1);
  }

  // ENVIRONMENTAL SCORE (0-10) - Default to 5 to match single property analysis
  // Single property gets actual FEMA/EPA data, batch uses same default (5)
  const environmentalScore = 5;

  // MARKET SCORE (0-10) - Match single property logic
  let marketScore = 5;
  if (enhanced) {
    if (enhanced.marketCompCount >= 5) {
      marketScore = 8;
    } else if (enhanced.marketCompCount >= 3) {
      marketScore = 7;
    }
    if (enhanced.avgPricePerSqft >= 200) {
      marketScore = Math.min(10, marketScore + 2);
    } else if (enhanced.avgPricePerSqft >= 150) {
      marketScore = Math.min(10, marketScore + 1);
    }
  }

  // ZONING SCORE (0-10) - Match single property zoning logic
  let zoningScore = 5;
  if (zoning) {
    const z = zoning.toUpperCase();
    if (z.includes('C-') || z.includes('COM') || z.includes('COMMERCIAL') || z.includes('B-') || z.includes('CBD') || z.includes('CG')) {
      zoningScore = 10;
    } else if (z.includes('MU') || z.includes('MIXED') || z.includes('PUD') || z.includes('PD')) {
      zoningScore = 9;
    } else if (z.includes('O-') || z.includes('OFFICE')) {
      zoningScore = 7;
    } else if (z.includes('I-') || z.includes('IND')) {
      zoningScore = 6;
    } else if (z.includes('R-') || z.includes('RES')) {
      zoningScore = 3;
    } else if (z.includes('AG') || z.includes('AGRICULTURAL')) {
      zoningScore = 2;
    }
  }

  // LOT SIZE SCORE (0-10) - Match single property lot size logic
  let lotSizeScore = 5;
  if (lotSizeSqFt) {
    const acres = lotSizeSqFt / 43560;
    if (acres >= 2 && acres <= 10) {
      lotSizeScore = 9; // Ideal for most commercial
    } else if (acres >= 1 && acres < 2) {
      lotSizeScore = 8; // Good for smaller retail
    } else if (acres >= 0.5 && acres < 1) {
      lotSizeScore = 6; // Limited options
    } else if (acres > 10) {
      lotSizeScore = 8; // Large site - good for big box
    } else {
      lotSizeScore = 4; // Too small
    }
  }

  // SITE SCORE (0-10) - Combine lot size + zoning (matches single property site score)
  // Single property also includes daytime population, but we don't have that in batch
  const hasLot = !!lotSizeSqFt;
  const hasZoning = !!zoning;
  let siteScore = 5;
  if (hasLot && hasZoning) {
    siteScore = Math.round((lotSizeScore * 0.5 + zoningScore * 0.5) * 10) / 10;
  } else if (hasLot) {
    siteScore = lotSizeScore;
  } else if (hasZoning) {
    siteScore = zoningScore;
  }

  // WALKABILITY SCORE (0-10) - Enhanced data
  let walkabilityScore = 5;
  if (enhanced) {
    walkabilityScore = Math.round(enhanced.walkScore / 10);
    if (enhanced.retailViability === 'excellent') {
      walkabilityScore = Math.min(10, walkabilityScore + 1);
    }
    if (enhanced.transitScore && enhanced.transitScore >= 50) {
      walkabilityScore = Math.min(10, walkabilityScore + 1);
    }
  }

  // SAFETY SCORE (0-10) - Enhanced data
  let safetyScore = 5;
  if (enhanced) {
    safetyScore = Math.round(enhanced.safetyScore / 10);
  }

  // DEVELOPMENT SCORE (0-10) - Enhanced data
  let developmentScore = 5;
  if (enhanced) {
    developmentScore = Math.round(enhanced.developmentMomentum / 10);
    if (enhanced.developmentTrend === 'growing') {
      developmentScore = Math.min(10, developmentScore + 1);
    } else if (enhanced.developmentTrend === 'declining') {
      developmentScore = Math.max(0, developmentScore - 1);
    }
  }

  // SATURATION SCORE (0-10) - Lower saturation = higher score
  let saturationScore = 5;
  if (enhanced) {
    saturationScore = Math.round((100 - enhanced.saturationScore) / 10);
  }

  return {
    trafficScore,
    demographicsScore,
    economicScore,
    competitionScore,
    accessScore,
    siteScore,
    environmentalScore,
    marketScore,
    walkabilityScore,
    safetyScore,
    developmentScore,
    saturationScore,
    zoningScore,
    lotSizeScore,
  };
}

// Calculate overall score using EXACT same weights as single parcel analysis (feasibilityScore.ts)
function calculateOverallScore(scores: ReturnType<typeof calculateScores>): number {
  // These weights match exactly what's in feasibilityScore.ts
  const weights = {
    traffic: 0.20,
    demographics: 0.15,
    economic: 0.15,
    competition: 0.10,
    access: 0.10,
    site: 0.10,
    environmental: 0.10,
    market: 0.10,
  };

  const overall =
    scores.trafficScore * weights.traffic +
    scores.demographicsScore * weights.demographics +
    scores.economicScore * weights.economic +
    scores.competitionScore * weights.competition +
    scores.accessScore * weights.access +
    scores.siteScore * weights.site +
    scores.environmentalScore * weights.environmental +
    scores.marketScore * weights.market;

  return Math.round(overall * 10) / 10;
}

async function analyzeParcel(
  parcel: ParcelInput,
  areaDemographics: DemographicsData | null,
  areaEnhanced: AreaEnhancedData | null
): Promise<QuickFeasibility> {
  const cacheKey = getCacheKey(parcel.coordinates.lat, parcel.coordinates.lng);

  // Check cache first
  const cached = analysisCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return {
      ...cached.data,
      parcelId: parcel.parcelId,
      address: parcel.address,
      lotSize: parcel.lotSize,
      lotSizeAcres: parcel.lotSize ? parcel.lotSize / 43560 : undefined,
      zoning: parcel.zoning || cached.data.zoning,
    };
  }

  // Fetch parcel-specific data
  // Fetch traffic/access data and business data in parallel
  const [trafficData, businessData] = await Promise.all([
    fetchTrafficAndAccessScores(parcel.coordinates.lat, parcel.coordinates.lng),
    fetchNearbyBusinessData(parcel.coordinates.lat, parcel.coordinates.lng),
  ]);

  const { count: businessCount, hasBusinessAtLocation, businessName, hasAnchor } = businessData;

  // Extract traffic and access scores
  const { trafficScore, accessScore, vpd: primaryVpd } = trafficData;

  // Calculate all scores
  const scores = calculateScores(
    trafficScore,
    accessScore,
    businessCount,
    hasAnchor,
    areaDemographics,
    areaEnhanced,
    parcel.lotSize,
    parcel.zoning
  );

  const overallScore = calculateOverallScore(scores);

  // Determine occupancy status
  let occupancyStatus: 'occupied' | 'vacant' | 'unknown' = 'unknown';
  if (hasBusinessAtLocation) {
    occupancyStatus = 'occupied';
  } else if (parcel.propertyType?.toLowerCase().includes('vacant')) {
    occupancyStatus = 'vacant';
  } else if (parcel.buildingSqFt && parcel.buildingSqFt > 0) {
    occupancyStatus = 'unknown';
  } else if (!parcel.buildingSqFt || parcel.buildingSqFt === 0) {
    occupancyStatus = 'vacant';
  }

  const result: QuickFeasibility = {
    parcelId: parcel.parcelId,
    address: parcel.address,
    coordinates: parcel.coordinates,
    lotSize: parcel.lotSize,
    lotSizeAcres: parcel.lotSize ? parcel.lotSize / 43560 : undefined,
    score: overallScore,
    factors: {
      // Core 8 factors (same as single property analysis)
      trafficScore: scores.trafficScore,
      demographicsScore: scores.demographicsScore,
      economicScore: scores.economicScore,
      competitionScore: scores.competitionScore,
      accessScore: scores.accessScore,
      siteScore: scores.siteScore,
      environmentalScore: scores.environmentalScore,
      marketScore: scores.marketScore,
      // Enhanced scores
      walkabilityScore: scores.walkabilityScore,
      safetyScore: scores.safetyScore,
      developmentScore: scores.developmentScore,
      saturationScore: scores.saturationScore,
      // Legacy compatibility
      businessDensity: scores.competitionScore,
      zoningScore: scores.zoningScore,
      lotSizeScore: scores.lotSizeScore,
    },
    zoning: parcel.zoning,
    nearbyBusinesses: businessCount,
    estimatedVPD: primaryVpd,
    medianIncome: areaDemographics?.medianHouseholdIncome,
    population: areaDemographics?.population,
    // Property context
    landUse: parcel.landUse,
    landUseCode: parcel.landUseCode,
    owner: parcel.owner,
    yearBuilt: parcel.yearBuilt,
    buildingSqFt: parcel.buildingSqFt,
    propertyType: parcel.propertyType || (hasBusinessAtLocation && businessName ? businessName : undefined),
    occupancyStatus,
  };

  // Cache the result
  analysisCache.set(cacheKey, {
    data: result,
    timestamp: Date.now(),
  });

  return result;
}

async function processParcelsWithConcurrency(
  parcels: ParcelInput[],
  concurrencyLimit: number,
  areaDemographics: DemographicsData | null,
  areaEnhanced: AreaEnhancedData | null
): Promise<QuickFeasibility[]> {
  const results: QuickFeasibility[] = [];

  for (let i = 0; i < parcels.length; i += concurrencyLimit) {
    const batch = parcels.slice(i, i + concurrencyLimit);

    const batchResults = await Promise.allSettled(
      batch.map(parcel => analyzeParcel(parcel, areaDemographics, areaEnhanced))
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.error('Failed to analyze parcel:', result.reason);
      }
    }

    if (i + concurrencyLimit < parcels.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }

  return results;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: BatchAnalyzeRequest = await request.json();
    const { parcels, minScore = 0, searchCenter } = body;

    if (!parcels || !Array.isArray(parcels)) {
      return NextResponse.json({ error: 'Invalid parcels data' }, { status: 400 });
    }

    if (Math.random() < 0.1) {
      cleanCache();
    }

    const demographicsCenter = searchCenter || parcels[0]?.coordinates;

    // Fetch area-level data once for all parcels
    let areaDemographics: DemographicsData | null = null;
    let areaEnhanced: AreaEnhancedData | null = null;

    if (demographicsCenter) {
      // Fetch demographics and enhanced data in parallel
      const [demographics, enhanced] = await Promise.all([
        fetchAreaDemographics(demographicsCenter.lat, demographicsCenter.lng),
        fetchAreaEnhancedData(demographicsCenter.lat, demographicsCenter.lng),
      ]);

      areaDemographics = demographics;
      areaEnhanced = enhanced;

      console.log(`[BatchAnalyze] Area data: Income $${areaDemographics?.medianHouseholdIncome?.toLocaleString() || 'N/A'}, Walk Score ${areaEnhanced?.walkScore || 'N/A'}, Safety ${areaEnhanced?.safetyGrade || 'N/A'}, Market: ${areaEnhanced?.marketCompCount || 0} comps @ $${areaEnhanced?.avgPricePerSqft || 0}/sqft`);
    }

    // Analyze all parcels with full scoring
    const allResults = await processParcelsWithConcurrency(parcels, BATCH_SIZE, areaDemographics, areaEnhanced);

    // Filter by minimum score
    const filteredResults = allResults.filter(r => r.score >= minScore);

    // Sort by score descending
    filteredResults.sort((a, b) => b.score - a.score);

    const searchTime = Date.now() - startTime;

    return NextResponse.json({
      results: filteredResults,
      totalAnalyzed: parcels.length,
      matchingCount: filteredResults.length,
      searchTime,
      cacheSize: analysisCache.size,
      hasEnhancedData: areaEnhanced !== null,
      areaData: {
        demographics: areaDemographics ? {
          medianIncome: areaDemographics.medianHouseholdIncome,
          population: areaDemographics.population,
          isCollegeTown: areaDemographics.isCollegeTown,
        } : null,
        enhanced: areaEnhanced ? {
          walkScore: areaEnhanced.walkScore,
          safetyGrade: areaEnhanced.safetyGrade,
          saturationLevel: areaEnhanced.saturationLevel,
          developmentTrend: areaEnhanced.developmentTrend,
        } : null,
      },
    });
  } catch (error) {
    console.error('Error in batch analysis:', error);
    return NextResponse.json({ error: 'Failed to analyze parcels' }, { status: 500 });
  }
}
