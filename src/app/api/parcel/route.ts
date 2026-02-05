import { NextResponse } from 'next/server';

interface ParcelRequest {
  coordinates: { lat: number; lng: number };
  address: string;
}

interface ParcelResponse {
  boundaries: Array<[number, number][]>;
  parcelInfo: {
    apn?: string;
    owner?: string;
    address?: string;
    acres?: number;
    sqft?: number;
    zoning?: string;
    landUse?: string;
    yearBuilt?: number;
  } | null;
  zoning: {
    code?: string;
    description?: string;
    allowedUses?: string[];
  } | null;
  source?: string;
}

// Calculate area of a polygon using the Shoelace formula
// Returns area in square feet
function calculatePolygonArea(coords: [number, number][]): number {
  if (coords.length < 3) return 0;

  // Convert lat/lng to approximate meters at this latitude
  const centerLat = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = 111320 * Math.cos(centerLat * Math.PI / 180);

  // Convert to meters
  const metersCoords = coords.map(([lat, lng]) => [
    lat * metersPerDegreeLat,
    lng * metersPerDegreeLng
  ]);

  // Shoelace formula
  let area = 0;
  for (let i = 0; i < metersCoords.length - 1; i++) {
    area += metersCoords[i][1] * metersCoords[i + 1][0];
    area -= metersCoords[i + 1][1] * metersCoords[i][0];
  }
  area = Math.abs(area) / 2;

  // Convert square meters to square feet
  return area * 10.7639;
}

// Fetch from Regrid's public tile endpoint
async function fetchParcelFromRegrid(lat: number, lng: number): Promise<ParcelResponse | null> {
  try {
    // Regrid has a public parcel lookup via their tiles API
    const url = `https://tiles.regrid.com/api/v1/parcel?lat=${lat}&lon=${lng}&token=public`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DroneSense/1.0',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.log('Regrid response not ok:', response.status);
      return null;
    }

    const data = await response.json();
    console.log('Regrid data:', JSON.stringify(data).slice(0, 500));

    if (!data.results || data.results.length === 0) return null;

    const parcel = data.results[0];
    const coords = parcel.geometry?.coordinates?.[0];
    const boundaries: Array<[number, number][]> = coords
      ? [coords.map((c: number[]) => [c[1], c[0]] as [number, number])]
      : [];

    // Get acreage from properties or calculate from geometry
    let acres = parcel.properties?.ll_gisacre;
    let sqft = parcel.properties?.ll_gissqft;

    if (!acres && boundaries.length > 0 && boundaries[0].length > 0) {
      sqft = calculatePolygonArea(boundaries[0]);
      acres = sqft / 43560;
    }

    return {
      boundaries,
      parcelInfo: {
        apn: parcel.properties?.parcelnumb,
        owner: parcel.properties?.owner,
        address: parcel.properties?.address,
        acres: acres ? Number(acres) : undefined,
        sqft: sqft ? Math.round(Number(sqft)) : undefined,
        zoning: parcel.properties?.zoning,
        landUse: parcel.properties?.usedesc,
      },
      zoning: parcel.properties?.zoning ? {
        code: parcel.properties.zoning,
        description: parcel.properties.zoning_description,
      } : null,
      source: 'Regrid',
    };
  } catch (error) {
    console.error('Regrid fetch error:', error);
    return null;
  }
}

