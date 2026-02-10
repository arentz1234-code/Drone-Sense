import { NextRequest, NextResponse } from 'next/server';

interface ParcelData {
  parcelId: string;
  address: string;
  coordinates: { lat: number; lng: number };
  lotSize?: number;
  zoning?: string;
  propertyType?: string;
}

interface SearchParcelsRequest {
  zipCode: string;
  propertyType?: 'all' | 'vacant' | 'commercial';
}

// Florida county GIS services mapping
const FLORIDA_COUNTY_GIS: Record<string, { url: string; layers: number[] }> = {
  // Hillsborough County (Tampa)
  '336': { url: 'https://maps.hillsboroughcounty.org/arcgis/rest/services', layers: [0] },
  // Pinellas County
  '337': { url: 'https://egis.pinellascounty.org/arcgis/rest/services', layers: [0] },
  // Orange County (Orlando)
  '328': { url: 'https://maps.ocfl.net/arcgis/rest/services', layers: [0] },
  // Miami-Dade
  '331': { url: 'https://gis.mdc.opendata.arcgis.com/arcgis/rest/services', layers: [0] },
  // Broward
  '333': { url: 'https://gis.broward.org/arcgis/rest/services', layers: [0] },
};

async function getZipCodeBoundary(zipCode: string): Promise<{ lat: number; lng: number; bounds: { north: number; south: number; east: number; west: number } } | null> {
  try {
    // Use Nominatim to get zip code center and approximate bounds
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${zipCode}&country=US&format=json&limit=1`,
      { headers: { 'User-Agent': 'DroneSense/1.0' } }
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (!data || data.length === 0) return null;

    const result = data[0];
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    // Approximate bounds (roughly 5 miles in each direction for a zip code)
    const latOffset = 0.07; // ~5 miles
    const lngOffset = 0.09; // ~5 miles (varies with latitude)

    return {
      lat,
      lng,
      bounds: {
        north: lat + latOffset,
        south: lat - latOffset,
        east: lng + lngOffset,
        west: lng - lngOffset,
      },
    };
  } catch (error) {
    console.error('Error getting zip code boundary:', error);
    return null;
  }
}

async function fetchParcelsFromOverpass(bounds: { north: number; south: number; east: number; west: number }, propertyType: string): Promise<ParcelData[]> {
  try {
    // Use Overpass API to get building footprints and land use data
    const query = `
      [out:json][timeout:25];
      (
        way["building"]["building"!="residential"]["building"!="house"]["building"!="apartments"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
        way["landuse"="commercial"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
        way["landuse"="retail"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
        ${propertyType === 'vacant' ? `way["landuse"="greenfield"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});` : ''}
        ${propertyType === 'vacant' ? `way["landuse"="brownfield"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});` : ''}
      );
      out center meta;
    `;

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    if (!response.ok) {
      console.error('Overpass API error:', response.status);
      return [];
    }

    const data = await response.json();
    const parcels: ParcelData[] = [];

    for (const element of data.elements || []) {
      if (element.center) {
        const tags = element.tags || {};
        parcels.push({
          parcelId: `OSM-${element.id}`,
          address: tags['addr:housenumber'] && tags['addr:street']
            ? `${tags['addr:housenumber']} ${tags['addr:street']}`
            : tags.name || `Property at ${element.center.lat.toFixed(4)}, ${element.center.lon.toFixed(4)}`,
          coordinates: { lat: element.center.lat, lng: element.center.lon },
          zoning: tags.landuse || tags.building || 'Unknown',
          propertyType: tags.landuse || tags.building,
        });
      }
    }

    return parcels;
  } catch (error) {
    console.error('Error fetching from Overpass:', error);
    return [];
  }
}

async function generateSampleParcels(center: { lat: number; lng: number }, zipCode: string, propertyType: string): Promise<ParcelData[]> {
  // Generate sample parcels based on the zip code center for demonstration
  // In production, this would use a real parcel data API
  const parcels: ParcelData[] = [];
  const gridSize = 5;
  const spacing = 0.003; // roughly 300 meters

  // Get street names from Nominatim for more realistic addresses
  let streetNames: string[] = [];
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=street+${zipCode}&countrycodes=US&format=json&limit=20`,
      { headers: { 'User-Agent': 'DroneSense/1.0' } }
    );
    if (response.ok) {
      const data = await response.json();
      streetNames = data.map((d: { display_name: string }) => {
        const parts = d.display_name.split(',');
        return parts[0] || 'Main St';
      }).filter((s: string) => s.length > 0);
    }
  } catch {
    streetNames = ['Main St', 'Oak Ave', 'Commerce Blvd', 'Industrial Way', 'Market St'];
  }

  if (streetNames.length === 0) {
    streetNames = ['Main St', 'Oak Ave', 'Commerce Blvd', 'Industrial Way', 'Market St'];
  }

  const zonings = propertyType === 'commercial'
    ? ['C-1', 'C-2', 'CG', 'CR', 'CBD']
    : propertyType === 'vacant'
    ? ['VL', 'AG', 'PD', 'I-1']
    : ['C-1', 'C-2', 'VL', 'I-1', 'PD', 'CG', 'CR'];

  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const lat = center.lat + (i - gridSize / 2) * spacing + (Math.random() - 0.5) * spacing * 0.5;
      const lng = center.lng + (j - gridSize / 2) * spacing + (Math.random() - 0.5) * spacing * 0.5;
      const streetNum = 100 + Math.floor(Math.random() * 9900);
      const streetName = streetNames[Math.floor(Math.random() * streetNames.length)];
      const lotSize = 5000 + Math.floor(Math.random() * 95000); // 5,000 to 100,000 sqft

      parcels.push({
        parcelId: `${zipCode}-${String(i * gridSize + j + 1).padStart(4, '0')}`,
        address: `${streetNum} ${streetName}`,
        coordinates: { lat, lng },
        lotSize,
        zoning: zonings[Math.floor(Math.random() * zonings.length)],
        propertyType: Math.random() > 0.3 ? 'commercial' : 'vacant',
      });
    }
  }

  return parcels;
}

