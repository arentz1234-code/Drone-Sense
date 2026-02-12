import { NextRequest, NextResponse } from 'next/server';

interface ParcelRadiusRequest {
  center: { lat: number; lng: number };
  radiusMiles: number;
  propertyType?: 'all' | 'vacant' | 'commercial';
}

interface ParcelResult {
  parcelId: string;
  address: string;
  coordinates: { lat: number; lng: number };
  lotSize?: number;
  zoning?: string;
}

// Earth radius in miles
const EARTH_RADIUS_MILES = 3959;

// Calculate distance between two points using Haversine formula
function getDistanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Convert radius to approximate degrees for bounding box
function radiusToDegrees(radiusMiles: number, lat: number): { latDeg: number; lngDeg: number } {
  const latDeg = radiusMiles / 69.0; // ~69 miles per degree latitude
  const lngDeg = radiusMiles / (69.0 * Math.cos(lat * Math.PI / 180));
  return { latDeg, lngDeg };
}

// Calculate polygon area using Shoelace formula
function calculatePolygonArea(coords: [number, number][]): number {
  if (coords.length < 3) return 0;

  const centerLat = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = 111320 * Math.cos(centerLat * Math.PI / 180);

  const metersCoords = coords.map(([lat, lng]) => [
    lat * metersPerDegreeLat,
    lng * metersPerDegreeLng
  ]);

  let area = 0;
  for (let i = 0; i < metersCoords.length - 1; i++) {
    area += metersCoords[i][1] * metersCoords[i + 1][0];
    area -= metersCoords[i + 1][1] * metersCoords[i][0];
  }
  area = Math.abs(area) / 2;

  const sqft = area * 10.7639;
  return sqft;
}

// Fetch parcels from ArcGIS USA Parcels
async function fetchParcelsFromArcGIS(
  center: { lat: number; lng: number },
  radiusMiles: number
): Promise<ParcelResult[]> {
  try {
    const { latDeg, lngDeg } = radiusToDegrees(radiusMiles, center.lat);

    const envelope = JSON.stringify({
      xmin: center.lng - lngDeg,
      ymin: center.lat - latDeg,
      xmax: center.lng + lngDeg,
      ymax: center.lat + latDeg,
      spatialReference: { wkid: 4326 }
    });

    const url = new URL('https://services2.arcgis.com/FiaPA4ga0iQKduv3/ArcGIS/rest/services/USA_Parcels_SubDivision/FeatureServer/0/query');
    url.searchParams.set('where', '1=1');
    url.searchParams.set('geometry', envelope);
    url.searchParams.set('geometryType', 'esriGeometryEnvelope');
    url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
    url.searchParams.set('outFields', 'APN,PARCEL_ID,OWNER,ADDR,SITEADDR,ADDRESS,ACRES,GIS_ACRES,ZONING,ZONE_CODE,LANDUSE,OBJECTID');
    url.searchParams.set('returnGeometry', 'true');
    url.searchParams.set('outSR', '4326');
    url.searchParams.set('resultRecordCount', '500');
    url.searchParams.set('f', 'json');

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return [];

    const data = await response.json();
    if (data.error || !data.features) return [];

    const parcels: ParcelResult[] = [];

    for (const feature of data.features) {
      const rings = feature.geometry?.rings;
      if (!rings || rings.length === 0) continue;

      // Calculate centroid
      const coords = rings[0];
      const centroidLng = coords.reduce((sum: number, c: number[]) => sum + c[0], 0) / coords.length;
      const centroidLat = coords.reduce((sum: number, c: number[]) => sum + c[1], 0) / coords.length;

      // Check if within radius (circle, not just bounding box)
      const distance = getDistanceMiles(center.lat, center.lng, centroidLat, centroidLng);
      if (distance > radiusMiles) continue;

      const attrs = feature.attributes || {};
      let lotSize = attrs.ACRES || attrs.GIS_ACRES;
      if (!lotSize) {
        const boundary: [number, number][] = coords.map((c: number[]) => [c[1], c[0]]);
        lotSize = calculatePolygonArea(boundary) / 43560; // Convert sqft to acres
      }

      parcels.push({
        parcelId: attrs.APN || attrs.PARCEL_ID || attrs.OBJECTID?.toString() || `parcel-${parcels.length}`,
        address: attrs.ADDR || attrs.SITEADDR || attrs.ADDRESS || 'Unknown Address',
        coordinates: { lat: centroidLat, lng: centroidLng },
        lotSize: lotSize ? Math.round(lotSize * 43560) : undefined, // Store as sqft
        zoning: attrs.ZONING || attrs.ZONE_CODE,
      });
    }

    return parcels;
  } catch (error) {
    console.error('ArcGIS radius search error:', error);
    return [];
  }
}