// Fetch from ArcGIS USA Parcels layer - Living Atlas
async function fetchParcelFromArcGIS(lat: number, lng: number): Promise<ParcelResponse | null> {
  try {
    // Use the USA Parcels Feature Layer from ArcGIS Living Atlas
    // This is a different, more accessible endpoint
    const url = new URL('https://services2.arcgis.com/FiaPA4ga0iQKduv3/ArcGIS/rest/services/USA_Parcels_SubDivision/FeatureServer/0/query');
    url.searchParams.set('where', '1=1');
    url.searchParams.set('geometry', `${lng},${lat}`);
    url.searchParams.set('geometryType', 'esriGeometryPoint');
    url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
    url.searchParams.set('outFields', '*');
    url.searchParams.set('returnGeometry', 'true');
    url.searchParams.set('outSR', '4326');
    url.searchParams.set('f', 'json');

    const response = await fetch(url.toString());

    if (!response.ok) {
      console.log('ArcGIS response not ok:', response.status);
      return null;
    }

    const data = await response.json();
    console.log('ArcGIS data:', JSON.stringify(data).slice(0, 500));

    if (data.error) {
      console.log('ArcGIS error:', data.error);
      return null;
    }

    if (!data.features || data.features.length === 0) return null;

    const feature = data.features[0];
    const rings = feature.geometry?.rings;

    // Convert ArcGIS rings to Leaflet polygon format [lat, lng]
    const boundaries: Array<[number, number][]> = rings
      ? rings.map((ring: number[][]) =>
          ring.map((coord: number[]) => [coord[1], coord[0]] as [number, number])
        )
      : [];

    // Calculate area from geometry if not in attributes
    let acres = feature.attributes?.ACRES || feature.attributes?.GIS_ACRES;
    let sqft = feature.attributes?.SQFT;

    // If Shape__Area exists, it's in the spatial reference units (often square meters)
    if (!acres && feature.attributes?.Shape__Area) {
      // Shape__Area is typically in square meters for WGS84 projections
      sqft = feature.attributes.Shape__Area * 10.7639;
      acres = sqft / 43560;
    }

    // Calculate from polygon if still no acreage
    if (!acres && boundaries.length > 0 && boundaries[0].length > 0) {
      sqft = calculatePolygonArea(boundaries[0]);
      acres = sqft / 43560;
    }

    return {
      boundaries,
      parcelInfo: {
        apn: feature.attributes?.APN || feature.attributes?.PARCEL_ID || feature.attributes?.OBJECTID,
        owner: feature.attributes?.OWNER || feature.attributes?.OWNERNAME,
        address: feature.attributes?.ADDR || feature.attributes?.SITEADDR || feature.attributes?.ADDRESS,
        acres: acres ? Number(acres) : undefined,
        sqft: sqft ? Math.round(Number(sqft)) : undefined,
        zoning: feature.attributes?.ZONING || feature.attributes?.ZONE_CODE || feature.attributes?.ZONING_CODE,
        landUse: feature.attributes?.LANDUSE || feature.attributes?.LAND_USE || feature.attributes?.USE_CODE,
        yearBuilt: feature.attributes?.YEAR_BUILT || feature.attributes?.YEARBUILT,
      },
      zoning: feature.attributes?.ZONING ? {
        code: feature.attributes.ZONING,
        description: feature.attributes.ZONE_DESC || feature.attributes.ZONING_DESC,
      } : null,
      source: 'ArcGIS USA Parcels',
    };
  } catch (error) {
    console.error('ArcGIS fetch error:', error);
    return null;
  }
}

// Fetch from City of Auburn GIS (Alabama)
async function fetchParcelFromAuburnGIS(lat: number, lng: number): Promise<ParcelResponse | null> {
  try {
    // City of Auburn ArcGIS MapServer - Parcels layer
    // Layer 6 is Parcels_1K based on the service documentation
    const url = new URL('https://gis.auburnalabama.org/public/rest/services/Main/COABasemap/MapServer/6/query');
    url.searchParams.set('where', '1=1');
    url.searchParams.set('geometry', `${lng},${lat}`);
    url.searchParams.set('geometryType', 'esriGeometryPoint');
    url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
    url.searchParams.set('outFields', '*');
    url.searchParams.set('returnGeometry', 'true');
    url.searchParams.set('outSR', '4326');
    url.searchParams.set('f', 'json');

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'DroneSense/1.0' }
    });

    if (!response.ok) {
      console.log('Auburn GIS response not ok:', response.status);
      return null;
    }

    const data = await response.json();
    console.log('Auburn GIS data:', JSON.stringify(data).slice(0, 500));

    if (data.error || !data.features || data.features.length === 0) return null;

    const feature = data.features[0];
    const rings = feature.geometry?.rings;

    if (!rings || rings.length === 0) return null;

    const boundaries: Array<[number, number][]> = rings.map((ring: number[][]) =>
      ring.map((coord: number[]) => [coord[1], coord[0]] as [number, number])
    );

    // Get acreage from Auburn GIS fields (ACRES or ACRES_COUNTY)
    let acres = feature.attributes?.ACRES || feature.attributes?.ACRES_COUNTY;
    let sqft = feature.attributes?.Shape__Area;

    // Calculate from polygon if acres not available
    if (!acres && boundaries.length > 0 && boundaries[0].length > 0) {
      sqft = calculatePolygonArea(boundaries[0]);
      acres = sqft / 43560;
    } else if (acres && !sqft) {
      sqft = acres * 43560;
    }

    // Build address from components
    const addressParts = [
      feature.attributes?.STRNUM,
      feature.attributes?.STRNAM,
    ].filter(Boolean);
    const fullAddress = addressParts.length > 0
      ? addressParts.join(' ')
      : feature.attributes?.ADR1 || feature.attributes?.SITEADDR;

    return {
      boundaries,
      parcelInfo: {
        apn: feature.attributes?.PARCEL || feature.attributes?.PIN || feature.attributes?.OBJECTID?.toString(),
        owner: feature.attributes?.OWNER,
        address: fullAddress,
        acres: acres ? Number(acres) : undefined,
        sqft: sqft ? Math.round(Number(sqft)) : undefined,
        zoning: feature.attributes?.ZONING,
        landUse: feature.attributes?.HSCODE ? `Class ${feature.attributes.HSCODE}` : undefined,
        yearBuilt: feature.attributes?.YEAR_BUILT,
      },
      zoning: null,
      source: 'City of Auburn GIS',
    };
  } catch (error) {
    console.error('Auburn GIS fetch error:', error);
    return null;
  }
}

