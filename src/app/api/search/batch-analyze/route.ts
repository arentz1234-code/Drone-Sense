import { NextRequest, NextResponse } from 'next/server';

interface ParcelInput {
  parcelId: string;
  address: string;
  coordinates: { lat: number; lng: number };
  lotSize?: number;
  zoning?: string;
}

interface QuickFeasibility {
  parcelId: string;
  address: string;
  coordinates: { lat: number; lng: number };
  lotSize?: number;
  lotSizeAcres?: number;
  score: number;
  factors: {
    trafficScore: number;
    businessDensity: number;
    zoningScore: number;
    accessScore: number;
    demographicsScore: number;
    lotSizeScore: number;
    environmentalScore: number;
  };
  zoning?: string;
  nearbyBusinesses?: number;
  estimatedVPD?: number;
  medianIncome?: number;
  population?: number;
}

interface BatchAnalyzeRequest {
  parcels: ParcelInput[];
  minScore?: number;
  fastMode?: boolean; // Skip real API calls, use estimates only
  searchCenter?: { lat: number; lng: number }; // Center of search area for demographics
}

interface DemographicsData {
  population: number;
  medianHouseholdIncome: number;
  employmentRate: number;
  isCollegeTown?: boolean;
  collegeEnrollmentPercent?: number;
}

interface CacheEntry {
  data: QuickFeasibility;
  timestamp: number;
}

// In-memory cache with TTL
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const analysisCache = new Map<string, CacheEntry>();

const BATCH_SIZE = 15; // Concurrent API calls
const BATCH_DELAY = 25; // ms between batches

// Generate cache key from coordinates
function getCacheKey(lat: number, lng: number): string {
  // Round to 5 decimal places (~1 meter precision) for cache key
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

// Clean expired cache entries
function cleanCache(): void {
  const now = Date.now();
  for (const [key, entry] of analysisCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      analysisCache.delete(key);
    }
  }
}

// Fetch real FDOT AADT data for VPD
async function fetchFDOTVPD(lat: number, lng: number): Promise<{ vpd: number; roadType: string }> {
  try {
    // Use FDOT ArcGIS REST API to get AADT data
    // Use smaller radius (~100 meters) to get the nearest road, not distant highways
    const radius = 0.001;
    const mapExtent = `${lng - radius},${lat - radius},${lng + radius},${lat + radius}`;
    const url = `https://gis.fdot.gov/arcgis/rest/services/FTO/fto_PROD/MapServer/identify?` +
      `geometry=${lng},${lat}&geometryType=esriGeometryPoint&sr=4326&` +
      `layers=all:7&tolerance=25&mapExtent=${mapExtent}&imageDisplay=400,400,96&` +
      `returnGeometry=false&f=json`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      return getEstimatedVPD(lat, lng);
    }

    const data = await response.json();
    if (!data.results || data.results.length === 0) {
      return getEstimatedVPD(lat, lng);
    }

    // Find the most recent AADT data (prioritize recency over highest value)
    // This gets the actual road data, not necessarily the busiest nearby road
    let bestVPD = 0;
    let bestYear = 0;
    let roadType = 'Local Road';

    for (const result of data.results) {
      const attrs = result.attributes;
      if (attrs && attrs.AADT && Number(attrs.AADT) > 0) {
        const aadt = Number(attrs.AADT);
        const year = Number(attrs.YEAR_) || 2024;

        // Prioritize most recent year, then take first result (closest)
        if (year > bestYear || (year === bestYear && bestVPD === 0)) {
          bestVPD = aadt;
          bestYear = year;

          // Determine road type from functional class or AADT
          if (aadt >= 25000) roadType = 'Major Arterial';
          else if (aadt >= 15000) roadType = 'Primary Arterial';
          else if (aadt >= 8000) roadType = 'Secondary Arterial';
          else if (aadt >= 3000) roadType = 'Collector Road';
          else roadType = 'Local Road';
        }
      }
    }

    if (bestVPD > 0) {
      return { vpd: bestVPD, roadType };
    }

    return getEstimatedVPD(lat, lng);
  } catch (error) {
    console.error('Error fetching FDOT data:', error);
    return getEstimatedVPD(lat, lng);
  }
}

