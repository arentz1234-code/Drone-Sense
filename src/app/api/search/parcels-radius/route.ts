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

// Max parcels to return (for performance)
const MAX_TOTAL_PARCELS = 2000;

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

// Generate grid cells for large area searches
function generateGridCells(
  center: { lat: number; lng: number },
  radiusMiles: number,
  cellSizeMiles: number
): Array<{ lat: number; lng: number; size: number }> {
  const cells: Array<{ lat: number; lng: number; size: number }> = [];
  const { latDeg, lngDeg } = radiusToDegrees(radiusMiles, center.lat);
  const cellLatDeg = cellSizeMiles / 69.0;
  const cellLngDeg = cellSizeMiles / (69.0 * Math.cos(center.lat * Math.PI / 180));

  // Calculate grid dimensions
  const numCellsLat = Math.ceil((latDeg * 2) / cellLatDeg);
  const numCellsLng = Math.ceil((lngDeg * 2) / cellLngDeg);

  const startLat = center.lat - latDeg;
  const startLng = center.lng - lngDeg;

  for (let i = 0; i < numCellsLat; i++) {
    for (let j = 0; j < numCellsLng; j++) {
      const cellCenterLat = startLat + (i + 0.5) * cellLatDeg;
      const cellCenterLng = startLng + (j + 0.5) * cellLngDeg;

      // Only include cells that overlap with the circle
      const distToCenter = getDistanceMiles(center.lat, center.lng, cellCenterLat, cellCenterLng);
      // Cell diagonal is roughly cellSize * sqrt(2), so add some buffer
      if (distToCenter <= radiusMiles + cellSizeMiles * 0.75) {
        cells.push({
          lat: cellCenterLat,
          lng: cellCenterLng,
          size: cellSizeMiles,
        });
      }
    }
  }

  return cells;
}

// Fetch parcels from a single cell (ArcGIS)
async function fetchParcelsFromArcGISCell(
  cellCenter: { lat: number; lng: number },
  cellSizeMiles: number,
  mainCenter: { lat: number; lng: number },
  maxRadius: number
): Promise<ParcelResult[]> {
  try {
    const halfSize = cellSizeMiles / 2;
    const { latDeg, lngDeg } = radiusToDegrees(halfSize, cellCenter.lat);

    const envelope = JSON.stringify({
      xmin: cellCenter.lng - lngDeg,
      ymin: cellCenter.lat - latDeg,
      xmax: cellCenter.lng + lngDeg,
      ymax: cellCenter.lat + latDeg,
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
    url.searchParams.set('resultRecordCount', '1000');
    url.searchParams.set('f', 'json');

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(30000),
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

      // Check if within main radius (circle)
      const distance = getDistanceMiles(mainCenter.lat, mainCenter.lng, centroidLat, centroidLng);
      if (distance > maxRadius) continue;

      const attrs = feature.attributes || {};
      let lotSize = attrs.ACRES || attrs.GIS_ACRES;
      if (!lotSize) {
        const boundary: [number, number][] = coords.map((c: number[]) => [c[1], c[0]]);
        lotSize = calculatePolygonArea(boundary) / 43560;
      }

      parcels.push({
        parcelId: attrs.APN || attrs.PARCEL_ID || attrs.OBJECTID?.toString() || `parcel-${parcels.length}`,
        address: attrs.ADDR || attrs.SITEADDR || attrs.ADDRESS || 'Unknown Address',
        coordinates: { lat: centroidLat, lng: centroidLng },
        lotSize: lotSize ? Math.round(lotSize * 43560) : undefined,
        zoning: attrs.ZONING || attrs.ZONE_CODE,
      });
    }

    return parcels;
  } catch (error) {
    console.error('ArcGIS cell search error:', error);
    return [];
  }
}

// Fetch parcels from a single cell (Leon County)
async function fetchParcelsFromLeonCountyCell(
  cellCenter: { lat: number; lng: number },
  cellSizeMiles: number,
  mainCenter: { lat: number; lng: number },
  maxRadius: number
): Promise<ParcelResult[]> {
  try {
    const halfSize = cellSizeMiles / 2;
    const { latDeg, lngDeg } = radiusToDegrees(halfSize, cellCenter.lat);

    // Convert to Web Mercator
    const toWebMercator = (lat: number, lng: number) => {
      const x = lng * 20037508.34 / 180;
      let y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180);
      y = y * 20037508.34 / 180;
      return { x, y };
    };

    const sw = toWebMercator(cellCenter.lat - latDeg, cellCenter.lng - lngDeg);
    const ne = toWebMercator(cellCenter.lat + latDeg, cellCenter.lng + lngDeg);

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
    url.searchParams.set('resultRecordCount', '1000');
    url.searchParams.set('f', 'json');

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(30000),
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

      const distance = getDistanceMiles(mainCenter.lat, mainCenter.lng, centroidLat, centroidLng);
      if (distance > maxRadius) continue;

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
    console.error('Leon County cell search error:', error);
    return [];
  }
}

