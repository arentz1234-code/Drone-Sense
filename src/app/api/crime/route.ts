import { NextRequest, NextResponse } from 'next/server';

export interface CrimeDataResponse {
  // Overall safety metrics
  safetyScore: number; // 0-100 (100 = safest)
  safetyGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  crimeIndex: number; // Relative to national average (1.0 = average)

  // Crime rates per 100,000 people
  violentCrimeRate: number;
  propertyCrimeRate: number;
  totalCrimeRate: number;

  // Comparison to averages
  vsNationalAverage: 'lower' | 'average' | 'higher' | 'much higher';
  vsStateAverage: 'lower' | 'average' | 'higher' | 'much higher';

  // Breakdown (if available)
  breakdown?: {
    homicide?: number;
    rape?: number;
    robbery?: number;
    assault?: number;
    burglary?: number;
    larceny?: number;
    motorVehicleTheft?: number;
    arson?: number;
  };

  // Business impact
  businessImpact: {
    insurancePremiumImpact: 'low' | 'moderate' | 'high';
    securityRecommendations: string[];
    operationalConsiderations: string[];
  };

  // Data source info
  dataYear: number;
  jurisdiction: string;
  source: string;
}

// National averages (2022 FBI UCR data)
const NATIONAL_AVERAGES = {
  violentCrime: 380.7, // per 100,000
  propertyCrime: 1954.4, // per 100,000
  totalCrime: 2335.1,
};

// State averages (simplified - would need full dataset)
const STATE_AVERAGES: Record<string, { violent: number; property: number }> = {
  FL: { violent: 383.6, property: 1887.7 },
  TX: { violent: 446.5, property: 2199.1 },
  CA: { violent: 499.5, property: 2436.7 },
  GA: { violent: 400.1, property: 2200.0 },
  NY: { violent: 363.8, property: 1401.3 },
  // Add more states as needed
};

function calculateSafetyScore(crimeIndex: number): number {
  // Convert crime index to safety score (inverse relationship)
  // Index of 1.0 = national average = 50 score
  // Index of 0.5 = half national average = 75 score
  // Index of 2.0 = double national average = 25 score
  const score = Math.round(100 - (crimeIndex * 50));
  return Math.max(0, Math.min(100, score));
}

function getSafetyGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  if (score >= 35) return 'D';
  return 'F';
}

function getComparison(rate: number, average: number): 'lower' | 'average' | 'higher' | 'much higher' {
  const ratio = rate / average;
  if (ratio < 0.7) return 'lower';
  if (ratio <= 1.3) return 'average';
  if (ratio <= 2.0) return 'higher';
  return 'much higher';
}

function analyzeBusinessImpact(crimeIndex: number, violentRate: number): CrimeDataResponse['businessImpact'] {
  const recommendations: string[] = [];
  const considerations: string[] = [];
  let insuranceImpact: 'low' | 'moderate' | 'high' = 'low';

  if (crimeIndex > 1.5) {
    insuranceImpact = 'high';
    recommendations.push('Install comprehensive security camera system');
    recommendations.push('Consider security guard during operating hours');
    recommendations.push('Install reinforced doors and security glass');
    considerations.push('Higher insurance premiums likely');
    considerations.push('May affect employee recruitment');
    considerations.push('Consider limiting cash on hand');
  } else if (crimeIndex > 1.0) {
    insuranceImpact = 'moderate';
    recommendations.push('Standard security camera system recommended');
    recommendations.push('Quality exterior lighting essential');
    recommendations.push('Consider alarm system with monitoring');
    considerations.push('Standard security measures should suffice');
    considerations.push('Insurance costs at normal rates');
  } else {
    insuranceImpact = 'low';
    recommendations.push('Basic security measures sufficient');
    recommendations.push('Standard exterior lighting');
    considerations.push('Low crime area - favorable for retail');
    considerations.push('Insurance premiums likely lower than average');
  }

  // Add specific recommendations based on violent crime
  if (violentRate > 500) {
    recommendations.push('Panic buttons at registers recommended');
    considerations.push('Avoid isolated locations or late-night hours');
  }

  return {
    insurancePremiumImpact: insuranceImpact,
    securityRecommendations: recommendations,
    operationalConsiderations: considerations,
  };
}

async function getStateFromCoordinates(lat: number, lng: number): Promise<string | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'User-Agent': 'DroneSense/1.0' } }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.address?.state || null;
  } catch {
    return null;
  }
}

async function getCountyFIPS(lat: number, lng: number): Promise<{ state: string; county: string; fips: string } | null> {
  try {
    // Use Census Geocoder to get FIPS codes
    const response = await fetch(
      `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&layers=Counties&format=json`
    );
    if (!response.ok) return null;

    const data = await response.json();
    const county = data.result?.geographies?.Counties?.[0];

    if (!county) return null;

    return {
      state: county.STATE,
      county: county.COUNTY,
      fips: county.GEOID,
    };
  } catch (error) {
    console.error('FIPS lookup error:', error);
    return null;
  }
}

