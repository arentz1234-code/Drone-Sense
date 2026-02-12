import { NextResponse } from 'next/server';

interface ParcelBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface NearbyParcel {
  boundaries: Array<[number, number][]>;
  owner?: string;
  apn?: string;
  acres?: number;
  address?: string;
  zoning?: string;
  landUse?: string;
}

interface ParcelRequest {
  bounds: ParcelBounds;
  centerLat?: number;
  centerLng?: number;
}

// Calculate area of a polygon using the Shoelace formula
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

  // Convert square meters to square feet, then to acres
  const sqft = area * 10.7639;
  return sqft / 43560;
}

// Fetch parcels from ArcGIS USA Parcels layer using envelope
async function fetchParcelsFromArcGIS(bounds: ParcelBounds): Promise<NearbyParcel[]> {
  try {
    const url = new URL('https://services2.arcgis.com/FiaPA4ga0iQKduv3/ArcGIS/rest/services/USA_Parcels_SubDivision/FeatureServer/0/query');

    // Use envelope geometry for bounding box query
    const envelope = JSON.stringify({
      xmin: bounds.west,
      ymin: bounds.south,
      xmax: bounds.east,
      ymax: bounds.north,
      spatialReference: { wkid: 4326 }
    });

    url.searchParams.set('where', '1=1');
    url.searchParams.set('geometry', envelope);
    url.searchParams.set('geometryType', 'esriGeometryEnvelope');
    url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
    url.searchParams.set('outFields', 'APN,PARCEL_ID,OWNER,OWNERNAME,ADDR,SITEADDR,ADDRESS,ACRES,GIS_ACRES,ZONING,ZONE_CODE,LANDUSE,LAND_USE,USE_CODE,OBJECTID');
    url.searchParams.set('returnGeometry', 'true');
    url.searchParams.set('outSR', '4326');
    url.searchParams.set('resultRecordCount', '100'); // Limit results
    url.searchParams.set('f', 'json');

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return [];

    const data = await response.json();

    if (data.error || !data.features || data.features.length === 0) return [];

    return data.features.map((feature: {
      geometry?: { rings?: number[][][] };
      attributes?: Record<string, string | number | undefined>;
    }) => {
      const rings = feature.geometry?.rings;
      if (!rings || rings.length === 0) return null;

      const boundaries: Array<[number, number][]> = rings.map((ring: number[][]) =>
        ring.map((coord: number[]) => [coord[1], coord[0]] as [number, number])
      );

      let acres = feature.attributes?.ACRES || feature.attributes?.GIS_ACRES;
      if (!acres && boundaries.length > 0 && boundaries[0].length > 0) {
        acres = calculatePolygonArea(boundaries[0]);
      }

      return {
        boundaries,
        owner: feature.attributes?.OWNER || feature.attributes?.OWNERNAME,
        apn: feature.attributes?.APN || feature.attributes?.PARCEL_ID || feature.attributes?.OBJECTID?.toString(),
        acres: acres ? Number(acres) : undefined,
        address: feature.attributes?.ADDR || feature.attributes?.SITEADDR || feature.attributes?.ADDRESS,
        zoning: feature.attributes?.ZONING || feature.attributes?.ZONE_CODE,
        landUse: feature.attributes?.LANDUSE || feature.attributes?.LAND_USE || feature.attributes?.USE_CODE,
      } as NearbyParcel;
    }).filter((p: NearbyParcel | null): p is NearbyParcel => p !== null && p.boundaries.length > 0);
  } catch (error) {
    console.error('ArcGIS parcels-nearby fetch error:', error);
    return [];
  }
}