// Fetch from Lee County Alabama GIS
async function fetchParcelFromLeeCountyAL(lat: number, lng: number): Promise<ParcelResponse | null> {
  try {
    // Lee County Alabama parcel service via Alabama GIS
    const url = new URL('https://gisservices.alabama.gov/arcgis/rest/services/Parcels/LeeCounty_Parcels/MapServer/0/query');
    url.searchParams.set('where', '1=1');
    url.searchParams.set('geometry', `${lng},${lat}`);
    url.searchParams.set('geometryType', 'esriGeometryPoint');
    url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
    url.searchParams.set('outFields', '*');
    url.searchParams.set('returnGeometry', 'true');
    url.searchParams.set('outSR', '4326');
    url.searchParams.set('f', 'json');

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'DroneSense/1.0' }
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data.error || !data.features || data.features.length === 0) return null;

    const feature = data.features[0];
    const rings = feature.geometry?.rings;

    if (!rings || rings.length === 0) return null;

    const boundaries: Array<[number, number][]> = rings.map((ring: number[][]) =>
      ring.map((coord: number[]) => [coord[1], coord[0]] as [number, number])
    );

    let acres = feature.attributes?.ACRES || feature.attributes?.ACREAGE || feature.attributes?.CALCACRES;
    let sqft = feature.attributes?.SQFT || feature.attributes?.Shape__Area;

    if (!acres && boundaries.length > 0 && boundaries[0].length > 0) {
      sqft = calculatePolygonArea(boundaries[0]);
      acres = sqft / 43560;
    }

    return {
      boundaries,
      parcelInfo: {
        apn: feature.attributes?.PARCELID || feature.attributes?.PIN || feature.attributes?.PPIN,
        owner: feature.attributes?.OWNER || feature.attributes?.OWNERNAME,
        address: feature.attributes?.PROPADDR || feature.attributes?.SITEADDR,
        acres: acres ? Number(acres) : undefined,
        sqft: sqft ? Math.round(Number(sqft)) : undefined,
        zoning: feature.attributes?.ZONING,
        landUse: feature.attributes?.LANDUSE || feature.attributes?.PROPCLASS,
      },
      zoning: null,
      source: 'Lee County AL GIS',
    };
  } catch (error) {
    console.error('Lee County AL fetch error:', error);
    return null;
  }
}

