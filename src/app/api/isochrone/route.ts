import { NextRequest, NextResponse } from 'next/server';

export interface IsochronePolygon {
  timeMinutes: number;
  coordinates: Array<[number, number]>; // Array of [lat, lng] forming polygon boundary
  areaSquareMiles: number;
}

export interface IsochroneResponse {
  // Drive-time polygons
  polygons: {
    fiveMinute: IsochronePolygon;
    tenMinute: IsochronePolygon;
    fifteenMinute: IsochronePolygon;
  };

  // Center point
  origin: {
    lat: number;
    lng: number;
  };

  // Trade area analysis
  tradeAreaAnalysis: {
    fiveMinute: { estimatedPopulation: number; estimatedHouseholds: number };
    tenMinute: { estimatedPopulation: number; estimatedHouseholds: number };
    fifteenMinute: { estimatedPopulation: number; estimatedHouseholds: number };
  };

  // Comparison to radius method
  radiusComparison: {
    fiveMinuteEquivalentMiles: number;
    tenMinuteEquivalentMiles: number;
    fifteenMinuteEquivalentMiles: number;
    urbanDensity: 'urban' | 'suburban' | 'rural';
  };

  // Traffic context
  trafficContext: string;

  source: string;
}

interface TomTomIsochroneGeometry {
  type: string;
  coordinates: number[][][];
}

interface TomTomIsochroneResponse {
  reachableRange: {
    center: { latitude: number; longitude: number };
    boundary: Array<{ latitude: number; longitude: number }>;
  };
}

async function fetchTomTomIsochrone(
  lat: number,
  lng: number,
  timeMinutes: number
): Promise<{ coordinates: Array<[number, number]>; areaSquareMiles: number } | null> {
  const apiKey = process.env.TOMTOM_API_KEY;

  if (!apiKey) {
    console.log('TomTom API key not configured');
    return null;
  }

  try {
    // TomTom Routing API - Calculate Reachable Range
    // https://developer.tomtom.com/routing-api/documentation/routing/calculate-reachable-range
    const timeBudgetSeconds = timeMinutes * 60;
    const url = `https://api.tomtom.com/routing/1/calculateReachableRange/${lat},${lng}/json?key=${apiKey}&timeBudgetInSec=${timeBudgetSeconds}&travelMode=car`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error(`TomTom API error: ${response.status}`);
      return null;
    }

    const data: TomTomIsochroneResponse = await response.json();

    if (!data.reachableRange?.boundary) {
      return null;
    }

    // Convert boundary points to [lat, lng] array
    const coordinates: Array<[number, number]> = data.reachableRange.boundary.map(
      (point) => [point.latitude, point.longitude]
    );

    // Calculate approximate area using shoelace formula
    const areaSquareMiles = calculatePolygonArea(coordinates);

    return { coordinates, areaSquareMiles };
  } catch (error) {
    console.error('TomTom isochrone error:', error);
    return null;
  }
}

function calculatePolygonArea(coords: Array<[number, number]>): number {
  if (coords.length < 3) return 0;

  // Shoelace formula for polygon area
  // Note: This is approximate for geographic coordinates
  let area = 0;
  const n = coords.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    // Convert to approximate miles (at mid-latitudes, 1 degree ~ 69 miles lat, ~54 miles lng)
    const lat1 = coords[i][0];
    const lng1 = coords[i][1];
    const lat2 = coords[j][0];
    const lng2 = coords[j][1];

    area += lng1 * lat2 - lng2 * lat1;
  }

  // Convert from degree^2 to square miles (approximate)
  const avgLat = coords.reduce((sum, c) => sum + c[0], 0) / n;
  const latMiles = 69;
  const lngMiles = 69 * Math.cos(avgLat * Math.PI / 180);

  return Math.abs(area / 2) * latMiles * lngMiles;
}

function generateFallbackIsochrone(
  lat: number,
  lng: number,
  timeMinutes: number,
  density: 'urban' | 'suburban' | 'rural'
): { coordinates: Array<[number, number]>; areaSquareMiles: number } {
  // Estimate radius based on average drive speed
  const avgSpeeds = {
    urban: 15, // mph in urban areas
    suburban: 30, // mph in suburban areas
    rural: 45, // mph in rural areas
  };

  const avgSpeed = avgSpeeds[density];
  const radiusMiles = (avgSpeed * timeMinutes) / 60;

  // Convert miles to degrees (approximate)
  const latDegPerMile = 1 / 69;
  const lngDegPerMile = 1 / (69 * Math.cos(lat * Math.PI / 180));

  const latRadius = radiusMiles * latDegPerMile;
  const lngRadius = radiusMiles * lngDegPerMile;

  // Generate circular polygon (16 points)
  const coordinates: Array<[number, number]> = [];
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * 2 * Math.PI;
    coordinates.push([
      lat + latRadius * Math.cos(angle),
      lng + lngRadius * Math.sin(angle),
    ]);
  }

  const areaSquareMiles = Math.PI * radiusMiles * radiusMiles;

  return { coordinates, areaSquareMiles };
}

