import { NextResponse } from 'next/server';
import * as turf from '@turf/turf';

interface AccessPointsRequest {
  parcelBoundary: Array<[number, number]>;
  coordinates: { lat: number; lng: number };
}

interface AccessPoint {
  coordinates: [number, number];
  roadName: string;
  type: 'entrance' | 'exit' | 'access';
  roadType?: string;
  distance?: number; // Distance from parcel boundary in meters
  vpd?: number; // Official VPD from FDOT if available
  vpdYear?: number; // Year of VPD count
  vpdSource?: 'fdot' | 'estimated'; // Source of VPD data
  estimatedVpd?: number; // Estimated VPD based on road classification
}

interface AccessPointsResponse {
  accessPoints: AccessPoint[];
  roadCount: number;
  roads: Array<{ name: string; type: string; vpd?: number; vpdSource?: string }>;
  totalVpd: number;
  primaryRoadVpd: number;
  primaryRoadName: string;
}

// VPD estimates based on OSM highway classification (fallback when no FDOT data)
const ROAD_TYPE_VPD: Record<string, { min: number; max: number; avg: number }> = {
  motorway: { min: 40000, max: 150000, avg: 75000 },
  motorway_link: { min: 20000, max: 80000, avg: 40000 },
  trunk: { min: 20000, max: 60000, avg: 35000 },
  trunk_link: { min: 10000, max: 40000, avg: 20000 },
  primary: { min: 10000, max: 35000, avg: 20000 },
  primary_link: { min: 8000, max: 25000, avg: 15000 },
  secondary: { min: 5000, max: 20000, avg: 12000 },
  secondary_link: { min: 4000, max: 15000, avg: 8000 },
  tertiary: { min: 2000, max: 10000, avg: 5000 },
  tertiary_link: { min: 1500, max: 8000, avg: 4000 },
  residential: { min: 500, max: 3000, avg: 1500 },
  unclassified: { min: 200, max: 2000, avg: 800 },
  living_street: { min: 100, max: 500, avg: 250 },
  service: { min: 50, max: 500, avg: 200 },
};

/**
 * Fetch FDOT AADT data at specific coordinates
 */