// State GIS endpoints - many states publish parcel data through ArcGIS services
const STATE_GIS_ENDPOINTS: Record<string, { url: string; name: string }[]> = {
  // Alabama (rough bounding box: lat 30.2-35.0, lng -88.5 to -84.9)
  'AL': [
    { url: 'https://gisservices.alabama.gov/arcgis/rest/services/Parcels/Statewide_Parcels/MapServer/0/query', name: 'Alabama Statewide Parcels' },
  ],
  // Florida
  'FL': [
    { url: 'https://gis.fdot.gov/arcgis/rest/services/Parcels/FeatureServer/0/query', name: 'Florida DOT Parcels' },
  ],
  // Georgia
  'GA': [
    { url: 'https://services1.arcgis.com/2iUE8l8JKrP2tygQ/arcgis/rest/services/Georgia_Parcels/FeatureServer/0/query', name: 'Georgia Parcels' },
  ],
  // Texas
  'TX': [
    { url: 'https://services.arcgis.com/KTcxiTD9dsQw4r7Z/arcgis/rest/services/Texas_Parcels/FeatureServer/0/query', name: 'Texas Parcels' },
  ],
};

// Determine state from coordinates (rough approximation)
function getStateFromCoords(lat: number, lng: number): string | null {
  // Alabama
  if (lat >= 30.2 && lat <= 35.0 && lng >= -88.5 && lng <= -84.9) return 'AL';
  // Florida
  if (lat >= 24.5 && lat <= 31.0 && lng >= -87.6 && lng <= -80.0) return 'FL';
  // Georgia
  if (lat >= 30.4 && lat <= 35.0 && lng >= -85.6 && lng <= -80.8) return 'GA';
  // Texas
  if (lat >= 25.8 && lat <= 36.5 && lng >= -106.6 && lng <= -93.5) return 'TX';
  return null;
}

// Fetch from state-level GIS services
async function fetchParcelFromStateGIS(lat: number, lng: number): Promise<ParcelResponse | null> {
  const state = getStateFromCoords(lat, lng);
  if (!state || !STATE_GIS_ENDPOINTS[state]) return null;

  for (const endpoint of STATE_GIS_ENDPOINTS[state]) {
    try {
      const url = new URL(endpoint.url);
      url.searchParams.set('where', '1=1');
      url.searchParams.set('geometry', `${lng},${lat}`);
      url.searchParams.set('geometryType', 'esriGeometryPoint');
      url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
      url.searchParams.set('outFields', '*');
      url.searchParams.set('returnGeometry', 'true');
      url.searchParams.set('outSR', '4326');
      url.searchParams.set('f', 'json');

      const response = await fetch(url.toString(), {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'DroneSense/1.0' }
      });

      if (!response.ok) continue;

      const data = await response.json();
      console.log(`${endpoint.name} data:`, JSON.stringify(data).slice(0, 300));

      if (data.error || !data.features || data.features.length === 0) continue;

      const feature = data.features[0];
      const rings = feature.geometry?.rings;

      if (!rings || rings.length === 0) continue;

      const boundaries: Array<[number, number][]> = rings.map((ring: number[][]) =>
        ring.map((coord: number[]) => [coord[1], coord[0]] as [number, number])
      );

      let acres = feature.attributes?.ACRES || feature.attributes?.ACREAGE || feature.attributes?.GIS_ACRES || feature.attributes?.CALCACRES;
      let sqft = feature.attributes?.SQFT || feature.attributes?.Shape__Area;

      if (!acres && boundaries.length > 0 && boundaries[0].length > 0) {
        sqft = calculatePolygonArea(boundaries[0]);
        acres = sqft / 43560;
      }

      return {
        boundaries,
        parcelInfo: {
          apn: feature.attributes?.PARCELID || feature.attributes?.PIN || feature.attributes?.APN || feature.attributes?.PARCEL_ID,
          owner: feature.attributes?.OWNER || feature.attributes?.OWNERNAME || feature.attributes?.OWNER_NAME,
          address: feature.attributes?.SITEADDR || feature.attributes?.ADDRESS || feature.attributes?.PROP_ADDR || feature.attributes?.PROPADDR,
          acres: acres ? Number(acres) : undefined,
          sqft: sqft ? Math.round(Number(sqft)) : undefined,
          zoning: feature.attributes?.ZONING || feature.attributes?.ZONE_CODE,
          landUse: feature.attributes?.LANDUSE || feature.attributes?.LAND_USE || feature.attributes?.PROPCLASS || feature.attributes?.USE_CODE,
          yearBuilt: feature.attributes?.YEAR_BUILT || feature.attributes?.YEARBUILT,
        },
        zoning: feature.attributes?.ZONING ? {
          code: feature.attributes.ZONING,
          description: feature.attributes.ZONE_DESC,
        } : null,
        source: endpoint.name,
      };
    } catch (error) {
      console.error(`${endpoint.name} fetch error:`, error);
      continue;
    }
  }

  return null;
}

