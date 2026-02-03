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
  // FDOT AADT data
  aadt: number | null;
  aadtYear: string | null;
  roadName: string | null;
  countyName: string | null;
  fdotDistance: string | null;
}

interface FDOTFeature {
  attributes: {
    AADT: number;
    AADTYEAR: number;
    ROADWAY: string;
    COUNTY: string;
    BEGINDESC: string;
    ENDDESC: string;
  };
  geometry: {
    x: number;
    y: number;
  };
}

async function getFDOTData(lat: number, lng: number): Promise<{
  aadt: number | null;
  aadtYear: string | null;
  roadName: string | null;
  countyName: string | null;
  distance: string | null;
}> {
  try {
    // Query FDOT's ArcGIS REST API for AADT data
    // Search within ~1 mile radius (0.015 degrees approximately)
    const searchRadius = 0.015;
    const geometry = JSON.stringify({
      xmin: lng - searchRadius,
      ymin: lat - searchRadius,
      xmax: lng + searchRadius,
      ymax: lat + searchRadius,
      spatialReference: { wkid: 4326 }
    });

    const fdotUrl = new URL('https://services1.arcgis.com/O1JpcwDW8sjYuddV/arcgis/rest/services/AADT_On_Florida_State_Highway_System/FeatureServer/0/query');
    fdotUrl.searchParams.set('where', '1=1');
    fdotUrl.searchParams.set('geometry', geometry);
    fdotUrl.searchParams.set('geometryType', 'esriGeometryEnvelope');
    fdotUrl.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
    fdotUrl.searchParams.set('outFields', 'AADT,AADTYEAR,ROADWAY,COUNTY,BEGINDESC,ENDDESC');
    fdotUrl.searchParams.set('returnGeometry', 'true');
    fdotUrl.searchParams.set('f', 'json');

    const response = await fetch(fdotUrl.toString());

    if (!response.ok) {
      console.error('FDOT API error:', response.status);
      return { aadt: null, aadtYear: null, roadName: null, countyName: null, distance: null };
    }

    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      return { aadt: null, aadtYear: null, roadName: null, countyName: null, distance: null };
    }

    // Find the closest feature
    let closestFeature: FDOTFeature | null = null;
    let closestDistance = Infinity;

    for (const feature of data.features as FDOTFeature[]) {
      if (feature.geometry) {
        const dx = feature.geometry.x - lng;
        const dy = feature.geometry.y - lat;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestFeature = feature;
        }
      }
    }

    if (!closestFeature) {
      return { aadt: null, aadtYear: null, roadName: null, countyName: null, distance: null };
    }

    // Convert distance to miles (rough approximation: 1 degree ≈ 69 miles)
    const distanceMiles = (closestDistance * 69).toFixed(2);

    return {
      aadt: closestFeature.attributes.AADT,
      aadtYear: closestFeature.attributes.AADTYEAR?.toString() || null,
      roadName: closestFeature.attributes.ROADWAY || null,
      countyName: closestFeature.attributes.COUNTY || null,
      distance: `${distanceMiles} mi`
    };
  } catch (error) {
    console.error('FDOT fetch error:', error);
    return { aadt: null, aadtYear: null, roadName: null, countyName: null, distance: null };
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

    // Fetch both TomTom and FDOT data in parallel
    const [tomtomResponse, fdotData] = await Promise.all([
      fetch(`https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json?point=${lat},${lng}&unit=MPH&thickness=1&key=${apiKey}`),
      getFDOTData(lat, lng)
    ]);

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

    const trafficData: TrafficData = {
      currentSpeed: Math.round(flowData.currentSpeed),
      freeFlowSpeed: Math.round(flowData.freeFlowSpeed),
      currentTravelTime: flowData.currentTravelTime,
      freeFlowTravelTime: flowData.freeFlowTravelTime,
      confidence: flowData.confidence || 0,
      roadType,
      trafficLevel,
      congestionPercent: Math.max(0, congestionPercent),
      // FDOT data
      aadt: fdotData.aadt,
      aadtYear: fdotData.aadtYear,
      roadName: fdotData.roadName,
      countyName: fdotData.countyName,
      fdotDistance: fdotData.distance,
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
