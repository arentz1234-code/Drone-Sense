import { NextResponse } from 'next/server';

interface TrafficRequest {
  coordinates: { lat: number; lng: number };
  address?: string;
  parcelBoundary?: Array<[number, number]>;
}

interface RoadVPD {
  roadName: string;
  vpd: number;
  year: number;
  source: string;
  roadwayId?: string;
}

interface FDOTSegment {
  aadt: number;
  year: number;
  roadway: string;
  descTo: string;
  descFrm: string;
}

export interface TrafficData {
  // Individual road VPD data
  roads: RoadVPD[];
  // Primary/average VPD (for backwards compatibility)
  estimatedVPD: number;
  vpdRange: string;
  vpdSource: string;
  // Road info
  roadType: string;
  // Real-time traffic
  currentSpeed: number;
  freeFlowSpeed: number;
  currentTravelTime: number;
  freeFlowTravelTime: number;
  confidence: number;
  trafficLevel: string;
  congestionPercent: number;
  // Multiple roads indicator
  hasMultipleRoads: boolean;
  averageVPD?: number;
}

// Find adjacent roads using OpenStreetMap Overpass API
async function findAdjacentRoads(lat: number, lng: number, boundaryCoords?: Array<[number, number]>): Promise<string[]> {
  try {
    const overpassUrl = 'https://overpass-api.de/api/interpreter';

    // Search for roads within 500m to capture main roads even if property is set back
    // Prioritize major roads (primary, secondary, trunk) over residential
    const query = `
      [out:json][timeout:15];
      (
        way["highway"~"primary|secondary|trunk|motorway"](around:500,${lat},${lng});
        way["highway"~"tertiary"](around:300,${lat},${lng});
        way["highway"~"residential"](around:150,${lat},${lng});
      );
      out body;
      >;
      out skel qt;
    `;

    const response = await fetch(overpassUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      console.log('[Traffic] Overpass API error:', response.status);
      return [];
    }

    const data = await response.json();
    const roadNames: string[] = [];

    for (const el of data.elements || []) {
      if (el.type === 'way' && el.tags?.name) {
        const name = el.tags.name;
        if (!roadNames.includes(name)) {
          roadNames.push(name);
        }
      }
    }

    console.log('[Traffic] Found adjacent roads from OSM:', roadNames);
    return roadNames;
  } catch (error) {
    console.error('[Traffic] Overpass error:', error);
    return [];
  }
}

// Common road name aliases (local name -> FDOT name patterns)
// This maps common/local names to their official route designations in FDOT data
const ROAD_ALIASES: Record<string, string[]> = {
  // Tallahassee area
  'capital circle': ['sr-263', 'sr263', 'capital', 'state road 263', '263'],
  'apalachee': ['sr-27', 'us-27', 'apalachee', 'state road 27', '27'],
  'tennessee': ['us-90', 'sr-10', 'tennessee', 'state road 10', '90', '10'],
  'mahan': ['us-90', 'sr-10', 'mahan', 'state road 10', '90', '10'],
  'tharpe': ['cr-158', 'tharpe', 'county road 158', '158'],
  'lake bradford': ['sr-371', 'lake bradford', 'state road 371', '371'],
  'monroe': ['sr-63', 'us-27', 'monroe', 'state road 63', '63'],
  'magnolia': ['magnolia', 'sr-61', 'state road 61', '61'],
  'meridian': ['sr-155', 'cr-155', 'meridian', 'state road 155', '155'],
  'thomasville': ['sr-61', 'thomasville', 'state road 61', '61'],
  'pensacola': ['sr-363', 'pensacola', 'state road 363', '363'],
  'ocala': ['sr-20', 'ocala', 'state road 20', '20'],
  'blountstown': ['sr-20', 'blountstown', 'us-90', 'state road 20', '20'],
  'centerville': ['cr-259', 'centerville', 'county road 259', '259'],
  'miccosukee': ['cr-59', 'miccosukee', 'county road 59', '59'],
  // Orlando area
  'colonial': ['sr-50', 'colonial', 'state road 50', '50'],
  'orange blossom': ['sr-451', 'orange blossom', 'state road 451', '451'],
  'sand lake': ['sr-482', 'sand lake', 'state road 482', '482'],
  'international': ['sr-535', 'international', 'state road 535', '535'],
  // Tampa area
  'dale mabry': ['sr-574', 'dale mabry', 'state road 574', '574'],
  'hillsborough': ['sr-580', 'hillsborough', 'state road 580', '580'],
  'fowler': ['sr-582', 'fowler', 'state road 582', '582'],
  'busch': ['sr-580', 'busch', 'state road 580', '580'],
  'kennedy': ['sr-60', 'kennedy', 'state road 60', '60'],
  // Miami area
  'biscayne': ['us-1', 'biscayne', 'us 1', '1'],
  'flagler': ['sr-968', 'flagler', 'state road 968', '968'],
  'calle ocho': ['sr-90', 'calle ocho', 'state road 90', '90'],
  // Jacksonville area
  'atlantic': ['sr-10', 'atlantic', 'state road 10', '10'],
  'beach': ['sr-212', 'beach', 'state road 212', '212'],
  'university': ['sr-109', 'university', 'state road 109', '109'],
};