// Fetch from county-level ArcGIS services
async function fetchParcelFromCountyGIS(lat: number, lng: number): Promise<ParcelResponse | null> {
  // Try multiple county/regional GIS endpoints
  const countyEndpoints = [
    // USA National Parcels dataset
    'https://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services/USA_Parcels/FeatureServer/0/query',
    // ESRI Living Atlas USA Parcels
    'https://services2.arcgis.com/FiaPA4ga0iQKduv3/ArcGIS/rest/services/USA_Parcels_Boundaries/FeatureServer/0/query',
  ];

  for (const endpoint of countyEndpoints) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set('where', '1=1');
      url.searchParams.set('geometry', `${lng},${lat}`);
      url.searchParams.set('geometryType', 'esriGeometryPoint');
      url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
      url.searchParams.set('outFields', '*');
      url.searchParams.set('returnGeometry', 'true');
      url.searchParams.set('outSR', '4326');
      url.searchParams.set('f', 'json');

      const response = await fetch(url.toString(), {
        signal: AbortSignal.timeout(8000)
      });

      if (!response.ok) continue;

      const data = await response.json();
      if (data.error || !data.features || data.features.length === 0) continue;

      const feature = data.features[0];
      const rings = feature.geometry?.rings;

      if (!rings || rings.length === 0) continue;

      const boundaries: Array<[number, number][]> = rings.map((ring: number[][]) =>
        ring.map((coord: number[]) => [coord[1], coord[0]] as [number, number])
      );

      // Calculate area from geometry if not in attributes
      let acres = feature.attributes?.ACRES || feature.attributes?.ACREAGE || feature.attributes?.GIS_ACRES || feature.attributes?.ll_gisacre;
      let sqft = feature.attributes?.SQFT || feature.attributes?.Shape__Area || feature.attributes?.ll_gissqft;

      if (!acres && boundaries.length > 0 && boundaries[0].length > 0) {
        sqft = calculatePolygonArea(boundaries[0]);
        acres = sqft / 43560;
      }

      return {
        boundaries,
        parcelInfo: {
          apn: feature.attributes?.APN || feature.attributes?.PARCEL_ID || feature.attributes?.PIN || feature.attributes?.parcelnumb,
          owner: feature.attributes?.OWNER || feature.attributes?.OWNERNAME || feature.attributes?.owner,
          address: feature.attributes?.SITEADDR || feature.attributes?.ADDRESS || feature.attributes?.address,
          acres: acres ? Number(acres) : undefined,
          sqft: sqft ? Math.round(Number(sqft)) : undefined,
          zoning: feature.attributes?.ZONING || feature.attributes?.zoning,
          landUse: feature.attributes?.LANDUSE || feature.attributes?.USECODE || feature.attributes?.usedesc,
        },
        zoning: null,
        source: 'National Parcels',
      };
    } catch (error) {
      continue;
    }
  }

  return null;
}

