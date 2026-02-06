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

    // Search for roads within 100m of the point (or along the parcel boundary if provided)
    let query: string;

    if (boundaryCoords && boundaryCoords.length > 3) {
      // Create a polygon query using parcel boundary
      const polyStr = boundaryCoords.map(([lat, lng]) => `${lat} ${lng}`).join(' ');
      query = `
        [out:json][timeout:15];
        (
          way["highway"~"primary|secondary|tertiary|residential|trunk|motorway"](around:50,${lat},${lng});
        );
        out body;
        >;
        out skel qt;
      `;
    } else {
      // Simple radius search
      query = `
        [out:json][timeout:15];
        (
          way["highway"~"primary|secondary|tertiary|residential|trunk|motorway"](around:100,${lat},${lng});
        );
        out body;
        >;
        out skel qt;
      `;
    }

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

// Check if two road names match
function roadNamesMatch(name1: string, name2: string): boolean {
  if (!name1 || !name2) return false;
  if (name1.toUpperCase() === 'N/A' || name2.toUpperCase() === 'N/A') return false;

  const n1 = normalizeStreetName(name1);
  const n2 = normalizeStreetName(name2);

  if (!n1 || !n2 || n1.length < 3 || n2.length < 3) return false;

  // Exact match
  if (n1 === n2) return true;

  // One contains the other (for compound names)
  const minLen = Math.min(n1.length, n2.length);
  const threshold = Math.max(3, Math.floor(minLen * 0.6));

  if (n1.includes(n2) && n2.length >= threshold) return true;
  if (n2.includes(n1) && n1.length >= threshold) return true;

  // Check compound names (e.g., "SR-61/THOMASVILLE RD")
  const parts1 = name1.split('/').map(normalizeStreetName);
  const parts2 = name2.split('/').map(normalizeStreetName);

  for (const p1 of parts1) {
    for (const p2 of parts2) {
      if (p1 && p2 && p1.length >= 3 && p2.length >= 3) {
        if (p1 === p2) return true;
        if (p1.includes(p2) && p2.length >= threshold) return true;
        if (p2.includes(p1) && p1.length >= threshold) return true;
      }
    }
  }

  return false;
}

// Fetch FDOT AADT data for a specific road
async function fetchFDOTForRoad(lat: number, lng: number, roadName: string): Promise<RoadVPD | null> {
  try {
    // Use a moderate search area to find the road while staying close to the property
    const mapExtent = `${lng - 0.015},${lat - 0.015},${lng + 0.015},${lat + 0.015}`;
    const url = `https://gis.fdot.gov/arcgis/rest/services/FTO/fto_PROD/MapServer/identify?` +
      `geometry=${lng},${lat}&geometryType=esriGeometryPoint&sr=4326&` +
      `layers=all:7&tolerance=200&mapExtent=${mapExtent}&imageDisplay=400,400,96&` +
      `returnGeometry=false&f=json`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.results || data.results.length === 0) return null;

    // Parse all segments
    const segments: FDOTSegment[] = [];
    for (const result of data.results) {
      const attrs = result.attributes;
      if (attrs && attrs.AADT && Number(attrs.AADT) > 0) {
        segments.push({
          aadt: Number(attrs.AADT),
          year: Number(attrs.YEAR_) || 2024,
          roadway: attrs.ROADWAY || '',
          descTo: attrs.DESC_TO || '',
          descFrm: attrs.DESC_FRM || '',
        });
      }
    }

    // Find ROADWAY IDs that match this road name
    const matchingRoadwayIds = new Set<string>();
    for (const seg of segments) {
      // Check if DESC_TO or DESC_FRM mentions the road
      if (roadNamesMatch(seg.descTo, roadName) || roadNamesMatch(seg.descFrm, roadName)) {
        matchingRoadwayIds.add(seg.roadway);
      }
    }

    if (matchingRoadwayIds.size === 0) {
      console.log(`[FDOT] No ROADWAY match for "${roadName}"`);
      return null;
    }

    // Get all segments with matching ROADWAY IDs
    const matchingSegments = segments.filter(s => matchingRoadwayIds.has(s.roadway));

    // Find the best segment (most recent year, then highest AADT)
    let best: FDOTSegment | null = null;
    for (const seg of matchingSegments) {
      if (!best || seg.year > best.year || (seg.year === best.year && seg.aadt > best.aadt)) {
        best = seg;
      }
    }

    if (!best) return null;

    console.log(`[FDOT] Found VPD for "${roadName}": ${best.aadt} (${best.year})`);

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
        // Determine road name - use the most descriptive one
        let roadName = Array.from(names).find(n => !n.includes('Bridge') && n.length > 3) ||
                       Array.from(names)[0] ||
                       `Road ${roadway}`;

        // Clean up the name
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
    const propertyStreet = address ? extractStreetName(address) : null;
    console.log(`[Traffic] Property street: ${propertyStreet}`);

    // STEP 2: Find adjacent roads from OpenStreetMap
    const osmRoads = await findAdjacentRoads(lat, lng, parcelBoundary);
    console.log(`[Traffic] OSM adjacent roads: ${osmRoads.join(', ') || 'none'}`);

    // STEP 3: Get all FDOT roads in the area
    const allFDOTRoads = await fetchAllFDOTRoads(lat, lng);

    // STEP 4: Match property street with FDOT data using ROADWAY ID approach
    const matchedRoads: RoadVPD[] = [];
    const matchedRoadwayIds = new Set<string>();

    // First, search for property street directly in FDOT raw data
    // This uses the ROADWAY ID matching approach (more accurate)
    if (propertyStreet) {
      const propertyRoad = await fetchFDOTForRoad(lat, lng, propertyStreet);
      if (propertyRoad && propertyRoad.roadwayId) {
        matchedRoads.push({
          ...propertyRoad,
          roadName: propertyStreet,
        });
        matchedRoadwayIds.add(propertyRoad.roadwayId);
        console.log(`[Traffic] Matched property street "${propertyStreet}" to ROADWAY ${propertyRoad.roadwayId}: ${propertyRoad.vpd} VPD`);
      }
    }

    // Then match OSM roads
    for (const osmRoad of osmRoads) {
      for (const fdotRoad of allFDOTRoads) {
        if (roadNamesMatch(fdotRoad.roadName, osmRoad) &&
            fdotRoad.roadwayId &&
            !matchedRoadwayIds.has(fdotRoad.roadwayId)) {
          matchedRoads.push({
            ...fdotRoad,
            roadName: osmRoad, // Use OSM name (cleaner)
          });
          matchedRoadwayIds.add(fdotRoad.roadwayId);
          break;
        }
      }
    }

    // If no matches found, use the top FDOT roads (closest/highest VPD)
    if (matchedRoads.length === 0 && allFDOTRoads.length > 0) {
      // Take top 2 roads by VPD
      const topRoads = allFDOTRoads.slice(0, 2);
      matchedRoads.push(...topRoads);
      console.log(`[Traffic] No matches, using top FDOT roads`);
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
