import { NextResponse } from 'next/server';

interface TrafficRequest {
  coordinates: { lat: number; lng: number };
  address?: string;  // Property address to extract street name
  stateCode?: string;
}

interface FDOTAADTResult {
  aadt: number;
  roadway: string;
  year: number;
  source: string;
}

export interface TrafficData {
  // Real-time data from TomTom
  currentSpeed: number;
  freeFlowSpeed: number;
  currentTravelTime: number;
  freeFlowTravelTime: number;
  confidence: number;
  roadType: string;
  trafficLevel: string;
  congestionPercent: number;
  // VPD data
  estimatedVPD: number;
  vpdRange: string;
  vpdSource: string;
}

interface FlowData {
  frc: string;
  currentSpeed: number;
  freeFlowSpeed: number;
  currentTravelTime: number;
  freeFlowTravelTime: number;
  confidence: number;
}

// Extract street name from a property address
function extractStreetName(address: string): string | null {
  if (!address) return null;

  // Common patterns for street addresses
  // "1817 Thomasville Rd, Tallahassee, FL 32303" -> "Thomasville"
  // "123 North Main Street, City, State" -> "Main"

  // Remove the street number at the beginning
  const withoutNumber = address.replace(/^\d+\s*/, '');

  // Take the first part (before the first comma)
  const streetPart = withoutNumber.split(',')[0].trim();

  // Remove common directional prefixes
  const withoutDirection = streetPart.replace(/^(North|South|East|West|N|S|E|W|NE|NW|SE|SW)\s+/i, '');

  // Remove common street suffixes to get the core name
  const withoutSuffix = withoutDirection.replace(/\s+(Road|Rd|Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Circle|Cir|Parkway|Pkwy|Highway|Hwy|Place|Pl|Trail|Trl|Terrace|Ter)\.?$/i, '');

  // Return the core street name (at least 3 characters)
  const streetName = withoutSuffix.trim();
  return streetName.length >= 3 ? streetName : null;
}

