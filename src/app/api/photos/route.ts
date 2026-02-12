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
  const aerialUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${coordinates.lng - 0.001},${coordinates.lat - 0.0008},${coordinates.lng + 0.001},${coordinates.lat + 0.0008}&bboxSR=4326&size=600,400&format=jpg&f=image`;

  photos.push({
    url: aerialUrl,
    label: 'Aerial View',
    type: 'aerial',
    available: true,
  });

  // 2. OpenStreetMap Static Map - FREE, no API key required
  const osmUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${coordinates.lat},${coordinates.lng}&zoom=18&size=600x400&markers=${coordinates.lat},${coordinates.lng},red-pushpin`;

  photos.push({
    url: osmUrl,
    label: 'Street Map',
    type: 'map',
    available: true,
  });

  // 3. Mapillary Street-Level Imagery - FREE (50k requests/day)
  const mapillaryToken = process.env.MAPILLARY_ACCESS_TOKEN;
  if (mapillaryToken) {
    try {
      // Search within ~500m radius for street-level imagery (0.005 degrees each direction)
      // Max allowed is 0.01 sq degrees (0.1 x 0.1), we use 0.01 x 0.01 = 0.0001 sq degrees
      const bbox = `${coordinates.lng - 0.005},${coordinates.lat - 0.005},${coordinates.lng + 0.005},${coordinates.lat + 0.005}`;
      const mapillaryUrl = `https://graph.mapillary.com/images?fields=id,thumb_1024_url,captured_at,compass_angle&bbox=${bbox}&limit=1`;

      const response = await fetch(mapillaryUrl, {
        headers: {
          'Authorization': `OAuth ${mapillaryToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data && data.data.length > 0) {
          const image = data.data[0];
          if (image.thumb_1024_url) {
            photos.push({
              url: image.thumb_1024_url,
              label: 'Street View',
              type: 'mapillary',
              available: true,
            });
          }
        }
      } else {
        console.log('Mapillary API error:', response.status, await response.text());
      }
    } catch (e) {
      console.error('Mapillary fetch error:', e);
    }
  }

  return NextResponse.json({ photos });
}