async function fetchFDOTAtPoint(lat: number, lng: number, roadName?: string): Promise<{ vpd: number; year: number } | null> {
  try {
    // Query FDOT GIS at the exact access point location
    const radius = 0.0015; // ~165m search radius
    const mapExtent = `${lng - radius},${lat - radius},${lng + radius},${lat + radius}`;
    const url = `https://gis.fdot.gov/arcgis/rest/services/FTO/fto_PROD/MapServer/identify?` +
      `geometry=${lng},${lat}&geometryType=esriGeometryPoint&sr=4326&` +
      `layers=all:7&tolerance=30&mapExtent=${mapExtent}&imageDisplay=400,400,96&` +
      `returnGeometry=false&f=json`;

    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.results || data.results.length === 0) return null;

    // Find the best matching segment
    let bestMatch: { vpd: number; year: number } | null = null;
    let bestScore = -1;

    for (const result of data.results) {
      const attrs = result.attributes;
      if (!attrs || !attrs.AADT || Number(attrs.AADT) <= 0) continue;

      const vpd = Number(attrs.AADT);
      const year = Number(attrs.YEAR_) || 2024;

      // Score based on road name match and recency
      let score = year; // Base score is year (more recent = better)

      // If road name provided, check for match in FDOT fields
      if (roadName) {
        const normalizedSearch = roadName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const fdotRoadName = (attrs.ROAD_NAME || attrs.ROADNAME || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const descTo = (attrs.DESC_TO || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const descFrm = (attrs.DESC_FRM || '').toLowerCase().replace(/[^a-z0-9]/g, '');

        // PRIORITY 1: ROAD_NAME field is the actual road name - strongest match
        if (fdotRoadName && (fdotRoadName.includes(normalizedSearch) || normalizedSearch.includes(fdotRoadName))) {
          score += 2000; // Highest priority - this IS the road
        }
        // PRIORITY 2: DESC_TO/DESC_FRM are cross-streets - weaker signal
        // Only use if BOTH fields mention the road (suggests it's the main road, not just crossing)
        else if ((descTo.includes(normalizedSearch) || normalizedSearch.includes(descTo)) &&
                 (descFrm.includes(normalizedSearch) || normalizedSearch.includes(descFrm))) {
          score += 1000; // Both endpoints mention this road - likely the main road
        }
        // Note: Single DESC_TO/DESC_FRM match no longer gives bonus (was causing wrong matching)
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = { vpd, year };
      }
    }

    return bestMatch;
  } catch (error) {
    console.log(`[AccessPoints] FDOT fetch error at ${lat},${lng}:`, error);
    return null;
  }
}

interface OSMWay {
  type: 'way';
  id: number;
  nodes: number[];
  geometry: Array<{ lat: number; lon: number }>;
  tags?: {
    highway?: string;
    name?: string;
    ref?: string;
    service?: string;
  };
}

interface OSMData {
  elements: OSMWay[];
}

/**
 * Find all access points by checking road intersections and proximity to parcel boundary
 */
async function findAccessPoints(
  lat: number,
  lng: number,
  parcelBoundary: Array<[number, number]>,
  radiusMeters: number = 150
): Promise<{ accessPoints: AccessPoint[]; allRoads: OSMWay[] }> {
  try {
    // Multiple Overpass API endpoints for redundancy
    const overpassServers = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    ];

    // Query for all road types that could provide access
    const query = `
      [out:json][timeout:15];
      (
        // All road types
        way["highway"~"motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|residential|unclassified|living_street|service"](around:${radiusMeters},${lat},${lng});
      );
      out body geom;
    `;

    let data: OSMData | null = null;

    // Try each server until one succeeds
    for (const overpassUrl of overpassServers) {
      try {
        console.log(`[AccessPoints] Trying Overpass server: ${overpassUrl}`);
        const response = await fetch(overpassUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(12000),
        });

        if (response.ok) {
          data = await response.json();
          console.log(`[AccessPoints] Got response from ${overpassUrl}`);
          break;
        } else {
          console.log(`[AccessPoints] ${overpassUrl} returned ${response.status}`);
        }
      } catch (err) {
        console.log(`[AccessPoints] ${overpassUrl} failed: ${err}`);
      }
    }

    if (!data) {
      console.error('[AccessPoints] All Overpass servers failed');
      return { accessPoints: [], allRoads: [] };
    }

    // Collect all roads with valid geometry
    const allRoads: OSMWay[] = [];
    for (const element of data.elements || []) {
      if (element.type === 'way' && element.geometry && element.geometry.length >= 2) {
        allRoads.push(element);
      }
    }

    console.log(`[AccessPoints] Found ${allRoads.length} roads`);

    // Convert parcel boundary to Turf polygon and line
    const parcelCoords = parcelBoundary.map(([lat, lng]) => [lng, lat] as [number, number]);
    if (parcelCoords[0][0] !== parcelCoords[parcelCoords.length - 1][0] ||
        parcelCoords[0][1] !== parcelCoords[parcelCoords.length - 1][1]) {
      parcelCoords.push(parcelCoords[0]);
    }
    const parcelPolygon = turf.polygon([parcelCoords]);
    const parcelLineResult = turf.polygonToLine(parcelPolygon);
    const parcelLine = parcelLineResult.type === 'FeatureCollection'
      ? parcelLineResult.features[0]
      : parcelLineResult;

    const accessPoints: AccessPoint[] = [];
    const seenCoords = new Set<string>();
    const seenRoads = new Map<string, number>(); // Track best distance per road

    // Process each road
    for (const road of allRoads) {
      const roadCoords = road.geometry.map(g => [g.lon, g.lat] as [number, number]);
      const roadLine = turf.lineString(roadCoords);
      const roadName = road.tags?.name || road.tags?.ref || 'Unnamed Road';
      const roadType = road.tags?.highway || 'road';

      // Skip internal parking/service roads unless they're the only option
      const isServiceRoad = roadType === 'service';

      // Method 1: Check for direct intersection with parcel boundary
      try {
        const intersections = turf.lineIntersect(roadLine, parcelLine as GeoJSON.Feature<GeoJSON.LineString>);

        for (const intersection of intersections.features) {
          const [lng, lat] = intersection.geometry.coordinates;
          const coordKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;

          if (seenCoords.has(coordKey)) continue;

          // Check if this road already has a better (closer) access point
          const existingDist = seenRoads.get(roadName);
          if (existingDist !== undefined && existingDist <= 0) continue;

          seenCoords.add(coordKey);
          seenRoads.set(roadName, 0); // Distance 0 = direct intersection

          accessPoints.push({
            coordinates: [lat, lng],
            roadName,
            type: 'access',
            roadType,
            distance: 0,
          });

          console.log(`[AccessPoints] Direct intersection: ${roadName} (${roadType})`);
        }
      } catch (err) {
        // Intersection check failed, continue with proximity check
      }

      // Method 2: Check for road segments inside or very close to parcel
      for (let i = 0; i < road.geometry.length; i++) {
        const geom = road.geometry[i];
        const point = turf.point([geom.lon, geom.lat]);

        // Check if point is inside parcel
        const isInside = turf.booleanPointInPolygon(point, parcelPolygon);

        // Check distance to parcel boundary
        let distance: number;
        try {
          distance = turf.pointToLineDistance(point, parcelLine as GeoJSON.Feature<GeoJSON.LineString>, { units: 'meters' });
        } catch {
          continue;
        }

        // For points inside, use negative distance to prioritize them
        const effectiveDistance = isInside ? -distance : distance;

        // Include if inside parcel or within 20 meters of boundary
        if (isInside || distance <= 20) {
          const coordKey = `${geom.lat.toFixed(5)},${geom.lon.toFixed(5)}`;
          if (seenCoords.has(coordKey)) continue;

          // Check if this road already has a better access point
          const existingDist = seenRoads.get(roadName);
          if (existingDist !== undefined && existingDist <= effectiveDistance) continue;

          // Skip service roads if we already have a non-service road access
          if (isServiceRoad && seenRoads.size > 0) {
            const hasPublicRoad = Array.from(seenRoads.keys()).some(name => {
              const ap = accessPoints.find(a => a.roadName === name);
              return ap && ap.roadType !== 'service';
            });
            if (hasPublicRoad) continue;
          }

          seenCoords.add(coordKey);
          seenRoads.set(roadName, effectiveDistance);

          accessPoints.push({
            coordinates: [geom.lat, geom.lon],
            roadName,
            type: 'access',
            roadType,
            distance: Math.max(0, distance),
          });

          console.log(`[AccessPoints] ${isInside ? 'Inside parcel' : 'Proximity'}: ${roadName} (${roadType}) - ${Math.round(distance)}m`);
        }
      }

      // Method 3: Find nearest point on road to parcel (for roads that don't touch)
      if (!seenRoads.has(roadName)) {
        let minDistance = Infinity;
        let nearestPoint: [number, number] | null = null;

        // Sample points along the parcel boundary
        for (const [pLat, pLng] of parcelBoundary) {
          const parcelPoint = turf.point([pLng, pLat]);
          try {
            const nearestOnRoad = turf.nearestPointOnLine(roadLine, parcelPoint);
            const dist = turf.distance(parcelPoint, nearestOnRoad, { units: 'meters' });

            if (dist < minDistance) {
              minDistance = dist;
              nearestPoint = nearestOnRoad.geometry.coordinates as [number, number];
            }
          } catch {
            continue;
          }
        }

        // Include if within 30 meters (potential access from adjacent lot)
        if (nearestPoint && minDistance <= 30) {
          const coordKey = `${nearestPoint[1].toFixed(5)},${nearestPoint[0].toFixed(5)}`;

          if (!seenCoords.has(coordKey)) {
            // Skip service roads for distant access
            if (!isServiceRoad || allRoads.filter(r => r.tags?.highway !== 'service').length === 0) {
              seenCoords.add(coordKey);
              seenRoads.set(roadName, minDistance);

              accessPoints.push({
                coordinates: [nearestPoint[1], nearestPoint[0]],
                roadName,
                type: 'access',
                roadType,
                distance: minDistance,
              });

              console.log(`[AccessPoints] Nearest point: ${roadName} (${roadType}) - ${Math.round(minDistance)}m`);
            }
          }
        }
      }
    }

    // Sort access points: direct intersections first, then by distance
    accessPoints.sort((a, b) => {
      // Prioritize non-service roads
      const aIsService = a.roadType === 'service';
      const bIsService = b.roadType === 'service';
      if (aIsService !== bIsService) return aIsService ? 1 : -1;

      // Then by distance
      return (a.distance || 0) - (b.distance || 0);
    });

    // Keep only ONE access point per unique road name
    // This ensures clean labeling with only unique roads shown
    const uniqueRoads = new Map<string, AccessPoint>();

    for (const ap of accessPoints) {
      // Skip unnamed roads - these are typically service roads, parking lots, driveways
      if (ap.roadName === 'Unnamed Road' || ap.roadName.toLowerCase().includes('unnamed')) {
        continue;
      }

      // Only keep the best (closest) access point for each unique road
      const existing = uniqueRoads.get(ap.roadName);
      if (!existing || (ap.distance || 0) < (existing.distance || Infinity)) {
        uniqueRoads.set(ap.roadName, ap);
      }
    }

    // Convert to array
    const deduped = Array.from(uniqueRoads.values());

    console.log(`[AccessPoints] Final: ${deduped.length} unique roads (from ${accessPoints.length} candidates)`);

    return { accessPoints: deduped, allRoads };
  } catch (error) {
    console.error('[AccessPoints] Error finding access points:', error);
    return { accessPoints: [], allRoads: [] };
  }
}