// Normalize street name for comparison
function normalizeStreetName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+(road|rd|street|st|avenue|ave|boulevard|blvd|drive|dr|lane|ln|way|court|ct|circle|cir|parkway|pkwy|highway|hwy|place|pl|trail|trl|terrace|ter)\.?$/i, '')
    .replace(/^(north|south|east|west|n|s|e|w|ne|nw|se|sw)\s+/i, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// Check if a road name matches the property street
function roadMatchesProperty(roadName: string, propertyStreet: string): boolean {
  if (!roadName || !propertyStreet) return false;

  // Skip obvious non-matches like "N/A"
  if (roadName.toUpperCase() === 'N/A' || roadName.trim() === '') return false;

  const normalizedRoad = normalizeStreetName(roadName);
  const normalizedProperty = normalizeStreetName(propertyStreet);

  if (!normalizedRoad || !normalizedProperty) return false;

  // Require minimum length for matches to avoid false positives like "na" in "thomasville"
  if (normalizedRoad.length < 4 || normalizedProperty.length < 4) return false;

  // Exact match
  if (normalizedRoad === normalizedProperty) return true;

  // One contains the other, but only if the contained part is substantial (at least 70% of the shorter string)
  const minLength = Math.min(normalizedRoad.length, normalizedProperty.length);
  const threshold = Math.max(4, Math.floor(minLength * 0.7));

  if (normalizedRoad.includes(normalizedProperty) && normalizedProperty.length >= threshold) {
    return true;
  }
  if (normalizedProperty.includes(normalizedRoad) && normalizedRoad.length >= threshold) {
    return true;
  }

  // Handle compound names like "SR-61/THOMASVILLE RD" - split and check each part
  const roadParts = roadName.split('/').map(part => normalizeStreetName(part));
  for (const part of roadParts) {
    if (part && part.length >= 4) {
      if (part === normalizedProperty) return true;
      if (part.includes(normalizedProperty) && normalizedProperty.length >= threshold) return true;
      if (normalizedProperty.includes(part) && part.length >= threshold) return true;
    }
  }

  return false;
}

// Get road name via reverse geocoding
async function getRoadName(lat: number, lng: number): Promise<string | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=17`,
      {
        headers: {
          'User-Agent': 'DroneSense/1.0 (https://drone-sense.vercel.app; Commercial Site Analysis)',
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();

    // Try to get the road name from the address
    if (data.address) {
      return data.address.road || data.address.street || data.address.highway || null;
    }

    return null;
  } catch (error) {
    console.error('Road name lookup error:', error);
    return null;
  }
}

// Fetch official AADT from Florida DOT's ArcGIS service, filtered by property street
async function fetchFloridaAADTFiltered(lat: number, lng: number, propertyStreet: string | null): Promise<FDOTAADTResult | null> {
  try {
    // Use ArcGIS identify endpoint to find AADT at this location
    // Layer 7 is the AADT layer
    // Use a larger search radius (~1.5km) to find the property's fronting road
    // and capture all segments along that road (not just the closest intersection)
    // This ensures we get the highest traffic count segment for major roads
    const mapExtent = `${lng - 0.015},${lat - 0.015},${lng + 0.015},${lat + 0.015}`;
    const url = `https://gis.fdot.gov/arcgis/rest/services/FTO/fto_PROD/MapServer/identify?` +
      `geometry=${lng},${lat}&geometryType=esriGeometryPoint&sr=4326&` +
      `layers=all:7&tolerance=200&mapExtent=${mapExtent}&imageDisplay=400,400,96&` +
      `returnGeometry=false&f=json`;

    console.log('Fetching Florida DOT AADT (filtered)...');
    console.log(`Property street to match: ${propertyStreet}`);
    const response = await fetch(url);

    if (!response.ok) {
      console.log('FDOT API error:', response.status);
      return null;
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      console.log('No FDOT AADT data found at this location');
      return null;
    }

    // Parse all results and their road names
    const allRoads: Array<{
      aadt: number;
      roadName: string;
      year: number;
      rawData: { DESC_TO: string; DESC_FRM: string; ROADWAY: string };
    }> = [];

    for (const result of data.results) {
      const attrs = result.attributes;
      if (attrs && attrs.AADT && Number(attrs.AADT) > 0) {
        const aadt = Number(attrs.AADT);
        const year = Number(attrs.YEAR_) || new Date().getFullYear();

        // Get all possible road name fields
        const descTo = attrs.DESC_TO || '';
        const descFrm = attrs.DESC_FRM || '';
        const roadway = attrs.ROADWAY || '';

        // Build road name - try DESC_TO first, then DESC_FRM
        let roadName = descTo || descFrm || 'Unknown Road';
        roadName = roadName.replace(/^(CR-\d+\/|SR-\d+\/|US-\d+\/)/, '').trim();

        allRoads.push({
          aadt,
          roadName,
          year,
          rawData: { DESC_TO: descTo, DESC_FRM: descFrm, ROADWAY: roadway }
        });
      }
    }

    console.log(`Found ${allRoads.length} FDOT road segments`);

    // Track if we found matching roads for the property street
    let hasPropertyMatch = false;

    // If we have a property street, filter to only matching roads
    let matchingRoads: typeof allRoads = [];
    if (propertyStreet) {
      // STEP 1: Find the ROADWAY ID for the property street
      // Look for segments where the property street name appears in DESC_TO
      // Important: Look for patterns like "SR-61/THOMASVILLE RD" where the road name
      // appears as the segment terminus (meaning THIS segment is ON that road)
      const roadwayIds = new Set<string>();

      // First pass: find ROADWAY IDs from segments that END at the property street
      // These are segments ON the property street that terminate at a named point
      for (const road of allRoads) {
        const descTo = road.rawData.DESC_TO || '';

        // Check if DESC_TO contains the street name (e.g., "SR-61/THOMASVILLE RD")
        // This indicates the segment is ON that road
        if (roadMatchesProperty(descTo, propertyStreet)) {
          if (road.rawData.ROADWAY) {
            roadwayIds.add(road.rawData.ROADWAY);
            console.log(`Found ROADWAY ${road.rawData.ROADWAY} from DESC_TO: ${descTo}`);
          }
        }
      }

      console.log(`Found ROADWAY IDs for "${propertyStreet}" (pass 1):`, Array.from(roadwayIds).join(', ') || 'none');

      // STEP 2: Get ALL segments with those ROADWAY IDs
      // This captures ALL segments on the same road, even if intersection names don't mention the road
      if (roadwayIds.size > 0) {
        matchingRoads = allRoads.filter(road => roadwayIds.has(road.rawData.ROADWAY));
        hasPropertyMatch = true;
        console.log(`Segments on matching ROADWAYs (${matchingRoads.length} total):`);
        for (const r of matchingRoads.slice(0, 10)) {
          console.log(`  ${r.rawData.DESC_FRM} -> ${r.rawData.DESC_TO}: ${r.aadt} (${r.year})`);
        }
      } else {
        // Fallback: try matching DESC_FRM as well
        for (const road of allRoads) {
          if (roadMatchesProperty(road.rawData.DESC_FRM, propertyStreet)) {
            if (road.rawData.ROADWAY) {
              roadwayIds.add(road.rawData.ROADWAY);
            }
          }
        }

        if (roadwayIds.size > 0) {
          matchingRoads = allRoads.filter(road => roadwayIds.has(road.rawData.ROADWAY));
          hasPropertyMatch = true;
          console.log(`Segments from DESC_FRM match:`, matchingRoads.length);
        } else {
          console.log(`No ROADWAY matches found for "${propertyStreet}"`);
        }
      }

      console.log(`Final matching roads for "${propertyStreet}": ${matchingRoads.length} segments`);
    }

    // If no matching roads, fall back to all roads (but prefer ones at exact location)
    if (matchingRoads.length === 0) {
      console.log('No matching roads found for property street, using closest road');
      matchingRoads = allRoads;
    }

    // Get the segment with the most recent data, then highest AADT
    // Prioritize recent data since older counts may be outdated
    let bestResult: FDOTAADTResult | null = null;
    for (const road of matchingRoads) {
      // Prefer: most recent year first, then highest AADT
      if (!bestResult ||
          road.year > bestResult.year ||
          (road.year === bestResult.year && road.aadt > bestResult.aadt)) {
        // Only use propertyStreet as display name if we actually matched the property's road
        // If we fell back to nearby roads, use the actual road name from the data
        const displayName = hasPropertyMatch ? (propertyStreet || road.roadName) : road.roadName;
        bestResult = {
          aadt: road.aadt,
          roadway: displayName,
          year: road.year,
          source: 'Florida DOT Official AADT'
        };
      }
    }

    if (bestResult) {
      console.log(`Selected FDOT AADT: ${bestResult.aadt} on ${bestResult.roadway} (${bestResult.year})`);
    }

    return bestResult;
  } catch (error) {
    console.error('Florida DOT AADT fetch error:', error);
    return null;
  }
}