// Fetch from Florida county GIS services
async function fetchParcelsFromFloridaCounty(
  center: { lat: number; lng: number },
  radiusMiles: number
): Promise<ParcelResult[]> {
  // Determine which county based on coordinates
  const isLeonCounty = center.lat >= 30.26 && center.lat <= 30.70 &&
                       center.lng >= -84.65 && center.lng <= -83.98;

  if (!isLeonCounty) return [];

  try {
    const { latDeg, lngDeg } = radiusToDegrees(radiusMiles, center.lat);

    // Convert to Web Mercator for Leon County
    const toWebMercator = (lat: number, lng: number) => {
      const x = lng * 20037508.34 / 180;
      let y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180);
      y = y * 20037508.34 / 180;
      return { x, y };
    };

    const sw = toWebMercator(center.lat - latDeg, center.lng - lngDeg);
    const ne = toWebMercator(center.lat + latDeg, center.lng + lngDeg);

    const envelope = JSON.stringify({
      xmin: sw.x,
      ymin: sw.y,
      xmax: ne.x,
      ymax: ne.y,
      spatialReference: { wkid: 102100 }
    });

    const url = new URL('https://intervector.leoncountyfl.gov/intervector/rest/services/MapServices/TLC_OverlayParnal_D_WM/MapServer/0/query');
    url.searchParams.set('where', '1=1');
    url.searchParams.set('geometry', envelope);
    url.searchParams.set('geometryType', 'esriGeometryEnvelope');
    url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
    url.searchParams.set('inSR', '102100');
    url.searchParams.set('outFields', '*');
    url.searchParams.set('returnGeometry', 'true');
    url.searchParams.set('outSR', '4326');
    url.searchParams.set('resultRecordCount', '500');
    url.searchParams.set('f', 'json');

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'DroneSense/1.0' }
    });

    if (!response.ok) return [];

    const data = await response.json();
    if (data.error || !data.features) return [];

    const parcels: ParcelResult[] = [];

    for (const feature of data.features) {
      const rings = feature.geometry?.rings;
      if (!rings || rings.length === 0) continue;

      const coords = rings[0];
      const centroidLng = coords.reduce((sum: number, c: number[]) => sum + c[0], 0) / coords.length;
      const centroidLat = coords.reduce((sum: number, c: number[]) => sum + c[1], 0) / coords.length;

      const distance = getDistanceMiles(center.lat, center.lng, centroidLat, centroidLng);
      if (distance > radiusMiles) continue;

      const attrs = feature.attributes || {};
      let lotSize = attrs.ACRES || attrs.ACREAGE || attrs.CALC_ACREA;
      if (!lotSize) {
        const boundary: [number, number][] = coords.map((c: number[]) => [c[1], c[0]]);
        lotSize = calculatePolygonArea(boundary) / 43560;
      }

      const address = attrs.SITEADDR || attrs.SITE_ADDR || attrs.ADDRESS ||
                     (attrs.STREET_NUM && attrs.STREET_NAME ? `${attrs.STREET_NUM} ${attrs.STREET_NAME}` : 'Unknown');

      parcels.push({
        parcelId: attrs.PARCELID || attrs.PARCEL_ID || attrs.PIN || attrs.STRAP || `parcel-${parcels.length}`,
        address,
        coordinates: { lat: centroidLat, lng: centroidLng },
        lotSize: lotSize ? Math.round(lotSize * 43560) : undefined,
        zoning: attrs.ZONING || attrs.ZONE_CODE,
      });
    }

    return parcels;
  } catch (error) {
    console.error('Florida county radius search error:', error);
    return [];
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: ParcelRadiusRequest = await request.json();
    const { center, radiusMiles, propertyType = 'all' } = body;

    if (!center || !center.lat || !center.lng) {
      return NextResponse.json({ error: 'Center coordinates required' }, { status: 400 });
    }

    if (!radiusMiles || radiusMiles <= 0 || radiusMiles > 10) {
      return NextResponse.json({ error: 'Radius must be between 0 and 10 miles' }, { status: 400 });
    }

    console.log(`[Radius Search] Center: ${center.lat}, ${center.lng}, Radius: ${radiusMiles} miles`);

    // Try Florida county GIS first (better data for FL)
    let parcels = await fetchParcelsFromFloridaCounty(center, radiusMiles);
    let source = 'Leon County GIS';

    // Fallback to ArcGIS
    if (parcels.length === 0) {
      parcels = await fetchParcelsFromArcGIS(center, radiusMiles);
      source = 'ArcGIS USA Parcels';
    }

    // Filter by property type if needed
    if (propertyType === 'vacant') {
      parcels = parcels.filter(p => {
        const zoning = (p.zoning || '').toUpperCase();
        return zoning.includes('VL') || zoning.includes('AG') ||
               zoning.includes('VAC') || !p.address || p.address === 'Unknown Address';
      });
    } else if (propertyType === 'commercial') {
      parcels = parcels.filter(p => {
        const zoning = (p.zoning || '').toUpperCase();
        return zoning.includes('C-') || zoning.includes('COM') ||
               zoning.includes('CR') || zoning.includes('CG') ||
               zoning.includes('CBD') || zoning.includes('MU');
      });
    }

    const searchTime = Date.now() - startTime;

    console.log(`[Radius Search] Found ${parcels.length} parcels in ${searchTime}ms from ${source}`);

    return NextResponse.json({
      parcels,
      totalCount: parcels.length,
      source,
      searchTime,
      center,
      radiusMiles,
    });
  } catch (error) {
    console.error('Radius search error:', error);
    return NextResponse.json({
      error: 'Failed to search parcels',
      message: String(error)
    }, { status: 500 });
  }
}