// Fallback: estimate VPD from road type using Overpass
async function getEstimatedVPD(lat: number, lng: number): Promise<{ vpd: number; roadType: string }> {
  try {
    const radius = 100; // meters
    const query = `
      [out:json][timeout:10];
      way(around:${radius},${lat},${lng})["highway"];
      out tags;
    `;

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    if (!response.ok) {
      return { vpd: 10000, roadType: 'Unknown' };
    }

    const data = await response.json();
    const roads = data.elements || [];

    // Estimate VPD based on road type
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

    // Return consistent estimate based on road type (no random variance)
    return { vpd: maxVpd, roadType: bestRoadType };
  } catch (error) {
    console.error('Error getting VPD estimate:', error);
    return { vpd: 10000, roadType: 'Unknown' };
  }
}

// Fetch nearby business count from Overpass API
async function fetchNearbyBusinessCount(lat: number, lng: number): Promise<number> {
  try {
    const radius = 500; // meters
    const query = `
      [out:json][timeout:10];
      (
        node["shop"](around:${radius},${lat},${lng});
        node["amenity"~"restaurant|fast_food|cafe|bank|pharmacy|fuel|hospital|clinic"](around:${radius},${lat},${lng});
        node["office"](around:${radius},${lat},${lng});
        way["shop"](around:${radius},${lat},${lng});
        way["amenity"~"restaurant|fast_food|cafe|bank|pharmacy|fuel|hospital|clinic"](around:${radius},${lat},${lng});
        way["office"](around:${radius},${lat},${lng});
      );
      out count;
    `;

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    if (!response.ok) {
      // Return consistent estimate on API failure
      return 10;
    }

    const data = await response.json();
    const count = data.elements?.[0]?.tags?.total;

    if (count !== undefined && count !== null) {
      return parseInt(count, 10);
    }

    // Fallback: count elements if count query didn't work
    return data.elements?.length || 10;
  } catch (error) {
    console.error('Error getting business count:', error);
    return 10;
  }
}

function calculateZoningScore(zoning?: string): number {
  if (!zoning) return 5;

  const zoningScores: Record<string, number> = {
    // Commercial zonings (highest scores)
    'CBD': 10, 'C-2': 9, 'CG': 9, 'CR': 8, 'C-1': 8,
    'commercial': 8, 'retail': 8,
    // Mixed/Planned (good scores)
    'PD': 7, 'MU': 8, 'mixed': 7,
    // Industrial (moderate)
    'I-1': 6, 'I-2': 5, 'industrial': 6,
    // Vacant/Agricultural (lower scores)
    'VL': 4, 'AG': 3, 'residential': 2,
  };

  const upperZoning = zoning.toUpperCase();
  for (const [key, score] of Object.entries(zoningScores)) {
    if (upperZoning.includes(key.toUpperCase())) {
      return score;
    }
  }

  return 5;
}

function calculateAccessScore(roadType: string): number {
  const accessScores: Record<string, number> = {
    'Highway/Interstate': 9,
    'Major Highway': 9,
    'Major Arterial': 9,
    'Primary Arterial': 8,
    'Secondary Arterial': 7,
    'Collector Road': 6,
    'Residential Street': 4,
    'Local Road': 5,
    'Unknown': 5,
  };

  return accessScores[roadType] || 5;
}