// Check if coordinates are in Leon County
function isInLeonCounty(center: { lat: number; lng: number }): boolean {
  return center.lat >= 30.26 && center.lat <= 30.70 &&
         center.lng >= -84.65 && center.lng <= -83.98;
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

    const useLeonCounty = isInLeonCounty(center);
    let allParcels: ParcelResult[] = [];
    let source = useLeonCounty ? 'Leon County GIS' : 'ArcGIS USA Parcels';

    // Determine cell size based on radius
    // Smaller radius = single query, larger radius = grid of smaller queries
    let cellSizeMiles: number;
    if (radiusMiles <= 0.5) {
      cellSizeMiles = radiusMiles * 2; // Single cell covers entire area
    } else if (radiusMiles <= 1) {
      cellSizeMiles = 0.75;
    } else if (radiusMiles <= 2) {
      cellSizeMiles = 1.0;
    } else if (radiusMiles <= 5) {
      cellSizeMiles = 1.5;
    } else {
      cellSizeMiles = 2.0;
    }

    const cells = generateGridCells(center, radiusMiles, cellSizeMiles);
    console.log(`[Radius Search] Generated ${cells.length} grid cells (cell size: ${cellSizeMiles} miles)`);

    // Process cells in batches for better performance
    const BATCH_SIZE = 4; // Process 4 cells concurrently
    const seenIds = new Set<string>();

    for (let i = 0; i < cells.length; i += BATCH_SIZE) {
      const batch = cells.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map(cell => {
        if (useLeonCounty) {
          return fetchParcelsFromLeonCountyCell(
            { lat: cell.lat, lng: cell.lng },
            cell.size,
            center,
            radiusMiles
          );
        } else {
          return fetchParcelsFromArcGISCell(
            { lat: cell.lat, lng: cell.lng },
            cell.size,
            center,
            radiusMiles
          );
        }
      });

      const batchResults = await Promise.all(batchPromises);

      // Deduplicate and add to results
      for (const cellParcels of batchResults) {
        for (const parcel of cellParcels) {
          if (!seenIds.has(parcel.parcelId)) {
            seenIds.add(parcel.parcelId);
            allParcels.push(parcel);
          }
        }
      }

      // Stop if we've hit the max
      if (allParcels.length >= MAX_TOTAL_PARCELS) {
        console.log(`[Radius Search] Hit max parcel limit (${MAX_TOTAL_PARCELS})`);
        break;
      }
    }

    // If Leon County returned nothing, try ArcGIS as fallback
    if (allParcels.length === 0 && useLeonCounty) {
      console.log('[Radius Search] Leon County returned no results, trying ArcGIS fallback');
      source = 'ArcGIS USA Parcels';

      for (let i = 0; i < cells.length; i += BATCH_SIZE) {
        const batch = cells.slice(i, i + BATCH_SIZE);

        const batchPromises = batch.map(cell =>
          fetchParcelsFromArcGISCell(
            { lat: cell.lat, lng: cell.lng },
            cell.size,
            center,
            radiusMiles
          )
        );

        const batchResults = await Promise.all(batchPromises);

        for (const cellParcels of batchResults) {
          for (const parcel of cellParcels) {
            if (!seenIds.has(parcel.parcelId)) {
              seenIds.add(parcel.parcelId);
              allParcels.push(parcel);
            }
          }
        }

        if (allParcels.length >= MAX_TOTAL_PARCELS) break;
      }
    }

    // Filter by property type if needed
    if (propertyType === 'vacant') {
      allParcels = allParcels.filter(p => {
        const zoning = (p.zoning || '').toUpperCase();
        return zoning.includes('VL') || zoning.includes('AG') ||
               zoning.includes('VAC') || !p.address || p.address === 'Unknown Address';
      });
    } else if (propertyType === 'commercial') {
      allParcels = allParcels.filter(p => {
        const zoning = (p.zoning || '').toUpperCase();
        return zoning.includes('C-') || zoning.includes('COM') ||
               zoning.includes('CR') || zoning.includes('CG') ||
               zoning.includes('CBD') || zoning.includes('MU');
      });
    }

    const searchTime = Date.now() - startTime;

    console.log(`[Radius Search] Found ${allParcels.length} parcels in ${searchTime}ms from ${source} (${cells.length} cells queried)`);

    return NextResponse.json({
      parcels: allParcels,
      totalCount: allParcels.length,
      source,
      searchTime,
      center,
      radiusMiles,
      gridCells: cells.length,
    });
  } catch (error) {
    console.error('Radius search error:', error);
    return NextResponse.json({
      error: 'Failed to search parcels',
      message: String(error)
    }, { status: 500 });
  }
}