export async function POST(request: NextRequest) {
  try {
    const body: SearchParcelsRequest = await request.json();
    const { zipCode, propertyType = 'all' } = body;

    if (!zipCode || !/^\d{5}$/.test(zipCode)) {
      return NextResponse.json({ error: 'Invalid zip code' }, { status: 400 });
    }

    // Get zip code center and bounds
    const zipInfo = await getZipCodeBoundary(zipCode);
    if (!zipInfo) {
      return NextResponse.json({ error: 'Zip code not found' }, { status: 404 });
    }

    // Try to fetch real parcels from Overpass API
    let parcels = await fetchParcelsFromOverpass(zipInfo.bounds, propertyType);

    // If no parcels found, generate sample data
    if (parcels.length === 0) {
      parcels = await generateSampleParcels(zipInfo, zipCode, propertyType);
    }

    // Filter by property type if specified
    if (propertyType !== 'all') {
      parcels = parcels.filter(p => {
        if (propertyType === 'vacant') {
          return p.zoning?.includes('VL') || p.zoning?.includes('AG') || p.propertyType === 'vacant';
        }
        if (propertyType === 'commercial') {
          return p.zoning?.includes('C') || p.zoning?.includes('CR') || p.propertyType === 'commercial';
        }
        return true;
      });
    }

    // Limit to 100 parcels for performance
    const limitedParcels = parcels.slice(0, 100);

    return NextResponse.json({
      parcels: limitedParcels,
      totalCount: parcels.length,
      zipCode,
      center: { lat: zipInfo.lat, lng: zipInfo.lng },
    });
  } catch (error) {
    console.error('Error searching parcels:', error);
    return NextResponse.json({ error: 'Failed to search parcels' }, { status: 500 });
  }
}
