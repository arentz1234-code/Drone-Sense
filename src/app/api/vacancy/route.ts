import { NextRequest, NextResponse } from 'next/server';

export interface VacancyResponse {
  // Overall market saturation
  marketSaturationScore: number; // 0-100 (100 = very saturated)
  saturationLevel: 'undersupplied' | 'balanced' | 'saturated' | 'oversupplied';

  // Business establishment data
  establishments: {
    total: number;
    perCapita: number; // per 1,000 residents
    vsNationalAverage: number; // ratio (1.0 = average)
  };

  // Sector breakdown (NAICS)
  sectors: {
    retail: { count: number; perCapita: number; saturation: 'low' | 'medium' | 'high' };
    foodService: { count: number; perCapita: number; saturation: 'low' | 'medium' | 'high' };
    healthcare: { count: number; perCapita: number; saturation: 'low' | 'medium' | 'high' };
    professional: { count: number; perCapita: number; saturation: 'low' | 'medium' | 'high' };
    finance: { count: number; perCapita: number; saturation: 'low' | 'medium' | 'high' };
  };

  // Opportunity analysis
  opportunities: {
    undersuppliedSectors: string[];
    oversuppliedSectors: string[];
    recommendations: string[];
  };

  // Trend data (if available)
  trend?: {
    previousYear: number;
    currentYear: number;
    changePercent: number;
    direction: 'growing' | 'stable' | 'shrinking';
  };

  // Geographic info
  jurisdiction: string;
  population: number;
  year: number;
  source: string;
}

// National averages per 1,000 population (from Census CBP)
const NATIONAL_AVERAGES = {
  totalEstablishments: 27.5,
  retail: 3.8, // NAICS 44-45
  foodService: 2.4, // NAICS 722
  healthcare: 2.1, // NAICS 62
  professional: 4.2, // NAICS 54
  finance: 1.8, // NAICS 52
};

interface CBPData {
  establishments: number;
  retail: number;
  foodService: number;
  healthcare: number;
  professional: number;
  finance: number;
}

async function getCountyInfo(lat: number, lng: number): Promise<{ name: string; state: string; fips: string } | null> {
  try {
    const response = await fetch(
      `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&layers=Counties&format=json`
    );
    if (!response.ok) return null;

    const data = await response.json();
    const county = data.result?.geographies?.Counties?.[0];

    if (!county) return null;

    return {
      name: county.NAME,
      state: county.STATE,
      fips: county.GEOID,
    };
  } catch (error) {
    console.error('County lookup error:', error);
    return null;
  }
}

async function getCountyPopulation(stateFips: string, countyFips: string): Promise<number> {
  try {
    const url = `https://api.census.gov/data/2022/acs/acs5?get=B01003_001E&for=county:${countyFips}&in=state:${stateFips}`;
    const response = await fetch(url);
    if (!response.ok) return 100000; // Default

    const data = await response.json();
    return parseInt(data[1]?.[0]) || 100000;
  } catch {
    return 100000;
  }
}

async function fetchCBPData(stateFips: string, countyFips: string): Promise<CBPData | null> {
  try {
    // Census County Business Patterns API
    // https://www.census.gov/data/developers/data-sets/cbp-nonemp-zbp.html
    const year = 2021; // Most recent available

    // Fetch total establishments and by NAICS sector
    const baseUrl = `https://api.census.gov/data/${year}/cbp`;

    // Total establishments
    const totalUrl = `${baseUrl}?get=ESTAB&for=county:${countyFips}&in=state:${stateFips}`;
    const totalResponse = await fetch(totalUrl);

    // Retail (NAICS 44-45)
    const retailUrl = `${baseUrl}?get=ESTAB&NAICS2017=44&for=county:${countyFips}&in=state:${stateFips}`;
    const retailResponse = await fetch(retailUrl);

    // Food Services (NAICS 722)
    const foodUrl = `${baseUrl}?get=ESTAB&NAICS2017=722&for=county:${countyFips}&in=state:${stateFips}`;
    const foodResponse = await fetch(foodUrl);

    // Healthcare (NAICS 62)
    const healthUrl = `${baseUrl}?get=ESTAB&NAICS2017=62&for=county:${countyFips}&in=state:${stateFips}`;
    const healthResponse = await fetch(healthUrl);

    // Professional Services (NAICS 54)
    const profUrl = `${baseUrl}?get=ESTAB&NAICS2017=54&for=county:${countyFips}&in=state:${stateFips}`;
    const profResponse = await fetch(profUrl);

    // Finance (NAICS 52)
    const financeUrl = `${baseUrl}?get=ESTAB&NAICS2017=52&for=county:${countyFips}&in=state:${stateFips}`;
    const financeResponse = await fetch(financeUrl);

    // Parse responses
    const parseResponse = async (response: Response): Promise<number> => {
      if (!response.ok) return 0;
      const data = await response.json();
      return parseInt(data[1]?.[0]) || 0;
    };

    return {
      establishments: await parseResponse(totalResponse),
      retail: await parseResponse(retailResponse),
      foodService: await parseResponse(foodResponse),
      healthcare: await parseResponse(healthResponse),
      professional: await parseResponse(profResponse),
      finance: await parseResponse(financeResponse),
    };
  } catch (error) {
    console.error('CBP API error:', error);
    return null;
  }
}

