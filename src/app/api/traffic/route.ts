import { NextResponse } from 'next/server';

interface TrafficRequest {
  coordinates: { lat: number; lng: number };
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

// Fetch official AADT from Florida DOT's ArcGIS service
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
    let bestResult: FDOTAADTResult | null = null;
    for (const result of data.results) {
      const attrs = result.attributes;
      if (attrs && attrs.AADT && attrs.AADT > 0) {
        if (!bestResult || attrs.AADT > bestResult.aadt) {
          bestResult = {
            aadt: attrs.AADT,
            roadway: attrs.ROADWAY || 'Unknown Road',
            year: attrs.YEAR_ || new Date().getFullYear(),
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
    const { coordinates } = body;

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

    // Sample multiple points around the address to find nearby major roads
    // Extended radius to capture major roads that properties have access to
    const offsets = [
      { lat: 0, lng: 0 },           // Center point
      // ~55m in cardinal directions
      { lat: 0.0005, lng: 0 },
      { lat: -0.0005, lng: 0 },
      { lat: 0, lng: 0.0005 },
      { lat: 0, lng: -0.0005 },
      // ~110m in cardinal directions
      { lat: 0.001, lng: 0 },
      { lat: -0.001, lng: 0 },
      { lat: 0, lng: 0.001 },
      { lat: 0, lng: -0.001 },
      // ~220m in cardinal directions (to reach nearby major roads)
      { lat: 0.002, lng: 0 },
      { lat: -0.002, lng: 0 },
      { lat: 0, lng: 0.002 },
      { lat: 0, lng: -0.002 },
      // ~330m in cardinal directions
      { lat: 0.003, lng: 0 },
      { lat: -0.003, lng: 0 },
      { lat: 0, lng: 0.003 },
      { lat: 0, lng: -0.003 },
      // Diagonal points at ~150m
      { lat: 0.001, lng: 0.001 },
      { lat: 0.001, lng: -0.001 },
      { lat: -0.001, lng: 0.001 },
      { lat: -0.001, lng: -0.001 },
      // Diagonal points at ~300m
      { lat: 0.002, lng: 0.002 },
      { lat: 0.002, lng: -0.002 },
      { lat: -0.002, lng: 0.002 },
      { lat: -0.002, lng: -0.002 },
    ];

    // Fetch traffic data for all sample points in parallel
    const results = await Promise.all(
      offsets.map(offset =>
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

    // Calculate VPD for each result and find the highest
    const resultsWithVPD = validResults.map(result => ({
      ...result,
      vpd: estimateVPD(result.frc, result.freeFlowSpeed)
    }));

    // Sort by VPD descending (highest first) to get the busiest road
    resultsWithVPD.sort((a, b) => b.vpd.estimatedVPD - a.vpd.estimatedVPD);

    // Use the road with the highest VPD
    const flowData = resultsWithVPD[0];

    console.log(`Found ${validResults.length} roads. Highest VPD: ${flowData.vpd.estimatedVPD} (${flowData.frc})`);
    console.log('All roads found:', resultsWithVPD.map(r => `${r.frc}: ${r.vpd.estimatedVPD} VPD`).join(', '));

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
    const roadType = frcMap[flowData.frc] || 'Road';

    // Check if location is in Florida (approximate bounds)
    const isInFlorida = lat >= 24.5 && lat <= 31.0 && lng >= -87.5 && lng <= -80.0;

    // Try to get official AADT from Florida DOT if in Florida
    let officialAADT: FDOTAADTResult | null = null;
    if (isInFlorida) {
      officialAADT = await fetchFloridaAADT(lat, lng);
    }

    // Use official AADT if available, otherwise use estimate
    const finalVPD = officialAADT ? officialAADT.aadt : flowData.vpd.estimatedVPD;
    const finalVPDSource = officialAADT
      ? `${officialAADT.source} - ${officialAADT.roadway} (${officialAADT.year})`
      : flowData.vpd.source + ' (highest nearby)';
    const finalVPDRange = officialAADT
      ? `Official count: ${officialAADT.aadt.toLocaleString()}`
      : flowData.vpd.vpdRange;

    // Use the VPD - official if available, otherwise estimated
    const trafficData: TrafficData = {
      currentSpeed: Math.round(flowData.currentSpeed),
      freeFlowSpeed: Math.round(flowData.freeFlowSpeed),
      currentTravelTime: flowData.currentTravelTime,
      freeFlowTravelTime: flowData.freeFlowTravelTime,
      confidence: flowData.confidence || 0,
      roadType: officialAADT ? officialAADT.roadway : roadType,
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