// Normalize street name for comparison
function normalizeStreetName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+(road|rd|street|st|avenue|ave|boulevard|blvd|drive|dr|lane|ln|way|court|ct|circle|cir|parkway|pkwy|highway|hwy|place|pl|trail|trl|terrace|ter)\.?$/i, '')
    .replace(/^(north|south|east|west|n|s|e|w|ne|nw|se|sw)\s+/i, '')
    .replace(/^(sr-\d+\/|cr-\d+\/|us-\d+\/)/i, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// Get aliases for a road name
function getRoadAliases(roadName: string): string[] {
  const normalized = normalizeStreetName(roadName);
  const aliases: string[] = [normalized];

  for (const [key, values] of Object.entries(ROAD_ALIASES)) {
    if (normalized.includes(normalizeStreetName(key)) || normalizeStreetName(key).includes(normalized)) {
      aliases.push(...values.map(v => normalizeStreetName(v)));
    }
  }

  return [...new Set(aliases)];
}

// Check if two road names match (including aliases)
function roadNamesMatch(name1: string, name2: string): boolean {
  if (!name1 || !name2) return false;
  if (name1.toUpperCase() === 'N/A' || name2.toUpperCase() === 'N/A') return false;

  // Get all possible aliases for both names
  const aliases1 = getRoadAliases(name1);
  const aliases2 = getRoadAliases(name2);

  // Also add the parts from compound names (e.g., "SR-61/THOMASVILLE RD")
  name1.split('/').forEach(part => aliases1.push(...getRoadAliases(part)));
  name2.split('/').forEach(part => aliases2.push(...getRoadAliases(part)));

  // Check all combinations
  for (const a1 of aliases1) {
    if (!a1 || a1.length < 3) continue;
    for (const a2 of aliases2) {
      if (!a2 || a2.length < 3) continue;

      // Exact match
      if (a1 === a2) return true;

      // One contains the other
      const minLen = Math.min(a1.length, a2.length);
      const threshold = Math.max(3, Math.floor(minLen * 0.6));

      if (a1.includes(a2) && a2.length >= threshold) return true;
      if (a2.includes(a1) && a1.length >= threshold) return true;
    }
  }

  return false;
}

// Fetch FDOT AADT data for a specific road (with optional extended radius)
async function fetchFDOTForRoad(lat: number, lng: number, roadName: string, extendedRadius: boolean = false): Promise<RoadVPD | null> {
  try {
    // Use a larger search area when looking for the address street
    const radius = extendedRadius ? 0.025 : 0.015; // ~2.7km vs ~1.6km
    const tolerance = extendedRadius ? 500 : 200;
    const mapExtent = `${lng - radius},${lat - radius},${lng + radius},${lat + radius}`;
    const url = `https://gis.fdot.gov/arcgis/rest/services/FTO/fto_PROD/MapServer/identify?` +
      `geometry=${lng},${lat}&geometryType=esriGeometryPoint&sr=4326&` +
      `layers=all:7&tolerance=${tolerance}&mapExtent=${mapExtent}&imageDisplay=400,400,96&` +
      `returnGeometry=false&f=json`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.results || data.results.length === 0) return null;

    // Parse all segments with additional FDOT fields
    interface ExtendedFDOTSegment extends FDOTSegment {
      routeId?: string;
      county?: string;
      roadName?: string;
    }

    const segments: ExtendedFDOTSegment[] = [];
    for (const result of data.results) {
      const attrs = result.attributes;
      if (attrs && attrs.AADT && Number(attrs.AADT) > 0) {
        segments.push({
          aadt: Number(attrs.AADT),
          year: Number(attrs.YEAR_) || 2024,
          roadway: attrs.ROADWAY || '',
          descTo: attrs.DESC_TO || '',
          descFrm: attrs.DESC_FRM || '',
          routeId: attrs.ROUTE_ID || attrs.ROUTEID || '',
          roadName: attrs.ROAD_NAME || attrs.ROADNAME || '',
        });
      }
    }

    // Get all aliases for the road name we're searching for
    const searchAliases = getRoadAliases(roadName);
    console.log(`[FDOT] Searching for "${roadName}" with aliases: ${searchAliases.join(', ')}`);

    // Find ROADWAY IDs that match this road name using multiple strategies
    const matchingRoadwayIds = new Set<string>();

    for (const seg of segments) {
      // Strategy 1: Check if DESC_TO or DESC_FRM mentions the road
      if (roadNamesMatch(seg.descTo, roadName) || roadNamesMatch(seg.descFrm, roadName)) {
        matchingRoadwayIds.add(seg.roadway);
        continue;
      }

      // Strategy 2: Check if ROAD_NAME field matches (if available)
      if (seg.roadName && roadNamesMatch(seg.roadName, roadName)) {
        matchingRoadwayIds.add(seg.roadway);
        continue;
      }
    }

    if (matchingRoadwayIds.size === 0) {
      console.log(`[FDOT] No ROADWAY match for "${roadName}"`);
      return null;
    }

    // Get all segments with matching ROADWAY IDs
    const matchingSegments = segments.filter(s => matchingRoadwayIds.has(s.roadway));

    // Find the best segment (most recent year, then highest AADT)
    let best: ExtendedFDOTSegment | null = null;
    for (const seg of matchingSegments) {
      if (!best || seg.year > best.year || (seg.year === best.year && seg.aadt > best.aadt)) {
        best = seg;
      }
    }

    if (!best) return null;

    console.log(`[FDOT] Found VPD for "${roadName}": ${best.aadt} (${best.year}) ROADWAY=${best.roadway}`);

    return {
      roadName,
      vpd: best.aadt,
      year: best.year,
      source: 'Florida DOT AADT',
      roadwayId: best.roadway,
    };
  } catch (error) {
    console.error(`[FDOT] Error fetching for "${roadName}":`, error);
    return null;
  }
}

