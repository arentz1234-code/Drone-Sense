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
      // Start with a small radius (~50m) and expand if needed
      // This ensures we get imagery actually near the address, not from a distant street
      const searchRadii = [0.0005, 0.001, 0.002, 0.003]; // ~50m, ~100m, ~200m, ~300m

      let foundImage = null;

      for (const radius of searchRadii) {
        const bbox = `${coordinates.lng - radius},${coordinates.lat - radius},${coordinates.lng + radius},${coordinates.lat + radius}`;
        // Request multiple images so we can find the closest one
        const mapillaryUrl = `https://graph.mapillary.com/images?fields=id,thumb_1024_url,captured_at,compass_angle,geometry&bbox=${bbox}&limit=10`;

        const response = await fetch(mapillaryUrl, {
          headers: {
            'Authorization': `OAuth ${mapillaryToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.data && data.data.length > 0) {
            // Find the closest image by calculating distance
            let closestImage = null;
            let closestDistance = Infinity;

            for (const image of data.data) {
              if (image.thumb_1024_url && image.geometry?.coordinates) {
                const [imgLng, imgLat] = image.geometry.coordinates;
                // Simple distance calculation (good enough for small distances)
                const distance = Math.sqrt(
                  Math.pow(imgLat - coordinates.lat, 2) +
                  Math.pow(imgLng - coordinates.lng, 2)
                );
                if (distance < closestDistance) {
                  closestDistance = distance;
                  closestImage = image;
                }
              }
            }

            if (closestImage) {
              foundImage = closestImage;
              break; // Found a close image, stop searching
            }
          }
        } else {
          console.log('Mapillary API error:', response.status, await response.text());
          break;
        }
      }

      if (foundImage) {
        photos.push({
          url: foundImage.thumb_1024_url,
          label: 'Street View',
          type: 'mapillary',
          available: true,
        });
      }
    } catch (e) {
      console.error('Mapillary fetch error:', e);
    }
  }

  return NextResponse.json({ photos });
}