// Fetch parcels from City of Auburn GIS using envelope
async function fetchParcelsFromAuburnGIS(bounds: ParcelBounds): Promise<NearbyParcel[]> {
  try {
    const url = new URL('https://gis.auburnalabama.org/public/rest/services/Main/COABasemap/MapServer/6/query');

    const envelope = JSON.stringify({
      xmin: bounds.west,
      ymin: bounds.south,
      xmax: bounds.east,
      ymax: bounds.north,
      spatialReference: { wkid: 4326 }
    });

    url.searchParams.set('where', '1=1');
    url.searchParams.set('geometry', envelope);
    url.searchParams.set('geometryType', 'esriGeometryEnvelope');
    url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
    url.searchParams.set('outFields', '*');
    url.searchParams.set('returnGeometry', 'true');
    url.searchParams.set('outSR', '4326');
    url.searchParams.set('resultRecordCount', '100');
    url.searchParams.set('f', 'json');

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'DroneSense/1.0' }
    });

    if (!response.ok) return [];

    const data = await response.json();

    if (data.error || !data.features || data.features.length === 0) return [];

    return data.features.map((feature: {
      geometry?: { rings?: number[][][] };
      attributes?: Record<string, string | number | undefined>;
    }) => {
      const rings = feature.geometry?.rings;
      if (!rings || rings.length === 0) return null;

      const boundaries: Array<[number, number][]> = rings.map((ring: number[][]) =>
        ring.map((coord: number[]) => [coord[1], coord[0]] as [number, number])
      );

      let acres = feature.attributes?.ACRES || feature.attributes?.ACRES_COUNTY;
      if (!acres && boundaries.length > 0 && boundaries[0].length > 0) {
        acres = calculatePolygonArea(boundaries[0]);
      }

      const addressParts = [
        feature.attributes?.STRNUM,
        feature.attributes?.STRNAM,
      ].filter(Boolean);
      const fullAddress = addressParts.length > 0
        ? addressParts.join(' ')
        : feature.attributes?.ADR1 || feature.attributes?.SITEADDR;

      return {
        boundaries,
        owner: feature.attributes?.OWNER,
        apn: feature.attributes?.PARCEL || feature.attributes?.PIN || feature.attributes?.OBJECTID?.toString(),
        acres: acres ? Number(acres) : undefined,
        address: fullAddress,
        zoning: feature.attributes?.ZONING,
        landUse: feature.attributes?.HSCODE ? `Class ${feature.attributes.HSCODE}` : undefined,
      } as NearbyParcel;
    }).filter((p: NearbyParcel | null): p is NearbyParcel => p !== null && p.boundaries.length > 0);
  } catch (error) {
    console.error('Auburn GIS parcels-nearby fetch error:', error);
    return [];
  }
}

// Fetch parcels from Lee County Alabama GIS
async function fetchParcelsFromLeeCountyAL(bounds: ParcelBounds): Promise<NearbyParcel[]> {
  try {
    const url = new URL('https://gisservices.alabama.gov/arcgis/rest/services/Parcels/LeeCounty_Parcels/MapServer/0/query');

    const envelope = JSON.stringify({
      xmin: bounds.west,
      ymin: bounds.south,
      xmax: bounds.east,
      ymax: bounds.north,
      spatialReference: { wkid: 4326 }
    });

    url.searchParams.set('where', '1=1');
    url.searchParams.set('geometry', envelope);
    url.searchParams.set('geometryType', 'esriGeometryEnvelope');
    url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
    url.searchParams.set('outFields', '*');
    url.searchParams.set('returnGeometry', 'true');
    url.searchParams.set('outSR', '4326');
    url.searchParams.set('resultRecordCount', '100');
    url.searchParams.set('f', 'json');

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'DroneSense/1.0' }
    });

    if (!response.ok) return [];

    const data = await response.json();

    if (data.error || !data.features || data.features.length === 0) return [];

    return data.features.map((feature: {
      geometry?: { rings?: number[][][] };
      attributes?: Record<string, string | number | undefined>;
    }) => {
      const rings = feature.geometry?.rings;
      if (!rings || rings.length === 0) return null;

      const boundaries: Array<[number, number][]> = rings.map((ring: number[][]) =>
        ring.map((coord: number[]) => [coord[1], coord[0]] as [number, number])
      );

      let acres = feature.attributes?.ACRES || feature.attributes?.ACREAGE || feature.attributes?.CALCACRES;
      if (!acres && boundaries.length > 0 && boundaries[0].length > 0) {
        acres = calculatePolygonArea(boundaries[0]);
      }

      return {
        boundaries,
        owner: feature.attributes?.OWNER || feature.attributes?.OWNERNAME,
        apn: feature.attributes?.PARCELID || feature.attributes?.PIN || feature.attributes?.PPIN,
        acres: acres ? Number(acres) : undefined,
        address: feature.attributes?.PROPADDR || feature.attributes?.SITEADDR,
        zoning: feature.attributes?.ZONING,
        landUse: feature.attributes?.LANDUSE || feature.attributes?.PROPCLASS,
      } as NearbyParcel;
    }).filter((p: NearbyParcel | null): p is NearbyParcel => p !== null && p.boundaries.length > 0);
  } catch (error) {
    console.error('Lee County parcels-nearby fetch error:', error);
    return [];
  }
}