// Fetch all FDOT data near location and group by road
async function fetchAllFDOTRoads(lat: number, lng: number): Promise<RoadVPD[]> {
  try {
    const mapExtent = `${lng - 0.015},${lat - 0.015},${lng + 0.015},${lat + 0.015}`;
    const url = `https://gis.fdot.gov/arcgis/rest/services/FTO/fto_PROD/MapServer/identify?` +
      `geometry=${lng},${lat}&geometryType=esriGeometryPoint&sr=4326&` +
      `layers=all:7&tolerance=200&mapExtent=${mapExtent}&imageDisplay=400,400,96&` +
      `returnGeometry=false&f=json`;

    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    if (!data.results || data.results.length === 0) return [];

    // Group segments by ROADWAY ID
    const roadwayMap = new Map<string, { segments: FDOTSegment[], names: Set<string> }>();

    for (const result of data.results) {
      const attrs = result.attributes;
      if (attrs && attrs.AADT && Number(attrs.AADT) > 0 && attrs.ROADWAY) {
        const roadway = attrs.ROADWAY;

        if (!roadwayMap.has(roadway)) {
          roadwayMap.set(roadway, { segments: [], names: new Set() });
        }

        const entry = roadwayMap.get(roadway)!;
        entry.segments.push({
          aadt: Number(attrs.AADT),
          year: Number(attrs.YEAR_) || 2024,
          roadway,
          descTo: attrs.DESC_TO || '',
          descFrm: attrs.DESC_FRM || '',
        });

        // Collect road names from DESC_TO and DESC_FRM
        if (attrs.DESC_TO && attrs.DESC_TO !== 'N/A') {
          entry.names.add(attrs.DESC_TO);
        }
        if (attrs.DESC_FRM && attrs.DESC_FRM !== 'N/A') {
          entry.names.add(attrs.DESC_FRM);
        }
      }
    }

    // Convert to RoadVPD array - get best segment for each ROADWAY
    const roads: RoadVPD[] = [];

    for (const [roadway, { segments, names }] of roadwayMap.entries()) {
      // Find best segment (most recent, then highest AADT)
      let best: FDOTSegment | null = null;
      for (const seg of segments) {
        if (!best || seg.year > best.year || (seg.year === best.year && seg.aadt > best.aadt)) {
          best = seg;
        }
      }

      if (best) {
        // Determine road name from DESC_TO/DESC_FRM
        let roadName = Array.from(names).find(n => !n.includes('Bridge') && n.length > 3) ||
                       Array.from(names)[0] ||
                       `Road ${roadway}`;
        // Clean up the name - remove route prefixes to get the street name
        roadName = roadName.replace(/^(CR-\d+\/|SR-\d+\/|US-\d+\/)/, '').trim();

        roads.push({
          roadName,
          vpd: best.aadt,
          year: best.year,
          source: 'Florida DOT AADT',
          roadwayId: roadway,
        });
      }
    }

    // Sort by VPD descending
    roads.sort((a, b) => b.vpd - a.vpd);

    console.log(`[FDOT] Found ${roads.length} unique roads:`, roads.map(r => `${r.roadName}: ${r.vpd}`).join(', '));

    return roads;
  } catch (error) {
    console.error('[FDOT] Error fetching all roads:', error);
    return [];
  }
}