async function determineUrbanDensity(lat: number, lng: number): Promise<'urban' | 'suburban' | 'rural'> {
  try {
    // Use OSM to check nearby building/road density
    const query = `
      [out:json][timeout:10];
      (
        way["building"](around:1000,${lat},${lng});
        way["highway"~"primary|secondary|tertiary"](around:1000,${lat},${lng});
      );
      out count;
    `;

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    if (!response.ok) {
      return 'suburban'; // Default
    }

    const data = await response.json();
    const count = data.elements?.[0]?.tags?.total || 0;

    if (count > 200) return 'urban';
    if (count > 50) return 'suburban';
    return 'rural';
  } catch {
    return 'suburban';
  }
}

function estimatePopulation(areaSquareMiles: number, density: 'urban' | 'suburban' | 'rural'): {
  estimatedPopulation: number;
  estimatedHouseholds: number;
} {
  // Average population density per square mile
  const densities = {
    urban: 10000,
    suburban: 3000,
    rural: 500,
  };

  const avgHouseholdSize = {
    urban: 2.1,
    suburban: 2.5,
    rural: 2.3,
  };

  const estimatedPopulation = Math.round(areaSquareMiles * densities[density]);
  const estimatedHouseholds = Math.round(estimatedPopulation / avgHouseholdSize[density]);

  return { estimatedPopulation, estimatedHouseholds };
}

function calculateEquivalentRadius(areaSquareMiles: number): number {
  // A = πr² → r = √(A/π)
  return Math.round(Math.sqrt(areaSquareMiles / Math.PI) * 100) / 100;
}

export async function POST(request: NextRequest) {
  try {
    const { lat, lng } = await request.json();

    if (!lat || !lng) {
      return NextResponse.json({ error: 'Coordinates required' }, { status: 400 });
    }

    const density = await determineUrbanDensity(lat, lng);

    // Fetch all isochrones in parallel
    const [fiveMin, tenMin, fifteenMin] = await Promise.all([
      fetchTomTomIsochrone(lat, lng, 5),
      fetchTomTomIsochrone(lat, lng, 10),
      fetchTomTomIsochrone(lat, lng, 15),
    ]);

    // Use fallbacks if API fails
    const fiveMinute = fiveMin || generateFallbackIsochrone(lat, lng, 5, density);
    const tenMinute = tenMin || generateFallbackIsochrone(lat, lng, 10, density);
    const fifteenMinute = fifteenMin || generateFallbackIsochrone(lat, lng, 15, density);

    const response: IsochroneResponse = {
      polygons: {
        fiveMinute: {
          timeMinutes: 5,
          coordinates: fiveMinute.coordinates,
          areaSquareMiles: Math.round(fiveMinute.areaSquareMiles * 100) / 100,
        },
        tenMinute: {
          timeMinutes: 10,
          coordinates: tenMinute.coordinates,
          areaSquareMiles: Math.round(tenMinute.areaSquareMiles * 100) / 100,
        },
        fifteenMinute: {
          timeMinutes: 15,
          coordinates: fifteenMinute.coordinates,
          areaSquareMiles: Math.round(fifteenMinute.areaSquareMiles * 100) / 100,
        },
      },
      origin: { lat, lng },
      tradeAreaAnalysis: {
        fiveMinute: estimatePopulation(fiveMinute.areaSquareMiles, density),
        tenMinute: estimatePopulation(tenMinute.areaSquareMiles, density),
        fifteenMinute: estimatePopulation(fifteenMinute.areaSquareMiles, density),
      },
      radiusComparison: {
        fiveMinuteEquivalentMiles: calculateEquivalentRadius(fiveMinute.areaSquareMiles),
        tenMinuteEquivalentMiles: calculateEquivalentRadius(tenMinute.areaSquareMiles),
        fifteenMinuteEquivalentMiles: calculateEquivalentRadius(fifteenMinute.areaSquareMiles),
        urbanDensity: density,
      },
      trafficContext: fiveMin
        ? 'Drive times calculated with current traffic conditions'
        : `Estimated based on ${density} area average speeds`,
      source: fiveMin ? 'TomTom Routing API' : 'Estimated (TomTom API unavailable)',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Isochrone error:', error);
    return NextResponse.json({ error: 'Failed to calculate drive-time areas' }, { status: 500 });
  }
}