export async function POST(request: Request) {
  try {
    const body: AccessPointsRequest = await request.json();
    const { parcelBoundary, coordinates } = body;

    if (!parcelBoundary || parcelBoundary.length < 3) {
      return NextResponse.json({ error: 'Invalid parcel boundary' }, { status: 400 });
    }

    if (!coordinates || !coordinates.lat || !coordinates.lng) {
      return NextResponse.json({ error: 'Coordinates required' }, { status: 400 });
    }

    // Calculate parcel area and perimeter to determine search radius
    const parcelCoords = parcelBoundary.map(([lat, lng]) => [lng, lat] as [number, number]);
    if (parcelCoords[0][0] !== parcelCoords[parcelCoords.length - 1][0] ||
        parcelCoords[0][1] !== parcelCoords[parcelCoords.length - 1][1]) {
      parcelCoords.push(parcelCoords[0]);
    }
    const parcelPolygon = turf.polygon([parcelCoords]);
    const parcelAreaSqMeters = turf.area(parcelPolygon);

    // If parcel is very small (< 500 sq meters), it's likely just a building footprint
    // Buffer it to approximate the lot
    let effectiveBoundary = parcelBoundary;
    if (parcelAreaSqMeters < 500) {
      console.log(`[AccessPoints] Very small parcel (${Math.round(parcelAreaSqMeters)} sq m), buffering to approximate lot`);
      const bufferedParcel = turf.buffer(parcelPolygon, 0.02, { units: 'kilometers' }); // 20m buffer
      if (bufferedParcel) {
        effectiveBoundary = bufferedParcel.geometry.coordinates[0].map(
          ([lng, lat]) => [lat, lng] as [number, number]
        );
      }
    }

    // Calculate search radius based on parcel size (larger parcels need larger radius)
    const parcelDiagonal = Math.sqrt(parcelAreaSqMeters);
    const searchRadius = Math.max(100, Math.min(300, parcelDiagonal * 1.5));

    console.log(`[AccessPoints] Processing parcel with ${parcelBoundary.length} vertices (${Math.round(parcelAreaSqMeters)} sq m) at ${coordinates.lat},${coordinates.lng}, radius: ${Math.round(searchRadius)}m`);

    // Find all access points
    const { accessPoints, allRoads } = await findAccessPoints(
      coordinates.lat,
      coordinates.lng,
      effectiveBoundary,
      searchRadius
    );

    // Get unique roads with their best access point (for VPD lookup)
    // Filter out unnamed roads
    const roadAccessPoints = new Map<string, AccessPoint>();
    for (const ap of accessPoints) {
      // Skip unnamed roads
      if (ap.roadName === 'Unnamed Road' || ap.roadName.toLowerCase().includes('unnamed')) {
        continue;
      }
      const existing = roadAccessPoints.get(ap.roadName);
      // Keep the access point with smallest distance (closest to boundary)
      if (!existing || (ap.distance || 0) < (existing.distance || Infinity)) {
        roadAccessPoints.set(ap.roadName, ap);
      }
    }

    console.log(`[AccessPoints] Found ${accessPoints.length} access points from ${roadAccessPoints.size} unique roads`);

    // Fetch FDOT VPD data for each unique road at its access point location
    const roadVPDMap = new Map<string, { vpd: number; year: number; source: 'fdot' | 'estimated' }>();

    // Fetch FDOT data in parallel (limit concurrency)
    const fdotPromises = Array.from(roadAccessPoints.entries()).map(async ([roadName, ap]) => {
      const [lat, lng] = ap.coordinates;
      const fdotData = await fetchFDOTAtPoint(lat, lng, roadName);

      if (fdotData) {
        console.log(`[AccessPoints] FDOT VPD for "${roadName}" at ${lat.toFixed(5)},${lng.toFixed(5)}: ${fdotData.vpd} (${fdotData.year})`);
        roadVPDMap.set(roadName, { vpd: fdotData.vpd, year: fdotData.year, source: 'fdot' });
      } else {
        // Fallback to estimated VPD based on road type
        const roadType = ap.roadType || 'unclassified';
        const estimated = ROAD_TYPE_VPD[roadType]?.avg || ROAD_TYPE_VPD['unclassified'].avg;
        console.log(`[AccessPoints] No FDOT data for "${roadName}", using estimate: ${estimated} (${roadType})`);
        roadVPDMap.set(roadName, { vpd: estimated, year: 0, source: 'estimated' });
      }
    });

    await Promise.all(fdotPromises);

    // Enrich access points with VPD data
    const enrichedAccessPoints: AccessPoint[] = accessPoints.map(ap => {
      const vpdData = roadVPDMap.get(ap.roadName);
      const roadType = ap.roadType || 'unclassified';
      const estimatedVpd = ROAD_TYPE_VPD[roadType]?.avg || ROAD_TYPE_VPD['unclassified'].avg;

      return {
        ...ap,
        vpd: vpdData?.vpd,
        vpdYear: vpdData?.year,
        vpdSource: vpdData?.source,
        estimatedVpd,
      };
    });

    // Build roads summary with VPD
    const roadsSummary = Array.from(roadAccessPoints.entries()).map(([name, ap]) => {
      const vpdData = roadVPDMap.get(name);
      return {
        name,
        type: ap.roadType || 'road',
        vpd: vpdData?.vpd,
        vpdSource: vpdData?.source === 'fdot' ? 'Florida DOT AADT' : 'Estimated',
      };
    }).sort((a, b) => (b.vpd || 0) - (a.vpd || 0));

    // Calculate totals
    const totalVpd = roadsSummary.reduce((sum, r) => sum + (r.vpd || 0), 0);
    const primaryRoad = roadsSummary[0];

    console.log(`[AccessPoints] VPD Summary: Primary="${primaryRoad?.name}" (${primaryRoad?.vpd}), Total=${totalVpd}`);

    const response: AccessPointsResponse = {
      accessPoints: enrichedAccessPoints,
      roadCount: roadAccessPoints.size,
      roads: roadsSummary,
      totalVpd,
      primaryRoadVpd: primaryRoad?.vpd || 0,
      primaryRoadName: primaryRoad?.name || 'Unknown',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[AccessPoints] API error:', error);
    return NextResponse.json({
      error: 'Failed to calculate access points',
      message: String(error)
    }, { status: 500 });
  }
}
