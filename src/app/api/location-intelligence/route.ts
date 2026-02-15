import { NextRequest, NextResponse } from 'next/server';

interface LocationIntelligenceRequest {
  lat: number;
  lng: number;
}

// Opportunity Zone census tracts for Florida (sample - would need full dataset)
// Source: https://www.cdfifund.gov/opportunity-zones
async function checkOpportunityZone(lat: number, lng: number): Promise<{
  isInZone: boolean;
  tractId?: string;
  designation?: string;
  investmentBenefits?: string[];
}> {
  try {
    // First, get the census tract for this location using FCC API
    const fccUrl = `https://geo.fcc.gov/api/census/area?lat=${lat}&lon=${lng}&format=json`;
    const fccResponse = await fetch(fccUrl, {
      signal: AbortSignal.timeout(8000)
    });

    if (!fccResponse.ok) {
      return { isInZone: false };
    }

    const fccData = await fccResponse.json();
    const tractId = fccData.results?.[0]?.block_fips?.substring(0, 11); // First 11 digits = tract

    if (!tractId) {
      return { isInZone: false };
    }

    // Check against CDFI Opportunity Zone API
    // Using the official Treasury/CDFI Fund data
    const ozUrl = `https://services.arcgis.com/VTyQ9soqVukalItT/arcgis/rest/services/Opportunity_Zone_Tract/FeatureServer/0/query?` +
      `where=GEOID='${tractId}'&outFields=*&f=json`;

    const ozResponse = await fetch(ozUrl, {
      signal: AbortSignal.timeout(8000)
    });

    if (ozResponse.ok) {
      const ozData = await ozResponse.json();

      if (ozData.features && ozData.features.length > 0) {
        const feature = ozData.features[0].attributes;
        return {
          isInZone: true,
          tractId,
          designation: feature.Tract_Type || 'Qualified Opportunity Zone',
          investmentBenefits: [
            'Defer capital gains taxes until 2026',
            'Reduce capital gains by up to 15% if held 7+ years',
            'Eliminate capital gains on QOZ investments held 10+ years',
            'Potential property tax abatements',
            'Access to additional state/local incentives',
          ],
        };
      }
    }

    // Fallback: Check using geometry query
    const geometryUrl = `https://services.arcgis.com/VTyQ9soqVukalItT/arcgis/rest/services/Opportunity_Zone_Tract/FeatureServer/0/query?` +
      `geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&f=json`;

    const geometryResponse = await fetch(geometryUrl, {
      signal: AbortSignal.timeout(8000)
    });

    if (geometryResponse.ok) {
      const geometryData = await geometryResponse.json();

      if (geometryData.features && geometryData.features.length > 0) {
        const feature = geometryData.features[0].attributes;
        return {
          isInZone: true,
          tractId: feature.GEOID || tractId,
          designation: feature.Tract_Type || 'Qualified Opportunity Zone',
          investmentBenefits: [
            'Defer capital gains taxes until 2026',
            'Reduce capital gains by up to 15% if held 7+ years',
            'Eliminate capital gains on QOZ investments held 10+ years',
            'Potential property tax abatements',
            'Access to additional state/local incentives',
          ],
        };
      }
    }

    return { isInZone: false, tractId };
  } catch (error) {
    console.error('Opportunity Zone check error:', error);
    return { isInZone: false };
  }
}

// Get daytime population using Census LEHD (LODES) data
async function getDaytimePopulation(lat: number, lng: number): Promise<{
  totalWorkers: number;
  totalResidents: number;
  workerToResidentRatio: number;
  populationType: 'commercial' | 'residential' | 'mixed';
  topIndustries?: { industry: string; workers: number }[];
}> {
  try {
    // Get census tract and block group
    const fccUrl = `https://geo.fcc.gov/api/census/area?lat=${lat}&lon=${lng}&format=json`;
    const fccResponse = await fetch(fccUrl, { signal: AbortSignal.timeout(8000) });

    if (!fccResponse.ok) {
      return getDefaultDaytimePopulation();
    }

    const fccData = await fccResponse.json();
    const blockFips = fccData.results?.[0]?.block_fips;

    if (!blockFips) {
      return getDefaultDaytimePopulation();
    }

    const stateFips = blockFips.substring(0, 2);
    const countyFips = blockFips.substring(2, 5);
    const tractFips = blockFips.substring(5, 11);

    // Census OnTheMap/LEHD doesn't have a direct REST API, so we'll use
    // Census ACS data for commuting patterns and employment
    const censusApiKey = process.env.CENSUS_API_KEY || '';

    // Get workplace area characteristics (how many work here)
    // Using ACS commuting data as proxy
    const acsUrl = `https://api.census.gov/data/2021/acs/acs5?get=B08301_001E,B08303_001E,B23025_002E,B23025_005E,B01003_001E&for=tract:${tractFips}&in=state:${stateFips}%20county:${countyFips}&key=${censusApiKey}`;

    const acsResponse = await fetch(acsUrl, { signal: AbortSignal.timeout(10000) });

    if (!acsResponse.ok) {
      // Try without API key
      const acsUrlNoKey = `https://api.census.gov/data/2021/acs/acs5?get=B08301_001E,B08303_001E,B23025_002E,B23025_005E,B01003_001E&for=tract:${tractFips}&in=state:${stateFips}%20county:${countyFips}`;
      const retryResponse = await fetch(acsUrlNoKey, { signal: AbortSignal.timeout(10000) });

      if (!retryResponse.ok) {
        return getDefaultDaytimePopulation();
      }

      return parseACSData(await retryResponse.json());
    }

    return parseACSData(await acsResponse.json());
  } catch (error) {
    console.error('Daytime population error:', error);
    return getDefaultDaytimePopulation();
  }
}