async function fetchFromGooglePlaces(lat: number, lng: number): Promise<{ data: CBPData; source: string } | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.log('[Vacancy] Google Places API key not configured');
    return null;
  }

  try {
    const radius = 3000; // 3km radius
    const baseUrl = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';

    // Search for different business types
    const searchTypes = [
      { type: 'store', category: 'retail' },
      { type: 'restaurant', category: 'foodService' },
      { type: 'hospital', category: 'healthcare' },
      { type: 'doctor', category: 'healthcare' },
      { type: 'pharmacy', category: 'healthcare' },
      { type: 'accounting', category: 'professional' },
      { type: 'lawyer', category: 'professional' },
      { type: 'bank', category: 'finance' },
    ];

    const counts = { retail: 0, foodService: 0, healthcare: 0, professional: 0, finance: 0 };

    // Fetch in parallel (limit to avoid rate limits)
    const results = await Promise.all(
      searchTypes.map(async ({ type, category }) => {
        try {
          const url = `${baseUrl}?location=${lat},${lng}&radius=${radius}&type=${type}&key=${apiKey}`;
          const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
          if (!response.ok) return { category, count: 0 };
          const data = await response.json();
          return { category, count: data.results?.length || 0 };
        } catch {
          return { category, count: 0 };
        }
      })
    );

    // Aggregate counts by category
    for (const { category, count } of results) {
      counts[category as keyof typeof counts] += count;
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(`[Vacancy] Google Places found ${total} establishments`);

    return {
      data: {
        establishments: total * 3, // Multiply since we only search some types
        retail: counts.retail * 2,
        foodService: counts.foodService,
        healthcare: counts.healthcare,
        professional: counts.professional * 2,
        finance: counts.finance,
      },
      source: 'Google Places API',
    };
  } catch (error) {
    console.error('[Vacancy] Google Places error:', error);
    return null;
  }
}

async function estimateFromOSM(lat: number, lng: number): Promise<CBPData> {
  try {
    const radius = 5000; // 5km radius

    // For a rough estimate, query each type separately
    const retailQuery = `[out:json][timeout:10];node["shop"](around:${radius},${lat},${lng});out count;`;
    const foodQuery = `[out:json][timeout:10];node["amenity"~"restaurant|cafe|fast_food"](around:${radius},${lat},${lng});out count;`;

    const [retailRes, foodRes] = await Promise.all([
      fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: `data=${encodeURIComponent(retailQuery)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }),
      fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: `data=${encodeURIComponent(foodQuery)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }),
    ]);

    const retailData = await retailRes.json();
    const foodData = await foodRes.json();

    const retailCount = retailData.elements?.length || 50;
    const foodCount = foodData.elements?.length || 30;

    // Estimate other categories based on typical ratios
    return {
      establishments: (retailCount + foodCount) * 3,
      retail: retailCount,
      foodService: foodCount,
      healthcare: Math.round(foodCount * 0.5),
      professional: Math.round(retailCount * 0.8),
      finance: Math.round(retailCount * 0.3),
    };
  } catch (error) {
    console.error('OSM estimation error:', error);
    // Return median values
    return {
      establishments: 2000,
      retail: 300,
      foodService: 200,
      healthcare: 150,
      professional: 400,
      finance: 100,
    };
  }
}

function calculateSaturation(perCapita: number, nationalAvg: number): 'low' | 'medium' | 'high' {
  const ratio = perCapita / nationalAvg;
  if (ratio < 0.7) return 'low';
  if (ratio > 1.3) return 'high';
  return 'medium';
}

function analyzeSaturationLevel(totalPerCapita: number): {
  score: number;
  level: 'undersupplied' | 'balanced' | 'saturated' | 'oversupplied';
} {
  const ratio = totalPerCapita / NATIONAL_AVERAGES.totalEstablishments;

  // Score: 0 = very undersupplied, 50 = balanced, 100 = very oversupplied
  const score = Math.min(100, Math.max(0, Math.round(ratio * 50)));

  let level: 'undersupplied' | 'balanced' | 'saturated' | 'oversupplied';
  if (ratio < 0.7) level = 'undersupplied';
  else if (ratio < 1.2) level = 'balanced';
  else if (ratio < 1.5) level = 'saturated';
  else level = 'oversupplied';

  return { score, level };
}