// Fetch from Regrid public tile endpoint
async function fetchParcelsFromRegrid(bounds: ParcelBounds): Promise<NearbyParcel[]> {
  try {
    // Regrid's bounding box query
    const centerLat = (bounds.north + bounds.south) / 2;
    const centerLng = (bounds.east + bounds.west) / 2;

    const url = `https://tiles.regrid.com/api/v1/parcel?lat=${centerLat}&lon=${centerLng}&token=public&return_geometry=true`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DroneSense/1.0',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return [];

    const data = await response.json();

    if (!data.results || data.results.length === 0) return [];

    return data.results.map((parcel: {
      geometry?: { coordinates?: number[][][] };
      properties?: Record<string, string | number | undefined>;
    }) => {
      const coords = parcel.geometry?.coordinates?.[0];
      if (!coords) return null;

      const boundaries: Array<[number, number][]> = [
        coords.map((c: number[]) => [c[1], c[0]] as [number, number])
      ];

      let acres = parcel.properties?.ll_gisacre;
      if (!acres && boundaries.length > 0 && boundaries[0].length > 0) {
        acres = calculatePolygonArea(boundaries[0]);
      }

      return {
        boundaries,
        owner: parcel.properties?.owner,
        apn: parcel.properties?.parcelnumb,
        acres: acres ? Number(acres) : undefined,
        address: parcel.properties?.address,
        zoning: parcel.properties?.zoning,
        landUse: parcel.properties?.usedesc,
      } as NearbyParcel;
    }).filter((p: NearbyParcel | null): p is NearbyParcel => p !== null && p.boundaries.length > 0);
  } catch (error) {
    console.error('Regrid parcels-nearby fetch error:', error);
    return [];
  }
}

// Determine if coordinates are in Auburn, AL area
function isInAuburnArea(centerLat?: number, centerLng?: number): boolean {
  if (!centerLat || !centerLng) return false;
  // Auburn, AL approximate bounds
  return centerLat >= 32.55 && centerLat <= 32.70 && centerLng >= -85.55 && centerLng <= -85.40;
}

// Determine if coordinates are in Lee County, AL area
function isInLeeCountyArea(centerLat?: number, centerLng?: number): boolean {
  if (!centerLat || !centerLng) return false;
  // Lee County, AL approximate bounds
  return centerLat >= 32.35 && centerLat <= 32.90 && centerLng >= -85.65 && centerLng <= -85.05;
}

// Determine if coordinates are in Leon County, FL area (Tallahassee)
function isInLeonCountyArea(centerLat?: number, centerLng?: number): boolean {
  if (!centerLat || !centerLng) return false;
  return centerLat >= 30.26 && centerLat <= 30.70 && centerLng >= -84.65 && centerLng <= -83.98;
}

// Convert WGS84 lat/lng to Web Mercator x/y
function toWebMercator(lat: number, lng: number): { x: number; y: number } {
  const x = lng * 20037508.34 / 180;
  let y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180);
  y = y * 20037508.34 / 180;
  return { x, y };
}

// Florida county configurations
interface FloridaCountyConfig {
  name: string;
  url: string;
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  webMercator?: boolean;
}