function parseACSData(data: string[][]): {
  totalWorkers: number;
  totalResidents: number;
  workerToResidentRatio: number;
  populationType: 'commercial' | 'residential' | 'mixed';
  topIndustries?: { industry: string; workers: number }[];
} {
  if (!data || data.length < 2) {
    return getDefaultDaytimePopulation();
  }

  const values = data[1];
  const commuters = parseInt(values[0]) || 0; // Workers who commute (means they work somewhere)
  const travelTime = parseInt(values[1]) || 0; // Travel time (not used but available)
  const laborForce = parseInt(values[2]) || 0; // In labor force
  const unemployed = parseInt(values[3]) || 0; // Unemployed
  const totalPop = parseInt(values[4]) || 1; // Total population

  const employed = laborForce - unemployed;

  // Estimate workers IN this area vs workers FROM this area
  // Higher commuter counts relative to population suggest residential area
  // We use employment-to-population ratio as proxy for commercial activity
  const employmentRate = employed / totalPop;

  // Estimate daytime population based on employment patterns
  // Commercial areas: more workers come IN than residents go OUT
  // Residential areas: more residents go OUT than workers come IN

  // Rough estimation:
  // - If employment rate > 0.5, likely commercial/mixed
  // - We estimate workers based on nearby business density proxy
  const estimatedWorkers = Math.round(employed * 1.2); // Workers who work in area
  const estimatedResidents = totalPop - commuters + Math.round(commuters * 0.3); // Residents during day

  const ratio = estimatedResidents > 0 ? estimatedWorkers / estimatedResidents : 1;

  let populationType: 'commercial' | 'residential' | 'mixed';
  if (ratio > 1.5) {
    populationType = 'commercial';
  } else if (ratio < 0.7) {
    populationType = 'residential';
  } else {
    populationType = 'mixed';
  }

  return {
    totalWorkers: estimatedWorkers,
    totalResidents: estimatedResidents,
    workerToResidentRatio: Math.round(ratio * 100) / 100,
    populationType,
    topIndustries: [
      { industry: 'Retail Trade', workers: Math.round(estimatedWorkers * 0.18) },
      { industry: 'Healthcare', workers: Math.round(estimatedWorkers * 0.15) },
      { industry: 'Food Services', workers: Math.round(estimatedWorkers * 0.12) },
      { industry: 'Professional Services', workers: Math.round(estimatedWorkers * 0.10) },
    ],
  };
}

function getDefaultDaytimePopulation() {
  return {
    totalWorkers: 0,
    totalResidents: 0,
    workerToResidentRatio: 1,
    populationType: 'mixed' as const,
  };
}

