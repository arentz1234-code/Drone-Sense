import * as turf from '@turf/turf';

export interface AccessPoint {
  coordinates: [number, number]; // [lat, lng]
  roadName: string;
  type: 'entrance' | 'exit' | 'access';
  roadType?: string;
}

export interface RoadGeometry {
  name: string;
  type: string;
  coordinates: Array<[number, number]>; // Array of [lat, lng]
}

/**
 * Find where roads intersect with a parcel boundary
 */
export function findAccessPoints(
  parcelBoundary: Array<[number, number]>, // Array of [lat, lng]
  roads: RoadGeometry[]
): AccessPoint[] {
  if (!parcelBoundary || parcelBoundary.length < 3 || !roads || roads.length === 0) {
    return [];
  }

  const accessPoints: AccessPoint[] = [];
  const seenCoords = new Set<string>();

  // Convert parcel boundary to GeoJSON polygon (Turf uses [lng, lat])
  const parcelCoords = parcelBoundary.map(([lat, lng]) => [lng, lat] as [number, number]);
  // Close the polygon if not already closed
  if (parcelCoords[0][0] !== parcelCoords[parcelCoords.length - 1][0] ||
      parcelCoords[0][1] !== parcelCoords[parcelCoords.length - 1][1]) {
    parcelCoords.push(parcelCoords[0]);
  }

  const parcelPolygon = turf.polygon([parcelCoords]);
  const parcelLineResult = turf.polygonToLine(parcelPolygon);
  // polygonToLine returns Feature for simple polygons, FeatureCollection for polygons with holes
  const parcelLine = parcelLineResult.type === 'FeatureCollection'
    ? parcelLineResult.features[0]
    : parcelLineResult;

  for (const road of roads) {
    if (!road.coordinates || road.coordinates.length < 2) continue;

    // Convert road coordinates to GeoJSON line (Turf uses [lng, lat])
    const roadCoords = road.coordinates.map(([lat, lng]) => [lng, lat] as [number, number]);
    const roadLine = turf.lineString(roadCoords);

    // Find intersections between road and parcel boundary
    const intersections = turf.lineIntersect(roadLine, parcelLine);

    for (const intersection of intersections.features) {
      const [lng, lat] = intersection.geometry.coordinates;
      const coordKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;

      // Avoid duplicate points
      if (seenCoords.has(coordKey)) continue;
      seenCoords.add(coordKey);

      accessPoints.push({
        coordinates: [lat, lng],
        roadName: road.name || 'Unknown Road',
        type: 'access', // We can't determine direction without more data
        roadType: road.type,
      });
    }
  }

  return accessPoints;
}

/**
 * Find the nearest point on the parcel boundary to a road
 * Useful when roads don't directly intersect but are close
 */
