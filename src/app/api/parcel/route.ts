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
  // Georgia
  'GA': [
    { url: 'https://services1.arcgis.com/2iUE8l8JKrP2tygQ/arcgis/rest/services/Georgia_Parcels/FeatureServer/0/query', name: 'Georgia Parcels' },
  ],
  // Texas
  'TX': [
    { url: 'https://services.arcgis.com/KTcxiTD9dsQw4r7Z/arcgis/rest/services/Texas_Parcels/FeatureServer/0/query', name: 'Texas Parcels' },
  ],
};

// Florida county-specific GIS endpoints (Florida doesn't have a statewide parcel layer)
const FLORIDA_COUNTY_GIS: { name: string; url: string; bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number } }[] = [
  // Hillsborough County (Tampa)
  {
    name: 'Hillsborough County',
    url: 'https://maps.hillsboroughcounty.org/arcgis/rest/services/InfoLayers/Parcels/MapServer/0/query',
    bounds: { minLat: 27.57, maxLat: 28.17, minLng: -82.82, maxLng: -82.05 }
  },
  // Orange County (Orlando)
  {
    name: 'Orange County',
    url: 'https://maps.ocfl.net/arcgis/rest/services/Parcels/MapServer/0/query',
    bounds: { minLat: 28.34, maxLat: 28.79, minLng: -81.66, maxLng: -80.95 }
  },
  // Pinellas County (St. Petersburg, Clearwater)
  {
    name: 'Pinellas County',
    url: 'https://egis.pinellascounty.org/arcgis/rest/services/Parcels/Parcels/MapServer/0/query',
    bounds: { minLat: 27.60, maxLat: 28.17, minLng: -82.85, maxLng: -82.53 }
  },
  // Duval County (Jacksonville)
  {
    name: 'Duval County',
    url: 'https://maps.coj.net/arcgis/rest/services/Parcels/Parcels/MapServer/0/query',
    bounds: { minLat: 30.10, maxLat: 30.59, minLng: -82.05, maxLng: -81.32 }
  },
  // Polk County (Lakeland)
  {
    name: 'Polk County',
    url: 'https://gis.polk-county.net/arcgis/rest/services/Parcels/MapServer/0/query',
    bounds: { minLat: 27.64, maxLat: 28.30, minLng: -82.11, maxLng: -81.15 }
  },
  // Lee County (Fort Myers)
  {
    name: 'Lee County FL',
    url: 'https://gis.leegov.com/arcgis/rest/services/Parcels/Parcels/MapServer/0/query',
    bounds: { minLat: 26.32, maxLat: 26.79, minLng: -82.27, maxLng: -81.56 }
  },
  // Brevard County (Melbourne, Cape Canaveral)
  {
    name: 'Brevard County',
    url: 'https://gis.brevardcounty.us/arcgis/rest/services/Parcels/MapServer/0/query',
    bounds: { minLat: 27.81, maxLat: 28.80, minLng: -81.11, maxLng: -80.22 }
  },
  // Volusia County (Daytona Beach)
  {
    name: 'Volusia County',
    url: 'https://maps.volusia.org/arcgis/rest/services/Parcels/Parcels/MapServer/0/query',
    bounds: { minLat: 28.76, maxLat: 29.43, minLng: -81.67, maxLng: -80.82 }
  },
  // Seminole County (Sanford)
  {
    name: 'Seminole County',
    url: 'https://gis.seminolecountyfl.gov/arcgis/rest/services/Parcels/MapServer/0/query',
    bounds: { minLat: 28.66, maxLat: 28.86, minLng: -81.48, maxLng: -81.00 }
  },
  // Sarasota County
  {
    name: 'Sarasota County',
    url: 'https://gis.scgov.net/arcgis/rest/services/Parcels/Parcels/MapServer/0/query',
    bounds: { minLat: 26.95, maxLat: 27.47, minLng: -82.80, maxLng: -82.07 }
  },
  // Manatee County (Bradenton)
  {
    name: 'Manatee County',
    url: 'https://gis.mymanatee.org/arcgis/rest/services/Parcels/MapServer/0/query',
    bounds: { minLat: 27.34, maxLat: 27.71, minLng: -82.76, maxLng: -82.04 }
  },
  // Pasco County
  {
    name: 'Pasco County',
    url: 'https://gis.pascocountyfl.net/arcgis/rest/services/Parcels/MapServer/0/query',
    bounds: { minLat: 28.12, maxLat: 28.54, minLng: -82.90, maxLng: -82.05 }
  },
  // Collier County (Naples)
  {
    name: 'Collier County',
    url: 'https://gis.colliercountyfl.gov/arcgis/rest/services/Parcels/MapServer/0/query',
    bounds: { minLat: 25.80, maxLat: 26.52, minLng: -81.87, maxLng: -80.87 }
  },
  // Escambia County (Pensacola)
  {
    name: 'Escambia County',
    url: 'https://gis.myescambia.com/arcgis/rest/services/Parcels/MapServer/0/query',
    bounds: { minLat: 30.27, maxLat: 30.98, minLng: -87.63, maxLng: -86.78 }
  },
  // Leon County (Tallahassee)
  {
    name: 'Leon County',
    url: 'https://gis.leoncountyfl.gov/arcgis/rest/services/Parcels/MapServer/0/query',
    bounds: { minLat: 30.26, maxLat: 30.70, minLng: -84.65, maxLng: -83.98 }
  },
  // Alachua County (Gainesville)
  {
    name: 'Alachua County',
    url: 'https://gis.alachuacounty.us/arcgis/rest/services/Parcels/MapServer/0/query',
    bounds: { minLat: 29.40, maxLat: 29.95, minLng: -82.66, maxLng: -82.05 }
  },
  // Marion County (Ocala)
  {
    name: 'Marion County',
    url: 'https://gis.marioncountyfl.org/arcgis/rest/services/Parcels/MapServer/0/query',
    bounds: { minLat: 28.85, maxLat: 29.55, minLng: -82.54, maxLng: -81.60 }
  },
  // Lake County
  {
    name: 'Lake County',
    url: 'https://gis.lakecountyfl.gov/arcgis/rest/services/Parcels/MapServer/0/query',
    bounds: { minLat: 28.40, maxLat: 29.10, minLng: -82.00, maxLng: -81.25 }
  },
  // Osceola County (Kissimmee)
  {
    name: 'Osceola County',
    url: 'https://gis.osceola.org/arcgis/rest/services/Parcels/MapServer/0/query',
    bounds: { minLat: 27.69, maxLat: 28.45, minLng: -81.60, maxLng: -80.80 }
  },
  // St. Johns County (St. Augustine)
  {
    name: 'St. Johns County',
    url: 'https://gis.sjcfl.us/arcgis/rest/services/Parcels/MapServer/0/query',
    bounds: { minLat: 29.62, maxLat: 30.25, minLng: -81.68, maxLng: -81.19 }
  },
];

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

