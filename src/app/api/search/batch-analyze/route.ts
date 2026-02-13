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
  };
  zoning?: string;
  nearbyBusinesses?: number;
  estimatedVPD?: number;
}

interface BatchAnalyzeRequest {
  parcels: ParcelInput[];
  minScore?: number;
  fastMode?: boolean; // Skip real API calls, use estimates only
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
  accessScore: number
): number {
  // Weighted average
  const weights = {
    traffic: 0.35,
    business: 0.25,
    zoning: 0.25,
    access: 0.15,
  };

  const overallScore =
    trafficScore * weights.traffic +
    businessDensityScore * weights.business +
    zoningScore * weights.zoning +
    accessScore * weights.access;

  return Math.round(overallScore * 10) / 10;
}

async function analyzeParcel(parcel: ParcelInput): Promise<QuickFeasibility> {
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

  // Calculate scores
  const zoningScore = calculateZoningScore(parcel.zoning);
  const accessScore = calculateAccessScore(traffic.roadType);
  const trafficScore = calculateTrafficScore(traffic.vpd);
  const businessDensityScore = calculateBusinessDensityScore(businessCount);

  const score = calculateOverallScore(
    trafficScore,
    businessDensityScore,
    zoningScore,
    accessScore
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
    },
    zoning: parcel.zoning,
    nearbyBusinesses: businessCount,
    estimatedVPD: traffic.vpd,
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
  concurrencyLimit: number
): Promise<QuickFeasibility[]> {
  const results: QuickFeasibility[] = [];

  // Process in batches
  for (let i = 0; i < parcels.length; i += concurrencyLimit) {
    const batch = parcels.slice(i, i + concurrencyLimit);

    // Process batch in parallel
    const batchResults = await Promise.allSettled(
      batch.map(parcel => analyzeParcel(parcel))
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
function analyzeParcelFast(parcel: ParcelInput): QuickFeasibility {
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

  const score = calculateOverallScore(trafficScore, businessDensityScore, zoningScore, accessScore);

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
    },
    zoning: parcel.zoning,
    nearbyBusinesses: businessCount,
    estimatedVPD: vpd,
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: BatchAnalyzeRequest = await request.json();
    const { parcels, minScore = 0, fastMode = false } = body;

    if (!parcels || !Array.isArray(parcels)) {
      return NextResponse.json({ error: 'Invalid parcels data' }, { status: 400 });
    }

    // Clean expired cache entries periodically
    if (Math.random() < 0.1) {
      cleanCache();
    }

    let allResults: QuickFeasibility[];

    if (fastMode) {
      // Only use fast mode if explicitly requested
      allResults = parcels.map(p => analyzeParcelFast(p));
    } else {
      // Always use real FDOT/Overpass API calls for accurate data
      allResults = await processParcelsWithConcurrency(parcels, BATCH_SIZE);
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
    });
  } catch (error) {
    console.error('Error in batch analysis:', error);
    return NextResponse.json({ error: 'Failed to analyze parcels' }, { status: 500 });
  }
}
