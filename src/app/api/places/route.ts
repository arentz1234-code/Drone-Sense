// Places API - uses OpenStreetMap Overpass API (free, no key needed)
import { NextResponse } from 'next/server';

interface PlacesRequest {
  coordinates: { lat: number; lng: number };
  radius: number;
}

interface Business {
  name: string;
  type: string;
  distance: string;
  address: string;
}

export async function POST(request: Request) {
  try {
    const body: PlacesRequest = await request.json();
    const { coordinates, radius: providedRadius } = body;

    if (!coordinates) {
      return NextResponse.json({ error: 'No coordinates provided' }, { status: 400 });
    }

    // Default to 1 mile (1609 meters) if no radius provided
    const radius = providedRadius || 1609;

    // Convert radius from meters to degrees (approximately)
    const radiusDeg = (radius / 1000) / 111;

    // Use Overpass API (OpenStreetMap) - completely FREE, no API key needed
    const query = `
      [out:json][timeout:25];
      (
        node["amenity"~"restaurant|cafe|fast_food|bank|pharmacy|fuel"](${coordinates.lat - radiusDeg},${coordinates.lng - radiusDeg},${coordinates.lat + radiusDeg},${coordinates.lng + radiusDeg});
        node["shop"~"supermarket|convenience|mall|department_store"](${coordinates.lat - radiusDeg},${coordinates.lng - radiusDeg},${coordinates.lat + radiusDeg},${coordinates.lng + radiusDeg});
        way["amenity"~"restaurant|cafe|fast_food|bank|pharmacy|fuel"](${coordinates.lat - radiusDeg},${coordinates.lng - radiusDeg},${coordinates.lat + radiusDeg},${coordinates.lng + radiusDeg});
        way["shop"~"supermarket|convenience|mall|department_store"](${coordinates.lat - radiusDeg},${coordinates.lng - radiusDeg},${coordinates.lat + radiusDeg},${coordinates.lng + radiusDeg});
      );
      out center;
    `;

    // Try multiple Overpass mirrors
    const mirrors = [
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass-api.de/api/interpreter',
    ];

    let response = null;
    let lastError = '';

    for (const mirror of mirrors) {
      try {
        response = await fetch(mirror, {
          method: 'POST',
          body: `data=${encodeURIComponent(query)}`,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'DroneSense/1.0 (https://drone-sense.vercel.app)',
          },
        });

        if (response.ok) break;
        lastError = `${mirror} returned ${response.status}`;
      } catch (e) {
        lastError = `${mirror} failed: ${e}`;
      }
    }

    if (!response || !response.ok) {
      console.error('All Overpass mirrors failed:', lastError);
      return NextResponse.json({ businesses: [], error: lastError });
    }

    const data = await response.json();
    console.log('Overpass returned', data.elements?.length || 0, 'elements');
    const allBusinesses: Business[] = [];

    if (data.elements) {
      for (const el of data.elements) {
        const tags = el.tags || {};
        if (!tags.name) continue;

        const lat = el.lat || el.center?.lat;
        const lon = el.lon || el.center?.lon;
        if (!lat || !lon) continue;

        const dist = haversine(coordinates.lat, coordinates.lng, lat, lon);
        if (dist > radius / 1000) continue;

        const type = tags.amenity || tags.shop || 'Business';
        const address = [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']]
          .filter(Boolean).join(' ') || 'Address not available';

        allBusinesses.push({
          name: tags.name,
          type: formatType(type),
          distance: `${(dist * 0.621371).toFixed(2)} mi`,
          address,
        });
      }
    }

    allBusinesses.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
    return NextResponse.json({ businesses: allBusinesses.slice(0, 25) });
  } catch (error) {
    console.error('Places API error:', error);
    return NextResponse.json({ businesses: [], error: String(error) });
  }
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function formatType(type: string): string {
  const map: Record<string, string> = {
    restaurant: 'Restaurant', cafe: 'Cafe', fast_food: 'Fast Food',
    bank: 'Bank', pharmacy: 'Pharmacy', fuel: 'Gas Station',
    supermarket: 'Grocery', convenience: 'Convenience', mall: 'Mall',
  };
  return map[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