// Fetch from Florida county-specific GIS services
async function fetchParcelFromFloridaCountyGIS(lat: number, lng: number): Promise<ParcelResponse | null> {
  // Find which Florida county this coordinate is in
  const matchingCounty = FLORIDA_COUNTY_GIS.find(county =>
    lat >= county.bounds.minLat && lat <= county.bounds.maxLat &&
    lng >= county.bounds.minLng && lng <= county.bounds.maxLng
  );

  if (!matchingCounty) {
    console.log('No matching Florida county found for coordinates');
    return null;
  }

  console.log(`Trying ${matchingCounty.name} GIS...`);

  try {
    const url = new URL(matchingCounty.url);
    url.searchParams.set('where', '1=1');
    url.searchParams.set('geometry', `${lng},${lat}`);
    url.searchParams.set('geometryType', 'esriGeometryPoint');
    url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
    url.searchParams.set('outFields', '*');
    url.searchParams.set('returnGeometry', 'true');
    url.searchParams.set('outSR', '4326');
    url.searchParams.set('f', 'json');

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'DroneSense/1.0' }
    });

    if (!response.ok) {
      console.log(`${matchingCounty.name} response not ok:`, response.status);
      return null;
    }

    const data = await response.json();
    console.log(`${matchingCounty.name} data:`, JSON.stringify(data).slice(0, 500));

    if (data.error) {
      console.log(`${matchingCounty.name} error:`, data.error);
      return null;
    }

    if (!data.features || data.features.length === 0) {
      console.log(`${matchingCounty.name}: No features found`);
      return null;
    }

    const feature = data.features[0];
    const rings = feature.geometry?.rings;

    if (!rings || rings.length === 0) return null;

    const boundaries: Array<[number, number][]> = rings.map((ring: number[][]) =>
      ring.map((coord: number[]) => [coord[1], coord[0]] as [number, number])
    );

    // Florida counties use various field names for parcel attributes
    const attrs = feature.attributes;
    let acres = attrs?.ACRES || attrs?.ACREAGE || attrs?.GIS_ACRES || attrs?.TOTALACRES || attrs?.LOT_ACRES || attrs?.Shape__Area;
    let sqft = attrs?.SQFT || attrs?.Shape__Area;

    // If Shape__Area is in square meters, convert
    if (attrs?.Shape__Area && !acres) {
      sqft = attrs.Shape__Area * 10.7639;
      acres = sqft / 43560;
    }

    // Calculate from polygon if still no acreage
    if (!acres && boundaries.length > 0 && boundaries[0].length > 0) {
      sqft = calculatePolygonArea(boundaries[0]);
      acres = sqft / 43560;
    }

    // Build address from various possible field names
    const address = attrs?.SITEADDR || attrs?.SITE_ADDR || attrs?.ADDRESS || attrs?.PROP_ADDR ||
                   attrs?.PHYSICAL_ADDRESS || attrs?.LOC_ADDR || attrs?.LOCATION ||
                   (attrs?.STREET_NUM && attrs?.STREET_NAME ? `${attrs.STREET_NUM} ${attrs.STREET_NAME}` : null);

    return {
      boundaries,
      parcelInfo: {
        apn: attrs?.PARCELID || attrs?.PARCEL_ID || attrs?.PIN || attrs?.FOLIO || attrs?.APN ||
             attrs?.STRAP || attrs?.ACCOUNT || attrs?.PARCEL_NO || attrs?.PARCEL,
        owner: attrs?.OWNER || attrs?.OWNERNAME || attrs?.OWNER_NAME || attrs?.OWNER1 || attrs?.OWN_NAME,
        address: address,
        acres: acres ? Number(acres) : undefined,
        sqft: sqft ? Math.round(Number(sqft)) : undefined,
        zoning: attrs?.ZONING || attrs?.ZONE_CODE || attrs?.ZONING_CODE || attrs?.ZONE,
        landUse: attrs?.LANDUSE || attrs?.LAND_USE || attrs?.USE_CODE || attrs?.DOR_CODE || attrs?.USEDESC,
        yearBuilt: attrs?.YEAR_BUILT || attrs?.YEARBUILT || attrs?.YR_BUILT || attrs?.EFFYEAR,
      },
      zoning: attrs?.ZONING ? {
        code: attrs.ZONING,
        description: attrs?.ZONE_DESC || attrs?.ZONING_DESC,
      } : null,
      source: `${matchingCounty.name} GIS`,
    };
  } catch (error) {
    console.error(`${matchingCounty.name} fetch error:`, error);
    return null;
  }
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
    // Priority: Local GIS (Auburn, Lee County) > Florida County > State GIS > ArcGIS > Regrid > National sources
    const [auburnResult, leeCountyResult, floridaCountyResult, stateResult, arcgisResult, regridResult, countyResult] = await Promise.allSettled([
      fetchParcelFromAuburnGIS(lat, lng),
      fetchParcelFromLeeCountyAL(lat, lng),
      fetchParcelFromFloridaCountyGIS(lat, lng),
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

    // Check Florida County GIS result
    if (isValidResult(floridaCountyResult)) {
      console.log('Using Florida County GIS data');
      return NextResponse.json(ensureAcreage(floridaCountyResult.value));
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
