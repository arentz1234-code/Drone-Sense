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
    const { coordinates, radius } = body;

    if (!coordinates) {
      return NextResponse.json({ error: 'No coordinates provided' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
      // Return mock data if no API key configured
      return NextResponse.json({ businesses: getMockBusinesses() });
    }

    // Use Google Places API Nearby Search
    const types = ['restaurant', 'store', 'gas_station', 'shopping_mall', 'supermarket', 'bank', 'cafe'];
    const allBusinesses: Business[] = [];

    for (const type of types) {
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${coordinates.lat},${coordinates.lng}&radius=${radius}&type=${type}&key=${apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.results) {
        for (const place of data.results.slice(0, 5)) {
          const distance = calculateDistance(
            coordinates.lat,
            coordinates.lng,
            place.geometry.location.lat,
            place.geometry.location.lng
          );

          allBusinesses.push({
            name: place.name,
            type: formatPlaceType(place.types?.[0] || type),
            distance: `${distance.toFixed(2)} mi`,
            address: place.vicinity || 'Address not available',
          });
        }
      }
    }

    // Remove duplicates and sort by distance
    const uniqueBusinesses = allBusinesses.filter(
      (business, index, self) =>
        index === self.findIndex((b) => b.name === business.name)
    );

    uniqueBusinesses.sort((a, b) => {
      const distA = parseFloat(a.distance);
      const distB = parseFloat(b.distance);
      return distA - distB;
    });

    return NextResponse.json({ businesses: uniqueBusinesses.slice(0, 20) });
  } catch (error) {
    console.error('Places API error:', error);
    return NextResponse.json({ businesses: getMockBusinesses() });
  }
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

function formatPlaceType(type: string): string {
  const typeMap: Record<string, string> = {
    restaurant: 'Restaurant',
    food: 'Food',
    cafe: 'Cafe',
    store: 'Retail',
    shopping_mall: 'Shopping',
    supermarket: 'Grocery',
    gas_station: 'Gas Station',
    bank: 'Bank',
    pharmacy: 'Pharmacy',
    convenience_store: 'Convenience',
    fast_food: 'Fast Food',
    meal_takeaway: 'Takeout',
  };
  return typeMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function getMockBusinesses(): Business[] {
  return [
    { name: "McDonald's", type: 'Fast Food', distance: '0.12 mi', address: '123 Main St' },
    { name: "Chick-fil-A", type: 'Fast Food', distance: '0.18 mi', address: '456 Commerce Dr' },
    { name: 'Shell Gas Station', type: 'Gas Station', distance: '0.22 mi', address: '789 Highway 280' },
    { name: 'Walgreens', type: 'Pharmacy', distance: '0.28 mi', address: '321 Oak Ave' },
    { name: 'Publix', type: 'Grocery', distance: '0.35 mi', address: '555 Market St' },
    { name: 'Starbucks', type: 'Cafe', distance: '0.15 mi', address: '111 Coffee Lane' },
    { name: "Wendy's", type: 'Fast Food', distance: '0.42 mi', address: '222 Burger Blvd' },
    { name: 'Bank of America', type: 'Bank', distance: '0.31 mi', address: '444 Finance Dr' },
  ];
}