// Fetch demographics for search area (called once per search)
async function fetchAreaDemographics(lat: number, lng: number): Promise<DemographicsData | null> {
  try {
    // Use FCC API to get census tract
    const fccUrl = `https://geo.fcc.gov/api/census/area?lat=${lat}&lon=${lng}&format=json`;
    const fccResponse = await fetch(fccUrl);

    if (!fccResponse.ok) return null;

    const fccData = await fccResponse.json();
    const fips = fccData.results?.[0]?.block_fips;

    if (!fips) return null;

    // Extract state and county FIPS
    const stateFips = fips.substring(0, 2);
    const countyFips = fips.substring(2, 5);
    const tractFips = fips.substring(5, 11);

    // Fetch ACS 5-year data
    const censusUrl = `https://api.census.gov/data/2022/acs/acs5?get=B01003_001E,B19013_001E,B23025_002E,B23025_005E,B14001_002E,B01001_001E&for=tract:${tractFips}&in=state:${stateFips}&in=county:${countyFips}`;

    const censusResponse = await fetch(censusUrl);
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

// Calculate demographics score (matching main analysis logic)
function calculateDemographicsScore(demographics: DemographicsData | null): { score: number; detail: string } {
  if (!demographics) {
    return { score: 5, detail: 'Demographics data unavailable' };
  }

  const { medianHouseholdIncome: income, employmentRate, population, isCollegeTown, collegeEnrollmentPercent } = demographics;

  let incomeScore = 5;
  if (isCollegeTown) {
    // College towns have hidden spending power
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

  const score = Math.min(10, Math.round(incomeScore + employmentBonus + populationBonus));

  const detail = isCollegeTown
    ? `College Town (${collegeEnrollmentPercent}% students) - $${income.toLocaleString()} income`
    : `$${income.toLocaleString()} median income, ${population.toLocaleString()} pop`;

  return { score, detail };
}

// Calculate lot size score
function calculateLotSizeScore(lotSizeSqFt: number | undefined): { score: number; detail: string } {
  if (!lotSizeSqFt) {
    return { score: 5, detail: 'Lot size unknown' };
  }

  const acres = lotSizeSqFt / 43560;

  // Commercial sweet spot is 0.5 to 5 acres
  if (acres >= 1 && acres <= 3) {
    return { score: 10, detail: `Ideal size: ${acres.toFixed(2)} acres` };
  } else if (acres >= 0.5 && acres <= 5) {
    return { score: 9, detail: `Great size: ${acres.toFixed(2)} acres` };
  } else if (acres >= 0.25 && acres <= 10) {
    return { score: 7, detail: `Workable size: ${acres.toFixed(2)} acres` };
  } else if (acres < 0.25) {
    return { score: 4, detail: `Small lot: ${acres.toFixed(2)} acres - limited options` };
  } else {
    return { score: 6, detail: `Large lot: ${acres.toFixed(2)} acres - may need subdivision` };
  }
}

// Simple flood zone check based on elevation (rough estimate)
async function checkFloodRisk(lat: number, lng: number): Promise<{ score: number; inFloodZone: boolean }> {
  try {
    // Use Open-Elevation API for quick check
    const response = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`);
    if (!response.ok) return { score: 7, inFloodZone: false };

    const data = await response.json();
    const elevation = data.results?.[0]?.elevation;

    if (elevation === undefined) return { score: 7, inFloodZone: false };

    // Very rough heuristic: low elevation in Florida = higher flood risk
    if (elevation < 5) {
      return { score: 4, inFloodZone: true };
    } else if (elevation < 15) {
      return { score: 6, inFloodZone: false };
    } else {
      return { score: 8, inFloodZone: false };
    }
  } catch {
    return { score: 7, inFloodZone: false };
  }
}

function calculateTrafficScore(vpd: number): number {
  if (vpd >= 30000) return 10;
  if (vpd >= 20000) return 9;
  if (vpd >= 15000) return 8;
  if (vpd >= 10000) return 7;
  if (vpd >= 5000) return 5;
  return 3;
}

function calculateBusinessDensityScore(businessCount: number): number {
  if (businessCount >= 25) return 10;
  if (businessCount >= 20) return 9;
  if (businessCount >= 15) return 8;
  if (businessCount >= 10) return 7;
  if (businessCount >= 5) return 6;
  return 4;
}

function calculateOverallScore(
  trafficScore: number,
  businessDensityScore: number,
  zoningScore: number,
  accessScore: number,
  demographicsScore: number = 5,
  lotSizeScore: number = 5,
  environmentalScore: number = 7
): number {
  // Weighted average matching the main analysis
  // Traffic + Demographics are most important for commercial viability
  const weights = {
    traffic: 0.25,
    demographics: 0.20,
    business: 0.15,
    zoning: 0.15,
    access: 0.10,
    lotSize: 0.10,
    environmental: 0.05,
  };

  const overallScore =
    trafficScore * weights.traffic +
    demographicsScore * weights.demographics +
    businessDensityScore * weights.business +
    zoningScore * weights.zoning +
    accessScore * weights.access +
    lotSizeScore * weights.lotSize +
    environmentalScore * weights.environmental;

  return Math.round(overallScore * 10) / 10;
}

async function analyzeParcel(
  parcel: ParcelInput,
  areaDemographics: DemographicsData | null
): Promise<QuickFeasibility> {
  const cacheKey = getCacheKey(parcel.coordinates.lat, parcel.coordinates.lng);

  // Check cache first
  const cached = analysisCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    // Return cached data with updated parcel info
    return {
      ...cached.data,
      parcelId: parcel.parcelId,
      address: parcel.address,
      lotSize: parcel.lotSize,
      lotSizeAcres: parcel.lotSize ? parcel.lotSize / 43560 : undefined,
      zoning: parcel.zoning || cached.data.zoning,
    };
  }

  // Fetch real data in parallel
  const [traffic, businessCount] = await Promise.all([
    fetchFDOTVPD(parcel.coordinates.lat, parcel.coordinates.lng),
    fetchNearbyBusinessCount(parcel.coordinates.lat, parcel.coordinates.lng),
  ]);

  // Calculate all scores
  const zoningScore = calculateZoningScore(parcel.zoning);
  const accessScore = calculateAccessScore(traffic.roadType);
  const trafficScore = calculateTrafficScore(traffic.vpd);
  const businessDensityScore = calculateBusinessDensityScore(businessCount);
  const demographicsResult = calculateDemographicsScore(areaDemographics);
  const lotSizeResult = calculateLotSizeScore(parcel.lotSize);

  // Use default environmental score (fetching per-parcel would be too slow)
  const environmentalScore = 7;

  const score = calculateOverallScore(
    trafficScore,
    businessDensityScore,
    zoningScore,
    accessScore,
    demographicsResult.score,
    lotSizeResult.score,
    environmentalScore
  );

  const result: QuickFeasibility = {
    parcelId: parcel.parcelId,
    address: parcel.address,
    coordinates: parcel.coordinates,
    lotSize: parcel.lotSize,
    lotSizeAcres: parcel.lotSize ? parcel.lotSize / 43560 : undefined,
    score,
    factors: {
      trafficScore,
      businessDensity: businessDensityScore,
      zoningScore,
      accessScore,
      demographicsScore: demographicsResult.score,
      lotSizeScore: lotSizeResult.score,
      environmentalScore,
    },
    zoning: parcel.zoning,
    nearbyBusinesses: businessCount,
    estimatedVPD: traffic.vpd,
    medianIncome: areaDemographics?.medianHouseholdIncome,
    population: areaDemographics?.population,
  };

  // Cache the result
  analysisCache.set(cacheKey, {
    data: result,
    timestamp: Date.now(),
  });

  return result;
}

// Process parcels with concurrency limit
async function processParcelsWithConcurrency(
  parcels: ParcelInput[],
  concurrencyLimit: number,
  areaDemographics: DemographicsData | null
): Promise<QuickFeasibility[]> {
  const results: QuickFeasibility[] = [];

  // Process in batches
  for (let i = 0; i < parcels.length; i += concurrencyLimit) {
    const batch = parcels.slice(i, i + concurrencyLimit);

    // Process batch in parallel
    const batchResults = await Promise.allSettled(
      batch.map(parcel => analyzeParcel(parcel, areaDemographics))
    );

    // Collect successful results
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.error('Failed to analyze parcel:', result.reason);
      }
    }

    // Rate limiting delay between batches (skip for last batch)
    if (i + concurrencyLimit < parcels.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }

  return results;
}

// Fast analysis using only estimates (no API calls)
function analyzeParcelFast(parcel: ParcelInput, areaDemographics: DemographicsData | null): QuickFeasibility {
  const zoningScore = calculateZoningScore(parcel.zoning);

  // Use consistent estimate based on zoning (no random values)
  // Commercial areas typically have higher traffic
  const vpdByZoning: Record<string, number> = {
    'CBD': 25000, 'C-2': 20000, 'CG': 18000, 'CR': 15000, 'C-1': 12000,
    'commercial': 15000, 'retail': 15000, 'PD': 12000, 'MU': 12000,
    'mixed': 10000, 'I-1': 8000, 'I-2': 8000, 'industrial': 8000,
    'VL': 5000, 'AG': 3000, 'residential': 5000,
  };

  let vpd = 10000; // default
  if (parcel.zoning) {
    const upperZoning = parcel.zoning.toUpperCase();
    for (const [key, vpdValue] of Object.entries(vpdByZoning)) {
      if (upperZoning.includes(key.toUpperCase())) {
        vpd = vpdValue;
        break;
      }
    }
  }

  // Estimate business count based on zoning
  const businessCount = zoningScore >= 7 ? 15 : zoningScore >= 5 ? 10 : 5;

  const trafficScore = calculateTrafficScore(vpd);
  const businessDensityScore = calculateBusinessDensityScore(businessCount);
  const accessScore = 6; // Default moderate access
  const demographicsResult = calculateDemographicsScore(areaDemographics);
  const lotSizeResult = calculateLotSizeScore(parcel.lotSize);
  const environmentalScore = 7;

  const score = calculateOverallScore(
    trafficScore,
    businessDensityScore,
    zoningScore,
    accessScore,
    demographicsResult.score,
    lotSizeResult.score,
    environmentalScore
  );

  return {
    parcelId: parcel.parcelId,
    address: parcel.address,
    coordinates: parcel.coordinates,
    lotSize: parcel.lotSize,
    lotSizeAcres: parcel.lotSize ? parcel.lotSize / 43560 : undefined,
    score,
    factors: {
      trafficScore,
      businessDensity: businessDensityScore,
      zoningScore,
      accessScore,
      demographicsScore: demographicsResult.score,
      lotSizeScore: lotSizeResult.score,
      environmentalScore,
    },
    zoning: parcel.zoning,
    nearbyBusinesses: businessCount,
    estimatedVPD: vpd,
    medianIncome: areaDemographics?.medianHouseholdIncome,
    population: areaDemographics?.population,
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: BatchAnalyzeRequest = await request.json();
    const { parcels, minScore = 0, fastMode = false, searchCenter } = body;

    if (!parcels || !Array.isArray(parcels)) {
      return NextResponse.json({ error: 'Invalid parcels data' }, { status: 400 });
    }

    // Clean expired cache entries periodically
    if (Math.random() < 0.1) {
      cleanCache();
    }

    // Fetch demographics for search area (once for all parcels)
    // Use search center if provided, otherwise use center of first parcel
    const demographicsCenter = searchCenter || parcels[0]?.coordinates;
    let areaDemographics: DemographicsData | null = null;

    if (demographicsCenter) {
      try {
        areaDemographics = await fetchAreaDemographics(demographicsCenter.lat, demographicsCenter.lng);
        console.log(`[BatchAnalyze] Demographics fetched: $${areaDemographics?.medianHouseholdIncome?.toLocaleString() || 'N/A'} income, ${areaDemographics?.population?.toLocaleString() || 'N/A'} pop`);
      } catch (e) {
        console.error('Failed to fetch demographics:', e);
      }
    }

    let allResults: QuickFeasibility[];

    if (fastMode) {
      // Only use fast mode if explicitly requested
      allResults = parcels.map(p => analyzeParcelFast(p, areaDemographics));
    } else {
      // Always use real FDOT/Overpass API calls for accurate data
      allResults = await processParcelsWithConcurrency(parcels, BATCH_SIZE, areaDemographics);
    }

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
      usedFastMode: fastMode,
      demographics: areaDemographics ? {
        medianIncome: areaDemographics.medianHouseholdIncome,
        population: areaDemographics.population,
        isCollegeTown: areaDemographics.isCollegeTown,
      } : null,
    });
  } catch (error) {
    console.error('Error in batch analysis:', error);
    return NextResponse.json({ error: 'Failed to analyze parcels' }, { status: 500 });
  }
}