// Fetch from OpenStreetMap for building outlines - improved version
async function fetchBoundaryFromOSM(lat: number, lng: number): Promise<ParcelResponse | null> {
  try {
    // Use Overpass API to get building footprints with larger search radius
    const overpassUrl = 'https://overpass-api.de/api/interpreter';
    // Search for buildings, landuse, and amenities within 50m
    const query = `
      [out:json][timeout:15];
      (
        way["building"](around:50,${lat},${lng});
        way["landuse"](around:50,${lat},${lng});
        way["amenity"](around:50,${lat},${lng});
        relation["building"](around:50,${lat},${lng});
      );
      out body;
      >;
      out skel qt;
    `;

    const response = await fetch(overpassUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      console.log('OSM Overpass response not ok:', response.status);
      return null;
    }

    const data = await response.json();
    console.log('OSM data elements:', data.elements?.length || 0);

    if (!data.elements || data.elements.length === 0) return null;

    // Find nodes and ways
    const nodes: Record<number, { lat: number; lon: number }> = {};
    const ways: Array<{ nodes: number[]; tags?: Record<string, string>; distance?: number }> = [];

    for (const el of data.elements) {
      if (el.type === 'node') {
        nodes[el.id] = { lat: el.lat, lon: el.lon };
      } else if (el.type === 'way' && el.nodes) {
        ways.push({ nodes: el.nodes, tags: el.tags });
      }
    }

    if (ways.length === 0) return null;

    // Convert ways to boundaries and calculate distance to center
    const boundariesWithDistance = ways.map(way => {
      const coords = way.nodes
        .map(nodeId => nodes[nodeId])
        .filter(node => node)
        .map(node => [node.lat, node.lon] as [number, number]);

      if (coords.length < 3) return null;

      // Calculate centroid distance to search point
      const centroidLat = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
      const centroidLng = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
      const distance = Math.sqrt(Math.pow(centroidLat - lat, 2) + Math.pow(centroidLng - lng, 2));

      return { coords, distance, tags: way.tags };
    }).filter(b => b !== null) as Array<{ coords: [number, number][]; distance: number; tags?: Record<string, string> }>;

    if (boundariesWithDistance.length === 0) return null;

    // Sort by distance and take the closest one (likely the target building)
    boundariesWithDistance.sort((a, b) => a.distance - b.distance);
    const closest = boundariesWithDistance[0];

    // Determine land use from tags
    let landUse = closest.tags?.building || closest.tags?.landuse || closest.tags?.amenity;
    if (landUse === 'yes') landUse = 'Building';
    if (landUse === 'commercial') landUse = 'Commercial';
    if (landUse === 'retail') landUse = 'Retail';
    if (landUse === 'industrial') landUse = 'Industrial';

    // Calculate accurate area using the polygon calculation function
    const sqft = calculatePolygonArea(closest.coords);
    const acres = sqft / 43560;

    return {
      boundaries: [closest.coords],
      parcelInfo: {
        sqft: Math.round(sqft),
        acres: acres,
        landUse: landUse ? String(landUse).charAt(0).toUpperCase() + String(landUse).slice(1) : undefined,
      },
      zoning: null,
      source: 'OpenStreetMap Building',
    };
  } catch (error) {
    console.error('OSM fetch error:', error);
    return null;
  }
}