// Fetch official AADT from Florida DOT's ArcGIS service (legacy - unfiltered)
async function fetchFloridaAADT(lat: number, lng: number): Promise<FDOTAADTResult | null> {
  try {
    // Use ArcGIS identify endpoint to find AADT at this location
    // Layer 7 is the AADT layer
    const mapExtent = `${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}`;
    const url = `https://gis.fdot.gov/arcgis/rest/services/FTO/fto_PROD/MapServer/identify?` +
      `geometry=${lng},${lat}&geometryType=esriGeometryPoint&sr=4326&` +
      `layers=all:7&tolerance=100&mapExtent=${mapExtent}&imageDisplay=400,400,96&` +
      `returnGeometry=false&f=json`;

    console.log('Fetching Florida DOT AADT...');
    const response = await fetch(url);

    if (!response.ok) {
      console.log('FDOT API error:', response.status);
      return null;
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      console.log('No FDOT AADT data found at this location');
      return null;
    }

    // Get the result with the highest AADT (busiest road nearby)
    // Prefer more recent data when AADTs are similar
    let bestResult: FDOTAADTResult | null = null;
    for (const result of data.results) {
      const attrs = result.attributes;
      if (attrs && attrs.AADT && Number(attrs.AADT) > 0) {
        const aadt = Number(attrs.AADT);
        const year = Number(attrs.YEAR_) || new Date().getFullYear();

        // Build road name from DESC_FRM (e.g., "THOMASVILLE RD" from "CR-158/THARPE ST")
        // The DESC_TO often contains the main road name
        let roadName = attrs.DESC_TO || attrs.DESC_FRM || 'Unknown Road';
        // Clean up common prefixes
        roadName = roadName.replace(/^(CR-\d+\/|SR-\d+\/|US-\d+\/)/, '').trim();

        // Prefer higher AADT, or same AADT with newer year
        if (!bestResult || aadt > bestResult.aadt || (aadt === bestResult.aadt && year > bestResult.year)) {
          bestResult = {
            aadt: aadt,
            roadway: roadName,
            year: year,
            source: 'Florida DOT Official AADT'
          };
        }
      }
    }

    if (bestResult) {
      console.log(`Found FDOT AADT: ${bestResult.aadt} on ${bestResult.roadway} (${bestResult.year})`);
    }

    return bestResult;
  } catch (error) {
    console.error('Florida DOT AADT fetch error:', error);
    return null;
  }
}

