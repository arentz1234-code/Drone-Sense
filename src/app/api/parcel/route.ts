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

    return {
      boundaries: coords ? [coords.map((c: number[]) => [c[1], c[0]] as [number, number])] : [],
      parcelInfo: {
        apn: parcel.properties?.parcelnumb,
        owner: parcel.properties?.owner,
        address: parcel.properties?.address,
        acres: parcel.properties?.ll_gisacre,
        sqft: parcel.properties?.ll_gissqft,
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

    return {
      boundaries,
      parcelInfo: {
        apn: feature.attributes?.APN || feature.attributes?.PARCEL_ID || feature.attributes?.OBJECTID,
        owner: feature.attributes?.OWNER || feature.attributes?.OWNERNAME,
        address: feature.attributes?.ADDR || feature.attributes?.SITEADDR || feature.attributes?.ADDRESS,
        acres: feature.attributes?.ACRES || feature.attributes?.GIS_ACRES || feature.attributes?.Shape__Area / 4046.86,
        sqft: feature.attributes?.SQFT || feature.attributes?.Shape__Area * 10.7639,
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

// Fetch from county-level ArcGIS services (Alabama example for Auburn)
async function fetchParcelFromCountyGIS(lat: number, lng: number): Promise<ParcelResponse | null> {
  // Try common county GIS patterns
  const countyEndpoints = [
    // Lee County Alabama (Auburn)
    'https://gis.leecountyga.gov/arcgis/rest/services/ParcelViewer/MapServer/0/query',
    // Generic county parcel service pattern
    'https://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services/USA_Parcels_Current/FeatureServer/0/query',
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
        signal: AbortSignal.timeout(5000)
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

      return {
        boundaries,
        parcelInfo: {
          apn: feature.attributes?.APN || feature.attributes?.PARCEL_ID || feature.attributes?.PIN,
          owner: feature.attributes?.OWNER || feature.attributes?.OWNERNAME,
          address: feature.attributes?.SITEADDR || feature.attributes?.ADDRESS,
          acres: feature.attributes?.ACRES || feature.attributes?.ACREAGE,
          sqft: feature.attributes?.SQFT,
          zoning: feature.attributes?.ZONING,
          landUse: feature.attributes?.LANDUSE || feature.attributes?.USECODE,
        },
        zoning: null,
        source: 'County GIS',
      };
    } catch (error) {
      continue;
    }
  }

  return null;
}

// Fetch from OpenStreetMap for building outlines
async function fetchBoundaryFromOSM(lat: number, lng: number): Promise<ParcelResponse | null> {
  try {
    // Use Overpass API to get building footprints
    const overpassUrl = 'https://overpass-api.de/api/interpreter';
    const query = `
      [out:json][timeout:10];
      (
        way["building"](around:30,${lat},${lng});
        relation["building"](around:30,${lat},${lng});
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

    if (!response.ok) return null;

    const data = await response.json();

    if (!data.elements || data.elements.length === 0) return null;

    // Find nodes and ways
    const nodes: Record<number, { lat: number; lon: number }> = {};
    const ways: Array<{ nodes: number[]; tags?: Record<string, string> }> = [];

    for (const el of data.elements) {
      if (el.type === 'node') {
        nodes[el.id] = { lat: el.lat, lon: el.lon };
      } else if (el.type === 'way' && el.nodes) {
        ways.push({ nodes: el.nodes, tags: el.tags });
      }
    }

    if (ways.length === 0) return null;

    // Convert ways to boundaries
    const boundaries: Array<[number, number][]> = ways.map(way =>
      way.nodes
        .map(nodeId => nodes[nodeId])
        .filter(node => node)
        .map(node => [node.lat, node.lon] as [number, number])
    ).filter(boundary => boundary.length > 2);

    if (boundaries.length === 0) return null;

    return {
      boundaries,
      parcelInfo: null,
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
function generateApproximateBoundary(lat: number, lng: number, address?: string): ParcelResponse {
  // Create approximate 0.5-acre lot (roughly 150ft x 150ft for commercial)
  const offset = 0.0007; // ~75m in each direction

  const boundaries: Array<[number, number][]> = [[
    [lat - offset, lng - offset],
    [lat - offset, lng + offset],
    [lat + offset, lng + offset],
    [lat + offset, lng - offset],
    [lat - offset, lng - offset],
  ]];

  return {
    boundaries,
    parcelInfo: {
      acres: 0.5,
      sqft: 21780,
      address,
    },
    zoning: null,
    source: 'Estimated',
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
    const [arcgisResult, regridResult, countyResult] = await Promise.allSettled([
      fetchParcelFromArcGIS(lat, lng),
      fetchParcelFromRegrid(lat, lng),
      fetchParcelFromCountyGIS(lat, lng),
    ]);

    // Check ArcGIS result
    if (arcgisResult.status === 'fulfilled' && arcgisResult.value && arcgisResult.value.boundaries && arcgisResult.value.boundaries.length > 0) {
      console.log('Using ArcGIS data');
      const data = arcgisResult.value;
      data.parcelInfo = { ...data.parcelInfo, address: address || data.parcelInfo?.address };
      return NextResponse.json(data);
    }

    // Check Regrid result
    if (regridResult.status === 'fulfilled' && regridResult.value && regridResult.value.boundaries && regridResult.value.boundaries.length > 0) {
      console.log('Using Regrid data');
      const data = regridResult.value;
      data.parcelInfo = { ...data.parcelInfo, address: address || data.parcelInfo?.address };
      return NextResponse.json(data);
    }

    // Check County GIS result
    if (countyResult.status === 'fulfilled' && countyResult.value && countyResult.value.boundaries && countyResult.value.boundaries.length > 0) {
      console.log('Using County GIS data');
      const data = countyResult.value;
      data.parcelInfo = { ...data.parcelInfo, address: address || data.parcelInfo?.address };
      return NextResponse.json(data);
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
