import { NextResponse } from 'next/server';

// Parse address components for structured geocoding
function parseAddress(address: string): { street?: string; city?: string; state?: string; zip?: string } {
  // Common patterns: "123 Main St, City, ST 12345" or "123 Main St, City, State 12345"
  const parts = address.split(',').map(p => p.trim());

  if (parts.length >= 2) {
    const street = parts[0];
    const lastPart = parts[parts.length - 1];

    // Extract state and zip from last part (e.g., "FL 32312" or "Florida 32312")
    const stateZipMatch = lastPart.match(/([A-Za-z]{2,})\s*(\d{5}(?:-\d{4})?)?$/);
    const state = stateZipMatch?.[1];
    const zip = stateZipMatch?.[2];

    // City is typically second-to-last part, or extract from last part before state
    let city = parts.length >= 3 ? parts[parts.length - 2] : undefined;
    if (!city && lastPart && stateZipMatch) {
      city = lastPart.replace(stateZipMatch[0], '').trim();
    }

    return { street, city, state, zip };
  }

  return {};
}

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
          source: 'google',
        });
      }
    }

    // Try US Census Geocoder (free and very accurate for US addresses)
    try {
      const censusUrl = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&format=json`;

      const censusResponse = await fetch(censusUrl, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (censusResponse.ok) {
        const censusData = await censusResponse.json();

        if (censusData.result?.addressMatches?.length > 0) {
          const match = censusData.result.addressMatches[0];
          const coords = match.coordinates;

          return NextResponse.json({
            lat: coords.y,
            lng: coords.x,
            formattedAddress: match.matchedAddress,
            source: 'census',
          });
        }
      }
    } catch (censusError) {
      console.log('Census geocoder error, falling back to Nominatim:', censusError);
    }

    // Try Nominatim with structured search for better accuracy
    const parsed = parseAddress(address);
    let nominatimUrl: string;

    if (parsed.street && parsed.city && parsed.state) {
      // Use structured search for more precise results
      nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&street=${encodeURIComponent(parsed.street)}&city=${encodeURIComponent(parsed.city)}&state=${encodeURIComponent(parsed.state)}${parsed.zip ? `&postalcode=${parsed.zip}` : ''}&countrycodes=us&limit=1&addressdetails=1`;
    } else {
      // Fallback to free-form search
      nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=us&limit=1&addressdetails=1`;
    }

    const nominatimResponse = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'DroneSense/1.0 (https://drone-sense.vercel.app; Commercial Site Analysis)',
      },
    });

    if (!nominatimResponse.ok) {
      throw new Error(`Nominatim error: ${nominatimResponse.status}`);
    }

    const nominatimData = await nominatimResponse.json();

    if (nominatimData && nominatimData.length > 0) {
      const result = nominatimData[0];

      // Check if we got a specific address or just a street/road
      // If it's just a road, try to warn but still return
      const isStreetOnly = result.addresstype === 'road' || result.class === 'highway';

      return NextResponse.json({
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        formattedAddress: result.display_name,
        source: 'nominatim',
        warning: isStreetOnly ? 'Could not find exact address, showing approximate street location' : undefined,
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
