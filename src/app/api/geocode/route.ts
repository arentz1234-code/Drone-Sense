import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { address } = await request.json();

    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    // Try Google Geocoding API first if available
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (googleApiKey) {
      const googleResponse = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${googleApiKey}`
      );
      const googleData = await googleResponse.json();

      if (googleData.status === 'OK' && googleData.results.length > 0) {
        const location = googleData.results[0].geometry.location;
        return NextResponse.json({
          lat: location.lat,
          lng: location.lng,
          formattedAddress: googleData.results[0].formatted_address,
        });
      }
    }

    // Fallback to Nominatim
    const nominatimResponse = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      {
        headers: {
          'User-Agent': 'DroneSense/1.0 (https://drone-sense.vercel.app; Commercial Site Analysis)',
        },
      }
    );

    if (!nominatimResponse.ok) {
      throw new Error(`Nominatim error: ${nominatimResponse.status}`);
    }

    const nominatimData = await nominatimResponse.json();

    if (nominatimData && nominatimData.length > 0) {
      return NextResponse.json({
        lat: parseFloat(nominatimData[0].lat),
        lng: parseFloat(nominatimData[0].lon),
        formattedAddress: nominatimData[0].display_name,
      });
    }

    return NextResponse.json({ error: 'Address not found' }, { status: 404 });
  } catch (error) {
    console.error('Geocoding error:', error);
    return NextResponse.json(
      { error: 'Geocoding failed' },
      { status: 500 }
    );
  }
}
