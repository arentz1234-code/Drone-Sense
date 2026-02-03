import { NextResponse } from 'next/server';

interface TrafficRequest {
  coordinates: { lat: number; lng: number };
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

    // Fetch TomTom traffic flow data
    const tomtomResponse = await fetch(
      `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json?point=${lat},${lng}&unit=MPH&thickness=1&key=${apiKey}`
    );

    if (!tomtomResponse.ok) {
      const errorText = await tomtomResponse.text();
      console.error('TomTom API error:', tomtomResponse.status, errorText);
      return NextResponse.json({
        error: 'Failed to fetch traffic data',
        message: `API returned status ${tomtomResponse.status}`
      }, { status: tomtomResponse.status });
    }

    const data = await tomtomResponse.json();
    const flowData = data.flowSegmentData;

    if (!flowData) {
      return NextResponse.json({
        error: 'No traffic data available',
        message: 'No traffic information found for this location'
      }, { status: 404 });
    }

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

    // Estimate VPD based on road class and speed
    const vpdEstimate = estimateVPD(flowData.frc, flowData.freeFlowSpeed);

    const trafficData: TrafficData = {
      currentSpeed: Math.round(flowData.currentSpeed),
      freeFlowSpeed: Math.round(flowData.freeFlowSpeed),
      currentTravelTime: flowData.currentTravelTime,
      freeFlowTravelTime: flowData.freeFlowTravelTime,
      confidence: flowData.confidence || 0,
      roadType,
      trafficLevel,
      congestionPercent: Math.max(0, congestionPercent),
      // VPD estimate
      estimatedVPD: vpdEstimate.estimatedVPD,
      vpdRange: vpdEstimate.vpdRange,
      vpdSource: vpdEstimate.source,
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