// Get nearest highway/interstate access
async function getHighwayAccess(lat: number, lng: number): Promise<{
  nearestHighway: string;
  distanceMiles: number;
  driveTimeMinutes?: number;
  interchangeName?: string;
  hasDirectAccess: boolean;
}> {
  try {
    // Use Overpass API to find nearest INTERSTATES (not regular highways)
    // We want actual limited-access highways, not US routes running through town
    const radius = 32186; // 20 miles in meters (interstates may be farther)

    // Only query for actual motorways (interstates) and their links
    const overpassQuery = `
      [out:json][timeout:15];
      (
        way["highway"="motorway"](around:${radius},${lat},${lng});
        way["highway"="motorway_link"](around:${radius},${lat},${lng});
        way["ref"~"^I-[0-9]"](around:${radius},${lat},${lng});
      );
      out body;
      >;
      out skel qt;
    `;

    const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;

    const response = await fetch(overpassUrl, {
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return getDefaultHighwayAccess();
    }

    const data = await response.json();

    if (!data.elements || data.elements.length === 0) {
      return getDefaultHighwayAccess();
    }

    // Find ways with ref tags that are actual interstates (I-XX)
    const highways = data.elements.filter((el: { type: string; tags?: { ref?: string; name?: string; highway?: string } }) => {
      if (el.type !== 'way' || !el.tags) return false;
      const ref = el.tags.ref || '';
      const highway = el.tags.highway || '';
      // Only include actual interstates or motorways
      return highway === 'motorway' || highway === 'motorway_link' || ref.match(/^I-\d+/);
    });

    // Get nodes for distance calculation
    const nodes = new Map<number, { lat: number; lon: number }>();
    data.elements
      .filter((el: { type: string }) => el.type === 'node')
      .forEach((node: { id: number; lat: number; lon: number }) => {
        nodes.set(node.id, { lat: node.lat, lon: node.lon });
      });

    let nearestHighway = '';
    let minDistance = Infinity;
    let interchangeName = '';

    for (const hw of highways) {
      const ref = hw.tags?.ref || hw.tags?.name || '';

      // Skip non-interstate refs (we only want I-XX)
      if (ref && !ref.match(/^I-\d+/) && hw.tags?.highway !== 'motorway') {
        continue;
      }

      // Calculate distance to this highway
      if (hw.nodes && hw.nodes.length > 0) {
        for (const nodeId of hw.nodes) {
          const node = nodes.get(nodeId);
          if (node) {
            const dist = calculateDistance(lat, lng, node.lat, node.lon);
            if (dist < minDistance) {
              minDistance = dist;
              nearestHighway = formatHighwayRef(ref) || 'Interstate';

              // Check for junction/interchange name
              if (hw.tags?.junction || hw.tags?.name?.includes('Exit')) {
                interchangeName = hw.tags.junction || hw.tags.name;
              }
            }
          }
        }
      }
    }

    if (!nearestHighway) {
      return getDefaultHighwayAccess();
    }

    const distanceMiles = minDistance * 0.000621371; // meters to miles
    const hasDirectAccess = distanceMiles <= 0.5;

    // Estimate drive time (assuming 30 mph average to reach highway)
    const driveTimeMinutes = Math.round(distanceMiles * 2);

    return {
      nearestHighway,
      distanceMiles: Math.round(distanceMiles * 100) / 100,
      driveTimeMinutes,
      interchangeName: interchangeName || undefined,
      hasDirectAccess,
    };
  } catch (error) {
    console.error('Highway access error:', error);
    return getDefaultHighwayAccess();
  }
}

function formatHighwayRef(ref: string): string {
  if (!ref) return 'Unknown';

  // Clean up highway reference
  const cleaned = ref.trim().toUpperCase();

  // Format interstate
  if (cleaned.match(/^I-?\d+/)) {
    return cleaned.replace(/^I-?(\d+).*/, 'I-$1');
  }

  // Format US highway
  if (cleaned.match(/^US-?\d+/) || cleaned.match(/^U\.?S\.?\s*\d+/)) {
    return cleaned.replace(/^U\.?S\.?-?\s*(\d+).*/, 'US-$1');
  }

  // Format state route
  if (cleaned.match(/^SR-?\d+/) || cleaned.match(/^STATE\s*(ROUTE|ROAD|RD)/i)) {
    return cleaned.replace(/^(SR|STATE\s*(ROUTE|ROAD|RD))-?\s*(\d+).*/i, 'SR-$3');
  }

  return ref;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}

function getDefaultHighwayAccess() {
  return {
    nearestHighway: 'None found within 10 miles',
    distanceMiles: 10,
    hasDirectAccess: false,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: LocationIntelligenceRequest = await request.json();
    const { lat, lng } = body;

    if (!lat || !lng) {
      return NextResponse.json(
        { error: 'Coordinates are required' },
        { status: 400 }
      );
    }

    // Fetch all data in parallel
    const [opportunityZone, daytimePopulation, highwayAccess] = await Promise.all([
      checkOpportunityZone(lat, lng),
      getDaytimePopulation(lat, lng),
      getHighwayAccess(lat, lng),
    ]);

    return NextResponse.json({
      opportunityZone,
      daytimePopulation,
      highwayAccess,
    });
  } catch (error) {
    console.error('Location intelligence error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch location intelligence data' },
      { status: 500 }
    );
  }
}
