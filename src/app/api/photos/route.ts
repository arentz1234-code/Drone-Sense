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

  // 2. Street Map - ArcGIS Street Map (FREE, no API key required, very reliable)
  const streetMapUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/export?bbox=${coordinates.lng - 0.002},${coordinates.lat - 0.0015},${coordinates.lng + 0.002},${coordinates.lat + 0.0015}&bboxSR=4326&size=600,400&format=jpg&f=image`;

  photos.push({
    url: streetMapUrl,
    label: 'Street Map',
    type: 'map',
    available: true,
  });

  // 3. Google Street View (preferred if API key available)
  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (googleApiKey) {
    // Google Street View Static API
    const googleStreetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${coordinates.lat},${coordinates.lng}&fov=90&heading=0&pitch=0&key=${googleApiKey}`;

    // Check if street view is available at this location
    const metadataUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${coordinates.lat},${coordinates.lng}&key=${googleApiKey}`;

    try {
      const metaResponse = await fetch(metadataUrl);
      const metaData = await metaResponse.json();

      if (metaData.status === 'OK') {
        photos.push({
          url: googleStreetViewUrl,
          label: 'Street View',
          type: 'streetView',
          available: true,
        });
      }
    } catch (e) {
      console.error('Google Street View metadata error:', e);
    }
  }

  // 4. Mapillary Street-Level Imagery - FREE fallback (50k requests/day)
  // Only use if Google Street View not available
  const hasStreetView = photos.some(p => p.type === 'streetView');
  const mapillaryToken = process.env.MAPILLARY_ACCESS_TOKEN;

  if (!hasStreetView && mapillaryToken) {
    try {
      // Search with expanding radius
      const searchRadii = [0.0003, 0.0006, 0.001, 0.002]; // ~30m, ~60m, ~100m, ~200m

      let bestImage = null;
      let bestScore = -Infinity;

      for (const radius of searchRadii) {
        const bbox = `${coordinates.lng - radius},${coordinates.lat - radius},${coordinates.lng + radius},${coordinates.lat + radius}`;
        const mapillaryUrl = `https://graph.mapillary.com/images?fields=id,thumb_1024_url,captured_at,compass_angle,geometry&bbox=${bbox}&limit=20`;

        const response = await fetch(mapillaryUrl, {
          headers: {
            'Authorization': `OAuth ${mapillaryToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.data && data.data.length > 0) {
            for (const image of data.data) {
              if (image.thumb_1024_url && image.geometry?.coordinates) {
                const [imgLng, imgLat] = image.geometry.coordinates;

                // Calculate distance from image to property
                const distance = Math.sqrt(
                  Math.pow(imgLat - coordinates.lat, 2) +
                  Math.pow(imgLng - coordinates.lng, 2)
                );

                // Calculate if camera is facing toward the property
                // Angle from image location to property
                const angleToProperty = Math.atan2(
                  coordinates.lng - imgLng,
                  coordinates.lat - imgLat
                ) * 180 / Math.PI;

                // Normalize to 0-360
                const normalizedAngle = (angleToProperty + 360) % 360;
                const compassAngle = image.compass_angle || 0;

                // Calculate how well the camera is facing the property (0 = perfect, 180 = opposite)
                let angleDiff = Math.abs(normalizedAngle - compassAngle);
                if (angleDiff > 180) angleDiff = 360 - angleDiff;

                // Score: prioritize close distance and camera facing property
                // Lower distance is better, lower angle diff is better
                const distanceScore = 1 / (distance + 0.0001); // Avoid division by zero
                const angleScore = (180 - angleDiff) / 180; // 1 = perfect, 0 = opposite direction
                const score = distanceScore * 0.4 + angleScore * 0.6;

                if (score > bestScore) {
                  bestScore = score;
                  bestImage = image;
                }
              }
            }

            // If we found a good image (facing property), stop searching
            if (bestImage && bestScore > 0.5) {
              break;
            }
          }
        } else {
          console.log('Mapillary API error:', response.status);
          break;
        }
      }

      if (bestImage) {
        photos.push({
          url: bestImage.thumb_1024_url,
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