export function findNearestAccessPoints(
  parcelBoundary: Array<[number, number]>,
  roads: RoadGeometry[],
  maxDistanceMeters: number = 50
): AccessPoint[] {
  if (!parcelBoundary || parcelBoundary.length < 3 || !roads || roads.length === 0) {
    return [];
  }

  const accessPoints: AccessPoint[] = [];
  const seenCoords = new Set<string>();

  // Convert parcel boundary to GeoJSON polygon
  const parcelCoords = parcelBoundary.map(([lat, lng]) => [lng, lat] as [number, number]);
  if (parcelCoords[0][0] !== parcelCoords[parcelCoords.length - 1][0] ||
      parcelCoords[0][1] !== parcelCoords[parcelCoords.length - 1][1]) {
    parcelCoords.push(parcelCoords[0]);
  }

  const parcelPolygon = turf.polygon([parcelCoords]);
  const parcelLineResult = turf.polygonToLine(parcelPolygon);
  // polygonToLine returns Feature for simple polygons, FeatureCollection for polygons with holes
  const parcelLine = parcelLineResult.type === 'FeatureCollection'
    ? parcelLineResult.features[0]
    : parcelLineResult;

  for (const road of roads) {
    if (!road.coordinates || road.coordinates.length < 2) continue;

    const roadCoords = road.coordinates.map(([lat, lng]) => [lng, lat] as [number, number]);
    const roadLine = turf.lineString(roadCoords);

    // First check for actual intersections
    const intersections = turf.lineIntersect(roadLine, parcelLine);

    if (intersections.features.length > 0) {
      for (const intersection of intersections.features) {
        const [lng, lat] = intersection.geometry.coordinates;
        const coordKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;

        if (seenCoords.has(coordKey)) continue;
        seenCoords.add(coordKey);

        accessPoints.push({
          coordinates: [lat, lng],
          roadName: road.name || 'Unknown Road',
          type: 'access',
          roadType: road.type,
        });
      }
    } else {
      // No intersection - find nearest point on parcel boundary to road
      // First get the parcel centroid to find the closest point on the road
      const parcelCentroid = turf.centroid(parcelPolygon);
      const nearestOnRoad = turf.nearestPointOnLine(roadLine, parcelCentroid);

      // Then find the nearest point on the parcel boundary to that road point
      const nearestOnParcel = turf.nearestPointOnLine(parcelLine, nearestOnRoad);

      const distance = turf.distance(
        nearestOnParcel,
        nearestOnRoad,
        { units: 'meters' }
      );

      if (distance <= maxDistanceMeters) {
        const [lng, lat] = nearestOnParcel.geometry.coordinates;
        const coordKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;

        if (seenCoords.has(coordKey)) continue;
        seenCoords.add(coordKey);

        accessPoints.push({
          coordinates: [lat, lng],
          roadName: road.name || 'Unknown Road',
          type: 'access',
          roadType: road.type,
        });
      }
    }
  }

  return accessPoints;
}

/**
 * Calculate the area of a polygon in square feet
 */
export function calculateArea(boundary: Array<[number, number]>): number {
  if (!boundary || boundary.length < 3) return 0;

  const coords = boundary.map(([lat, lng]) => [lng, lat] as [number, number]);
  if (coords[0][0] !== coords[coords.length - 1][0] ||
      coords[0][1] !== coords[coords.length - 1][1]) {
    coords.push(coords[0]);
  }

  const polygon = turf.polygon([coords]);
  const areaSquareMeters = turf.area(polygon);
  const areaSquareFeet = areaSquareMeters * 10.7639;

  return Math.round(areaSquareFeet);
}

/**
 * Get the centroid of a polygon
 */
export function getCentroid(boundary: Array<[number, number]>): [number, number] {
  if (!boundary || boundary.length < 3) {
    return boundary?.[0] || [0, 0];
  }

  const coords = boundary.map(([lat, lng]) => [lng, lat] as [number, number]);
  if (coords[0][0] !== coords[coords.length - 1][0] ||
      coords[0][1] !== coords[coords.length - 1][1]) {
    coords.push(coords[0]);
  }

  const polygon = turf.polygon([coords]);
  const centroid = turf.centroid(polygon);
  const [lng, lat] = centroid.geometry.coordinates;

  return [lat, lng];
}

/**
 * Buffer a polygon by a given distance
 */
export function bufferBoundary(
  boundary: Array<[number, number]>,
  distanceMeters: number
): Array<[number, number]> {
  if (!boundary || boundary.length < 3) return boundary;

  const coords = boundary.map(([lat, lng]) => [lng, lat] as [number, number]);
  if (coords[0][0] !== coords[coords.length - 1][0] ||
      coords[0][1] !== coords[coords.length - 1][1]) {
    coords.push(coords[0]);
  }

  const polygon = turf.polygon([coords]);
  const buffered = turf.buffer(polygon, distanceMeters, { units: 'meters' });

  if (!buffered || !buffered.geometry.coordinates[0]) {
    return boundary;
  }

  return buffered.geometry.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number]);
}