function generateOpportunityAnalysis(
  sectors: VacancyResponse['sectors']
): VacancyResponse['opportunities'] {
  const undersupplied: string[] = [];
  const oversupplied: string[] = [];
  const recommendations: string[] = [];

  const sectorNames: Record<keyof typeof sectors, string> = {
    retail: 'Retail',
    foodService: 'Food Service / Restaurants',
    healthcare: 'Healthcare',
    professional: 'Professional Services',
    finance: 'Financial Services',
  };

  for (const [key, data] of Object.entries(sectors)) {
    const sectorName = sectorNames[key as keyof typeof sectorNames];
    if (data.saturation === 'low') {
      undersupplied.push(sectorName);
    } else if (data.saturation === 'high') {
      oversupplied.push(sectorName);
    }
  }

  if (undersupplied.length > 0) {
    recommendations.push(`Undersupplied sectors present opportunity: ${undersupplied.join(', ')}`);
  }

  if (oversupplied.length > 0) {
    recommendations.push(`High competition in: ${oversupplied.join(', ')} - differentiation needed`);
  }

  if (sectors.retail.saturation === 'low' && sectors.foodService.saturation === 'low') {
    recommendations.push('Area may be underserved - strong opportunity for neighborhood retail');
  }

  if (sectors.foodService.saturation === 'high') {
    recommendations.push('Restaurant market saturated - consider unique concept or different sector');
  }

  if (sectors.healthcare.saturation === 'low') {
    recommendations.push('Healthcare services undersupplied - medical office, pharmacy, or clinic may succeed');
  }

  if (recommendations.length === 0) {
    recommendations.push('Market is balanced - focus on location quality and execution');
  }

  return { undersuppliedSectors: undersupplied, oversuppliedSectors: oversupplied, recommendations };
}

export async function POST(request: NextRequest) {
  try {
    const { lat, lng } = await request.json();

    if (!lat || !lng) {
      return NextResponse.json({ error: 'Coordinates required' }, { status: 400 });
    }

    const countyInfo = await getCountyInfo(lat, lng);
    let cbpData: CBPData | null = null;
    let population = 100000;
    let jurisdiction = 'Unknown County';
    let source = 'Estimated from OpenStreetMap';

    if (countyInfo) {
      jurisdiction = countyInfo.name;
      population = await getCountyPopulation(countyInfo.state, countyInfo.fips.slice(-3));
    }

    // Try Google Places first (most accurate for nearby businesses)
    const googleResult = await fetchFromGooglePlaces(lat, lng);
    if (googleResult) {
      cbpData = googleResult.data;
      source = googleResult.source;
    }

    // Fall back to Census CBP if Google Places fails
    if (!cbpData && countyInfo) {
      cbpData = await fetchCBPData(countyInfo.state, countyInfo.fips.slice(-3));
      if (cbpData) {
        source = 'U.S. Census Bureau County Business Patterns';
      }
    }

    // Fall back to OSM estimation if both fail
    if (!cbpData) {
      cbpData = await estimateFromOSM(lat, lng);
      source = 'Estimated from OpenStreetMap';
    }

    const popThousands = population / 1000;

    const sectors: VacancyResponse['sectors'] = {
      retail: {
        count: cbpData.retail,
        perCapita: Math.round((cbpData.retail / popThousands) * 100) / 100,
        saturation: calculateSaturation(cbpData.retail / popThousands, NATIONAL_AVERAGES.retail),
      },
      foodService: {
        count: cbpData.foodService,
        perCapita: Math.round((cbpData.foodService / popThousands) * 100) / 100,
        saturation: calculateSaturation(cbpData.foodService / popThousands, NATIONAL_AVERAGES.foodService),
      },
      healthcare: {
        count: cbpData.healthcare,
        perCapita: Math.round((cbpData.healthcare / popThousands) * 100) / 100,
        saturation: calculateSaturation(cbpData.healthcare / popThousands, NATIONAL_AVERAGES.healthcare),
      },
      professional: {
        count: cbpData.professional,
        perCapita: Math.round((cbpData.professional / popThousands) * 100) / 100,
        saturation: calculateSaturation(cbpData.professional / popThousands, NATIONAL_AVERAGES.professional),
      },
      finance: {
        count: cbpData.finance,
        perCapita: Math.round((cbpData.finance / popThousands) * 100) / 100,
        saturation: calculateSaturation(cbpData.finance / popThousands, NATIONAL_AVERAGES.finance),
      },
    };

    const totalPerCapita = cbpData.establishments / popThousands;
    const { score, level } = analyzeSaturationLevel(totalPerCapita);

    const response: VacancyResponse = {
      marketSaturationScore: score,
      saturationLevel: level,
      establishments: {
        total: cbpData.establishments,
        perCapita: Math.round(totalPerCapita * 100) / 100,
        vsNationalAverage: Math.round((totalPerCapita / NATIONAL_AVERAGES.totalEstablishments) * 100) / 100,
      },
      sectors,
      opportunities: generateOpportunityAnalysis(sectors),
      jurisdiction,
      population,
      year: 2021,
      source,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Vacancy data error:', error);
    return NextResponse.json({ error: 'Failed to fetch vacancy data' }, { status: 500 });
  }
}