const FLORIDA_COUNTIES: FloridaCountyConfig[] = [
  { name: 'Leon County', url: 'https://intervector.leoncountyfl.gov/intervector/rest/services/MapServices/TLC_OverlayParnal_D_WM/MapServer/0/query', bounds: { minLat: 30.26, maxLat: 30.70, minLng: -84.65, maxLng: -83.98 }, webMercator: true },
  { name: 'Hillsborough County', url: 'https://maps.hillsboroughcounty.org/arcgis/rest/services/InfoLayers/Parcels/MapServer/0/query', bounds: { minLat: 27.57, maxLat: 28.17, minLng: -82.82, maxLng: -82.05 } },
  { name: 'Orange County', url: 'https://maps.ocfl.net/arcgis/rest/services/Parcels/MapServer/0/query', bounds: { minLat: 28.34, maxLat: 28.79, minLng: -81.66, maxLng: -80.95 } },
  { name: 'Duval County', url: 'https://maps.coj.net/arcgis/rest/services/Parcels/Parcels/MapServer/0/query', bounds: { minLat: 30.10, maxLat: 30.59, minLng: -82.05, maxLng: -81.32 } },
];

// Find which Florida county the coordinates are in
function getFloridaCounty(centerLat?: number, centerLng?: number): FloridaCountyConfig | null {
  if (!centerLat || !centerLng) return null;
  return FLORIDA_COUNTIES.find(county =>
    centerLat >= county.bounds.minLat && centerLat <= county.bounds.maxLat &&
    centerLng >= county.bounds.minLng && centerLng <= county.bounds.maxLng
  ) || null;
}

// Fetch parcels from Florida county GIS
async function fetchParcelsFromFloridaCounty(bounds: ParcelBounds, county: FloridaCountyConfig): Promise<NearbyParcel[]> {
  try {
    const url = new URL(county.url);

    // Handle Web Mercator coordinates if required by the county
    let envelope: string;
    if (county.webMercator) {
      const sw = toWebMercator(bounds.south, bounds.west);
      const ne = toWebMercator(bounds.north, bounds.east);
      envelope = JSON.stringify({
        xmin: sw.x,
        ymin: sw.y,
        xmax: ne.x,
        ymax: ne.y,
        spatialReference: { wkid: 102100 }
      });
      url.searchParams.set('inSR', '102100');  // Web Mercator
    } else {
      envelope = JSON.stringify({
        xmin: bounds.west,
        ymin: bounds.south,
        xmax: bounds.east,
        ymax: bounds.north,
        spatialReference: { wkid: 4326 }
      });
      url.searchParams.set('inSR', '4326');  // WGS84
    }

    url.searchParams.set('where', '1=1');
    url.searchParams.set('geometry', envelope);
    url.searchParams.set('geometryType', 'esriGeometryEnvelope');
    url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
    url.searchParams.set('outFields', '*');
    url.searchParams.set('returnGeometry', 'true');
    url.searchParams.set('outSR', '4326');
    url.searchParams.set('resultRecordCount', '100');
    url.searchParams.set('f', 'json');

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'DroneSense/1.0' }
    });

    if (!response.ok) return [];

    const data = await response.json();

    if (data.error || !data.features || data.features.length === 0) return [];

    return data.features.map((feature: {
      geometry?: { rings?: number[][][] };
      attributes?: Record<string, string | number | undefined>;
    }) => {
      const rings = feature.geometry?.rings;
      if (!rings || rings.length === 0) return null;

      const boundaries: Array<[number, number][]> = rings.map((ring: number[][]) =>
        ring.map((coord: number[]) => [coord[1], coord[0]] as [number, number])
      );

      const attrs = feature.attributes || {};
      let acres = attrs.ACRES || attrs.ACREAGE || attrs.GIS_ACRES || attrs.TOTALACRES || attrs.CALC_ACREA;
      if (!acres && boundaries.length > 0 && boundaries[0].length > 0) {
        acres = calculatePolygonArea(boundaries[0]);
      }

      const address = attrs.SITEADDR || attrs.SITE_ADDR || attrs.ADDRESS || attrs.PROP_ADDR ||
                     attrs.PHYSICAL_ADDRESS || attrs.LOC_ADDR || attrs.LOCATION ||
                     (attrs.STREET_NUM && attrs.STREET_NAME ? `${attrs.STREET_NUM} ${attrs.STREET_NAME}` : undefined);

      return {
        boundaries,
        owner: attrs.OWNER || attrs.OWNERNAME || attrs.OWNER_NAME || attrs.OWNER1 || attrs.OWN_NAME,
        apn: attrs.PARCELID || attrs.PARCEL_ID || attrs.PIN || attrs.FOLIO || attrs.APN || attrs.STRAP || attrs.TAXID,
        acres: acres ? Number(acres) : undefined,
        address: address,
        zoning: attrs.ZONING || attrs.ZONE_CODE || attrs.ZONING_CODE || attrs.ZONE,
        landUse: attrs.LANDUSE || attrs.LAND_USE || attrs.USE_CODE || attrs.DOR_CODE || attrs.USEDESC,
      } as NearbyParcel;
    }).filter((p: NearbyParcel | null): p is NearbyParcel => p !== null && p.boundaries.length > 0);
  } catch (error) {
    console.error(`${county.name} parcels-nearby fetch error:`, error);
    return [];
  }
}

