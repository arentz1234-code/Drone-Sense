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
}

// Try to fetch parcel data from multiple free sources
async function fetchParcelFromRegrid(lat: number, lng: number): Promise<ParcelResponse | null> {
  try {
    // Regrid (Loveland) has a free tile-based lookup
    // Using their public parcel endpoint
    const url = `https://app.regrid.com/api/v1/parcel?lat=${lat}&lon=${lng}&token=public`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DroneSense/1.0',
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
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
    };
  } catch (error) {
    console.error('Regrid fetch error:', error);
    return null;
  }
}

// Fetch from ArcGIS USA Parcels layer (free public layer)
async function fetchParcelFromArcGIS(lat: number, lng: number): Promise<ParcelResponse | null> {
  try {
    // Query USA Parcels public layer
    const geometry = JSON.stringify({
      x: lng,
      y: lat,
      spatialReference: { wkid: 4326 }
    });

    const url = new URL('https://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services/USA_Parcels/FeatureServer/0/query');
    url.searchParams.set('geometry', geometry);
    url.searchParams.set('geometryType', 'esriGeometryPoint');
    url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
    url.searchParams.set('outFields', '*');
    url.searchParams.set('returnGeometry', 'true');
    url.searchParams.set('f', 'json');

    const response = await fetch(url.toString());

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.features || data.features.length === 0) return null;

    const feature = data.features[0];
    const rings = feature.geometry?.rings;

    // Convert ArcGIS rings to Leaflet polygon format
    const boundaries: Array<[number, number][]> = rings
      ? rings.map((ring: number[][]) =>
          ring.map((coord: number[]) => [coord[1], coord[0]] as [number, number])
        )
      : [];

    return {
      boundaries,
      parcelInfo: {
        apn: feature.attributes?.APN || feature.attributes?.PARCEL_ID,
        owner: feature.attributes?.OWNER,
        address: feature.attributes?.ADDR || feature.attributes?.SITEADDR,
        acres: feature.attributes?.ACRES || feature.attributes?.GIS_ACRES,
        sqft: feature.attributes?.SQFT || feature.attributes?.SHAPE_Area,
        zoning: feature.attributes?.ZONING || feature.attributes?.ZONE_CODE,
        landUse: feature.attributes?.LANDUSE || feature.attributes?.LAND_USE,
        yearBuilt: feature.attributes?.YEAR_BUILT,
      },
      zoning: feature.attributes?.ZONING ? {
        code: feature.attributes.ZONING,
        description: feature.attributes.ZONE_DESC,
      } : null,
    };
  } catch (error) {
    console.error('ArcGIS fetch error:', error);
    return null;
  }
}

// Fetch from OpenStreetMap Nominatim for basic boundary
async function fetchBoundaryFromOSM(lat: number, lng: number): Promise<ParcelResponse | null> {
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

    // Handle different geometry types
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

    return {
      boundaries,
      parcelInfo: {
        address: data.display_name,
      },
      zoning: null,
    };
  } catch (error) {
    console.error('OSM fetch error:', error);
    return null;
  }
}

// Generate approximate parcel boundary based on typical lot sizes
function generateApproximateBoundary(lat: number, lng: number): ParcelResponse {
  // Create approximate 1-acre lot (roughly 200ft x 200ft)
  const offset = 0.0009; // ~100m in each direction

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
      acres: 1.0,
      sqft: 43560,
    },
    zoning: null,
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

    // Try multiple sources in order of preference
    let parcelData: ParcelResponse | null = null;

    // 1. Try ArcGIS USA Parcels
    parcelData = await fetchParcelFromArcGIS(lat, lng);
    if (parcelData && parcelData.boundaries.length > 0) {
      parcelData.parcelInfo = { ...parcelData.parcelInfo, address: address || parcelData.parcelInfo?.address };
      return NextResponse.json(parcelData);
    }

    // 2. Try Regrid
    parcelData = await fetchParcelFromRegrid(lat, lng);
    if (parcelData && parcelData.boundaries.length > 0) {
      return NextResponse.json(parcelData);
    }

    // 3. Try OSM for building/property boundary
    parcelData = await fetchBoundaryFromOSM(lat, lng);
    if (parcelData && parcelData.boundaries.length > 0) {
      return NextResponse.json(parcelData);
    }

    // 4. Fall back to approximate boundary
    parcelData = generateApproximateBoundary(lat, lng);
    parcelData.parcelInfo = {
      ...parcelData.parcelInfo,
      address: address
    };

    return NextResponse.json({
      ...parcelData,
      message: 'Using approximate boundary - exact parcel data not available for this location'
    });

  } catch (error) {
    console.error('Parcel API error:', error);
    return NextResponse.json({
      error: 'Failed to fetch parcel data',
      message: String(error)
    }, { status: 500 });
  }
}
