import { NextResponse } from 'next/server';

interface PhotoRequest {
  coordinates: { lat: number; lng: number };
  address?: string;
  apn?: string;
}

interface PhotoResponse {
  photos: Array<{
    url: string;
    label: string;
    type: 'streetView' | 'aerial' | 'map' | 'mapillary';
    available: boolean;
  }>;
}

export async function POST(request: Request) {
  const body: PhotoRequest = await request.json();
  const { coordinates } = body;

  if (!coordinates) {
    return NextResponse.json({ error: 'Coordinates required' }, { status: 400 });
  }

  const photos: PhotoResponse['photos'] = [];

  // 1. ArcGIS World Imagery (Aerial/Satellite) - FREE, no API key required
  // Using ArcGIS REST API for static export
  const aerialUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${coordinates.lng - 0.001},${coordinates.lat - 0.0008},${coordinates.lng + 0.001},${coordinates.lat + 0.0008}&bboxSR=4326&size=600,400&format=jpg&f=image`;

  photos.push({
    url: aerialUrl,
    label: 'Aerial View',
    type: 'aerial',
    available: true,
  });

  // 2. OpenStreetMap Static Map - FREE, no API key required
  // Using OSM static map service
  const osmUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${coordinates.lat},${coordinates.lng}&zoom=18&size=600x400&markers=${coordinates.lat},${coordinates.lng},red-pushpin`;

  photos.push({
    url: osmUrl,
    label: 'Street Map',
    type: 'map',
    available: true,
  });

  // 3. Check Mapillary for street-level imagery (FREE, crowdsourced)
  // Mapillary is free but coverage varies by location
  try {
    const mapillaryClientId = process.env.MAPILLARY_CLIENT_ID;
    if (mapillaryClientId) {
      const searchRadius = 50; // meters
      const mapillaryUrl = `https://graph.mapillary.com/images?access_token=${mapillaryClientId}&fields=id,thumb_1024_url&bbox=${coordinates.lng - 0.0005},${coordinates.lat - 0.0005},${coordinates.lng + 0.0005},${coordinates.lat + 0.0005}&limit=1`;

      const response = await fetch(mapillaryUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.data && data.data.length > 0 && data.data[0].thumb_1024_url) {
          photos.push({
            url: data.data[0].thumb_1024_url,
            label: 'Street View (Mapillary)',
            type: 'mapillary',
            available: true,
          });
        }
      }
    }
  } catch (e) {
    // Mapillary not available, continue without it
  }

  return NextResponse.json({ photos });
}
