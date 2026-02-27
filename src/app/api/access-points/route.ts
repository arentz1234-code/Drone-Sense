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
 * Calculate angle between two points relative to horizontal
 */
function calculateBearing(from: [number, number], to: [number, number]): number {
  const dLon = to[0] - from[0];
  const dLat = to[1] - from[1];
  return Math.atan2(dLon, dLat) * 180 / Math.PI;
}

/**
 * Check if a road segment is roughly perpendicular to parcel edge (potential entrance)
 */
function isPerpendicularToEdge(
  roadPoint: [number, number],
  roadDirection: number,
  parcelEdgeStart: [number, number],
  parcelEdgeEnd: [number, number]
): boolean {
  const edgeDirection = calculateBearing(parcelEdgeStart, parcelEdgeEnd);
  const angleDiff = Math.abs(roadDirection - edgeDirection);
  const normalizedDiff = angleDiff % 180;
  // Check if roughly perpendicular (70-110 degrees)
  return normalizedDiff >= 70 && normalizedDiff <= 110;
}

/**
 * Find the nearest point on the parcel boundary to a given point
 */
function findNearestEdge(
  point: [number, number],
  parcelBoundary: Array<[number, number]>
): { start: [number, number]; end: [number, number]; distance: number } | null {
  let nearest: { start: [number, number]; end: [number, number]; distance: number } | null = null;

  for (let i = 0; i < parcelBoundary.length - 1; i++) {
    const start = parcelBoundary[i];
    const end = parcelBoundary[i + 1];

    // Calculate distance from point to line segment
    const A = point[0] - start[0];
    const B = point[1] - start[1];
    const C = end[0] - start[0];
    const D = end[1] - start[1];

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;
    if (param < 0) {
      xx = start[0];
      yy = start[1];
    } else if (param > 1) {
      xx = end[0];
      yy = end[1];
    } else {
      xx = start[0] + param * C;
      yy = start[1] + param * D;
    }

    const dx = point[0] - xx;
    const dy = point[1] - yy;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (!nearest || distance < nearest.distance) {
      nearest = { start, end, distance };
    }
  }

  return nearest;
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

    // First pass: Identify service roads (driveways) that connect main roads to the parcel
    // These are the most accurate indicators of actual entrance locations
    const serviceRoads = allRoads.filter(r => r.tags?.highway === 'service');
    const mainRoads = allRoads.filter(r => r.tags?.highway !== 'service');

    // Track which main roads have service road connections
    const mainRoadEntrances = new Map<string, { coords: [number, number]; distance: number }[]>();

    // Find where service roads connect main roads to the parcel
    for (const serviceRoad of serviceRoads) {
      const serviceCoords = serviceRoad.geometry;
      if (serviceCoords.length < 2) continue;

      // Check if service road enters the parcel
      let entersParcel = false;
      let entryPoint: { lat: number; lon: number } | null = null;

      for (let i = 0; i < serviceCoords.length; i++) {
        const geom = serviceCoords[i];
        const point = turf.point([geom.lon, geom.lat]);
        const isInside = turf.booleanPointInPolygon(point, parcelPolygon);

        if (isInside && !entersParcel) {
          // This is where the service road enters the parcel
          entersParcel = true;
          // Use the previous point (just outside) as the entrance, or current if first
          entryPoint = i > 0 ? serviceCoords[i - 1] : geom;
        }
      }

      // Also check start/end points for being near parcel boundary
      const startPoint = serviceCoords[0];
      const endPoint = serviceCoords[serviceCoords.length - 1];

      for (const endpoint of [startPoint, endPoint]) {
        const point = turf.point([endpoint.lon, endpoint.lat]);
        let distToBoundary: number;
        try {
          distToBoundary = turf.pointToLineDistance(point, parcelLine as GeoJSON.Feature<GeoJSON.LineString>, { units: 'meters' });
        } catch {
          continue;
        }

        // If endpoint is near parcel boundary (within 15m), this is likely a driveway entrance
        if (distToBoundary <= 15) {
          // Find which main road this service road connects to
          for (const mainRoad of mainRoads) {
            const mainRoadName = mainRoad.tags?.name || mainRoad.tags?.ref;
            if (!mainRoadName) continue;

            // Check if service road starts/ends near this main road
            for (const mainGeom of mainRoad.geometry) {
              const dx = endpoint.lon - mainGeom.lon;
              const dy = endpoint.lat - mainGeom.lat;
              const distToMain = Math.sqrt(dx * dx + dy * dy) * 111000; // Approx meters

              if (distToMain <= 25) {
                // This service road connects this main road to the parcel
                const entrances = mainRoadEntrances.get(mainRoadName) || [];
                // Use the other endpoint (the one near the parcel) as the entrance
                const nearParcelEndpoint = endpoint === startPoint ? endPoint : startPoint;
                entrances.push({
                  coords: [nearParcelEndpoint.lat, nearParcelEndpoint.lon],
                  distance: distToBoundary
                });
                mainRoadEntrances.set(mainRoadName, entrances);
                console.log(`[AccessPoints] Found driveway from ${mainRoadName} entering parcel`);
              }
            }
          }
        }
      }

      // If service road enters parcel, mark the entry point
      if (entersParcel && entryPoint) {
        const coordKey = `${entryPoint.lat.toFixed(5)},${entryPoint.lon.toFixed(5)}`;
        if (!seenCoords.has(coordKey)) {
          seenCoords.add(coordKey);

          // Find which main road this connects to
          let connectedRoadName = 'Unnamed Road';
          for (const mainRoad of mainRoads) {
            const mainRoadName = mainRoad.tags?.name || mainRoad.tags?.ref;
            if (!mainRoadName) continue;

            for (const mainGeom of mainRoad.geometry) {
              for (const serviceGeom of serviceCoords) {
                const dx = serviceGeom.lon - mainGeom.lon;
                const dy = serviceGeom.lat - mainGeom.lat;
                const dist = Math.sqrt(dx * dx + dy * dy) * 111000;
                if (dist <= 20) {
                  connectedRoadName = mainRoadName;
                  break;
                }
              }
              if (connectedRoadName !== 'Unnamed Road') break;
            }
            if (connectedRoadName !== 'Unnamed Road') break;
          }

          if (connectedRoadName !== 'Unnamed Road') {
            seenRoads.set(connectedRoadName, 0);
            accessPoints.push({
              coordinates: [entryPoint.lat, entryPoint.lon],
              roadName: connectedRoadName,
              type: 'entrance',
              roadType: 'service',
              distance: 0,
            });
            console.log(`[AccessPoints] Driveway entrance from ${connectedRoadName}`);
          }
        }
      }
    }

    // Process main roads - look for actual entrance points
    for (const road of mainRoads) {
      const roadCoords = road.geometry.map(g => [g.lon, g.lat] as [number, number]);
      const roadLine = turf.lineString(roadCoords);
      const roadName = road.tags?.name || road.tags?.ref || 'Unnamed Road';
      const roadType = road.tags?.highway || 'road';

      // If we already found a driveway entrance for this road, use that
      if (seenRoads.has(roadName)) continue;

      // Check if we found service road connections for this road
      const driveways = mainRoadEntrances.get(roadName);
      if (driveways && driveways.length > 0) {
        // Use the closest driveway entrance
        driveways.sort((a, b) => a.distance - b.distance);
        const best = driveways[0];
        const coordKey = `${best.coords[0].toFixed(5)},${best.coords[1].toFixed(5)}`;

        if (!seenCoords.has(coordKey)) {
          seenCoords.add(coordKey);
          seenRoads.set(roadName, best.distance);
          accessPoints.push({
            coordinates: best.coords,
            roadName,
            type: 'entrance',
            roadType,
            distance: best.distance,
          });
          console.log(`[AccessPoints] Using driveway entrance for ${roadName}`);
          continue;
        }
      }

      // Method 1: Check for direct intersection with parcel boundary
      // AND check if road direction is perpendicular (indicates entrance)
      try {
        const intersections = turf.lineIntersect(roadLine, parcelLine as GeoJSON.Feature<GeoJSON.LineString>);

        let bestIntersection: { coords: [number, number]; isPerpendicular: boolean } | null = null;

        for (const intersection of intersections.features) {
          const [lng, lat] = intersection.geometry.coordinates;

          // Find the road direction at this point
          let roadDirection = 0;
          for (let i = 0; i < road.geometry.length - 1; i++) {
            const g1 = road.geometry[i];
            const g2 = road.geometry[i + 1];
            const d1 = Math.abs(g1.lat - lat) + Math.abs(g1.lon - lng);
            const d2 = Math.abs(g2.lat - lat) + Math.abs(g2.lon - lng);
            if (d1 < 0.0001 || d2 < 0.0001) {
              roadDirection = calculateBearing([g1.lon, g1.lat], [g2.lon, g2.lat]);
              break;
            }
          }

          // Find nearest parcel edge
          const nearestEdge = findNearestEdge([lat, lng], parcelBoundary);
          const isPerpendicular = nearestEdge ?
            isPerpendicularToEdge([lat, lng], roadDirection, nearestEdge.start, nearestEdge.end) : false;

          if (!bestIntersection || isPerpendicular) {
            bestIntersection = { coords: [lat, lng], isPerpendicular };
          }
        }

        if (bestIntersection) {
          const coordKey = `${bestIntersection.coords[0].toFixed(5)},${bestIntersection.coords[1].toFixed(5)}`;
          if (!seenCoords.has(coordKey)) {
            seenCoords.add(coordKey);
            seenRoads.set(roadName, 0);
            accessPoints.push({
              coordinates: bestIntersection.coords,
              roadName,
              type: 'access',
              roadType,
              distance: 0,
            });
            console.log(`[AccessPoints] Direct intersection: ${roadName} (${roadType})${bestIntersection.isPerpendicular ? ' [perpendicular]' : ''}`);
          }
        }
      } catch (err) {
        // Intersection check failed, continue with proximity check
      }

      // Method 2: For roads that don't intersect, find the point closest to parcel
      // that is also perpendicular to the parcel edge (likely entrance)
      if (!seenRoads.has(roadName)) {
        let bestCandidate: { coords: [number, number]; distance: number; isPerpendicular: boolean } | null = null;

        for (let i = 0; i < road.geometry.length - 1; i++) {
          const geom = road.geometry[i];
          const nextGeom = road.geometry[i + 1];
          const point = turf.point([geom.lon, geom.lat]);

          let distance: number;
          try {
            distance = turf.pointToLineDistance(point, parcelLine as GeoJSON.Feature<GeoJSON.LineString>, { units: 'meters' });
          } catch {
            continue;
          }

          if (distance <= 20) { // Only roads within 20m of parcel boundary
            const roadDirection = calculateBearing([geom.lon, geom.lat], [nextGeom.lon, nextGeom.lat]);
            const nearestEdge = findNearestEdge([geom.lat, geom.lon], parcelBoundary);
            const isPerpendicular = nearestEdge ?
              isPerpendicularToEdge([geom.lat, geom.lon], roadDirection, nearestEdge.start, nearestEdge.end) : false;

            // Prioritize perpendicular points, then by distance
            if (!bestCandidate ||
                (isPerpendicular && !bestCandidate.isPerpendicular) ||
                (isPerpendicular === bestCandidate.isPerpendicular && distance < bestCandidate.distance)) {
              bestCandidate = { coords: [geom.lat, geom.lon], distance, isPerpendicular };
            }
          }
        }

        if (bestCandidate) {
          const coordKey = `${bestCandidate.coords[0].toFixed(5)},${bestCandidate.coords[1].toFixed(5)}`;
          if (!seenCoords.has(coordKey)) {
            seenCoords.add(coordKey);
            seenRoads.set(roadName, bestCandidate.distance);
            accessPoints.push({
              coordinates: bestCandidate.coords,
              roadName,
              type: 'access',
              roadType,
              distance: bestCandidate.distance,
            });
            console.log(`[AccessPoints] Proximity: ${roadName} (${roadType}) - ${Math.round(bestCandidate.distance)}m${bestCandidate.isPerpendicular ? ' [perpendicular]' : ''}`);
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

    // Road type priority (higher = more important)
    const roadTypePriority: Record<string, number> = {
      'motorway': 10, 'motorway_link': 9,
      'trunk': 8, 'trunk_link': 7,
      'primary': 6, 'primary_link': 5,
      'secondary': 4, 'secondary_link': 3,
      'tertiary': 2, 'tertiary_link': 1,
      'residential': 0, 'unclassified': -1,
      'living_street': -2, 'service': -3,
    };

    for (const ap of accessPoints) {
      // Skip unnamed roads - these are typically service roads, parking lots, driveways
      if (ap.roadName === 'Unnamed Road' || ap.roadName.toLowerCase().includes('unnamed')) {
        continue;
      }

      // Skip service roads unless they're named (actual driveways vs parking lot aisles)
      if (ap.roadType === 'service' && !ap.roadName.match(/\d|drive|entrance|exit/i)) {
        continue;
      }

      // Only keep the best (closest) access point for each unique road
      const existing = uniqueRoads.get(ap.roadName);
      if (!existing || (ap.distance || 0) < (existing.distance || Infinity)) {
        uniqueRoads.set(ap.roadName, ap);
      }
    }

    // Convert to array and sort by road importance
    let deduped = Array.from(uniqueRoads.values());

    // Sort by road type priority (most important first), then by distance
    deduped.sort((a, b) => {
      const priorityA = roadTypePriority[a.roadType || 'unclassified'] ?? -1;
      const priorityB = roadTypePriority[b.roadType || 'unclassified'] ?? -1;
      if (priorityA !== priorityB) return priorityB - priorityA;
      return (a.distance || 0) - (b.distance || 0);
    });

    // Limit to maximum 4 access points (most properties don't have more than 4 road frontages)
    // This prevents cluttered maps at complex intersections
    if (deduped.length > 4) {
      console.log(`[AccessPoints] Limiting from ${deduped.length} to 4 most important roads`);
      deduped = deduped.slice(0, 4);
    }

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