export async function POST(request: Request) {
  try {
    const body: ParcelRequest = await request.json();
    const { bounds, centerLat, centerLng } = body;

    if (!bounds || !bounds.north || !bounds.south || !bounds.east || !bounds.west) {
      return NextResponse.json({ error: 'Invalid bounds provided' }, { status: 400 });
    }

    console.log(`Fetching nearby parcels for bounds: N${bounds.north.toFixed(4)}, S${bounds.south.toFixed(4)}, E${bounds.east.toFixed(4)}, W${bounds.west.toFixed(4)}`);

    // Determine which data sources to try based on location
    const isAuburn = isInAuburnArea(centerLat, centerLng);
    const isLeeCounty = isInLeeCountyArea(centerLat, centerLng);

    let parcels: NearbyParcel[] = [];

    // Try local GIS first if in the area
    if (isAuburn) {
      console.log('Trying Auburn GIS for nearby parcels...');
      parcels = await fetchParcelsFromAuburnGIS(bounds);
      if (parcels.length > 0) {
        console.log(`Found ${parcels.length} parcels from Auburn GIS`);
        return NextResponse.json({ parcels, source: 'City of Auburn GIS' });
      }
    }

    if (isLeeCounty) {
      console.log('Trying Lee County GIS for nearby parcels...');
      parcels = await fetchParcelsFromLeeCountyAL(bounds);
      if (parcels.length > 0) {
        console.log(`Found ${parcels.length} parcels from Lee County GIS`);
        return NextResponse.json({ parcels, source: 'Lee County AL GIS' });
      }
    }

    // Try Florida county GIS
    const floridaCounty = getFloridaCounty(centerLat, centerLng);
    if (floridaCounty) {
      console.log(`Trying ${floridaCounty.name} GIS for nearby parcels...`);
      parcels = await fetchParcelsFromFloridaCounty(bounds, floridaCounty);
      if (parcels.length > 0) {
        console.log(`Found ${parcels.length} parcels from ${floridaCounty.name} GIS`);
        return NextResponse.json({ parcels, source: `${floridaCounty.name} GIS` });
      }
    }

    // Try ArcGIS USA Parcels
    console.log('Trying ArcGIS USA Parcels...');
    parcels = await fetchParcelsFromArcGIS(bounds);
    if (parcels.length > 0) {
      console.log(`Found ${parcels.length} parcels from ArcGIS`);
      return NextResponse.json({ parcels, source: 'ArcGIS USA Parcels' });
    }

    // Try Regrid as fallback
    console.log('Trying Regrid...');
    parcels = await fetchParcelsFromRegrid(bounds);
    if (parcels.length > 0) {
      console.log(`Found ${parcels.length} parcels from Regrid`);
      return NextResponse.json({ parcels, source: 'Regrid' });
    }

    // No parcels found
    console.log('No parcels found for this area');
    return NextResponse.json({ parcels: [], source: null, message: 'No parcel data available for this area' });

  } catch (error) {
    console.error('Parcels-nearby API error:', error);
    return NextResponse.json({
      error: 'Failed to fetch nearby parcels',
      message: String(error)
    }, { status: 500 });
  }
}