// Extract street name from address
function extractStreetName(address: string): string | null {
  if (!address) return null;
  const withoutNumber = address.replace(/^\d+\s*/, '');
  const streetPart = withoutNumber.split(',')[0].trim();
  const withoutDirection = streetPart.replace(/^(North|South|East|West|N|S|E|W|NE|NW|SE|SW)\s+/i, '');
  const withoutSuffix = withoutDirection.replace(/\s+(Road|Rd|Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Circle|Cir|Parkway|Pkwy|Highway|Hwy|Place|Pl|Trail|Trl|Terrace|Ter)\.?$/i, '');
  const streetName = withoutSuffix.trim();
  return streetName.length >= 3 ? streetName : null;
}

// Get road name at coordinates using reverse geocoding
async function getRoadNameAtLocation(lat: number, lng: number): Promise<string | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=17`,
      { headers: { 'User-Agent': 'DroneSense/1.0' } }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.address?.road || data.address?.street || null;
  } catch {
    return null;
  }
}

// Fetch TomTom traffic data
async function fetchTomTomTraffic(lat: number, lng: number, apiKey: string) {
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
    const { coordinates, address, parcelBoundary } = body;

    if (!coordinates) {
      return NextResponse.json({ error: 'No coordinates provided' }, { status: 400 });
    }

    const apiKey = process.env.TOMTOM_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Traffic API not configured' }, { status: 500 });
    }

    const { lat, lng } = coordinates;
    console.log(`[Traffic] Processing: ${address || `${lat},${lng}`}`);

    // STEP 1: Extract property street from address
    let propertyStreet = address ? extractStreetName(address) : null;
    console.log(`[Traffic] Property street from address: ${propertyStreet}`);

    // STEP 2: Use reverse geocoding to get the official road name at this location
    const reverseGeocodedRoad = await getRoadNameAtLocation(lat, lng);
    console.log(`[Traffic] Reverse geocoded road: ${reverseGeocodedRoad}`);

    // STEP 3: Find adjacent roads from OpenStreetMap
    const osmRoads = await findAdjacentRoads(lat, lng, parcelBoundary);
    console.log(`[Traffic] OSM adjacent roads: ${osmRoads.join(', ') || 'none'}`);

    // Add reverse geocoded road to OSM roads if not already present
    if (reverseGeocodedRoad) {
      const reverseNormalized = normalizeStreetName(reverseGeocodedRoad);
      const alreadyHas = osmRoads.some(r => normalizeStreetName(r) === reverseNormalized);
      if (!alreadyHas) {
        osmRoads.unshift(reverseGeocodedRoad);
      }
    }

    // STEP 4: Get all FDOT roads in the area
    const allFDOTRoads = await fetchAllFDOTRoads(lat, lng);

    // STEP 5: Match roads with FDOT data
    const matchedRoads: RoadVPD[] = [];
    const matchedRoadwayIds = new Set<string>();

    // Strategy 1: Match property street with OSM roads first
    // If the address street matches an OSM road, use that as the property's main road
    let propertyOSMRoad: string | null = null;
    if (propertyStreet) {
      for (const osmRoad of osmRoads) {
        if (roadNamesMatch(osmRoad, propertyStreet)) {
          propertyOSMRoad = osmRoad;
          console.log(`[Traffic] Property street "${propertyStreet}" matches OSM road "${osmRoad}"`);
          break;
        }
      }
    }

    // Strategy 2: For the property's main road, use highest VPD segment
    // Since FDOT doesn't label roads by name, we use VPD as a heuristic
    // Main roads (like Thomasville Rd) typically have high VPD
    if (propertyStreet && allFDOTRoads.length > 0) {
      // Use the highest VPD road as the property's main road
      const mainRoad = allFDOTRoads[0]; // Already sorted by VPD descending
      matchedRoads.push({
        ...mainRoad,
        roadName: propertyOSMRoad || propertyStreet,
      });
      matchedRoadwayIds.add(mainRoad.roadwayId!);
      console.log(`[Traffic] Property road "${propertyStreet}": ${mainRoad.vpd} VPD (highest in area)`);
    }

    // Strategy 3: Match other OSM roads with remaining FDOT roads
    for (const osmRoad of osmRoads) {
      // Skip if this is the property street (already handled)
      if (propertyStreet && roadNamesMatch(osmRoad, propertyStreet)) continue;

      // Try matching with FDOT roads that haven't been claimed
      for (const fdotRoad of allFDOTRoads) {
        if (fdotRoad.roadwayId && !matchedRoadwayIds.has(fdotRoad.roadwayId)) {
          // Match if names are similar OR if it's a minor road
          if (roadNamesMatch(fdotRoad.roadName, osmRoad)) {
            matchedRoads.push({
              ...fdotRoad,
              roadName: osmRoad,
            });
            matchedRoadwayIds.add(fdotRoad.roadwayId);
            break;
          }
        }
      }
    }

    // Strategy 4: If still no property road matched, use the highest VPD segment
    if (matchedRoads.length === 0 && allFDOTRoads.length > 0) {
      const topRoad = allFDOTRoads[0];
      matchedRoads.push({
        ...topRoad,
        roadName: propertyStreet || topRoad.roadName,
      });
      console.log(`[Traffic] Fallback: using highest VPD road: ${topRoad.vpd} VPD`);
    }

    console.log(`[Traffic] Final matched roads: ${matchedRoads.map(r => `${r.roadName}:${r.vpd}`).join(', ')}`);

    // STEP 5: Get TomTom real-time traffic
    const flowData = await fetchTomTomTraffic(lat, lng, apiKey);

    const currentSpeed = flowData?.currentSpeed || 35;
    const freeFlowSpeed = flowData?.freeFlowSpeed || 45;
    const congestionPercent = freeFlowSpeed > 0
      ? Math.max(0, Math.round((1 - currentSpeed / freeFlowSpeed) * 100))
      : 0;

    let trafficLevel = 'Free Flow';
    if (congestionPercent > 50) trafficLevel = 'Heavy';
    else if (congestionPercent > 25) trafficLevel = 'Moderate';
    else if (congestionPercent > 10) trafficLevel = 'Light';

    // STEP 6: Calculate averages and prepare response
    const hasMultipleRoads = matchedRoads.length > 1;
    const totalVPD = matchedRoads.reduce((sum, r) => sum + r.vpd, 0);
    const averageVPD = hasMultipleRoads ? Math.round(totalVPD / matchedRoads.length) : undefined;

    // Primary VPD is the highest among matched roads (or average if multiple)
    const primaryVPD = matchedRoads.length > 0
      ? (hasMultipleRoads ? averageVPD! : matchedRoads[0].vpd)
      : 0;

    // Primary road name
    const primaryRoad = matchedRoads.length > 0
      ? matchedRoads[0].roadName
      : (propertyStreet || 'Unknown');

    // Build VPD source string
    let vpdSource = '';
    if (matchedRoads.length > 1) {
      vpdSource = `Average of ${matchedRoads.length} roads: ${matchedRoads.map(r => r.roadName).join(', ')}`;
    } else if (matchedRoads.length === 1) {
      vpdSource = `Florida DOT AADT - ${matchedRoads[0].roadName} (${matchedRoads[0].year})`;
    } else {
      vpdSource = 'No official data available';
    }

    // Build VPD range string
    let vpdRange = '';
    if (matchedRoads.length > 1) {
      const minVPD = Math.min(...matchedRoads.map(r => r.vpd));
      const maxVPD = Math.max(...matchedRoads.map(r => r.vpd));
      vpdRange = `${minVPD.toLocaleString()} - ${maxVPD.toLocaleString()}`;
    } else if (matchedRoads.length === 1) {
      vpdRange = `Official count: ${matchedRoads[0].vpd.toLocaleString()}`;
    } else {
      vpdRange = 'N/A';
    }

    const trafficData: TrafficData = {
      roads: matchedRoads,
      estimatedVPD: primaryVPD,
      vpdRange,
      vpdSource,
      roadType: primaryRoad,
      currentSpeed: Math.round(currentSpeed),
      freeFlowSpeed: Math.round(freeFlowSpeed),
      currentTravelTime: flowData?.currentTravelTime || 0,
      freeFlowTravelTime: flowData?.freeFlowTravelTime || 0,
      confidence: flowData?.confidence || 0,
      trafficLevel,
      congestionPercent,
      hasMultipleRoads,
      averageVPD,
    };

    console.log(`[Traffic] Response: VPD=${primaryVPD}, Roads=${matchedRoads.length}, HasMultiple=${hasMultipleRoads}`);

    return NextResponse.json(trafficData);
  } catch (error) {
    console.error('[Traffic] API error:', error);
    return NextResponse.json({
      error: 'Failed to fetch traffic data',
      message: String(error)
    }, { status: 500 });
  }
}