// FRC priority - lower number = more major road
const FRC_PRIORITY: Record<string, number> = {
  'FRC0': 0,  // Motorway/Freeway - highest priority
  'FRC1': 1,  // Major Road
  'FRC2': 2,  // Other Major Road
  'FRC3': 3,  // Secondary Road
  'FRC4': 4,  // Local Connecting Road
  'FRC5': 5,  // Local Road High Importance
  'FRC6': 6,  // Local Road - lowest priority
};

// Estimate VPD based on road functional class (FRC)
// These are typical AADT ranges from FHWA Highway Statistics
function estimateVPD(frc: string, freeFlowSpeed: number): {
  estimatedVPD: number;
  vpdRange: string;
  source: string;
} {
  // Typical VPD ranges by road class (from FHWA data)
  const vpdByFRC: Record<string, { min: number; max: number; typical: number }> = {
    'FRC0': { min: 30000, max: 150000, typical: 75000 },  // Motorway/Freeway
    'FRC1': { min: 15000, max: 50000, typical: 30000 },   // Major Road
    'FRC2': { min: 10000, max: 35000, typical: 20000 },   // Other Major Road
    'FRC3': { min: 5000, max: 20000, typical: 12000 },    // Secondary Road
    'FRC4': { min: 2000, max: 10000, typical: 5000 },     // Local Connecting Road
    'FRC5': { min: 1000, max: 5000, typical: 2500 },      // Local Road High Importance
    'FRC6': { min: 100, max: 2000, typical: 800 },        // Local Road
  };

  const range = vpdByFRC[frc] || { min: 500, max: 5000, typical: 2000 };

  // Adjust estimate based on free flow speed
  // Higher speed limits typically correlate with higher capacity/volume
  let speedFactor = 1;
  if (freeFlowSpeed > 60) speedFactor = 1.2;
  else if (freeFlowSpeed > 45) speedFactor = 1.0;
  else if (freeFlowSpeed > 30) speedFactor = 0.8;
  else speedFactor = 0.6;

  const estimated = Math.round(range.typical * speedFactor);

  return {
    estimatedVPD: estimated,
    vpdRange: `${range.min.toLocaleString()} - ${range.max.toLocaleString()}`,
    source: 'Estimated (FHWA road class)'
  };
}

