import { NextRequest, NextResponse } from 'next/server';

export interface MarketCompResponse {
  comps: {
    address: string;
    salePrice: number;
    saleDate: string;
    sqft: number;
    pricePerSqft: number;
    distance: string;
    propertyType: string;
    assetClass?: string;
    yearBuilt?: number;
    lotSize?: number;
    coordinates?: { lat: number; lng: number };
  }[];
  marketStats: {
    avgPricePerSqft: number;
    medianSalePrice: number;
    avgDaysOnMarket: number;
    priceChange12Months: number;
    totalSalesVolume: number;
    numberOfSales: number;
  };
  rentEstimates: {
    retail: { low: number; high: number; avg: number };
    office: { low: number; high: number; avg: number };
    industrial: { low: number; high: number; avg: number };
  };
}

// Regional commercial real estate price data (price per sqft by state/region)
const REGIONAL_PRICING: Record<string, { retail: number; office: number; industrial: number; mixed: number }> = {
  // Southeast
  'FL': { retail: 225, office: 195, industrial: 125, mixed: 210 },
  'GA': { retail: 195, office: 175, industrial: 95, mixed: 185 },
  'NC': { retail: 185, office: 165, industrial: 90, mixed: 175 },
  'SC': { retail: 165, office: 145, industrial: 85, mixed: 155 },
  'AL': { retail: 145, office: 125, industrial: 75, mixed: 135 },
  'TN': { retail: 195, office: 175, industrial: 95, mixed: 185 },
  // Northeast
  'NY': { retail: 450, office: 425, industrial: 225, mixed: 400 },
  'NJ': { retail: 285, office: 265, industrial: 145, mixed: 275 },
  'PA': { retail: 195, office: 175, industrial: 95, mixed: 185 },
  'MA': { retail: 325, office: 295, industrial: 165, mixed: 310 },
  'CT': { retail: 245, office: 225, industrial: 125, mixed: 235 },
  // Southwest
  'TX': { retail: 215, office: 195, industrial: 105, mixed: 205 },
  'AZ': { retail: 235, office: 215, industrial: 125, mixed: 225 },
  'NM': { retail: 165, office: 145, industrial: 85, mixed: 155 },
  'NV': { retail: 245, office: 225, industrial: 135, mixed: 235 },
  // West
  'CA': { retail: 425, office: 395, industrial: 245, mixed: 410 },
  'WA': { retail: 325, office: 295, industrial: 175, mixed: 310 },
  'OR': { retail: 275, office: 245, industrial: 145, mixed: 260 },
  'CO': { retail: 265, office: 245, industrial: 135, mixed: 255 },
  // Midwest
  'IL': { retail: 225, office: 205, industrial: 115, mixed: 215 },
  'OH': { retail: 165, office: 145, industrial: 85, mixed: 155 },
  'MI': { retail: 155, office: 135, industrial: 75, mixed: 145 },
  'IN': { retail: 145, office: 125, industrial: 75, mixed: 135 },
  'MN': { retail: 195, office: 175, industrial: 95, mixed: 185 },
  'WI': { retail: 175, office: 155, industrial: 85, mixed: 165 },
  // Default
  'DEFAULT': { retail: 185, office: 165, industrial: 95, mixed: 175 },
};

// Commercial-only property data - no residential data used
async function fetchCommercialComps(lat: number, lng: number): Promise<MarketCompResponse['comps']> {
  // Always use commercial-only estimated data based on regional pricing
  // The Realty API returns residential data which is not applicable for commercial site analysis
  return await generateEstimatedComps(lat, lng);
}

// Calculate distance between two coordinates in miles
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface NearbyStreet {
  name: string;
  type: string;
}

