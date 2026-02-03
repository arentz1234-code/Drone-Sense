import { NextResponse } from 'next/server';

interface TrafficRequest {
  coordinates: { lat: number; lng: number };
}

export interface TrafficData {
  currentSpeed: number;
  freeFlowSpeed: number;
  currentTravelTime: number;
  freeFlowTravelTime: number;
  confidence: number;
  roadType: string;
  trafficLevel: string;
  congestionPercent: number;
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

    // Use TomTom Traffic Flow API
    // Get traffic flow for roads near the coordinates
    const { lat, lng } = coordinates;

    // Create a small bounding box around the coordinates (roughly 0.5 mile radius)
    const delta = 0.008; // ~0.5 miles
    const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;

    const flowUrl = `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json?point=${lat},${lng}&unit=MPH&thickness=1&key=${apiKey}`;

    const response = await fetch(flowUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('TomTom API error:', response.status, errorText);
      return NextResponse.json({
        error: 'Failed to fetch traffic data',
        message: `API returned status ${response.status}`
      }, { status: response.status });
    }

    const data = await response.json();
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

    const trafficData: TrafficData = {
      currentSpeed: Math.round(flowData.currentSpeed),
      freeFlowSpeed: Math.round(flowData.freeFlowSpeed),
      currentTravelTime: flowData.currentTravelTime,
      freeFlowTravelTime: flowData.freeFlowTravelTime,
      confidence: flowData.confidence || 0,
      roadType,
      trafficLevel,
      congestionPercent: Math.max(0, congestionPercent),
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