// Fetch traffic data for a single point
async function fetchTrafficPoint(lat: number, lng: number, apiKey: string): Promise<FlowData | null> {
  try {
    const response = await fetch(
      `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json?point=${lat},${lng}&unit=MPH&thickness=1&key=${apiKey}`
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data.flowSegmentData || null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body: TrafficRequest = await request.json();
    const { coordinates, address } = body;

    if (!coordinates) {
      return NextResponse.json({ error: 'No coordinates provided' }, { status: 400 });
    }

    const apiKey = process.env.TOMTOM_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        error: 'Traffic API not configured',
        message: 'Add TOMTOM_API_KEY to environment variables'
      }, { status: 500 });
    }

    const { lat, lng } = coordinates;

    // STEP 1: Determine the property's fronting road
    // First try to extract from the address, then fall back to reverse geocoding
    let propertyStreet = address ? extractStreetName(address) : null;
    const reverseGeocodedRoad = await getRoadName(lat, lng);

    // If we couldn't extract from address, use reverse geocoded road
    if (!propertyStreet && reverseGeocodedRoad) {
      propertyStreet = reverseGeocodedRoad;
    }

    console.log(`Property address: ${address}`);
    console.log(`Extracted street name: ${propertyStreet}`);
    console.log(`Reverse geocoded road: ${reverseGeocodedRoad}`);

    // STEP 2: Get traffic data at the property location (not searching widely)
    // Only sample very close points to stay on the same road
    const closeOffsets = [
      { lat: 0, lng: 0 },           // Center point (on the road)
      // ~25m in cardinal directions (stay on same road)
      { lat: 0.00025, lng: 0 },
      { lat: -0.00025, lng: 0 },
      { lat: 0, lng: 0.00025 },
      { lat: 0, lng: -0.00025 },
    ];

    // Fetch traffic data for close points
    const results = await Promise.all(
      closeOffsets.map(offset =>
        fetchTrafficPoint(lat + offset.lat, lng + offset.lng, apiKey)
      )
    );

    // Filter out null results
    const validResults = results.filter((r): r is FlowData => r !== null);

    if (validResults.length === 0) {
      return NextResponse.json({
        error: 'No traffic data available',
        message: 'No traffic information found for this location'
      }, { status: 404 });
    }

    // Use the first valid result (at property location)
    const flowData = {
      ...validResults[0],
      vpd: estimateVPD(validResults[0].frc, validResults[0].freeFlowSpeed)
    };

    // Calculate congestion percentage
    const congestionPercent = flowData.freeFlowSpeed > 0
      ? Math.round((1 - flowData.currentSpeed / flowData.freeFlowSpeed) * 100)
      : 0;

    // Determine traffic level
    let trafficLevel = 'Light';
    if (congestionPercent > 50) {
      trafficLevel = 'Heavy';
    } else if (congestionPercent > 25) {
      trafficLevel = 'Moderate';
    } else if (congestionPercent > 10) {
      trafficLevel = 'Light';
    } else {
      trafficLevel = 'Free Flow';
    }

    // Determine road type based on FRC (Functional Road Class)
    const frcMap: Record<string, string> = {
      'FRC0': 'Motorway/Freeway',
      'FRC1': 'Major Road',
      'FRC2': 'Other Major Road',
      'FRC3': 'Secondary Road',
      'FRC4': 'Local Connecting Road',
      'FRC5': 'Local Road High Importance',
      'FRC6': 'Local Road',
    };
    const roadTypeClassification = frcMap[flowData.frc] || 'Road';

    // STEP 3: Get official AADT from Florida DOT, filtered by property street
    const isInFlorida = lat >= 24.5 && lat <= 31.0 && lng >= -87.5 && lng <= -80.0;

    let officialAADT: FDOTAADTResult | null = null;
    if (isInFlorida) {
      officialAADT = await fetchFloridaAADTFiltered(lat, lng, propertyStreet);
    }

    // Use the property's fronting road name
    const displayRoadName = (() => {
      // If we have official AADT with a good road name that matches property, use it
      if (officialAADT?.roadway &&
          officialAADT.roadway !== 'Unknown Road' &&
          officialAADT.roadway !== 'N/A' &&
          officialAADT.roadway.trim() !== '') {
        return officialAADT.roadway;
      }
      // Use the property street name
      if (propertyStreet) {
        return propertyStreet;
      }
      // Fall back to road type classification
      return roadTypeClassification;
    })();

    // Use official AADT if available, otherwise use estimate
    const finalVPD = officialAADT ? officialAADT.aadt : flowData.vpd.estimatedVPD;
    const finalVPDSource = officialAADT
      ? `Florida DOT Official AADT - ${displayRoadName} (${officialAADT.year})`
      : `Estimated from ${displayRoadName} (${roadTypeClassification})`;
    const finalVPDRange = officialAADT
      ? `Official count: ${officialAADT.aadt.toLocaleString()}`
      : flowData.vpd.vpdRange;

    console.log(`Final road: ${displayRoadName}, VPD: ${finalVPD}`);

    // Use the VPD - official if available, otherwise estimated
    const trafficData: TrafficData = {
      currentSpeed: Math.round(flowData.currentSpeed),
      freeFlowSpeed: Math.round(flowData.freeFlowSpeed),
      currentTravelTime: flowData.currentTravelTime,
      freeFlowTravelTime: flowData.freeFlowTravelTime,
      confidence: flowData.confidence || 0,
      roadType: displayRoadName,
      trafficLevel,
      congestionPercent: Math.max(0, congestionPercent),
      // VPD - prefer official AADT when available
      estimatedVPD: finalVPD,
      vpdRange: finalVPDRange,
      vpdSource: finalVPDSource,
    };

    return NextResponse.json(trafficData);
  } catch (error) {
    console.error('Traffic API error:', error);
    return NextResponse.json({
      error: 'Failed to fetch traffic data',
      message: String(error)
    }, { status: 500 });
  }
}