async function fetchFBICrimeData(stateFips: string, countyFips: string): Promise<CrimeDataResponse['breakdown'] | null> {
  try {
    // FBI Crime Data Explorer API
    const apiKey = process.env.FBI_API_KEY;
    if (!apiKey) {
      console.log('FBI API key not configured');
      return null;
    }

    // Note: FBI API requires registration at https://crime-data-explorer.fr.cloud.gov/api
    const url = `https://api.usa.gov/crime/fbi/sapi/api/summarized/agencies/byStateAbbr/${stateFips}/offenses/2022/2022?api_key=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    // Process FBI data format - structure varies by endpoint
    return data.results?.[0] || null;
  } catch (error) {
    console.error('FBI API error:', error);
    return null;
  }
}

async function estimateCrimeFromOpenData(lat: number, lng: number): Promise<Partial<CrimeDataResponse>> {
  // Use multiple free sources to estimate crime levels
  const countyInfo = await getCountyFIPS(lat, lng);

  if (!countyInfo) {
    // Return national average estimates if can't determine location
    return {
      violentCrimeRate: NATIONAL_AVERAGES.violentCrime,
      propertyCrimeRate: NATIONAL_AVERAGES.propertyCrime,
      totalCrimeRate: NATIONAL_AVERAGES.totalCrime,
      crimeIndex: 1.0,
      dataYear: 2022,
      jurisdiction: 'Unknown',
      source: 'National average estimate',
    };
  }

  // Try to get state-level data
  const stateAbbr = await getStateFromCoordinates(lat, lng);
  const stateData = stateAbbr ? STATE_AVERAGES[stateAbbr.substring(0, 2).toUpperCase()] : null;

  // Use state average if available, otherwise national
  const violentRate = stateData?.violent || NATIONAL_AVERAGES.violentCrime;
  const propertyRate = stateData?.property || NATIONAL_AVERAGES.propertyCrime;
  const totalRate = violentRate + propertyRate;
  const crimeIndex = totalRate / NATIONAL_AVERAGES.totalCrime;

  return {
    violentCrimeRate: Math.round(violentRate * 10) / 10,
    propertyCrimeRate: Math.round(propertyRate * 10) / 10,
    totalCrimeRate: Math.round(totalRate * 10) / 10,
    crimeIndex: Math.round(crimeIndex * 100) / 100,
    dataYear: 2022,
    jurisdiction: stateAbbr || 'Unknown',
    source: stateData ? 'State-level FBI UCR data' : 'National average estimate',
  };
}

// Try to fetch from city/county open data portals
async function fetchLocalCrimeData(lat: number, lng: number): Promise<Partial<CrimeDataResponse> | null> {
  // Many cities have open data portals - this could be expanded
  // For now, check for major metro areas with known APIs

  // Example: Check if near a major city with open crime data
  try {
    const reverseGeocode = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`,
      { headers: { 'User-Agent': 'DroneSense/1.0' } }
    );
    const geoData = await reverseGeocode.json();
    const city = geoData.address?.city || geoData.address?.town;

    // Add city-specific API calls here as needed
    // Example cities with open crime APIs:
    // - Chicago: https://data.cityofchicago.org/
    // - Los Angeles: https://data.lacity.org/
    // - New York: https://data.cityofnewyork.us/
    // - Atlanta: https://atlantapd.org/opendata

    console.log(`Location near: ${city} - checking for local crime data`);
    return null; // Placeholder - would implement city-specific APIs
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { lat, lng } = await request.json();

    if (!lat || !lng) {
      return NextResponse.json({ error: 'Coordinates required' }, { status: 400 });
    }

    // Try local data first, then fall back to estimates
    const localData = await fetchLocalCrimeData(lat, lng);
    const estimatedData = await estimateCrimeFromOpenData(lat, lng);

    const crimeData = localData || estimatedData;

    const violentRate = crimeData.violentCrimeRate || NATIONAL_AVERAGES.violentCrime;
    const propertyRate = crimeData.propertyCrimeRate || NATIONAL_AVERAGES.propertyCrime;
    const totalRate = crimeData.totalCrimeRate || NATIONAL_AVERAGES.totalCrime;
    const crimeIndex = crimeData.crimeIndex || 1.0;

    const safetyScore = calculateSafetyScore(crimeIndex);
    const stateAbbr = await getStateFromCoordinates(lat, lng);
    const stateAvg = stateAbbr ? STATE_AVERAGES[stateAbbr.substring(0, 2).toUpperCase()] : null;

    const response: CrimeDataResponse = {
      safetyScore,
      safetyGrade: getSafetyGrade(safetyScore),
      crimeIndex,
      violentCrimeRate: violentRate,
      propertyCrimeRate: propertyRate,
      totalCrimeRate: totalRate,
      vsNationalAverage: getComparison(totalRate, NATIONAL_AVERAGES.totalCrime),
      vsStateAverage: stateAvg
        ? getComparison(totalRate, stateAvg.violent + stateAvg.property)
        : 'average',
      businessImpact: analyzeBusinessImpact(crimeIndex, violentRate),
      dataYear: crimeData.dataYear || 2022,
      jurisdiction: crimeData.jurisdiction || 'Unknown',
      source: crimeData.source || 'FBI UCR estimates',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Crime data error:', error);
    return NextResponse.json({ error: 'Failed to fetch crime data' }, { status: 500 });
  }
}