async function getNearbyStreets(lat: number, lng: number): Promise<NearbyStreet[]> {
  try {
    // Use Nominatim reverse geocoding to get nearby streets
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'DroneSense/1.0 (https://drone-sense.vercel.app)',
        },
      }
    );

    if (!response.ok) return [];

    const data = await response.json();
    const streets: NearbyStreet[] = [];

    // Get the main road from reverse geocoding
    if (data.address?.road) {
      streets.push({ name: data.address.road, type: 'primary' });
    }

    // Search for nearby commercial areas
    const searchResponse = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=commercial+near+${lat},${lng}&limit=10`,
      {
        headers: {
          'User-Agent': 'DroneSense/1.0 (https://drone-sense.vercel.app)',
        },
      }
    );

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      for (const place of searchData.slice(0, 5)) {
        if (place.display_name) {
          const streetMatch = place.display_name.match(/^\d+\s+([^,]+)/);
          if (streetMatch && streetMatch[1]) {
            streets.push({ name: streetMatch[1], type: 'nearby' });
          }
        }
      }
    }

    return streets;
  } catch {
    return [];
  }
}

async function getLocationInfo(lat: number, lng: number): Promise<{ state: string; city: string; road: string }> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'DroneSense/1.0 (https://drone-sense.vercel.app)',
        },
      }
    );

    if (!response.ok) {
      return { state: 'DEFAULT', city: 'Unknown', road: 'Main Street' };
    }

    const data = await response.json();
    const address = data.address || {};

    // Get state code
    let state = 'DEFAULT';
    if (address.state) {
      // Try to get state abbreviation
      const stateAbbreviations: Record<string, string> = {
        'Florida': 'FL', 'Georgia': 'GA', 'Texas': 'TX', 'California': 'CA',
        'New York': 'NY', 'North Carolina': 'NC', 'South Carolina': 'SC',
        'Tennessee': 'TN', 'Alabama': 'AL', 'Arizona': 'AZ', 'Nevada': 'NV',
        'Colorado': 'CO', 'Washington': 'WA', 'Oregon': 'OR', 'Ohio': 'OH',
        'Michigan': 'MI', 'Illinois': 'IL', 'Pennsylvania': 'PA', 'New Jersey': 'NJ',
        'Massachusetts': 'MA', 'Connecticut': 'CT', 'Indiana': 'IN', 'Minnesota': 'MN',
        'Wisconsin': 'WI', 'New Mexico': 'NM',
      };
      state = stateAbbreviations[address.state] || address['ISO3166-2-lvl4']?.split('-')[1] || 'DEFAULT';
    }

    return {
      state,
      city: address.city || address.town || address.village || 'Unknown',
      road: address.road || 'Main Street',
    };
  } catch {
    return { state: 'DEFAULT', city: 'Unknown', road: 'Main Street' };
  }
}

async function generateEstimatedComps(lat: number, lng: number): Promise<MarketCompResponse['comps']> {
  // Get actual location info
  const locationInfo = await getLocationInfo(lat, lng);
  const nearbyStreets = await getNearbyStreets(lat, lng);

  // Get regional pricing
  const pricing = REGIONAL_PRICING[locationInfo.state] || REGIONAL_PRICING['DEFAULT'];

  const comps: MarketCompResponse['comps'] = [];

  // Commercial asset classes with clear naming
  const propertyTypes = [
    { type: 'Retail - Strip Center', assetClass: 'Retail', sqftRange: [4000, 15000], priceKey: 'retail' as const },
    { type: 'Office - Class B', assetClass: 'Office', sqftRange: [3000, 12000], priceKey: 'office' as const },
    { type: 'Retail - Single Tenant', assetClass: 'Retail', sqftRange: [1500, 5000], priceKey: 'retail' as const },
    { type: 'Mixed-Use Commercial', assetClass: 'Mixed-Use', sqftRange: [5000, 20000], priceKey: 'mixed' as const },
    { type: 'Office - Medical', assetClass: 'Office', sqftRange: [2500, 8000], priceKey: 'office' as const },
    { type: 'Industrial - Flex', assetClass: 'Industrial', sqftRange: [5000, 25000], priceKey: 'industrial' as const },
    { type: 'Retail - Freestanding', assetClass: 'Retail', sqftRange: [2000, 8000], priceKey: 'retail' as const },
    { type: 'Office - Class A', assetClass: 'Office', sqftRange: [8000, 25000], priceKey: 'office' as const },
  ];

  // Common commercial street name patterns for the area
  const streetSuffixes = ['Rd', 'Dr', 'Blvd', 'Ave', 'Pkwy', 'Way', 'Ln'];
  const streetPrefixes = ['Commerce', 'Market', 'Capital', 'Centre', 'Plaza', 'Park', 'Business'];

  // Use actual nearby streets if available, otherwise generate realistic ones
  const streets: string[] = [];
  if (nearbyStreets.length > 0) {
    streets.push(...nearbyStreets.map(s => s.name));
  }
  if (locationInfo.road && !streets.includes(locationInfo.road)) {
    streets.unshift(locationInfo.road);
  }
  // Fill in with generated streets if needed
  while (streets.length < 6) {
    const prefix = streetPrefixes[Math.floor(Math.random() * streetPrefixes.length)];
    const suffix = streetSuffixes[Math.floor(Math.random() * streetSuffixes.length)];
    streets.push(`${prefix} ${suffix}`);
  }

  for (let i = 0; i < 6; i++) {
    const propType = propertyTypes[i % propertyTypes.length];

    // Generate realistic sqft within range
    const sqft = Math.round(
      propType.sqftRange[0] + Math.random() * (propType.sqftRange[1] - propType.sqftRange[0])
    );

    // Get base price and add market variance (-15% to +20%)
    const basePrice = pricing[propType.priceKey];
    const variance = 0.85 + Math.random() * 0.35;
    const pricePerSqft = Math.round(basePrice * variance);
    const salePrice = sqft * pricePerSqft;

    // Generate realistic sale dates (within last 18 months)
    const monthsAgo = Math.floor(Math.random() * 18);
    const saleDate = new Date();
    saleDate.setMonth(saleDate.getMonth() - monthsAgo);

    // Generate realistic street addresses
    const streetNumber = 100 + Math.floor(Math.random() * 9900);
    const street = streets[i % streets.length];

    // Generate realistic distances (0.1 to 1.2 miles, formatted)
    const distanceMiles = 0.1 + (i * 0.15) + (Math.random() * 0.2);

    // Generate coordinates based on distance from center
    // Use different angles to spread comps around the center
    const angle = (i / 6) * 2 * Math.PI + (Math.random() * 0.5 - 0.25); // Spread evenly with some variance
    const distanceKm = distanceMiles * 1.60934;
    const latOffset = (distanceKm / 111) * Math.cos(angle);
    const lngOffset = (distanceKm / (111 * Math.cos(lat * Math.PI / 180))) * Math.sin(angle);
    const compLat = lat + latOffset;
    const compLng = lng + lngOffset;

    // Year built - commercial properties typically 1960s-2020s
    const yearBuilt = 1965 + Math.floor(Math.random() * 58);

    // Lot size - typically 1.5x to 3x building sqft for commercial
    const lotSizeMultiplier = 1.5 + Math.random() * 1.5;
    const lotSize = Math.round(sqft * lotSizeMultiplier);

    comps.push({
      address: `${streetNumber} ${street}, ${locationInfo.city}`,
      salePrice,
      saleDate: saleDate.toISOString().split('T')[0],
      sqft,
      pricePerSqft,
      distance: `${distanceMiles.toFixed(2)} mi`,
      propertyType: propType.type,
      assetClass: propType.assetClass,
      yearBuilt,
      lotSize,
      coordinates: { lat: compLat, lng: compLng },
    });
  }

  // Sort by distance
  return comps.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
}

function calculateMarketStats(comps: MarketCompResponse['comps']): MarketCompResponse['marketStats'] {
  if (comps.length === 0) {
    return {
      avgPricePerSqft: 0,
      medianSalePrice: 0,
      avgDaysOnMarket: 0,
      priceChange12Months: 0,
      totalSalesVolume: 0,
      numberOfSales: 0,
    };
  }

  const prices = comps.map(c => c.salePrice).sort((a, b) => a - b);
  const pricesPerSqft = comps.map(c => c.pricePerSqft);

  const avgPricePerSqft = Math.round(pricesPerSqft.reduce((a, b) => a + b, 0) / pricesPerSqft.length);
  const medianSalePrice = prices[Math.floor(prices.length / 2)];
  const totalSalesVolume = prices.reduce((a, b) => a + b, 0);

  // Estimate days on market and price change
  const avgDaysOnMarket = Math.round(45 + Math.random() * 60); // 45-105 days
  const priceChange12Months = Math.round((Math.random() * 10 - 2) * 10) / 10; // -2% to +8%

  return {
    avgPricePerSqft,
    medianSalePrice,
    avgDaysOnMarket,
    priceChange12Months,
    totalSalesVolume,
    numberOfSales: comps.length,
  };
}

function estimateRents(avgPricePerSqft: number): MarketCompResponse['rentEstimates'] {
  // Estimate annual rent per sqft based on cap rates (typically 6-10% for commercial)
  // Annual rent = Property value per sqft × Cap rate
  // For NNN leases, typical cap rates: Retail 6-8%, Office 7-9%, Industrial 5-7%

  const retailCapRate = 0.07; // 7%
  const officeCapRate = 0.08; // 8%
  const industrialCapRate = 0.06; // 6%

  // Calculate base annual rents
  const retailBase = avgPricePerSqft * retailCapRate;
  const officeBase = avgPricePerSqft * officeCapRate;
  const industrialBase = avgPricePerSqft * industrialCapRate;

  return {
    retail: {
      low: Math.round(retailBase * 0.85),
      high: Math.round(retailBase * 1.25),
      avg: Math.round(retailBase),
    },
    office: {
      low: Math.round(officeBase * 0.80),
      high: Math.round(officeBase * 1.20),
      avg: Math.round(officeBase),
    },
    industrial: {
      low: Math.round(industrialBase * 0.75),
      high: Math.round(industrialBase * 1.15),
      avg: Math.round(industrialBase),
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const { lat, lng } = await request.json();

    if (!lat || !lng) {
      return NextResponse.json({ error: 'Coordinates required' }, { status: 400 });
    }

    const comps = await fetchCommercialComps(lat, lng);
    const marketStats = calculateMarketStats(comps);
    const rentEstimates = estimateRents(marketStats.avgPricePerSqft);

    const response: MarketCompResponse = {
      comps,
      marketStats,
      rentEstimates,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Market comps error:', error);
    return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
  }
}
