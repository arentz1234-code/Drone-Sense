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
}

interface AccessPointsResponse {
  accessPoints: AccessPoint[];
  roadCount: number;
  roads: Array<{ name: string; type: string }>;
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
 * Check if a service road touches or crosses the parcel boundary
 */
function serviceRoadTouchesParcel(
  serviceRoad: OSMWay,
  parcelPolygon: GeoJSON.Feature<GeoJSON.Polygon>,
  parcelLine: GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString>
): { touches: boolean; intersectionPoint?: [number, number] } {
  if (!serviceRoad.geometry || serviceRoad.geometry.length < 2) {
    return { touches: false };
  }

  // Convert service road to line
  const roadCoords = serviceRoad.geometry.map(g => [g.lon, g.lat] as [number, number]);
  const roadLine = turf.lineString(roadCoords);

  // Check if road intersects parcel boundary
  const intersections = turf.lineIntersect(roadLine, parcelLine);
  if (intersections.features.length > 0) {
    const [lng, lat] = intersections.features[0].geometry.coordinates;
    return { touches: true, intersectionPoint: [lat, lng] };
  }

  // Check if any point of the road is inside the parcel
  for (const coord of roadCoords) {
    const point = turf.point(coord);
    if (turf.booleanPointInPolygon(point, parcelPolygon)) {
      return { touches: true };
    }
  }

  // Check if road comes very close to parcel boundary (within 2 meters)
  // This catches driveways that are mapped slightly off
  for (const geom of serviceRoad.geometry) {
    const point = turf.point([geom.lon, geom.lat]);
    // Cast to any to handle both LineString and MultiLineString
    const distance = turf.pointToLineDistance(point, parcelLine as GeoJSON.Feature<GeoJSON.LineString>, { units: 'meters' });
    if (distance < 2) {
      return { touches: true, intersectionPoint: [geom.lat, geom.lon] };
    }
  }

  return { touches: false };
}

/**
 * Find access points where driveways that touch the parcel connect to public roads
 */
async function findDrivewayAccessPoints(
  lat: number,
  lng: number,
  parcelBoundary: Array<[number, number]>,
  radiusMeters: number = 100
): Promise<{ accessPoints: AccessPoint[]; publicRoads: OSMWay[] }> {
  try {
    // Multiple Overpass API endpoints for redundancy
    const overpassServers = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    ];

    // Query for both public roads AND service roads/driveways
    const query = `
      [out:json][timeout:15];
      (
        // Public roads
        way["highway"~"primary|secondary|tertiary|trunk|residential|unclassified"](around:${radiusMeters},${lat},${lng});
        // Service roads, driveways, parking aisles
        way["highway"="service"](around:${radiusMeters},${lat},${lng});
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
      return { accessPoints: [], publicRoads: [] };
    }

    // Separate public roads from service roads
    const publicRoads: OSMWay[] = [];
    const serviceRoads: OSMWay[] = [];

    for (const element of data.elements || []) {
      if (element.type === 'way' && element.geometry && element.nodes) {
        const highway = element.tags?.highway;
        if (highway === 'service') {
          serviceRoads.push(element);
        } else if (highway) {
          publicRoads.push(element);
        }
      }
    }

    console.log(`[AccessPoints] Found ${publicRoads.length} public roads, ${serviceRoads.length} service roads`);

    // Convert parcel boundary to Turf polygon
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

    // Create a map of node IDs to their coordinates
    const nodeCoords: Map<number, [number, number]> = new Map();
    for (const way of [...publicRoads, ...serviceRoads]) {
      for (let i = 0; i < way.nodes.length; i++) {
        if (way.geometry[i]) {
          nodeCoords.set(way.nodes[i], [way.geometry[i].lat, way.geometry[i].lon]);
        }
      }
    }

    // Create set of node IDs for public roads
    const publicRoadNodes: Set<number> = new Set();
    for (const road of publicRoads) {
      for (const nodeId of road.nodes) {
        publicRoadNodes.add(nodeId);
      }
    }

    // Step 1: Find service roads that touch THIS parcel
    const parcelServiceRoads: OSMWay[] = [];
    for (const serviceRoad of serviceRoads) {
      const result = serviceRoadTouchesParcel(serviceRoad, parcelPolygon, parcelLine);
      if (result.touches) {
        parcelServiceRoads.push(serviceRoad);
      }
    }

    console.log(`[AccessPoints] ${parcelServiceRoads.length} service roads touch the parcel`);

    // Step 2: For each service road that touches the parcel, find where it connects to public roads
    const accessPoints: AccessPoint[] = [];
    const seenCoords = new Set<string>();

    for (const serviceRoad of parcelServiceRoads) {
      for (let i = 0; i < serviceRoad.nodes.length; i++) {
        const nodeId = serviceRoad.nodes[i];

        // If this node is shared with a public road, it's an access point
        if (publicRoadNodes.has(nodeId)) {
          const coords = nodeCoords.get(nodeId);
          if (!coords) continue;

          const [nodeLat, nodeLng] = coords;
          const coordKey = `${nodeLat.toFixed(5)},${nodeLng.toFixed(5)}`;
          if (seenCoords.has(coordKey)) continue;
          seenCoords.add(coordKey);

          // Find which public road this connects to
          let connectedRoad: OSMWay | null = null;
          for (const publicRoad of publicRoads) {
            if (publicRoad.nodes.includes(nodeId)) {
              connectedRoad = publicRoad;
              break;
            }
          }

          const roadName = connectedRoad?.tags?.name ||
                         connectedRoad?.tags?.ref ||
                         'Unnamed Road';

          accessPoints.push({
            coordinates: [nodeLat, nodeLng],
            roadName,
            type: 'access',
            roadType: connectedRoad?.tags?.highway,
          });

          console.log(`[AccessPoints] Found access point at ${nodeLat.toFixed(5)},${nodeLng.toFixed(5)} -> ${roadName}`);
        }
      }
    }

    // Fallback: If no shared nodes found, check for close proximity connections
    if (accessPoints.length === 0 && parcelServiceRoads.length > 0) {
      console.log('[AccessPoints] No shared nodes, checking proximity connections...');

      for (const serviceRoad of parcelServiceRoads) {
        // Check endpoints of service roads
        const endpoints = [0, serviceRoad.geometry.length - 1];

        for (const idx of endpoints) {
          const geom = serviceRoad.geometry[idx];
          if (!geom) continue;

          const endPoint = turf.point([geom.lon, geom.lat]);

          // Check distance to each public road
          for (const publicRoad of publicRoads) {
            const roadCoords = publicRoad.geometry.map(g => [g.lon, g.lat] as [number, number]);
            if (roadCoords.length < 2) continue;

            const roadLine = turf.lineString(roadCoords);
            const distanceToRoad = turf.pointToLineDistance(endPoint, roadLine, { units: 'meters' });

            if (distanceToRoad < 5) {
              const coordKey = `${geom.lat.toFixed(5)},${geom.lon.toFixed(5)}`;
              if (seenCoords.has(coordKey)) continue;
              seenCoords.add(coordKey);

              const roadName = publicRoad.tags?.name ||
                             publicRoad.tags?.ref ||
                             'Unnamed Road';

              accessPoints.push({
                coordinates: [geom.lat, geom.lon],
                roadName,
                type: 'access',
                roadType: publicRoad.tags?.highway,
              });

              console.log(`[AccessPoints] Found proximity access point -> ${roadName}`);
              break;
            }
          }
        }
      }
    }

    // Fallback: If still no access points, find nearest points on public roads to parcel boundary
    // This ensures we always show likely access locations
    if (accessPoints.length === 0 && publicRoads.length > 0) {
      console.log('[AccessPoints] No driveway connections found, finding nearest road points to parcel...');

      const roadDistances: Array<{
        lat: number;
        lng: number;
        distance: number;
        roadName: string;
        roadType?: string;
      }> = [];

      for (const publicRoad of publicRoads) {
        const roadCoords = publicRoad.geometry.map(g => [g.lon, g.lat] as [number, number]);
        if (roadCoords.length < 2) continue;

        const roadLine = turf.lineString(roadCoords);
        const roadName = publicRoad.tags?.name || publicRoad.tags?.ref || 'Unnamed Road';

        // Find the closest point on this road to the parcel boundary
        let minDistance = Infinity;
        let closestPoint: [number, number] | null = null;

        // Sample points along the parcel boundary
        for (const [pLat, pLng] of parcelBoundary) {
          const parcelPoint = turf.point([pLng, pLat]);
          const nearestOnRoad = turf.nearestPointOnLine(roadLine, parcelPoint);
          const dist = turf.distance(parcelPoint, nearestOnRoad, { units: 'meters' });

          if (dist < minDistance) {
            minDistance = dist;
            closestPoint = nearestOnRoad.geometry.coordinates as [number, number];
          }
        }

        // Only include if road is within 50 meters of parcel
        if (closestPoint && minDistance < 50) {
          roadDistances.push({
            lat: closestPoint[1],
            lng: closestPoint[0],
            distance: minDistance,
            roadName,
            roadType: publicRoad.tags?.highway,
          });
        }
      }

      // Sort by distance and take up to 3 closest unique roads
      roadDistances.sort((a, b) => a.distance - b.distance);
      const addedRoads = new Set<string>();

      for (const rd of roadDistances) {
        if (addedRoads.has(rd.roadName)) continue;
        addedRoads.add(rd.roadName);

        const coordKey = `${rd.lat.toFixed(5)},${rd.lng.toFixed(5)}`;
        if (seenCoords.has(coordKey)) continue;
        seenCoords.add(coordKey);

        accessPoints.push({
          coordinates: [rd.lat, rd.lng],
          roadName: rd.roadName,
          type: 'access',
          roadType: rd.roadType,
        });

        console.log(`[AccessPoints] Added fallback access point on ${rd.roadName} (${Math.round(rd.distance)}m from parcel)`);

        if (accessPoints.length >= 3) break;
      }
    }

    return { accessPoints, publicRoads };
  } catch (error) {
    console.error('[AccessPoints] Error finding driveway access points:', error);
    return { accessPoints: [], publicRoads: [] };
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

    // Calculate parcel area to detect if it's just a building footprint
    const parcelCoords = parcelBoundary.map(([lat, lng]) => [lng, lat] as [number, number]);
    if (parcelCoords[0][0] !== parcelCoords[parcelCoords.length - 1][0] ||
        parcelCoords[0][1] !== parcelCoords[parcelCoords.length - 1][1]) {
      parcelCoords.push(parcelCoords[0]);
    }
    const parcelPolygon = turf.polygon([parcelCoords]);
    const parcelAreaSqMeters = turf.area(parcelPolygon);

    // If parcel is very small (< 1000 sq meters), it's likely just a building footprint
    // Buffer it to approximate the lot
    let effectiveBoundary = parcelBoundary;
    if (parcelAreaSqMeters < 1000) {
      console.log(`[AccessPoints] Very small parcel (${Math.round(parcelAreaSqMeters)} sq m), buffering to approximate lot`);
      const bufferedParcel = turf.buffer(parcelPolygon, 0.03, { units: 'kilometers' }); // 30m buffer
      if (bufferedParcel) {
        effectiveBoundary = bufferedParcel.geometry.coordinates[0].map(
          ([lng, lat]) => [lat, lng] as [number, number]
        );
      }
    }

    console.log(`[AccessPoints] Processing parcel with ${parcelBoundary.length} vertices (${Math.round(parcelAreaSqMeters)} sq m) at ${coordinates.lat},${coordinates.lng}`);

    // Find access points for driveways that touch this parcel
    const { accessPoints, publicRoads } = await findDrivewayAccessPoints(
      coordinates.lat,
      coordinates.lng,
      effectiveBoundary,
      100 // Tighter radius for more accurate results
    );

    // Get unique roads
    const accessRoads = [...new Set(accessPoints.map(ap => ap.roadName))];

    console.log(`[AccessPoints] Found ${accessPoints.length} access points from ${accessRoads.length} roads`);

    const response: AccessPointsResponse = {
      accessPoints,
      roadCount: accessRoads.length,
      roads: publicRoads.map(r => ({
        name: r.tags?.name || r.tags?.ref || 'Unnamed Road',
        type: r.tags?.highway || 'road'
      })),
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