// Fetch property boundary from Nominatim
async function fetchBoundaryFromNominatim(lat: number, lng: number): Promise<ParcelResponse | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&polygon_geojson=1&zoom=18`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DroneSense/1.0',
      },
    });

    if (!response.ok) return null;

    const data = await response.json();

    if (!data.geojson?.coordinates) return null;

    let boundaries: Array<[number, number][]> = [];

    if (data.geojson.type === 'Polygon') {
      boundaries = data.geojson.coordinates.map((ring: number[][]) =>
        ring.map((coord: number[]) => [coord[1], coord[0]] as [number, number])
      );
    } else if (data.geojson.type === 'MultiPolygon') {
      boundaries = data.geojson.coordinates.flat().map((ring: number[][]) =>
        ring.map((coord: number[]) => [coord[1], coord[0]] as [number, number])
      );
    }

    if (boundaries.length === 0 || boundaries[0].length < 3) return null;

    return {
      boundaries,
      parcelInfo: {
        address: data.display_name,
      },
      zoning: null,
      source: 'OpenStreetMap',
    };
  } catch (error) {
    console.error('Nominatim fetch error:', error);
    return null;
  }
}

// Generate approximate parcel boundary based on typical lot sizes
// Creates a more realistic commercial lot shape
function generateApproximateBoundary(lat: number, lng: number, address?: string): ParcelResponse {
  // Typical commercial lot along a road: wider frontage, deeper lot
  // Approximately 200ft wide x 300ft deep (~1.4 acres)
  const widthOffset = 0.0009; // ~100m (200ft) half-width
  const depthOffset = 0.00135; // ~150m (300ft) half-depth

  // Create a rectangle oriented with the likely road frontage
  const boundaries: Array<[number, number][]> = [[
    [lat - depthOffset, lng - widthOffset],
    [lat - depthOffset, lng + widthOffset],
    [lat + depthOffset, lng + widthOffset],
    [lat + depthOffset, lng - widthOffset],
    [lat - depthOffset, lng - widthOffset],
  ]];

  return {
    boundaries,
    parcelInfo: {
      acres: 1.4,
      sqft: 60984,
      address,
    },
    zoning: null,
    source: 'Estimated (typical commercial lot)',
  };
}

export async function POST(request: Request) {
  try {
    const body: ParcelRequest = await request.json();
    const { coordinates, address } = body;

    if (!coordinates) {
      return NextResponse.json({ error: 'No coordinates provided' }, { status: 400 });
    }

    const { lat, lng } = coordinates;
    console.log(`Fetching parcel data for: ${lat}, ${lng}`);

    // Try multiple sources in parallel for speed
    // Priority: Local GIS (Auburn, Lee County) > State GIS > ArcGIS > Regrid > National sources
    const [auburnResult, leeCountyResult, stateResult, arcgisResult, regridResult, countyResult] = await Promise.allSettled([
      fetchParcelFromAuburnGIS(lat, lng),
      fetchParcelFromLeeCountyAL(lat, lng),
      fetchParcelFromStateGIS(lat, lng),
      fetchParcelFromArcGIS(lat, lng),
      fetchParcelFromRegrid(lat, lng),
      fetchParcelFromCountyGIS(lat, lng),
    ]);

    // Helper to check if result is valid
    const isValidResult = (result: PromiseSettledResult<ParcelResponse | null>): result is PromiseFulfilledResult<ParcelResponse> => {
      return result.status === 'fulfilled' &&
             result.value !== null &&
             result.value.boundaries &&
             result.value.boundaries.length > 0;
    };

    // Helper to ensure acreage is calculated
    const ensureAcreage = (data: ParcelResponse): ParcelResponse => {
      if (!data.parcelInfo?.acres && data.boundaries.length > 0 && data.boundaries[0].length > 0) {
        const sqft = calculatePolygonArea(data.boundaries[0]);
        data.parcelInfo = {
          ...data.parcelInfo,
          sqft: Math.round(sqft),
          acres: sqft / 43560,
        };
      }
      data.parcelInfo = { ...data.parcelInfo, address: address || data.parcelInfo?.address };
      return data;
    };

    // Check Auburn GIS result first (most accurate for Auburn area)
    if (isValidResult(auburnResult)) {
      console.log('Using Auburn GIS data');
      return NextResponse.json(ensureAcreage(auburnResult.value));
    }

    // Check Lee County AL result
    if (isValidResult(leeCountyResult)) {
      console.log('Using Lee County AL GIS data');
      return NextResponse.json(ensureAcreage(leeCountyResult.value));
    }

    // Check State GIS result
    if (isValidResult(stateResult)) {
      console.log('Using State GIS data');
      return NextResponse.json(ensureAcreage(stateResult.value));
    }

    // Check ArcGIS result
    if (isValidResult(arcgisResult)) {
      console.log('Using ArcGIS data');
      return NextResponse.json(ensureAcreage(arcgisResult.value));
    }

    // Check Regrid result
    if (isValidResult(regridResult)) {
      console.log('Using Regrid data');
      return NextResponse.json(ensureAcreage(regridResult.value));
    }

    // Check County GIS result
    if (isValidResult(countyResult)) {
      console.log('Using County GIS data');
      return NextResponse.json(ensureAcreage(countyResult.value));
    }

    // Try OSM building footprints
    console.log('Trying OSM building footprints...');
    const osmResult = await fetchBoundaryFromOSM(lat, lng);
    if (osmResult && osmResult.boundaries && osmResult.boundaries.length > 0) {
      console.log('Using OSM building data');
      osmResult.parcelInfo = { address };
      return NextResponse.json(osmResult);
    }

    // Try Nominatim
    console.log('Trying Nominatim...');
    const nominatimResult = await fetchBoundaryFromNominatim(lat, lng);
    if (nominatimResult && nominatimResult.boundaries && nominatimResult.boundaries.length > 0) {
      console.log('Using Nominatim data');
      return NextResponse.json(nominatimResult);
    }

    // Fall back to approximate boundary
    console.log('Using approximate boundary');
    const approxData = generateApproximateBoundary(lat, lng, address);

    return NextResponse.json({
      ...approxData,
      message: 'Using approximate boundary - exact parcel data not available for this location',
    });

  } catch (error) {
    console.error('Parcel API error:', error);
    return NextResponse.json({
      error: 'Failed to fetch parcel data',
      message: String(error)
    }, { status: 500 });
  }
}
