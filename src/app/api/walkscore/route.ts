import { NextRequest, NextResponse } from 'next/server';

export interface WalkScoreResponse {
  walkScore: number;
  walkDescription: string;
  transitScore: number | null;
  transitDescription: string | null;
  bikeScore: number | null;
  bikeDescription: string | null;
  // Computed fields for site analysis
  pedestrianFriendly: boolean;
  transitAccessible: boolean;
  retailViability: 'excellent' | 'good' | 'fair' | 'poor';
  recommendations: string[];
  source: string; // Data source indicator for transparency
  isEstimate: boolean; // Whether this is an estimate vs official API data
}

// Walk Score descriptions
const walkDescriptions: Record<number, string> = {
  90: 'Walker\'s Paradise - Daily errands do not require a car',
  70: 'Very Walkable - Most errands can be accomplished on foot',
  50: 'Somewhat Walkable - Some errands can be accomplished on foot',
  25: 'Car-Dependent - Most errands require a car',
  0: 'Almost All Errands Require a Car',
};

const transitDescriptions: Record<number, string> = {
  90: 'Excellent Transit - Convenient for most trips',
  70: 'Excellent Transit - Many nearby public transportation options',
  50: 'Good Transit - Many nearby public transportation options',
  25: 'Some Transit - A few public transportation options',
  0: 'Minimal Transit - Few public transportation options',
};

const bikeDescriptions: Record<number, string> = {
  90: 'Biker\'s Paradise - Daily errands can be accomplished on a bike',
  70: 'Very Bikeable - Biking is convenient for most trips',
  50: 'Bikeable - Some bike infrastructure',
  25: 'Somewhat Bikeable - Minimal bike infrastructure',
  0: 'Somewhat Bikeable - Minimal bike infrastructure',
};

function getDescription(score: number, descriptions: Record<number, string>): string {
  if (score >= 90) return descriptions[90];
  if (score >= 70) return descriptions[70];
  if (score >= 50) return descriptions[50];
  if (score >= 25) return descriptions[25];
  return descriptions[0];
}

function analyzeRetailViability(walkScore: number, transitScore: number | null): {
  viability: 'excellent' | 'good' | 'fair' | 'poor';
  recommendations: string[];
} {
  const recommendations: string[] = [];
  let viability: 'excellent' | 'good' | 'fair' | 'poor' = 'fair';

  const effectiveTransit = transitScore ?? 0;
  const combinedScore = (walkScore * 0.7) + (effectiveTransit * 0.3);

  if (combinedScore >= 80) {
    viability = 'excellent';
    recommendations.push('Excellent pedestrian traffic potential - ideal for foot-traffic-dependent retail');
    recommendations.push('Consider restaurants, cafes, boutiques, or service businesses');
    if (transitScore && transitScore >= 70) {
      recommendations.push('Strong transit access expands customer catchment area');
    }
  } else if (combinedScore >= 60) {
    viability = 'good';
    recommendations.push('Good walkability supports neighborhood retail and services');
    recommendations.push('Local convenience stores, dry cleaners, and professional services work well');
    if (walkScore < 70) {
      recommendations.push('Consider businesses that also accommodate drive-up customers');
    }
  } else if (combinedScore >= 40) {
    viability = 'fair';
    recommendations.push('Moderate walkability - focus on destination retail or service businesses');
    recommendations.push('Ensure adequate parking as most customers will drive');
    recommendations.push('QSR with drive-thru, auto services, or appointment-based businesses recommended');
  } else {
    viability = 'poor';
    recommendations.push('Car-dependent location - pedestrian retail not recommended');
    recommendations.push('Focus on destination businesses: big-box retail, auto dealers, warehousing');
    recommendations.push('Drive-thru and ample parking are essential');
  }

  return { viability, recommendations };
}

async function fetchWalkScore(lat: number, lng: number, address: string): Promise<WalkScoreResponse> {
  const apiKey = process.env.WALKSCORE_API_KEY;

  // If no API key, return estimated scores based on location type
  if (!apiKey) {
    console.log('Walk Score API key not configured - using estimates');
    return getEstimatedWalkScore(lat, lng);
  }

  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://api.walkscore.com/score?format=json&lat=${lat}&lon=${lng}&address=${encodedAddress}&transit=1&bike=1&wsapikey=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Walk Score API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 1) {
      // Walk Score returns status !== 1 for errors
      throw new Error(`Walk Score error: ${data.description || 'Unknown error'}`);
    }

    const walkScore = data.walkscore ?? 0;
    const transitScore = data.transit?.score ?? null;
    const bikeScore = data.bike?.score ?? null;

    const { viability, recommendations } = analyzeRetailViability(walkScore, transitScore);

    return {
      walkScore,
      walkDescription: data.description || getDescription(walkScore, walkDescriptions),
      transitScore,
      transitDescription: transitScore !== null ? getDescription(transitScore, transitDescriptions) : null,
      bikeScore,
      bikeDescription: bikeScore !== null ? getDescription(bikeScore, bikeDescriptions) : null,
      pedestrianFriendly: walkScore >= 70,
      transitAccessible: transitScore !== null && transitScore >= 50,
      retailViability: viability,
      recommendations,
      source: 'Walk Score API (official)',
      isEstimate: false,
    };
  } catch (error) {
    console.error('Walk Score API error:', error);
    // Fall back to estimates
    return getEstimatedWalkScore(lat, lng);
  }
}

async function getEstimatedWalkScore(lat: number, lng: number): Promise<WalkScoreResponse> {
  // Use OpenStreetMap to estimate walkability based on nearby amenities
  try {
    const radius = 800; // 800m ~ 0.5 miles (10 min walk)
    const query = `
      [out:json][timeout:10];
      (
        node["shop"](around:${radius},${lat},${lng});
        node["amenity"~"restaurant|cafe|bank|pharmacy|school"](around:${radius},${lat},${lng});
        way["highway"~"footway|pedestrian|cycleway"](around:${radius},${lat},${lng});
        node["public_transport"](around:${radius},${lat},${lng});
      );
      out count;
    `;

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    if (!response.ok) {
      throw new Error('Overpass API error');
    }

    const data = await response.json();
    const count = data.elements?.[0]?.tags?.total || 0;

    // Estimate walk score based on amenity count
    let walkScore = Math.min(100, Math.round(count * 2.5));
    walkScore = Math.max(10, walkScore); // Minimum score

    // Rough transit estimate (lower confidence)
    const transitScore = count > 20 ? Math.min(70, count * 1.5) : null;
    const bikeScore = Math.min(80, Math.round(count * 2));

    const { viability, recommendations } = analyzeRetailViability(walkScore, transitScore);
    recommendations.unshift('Note: Scores are estimates - consider obtaining official Walk Score API key');

    return {
      walkScore,
      walkDescription: getDescription(walkScore, walkDescriptions),
      transitScore: transitScore ? Math.round(transitScore) : null,
      transitDescription: transitScore ? getDescription(Math.round(transitScore), transitDescriptions) : null,
      bikeScore,
      bikeDescription: getDescription(bikeScore, bikeDescriptions),
      pedestrianFriendly: walkScore >= 70,
      transitAccessible: transitScore !== null && transitScore >= 50,
      retailViability: viability,
      recommendations,
      source: 'OpenStreetMap amenity count estimate',
      isEstimate: true,
    };
  } catch (error) {
    console.error('Walk Score estimation error:', error);
    // Return conservative defaults
    return {
      walkScore: 25,
      walkDescription: 'Unable to determine walkability - manual verification recommended',
      transitScore: null,
      transitDescription: null,
      bikeScore: null,
      bikeDescription: null,
      pedestrianFriendly: false,
      transitAccessible: false,
      retailViability: 'fair',
      recommendations: ['Walk Score data unavailable - assess pedestrian infrastructure manually'],
      source: 'Unable to fetch - using defaults',
      isEstimate: true,
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { lat, lng, address } = await request.json();

    if (!lat || !lng) {
      return NextResponse.json({ error: 'Coordinates required' }, { status: 400 });
    }

    const result = await fetchWalkScore(lat, lng, address || `${lat},${lng}`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Walk Score error:', error);
    return NextResponse.json({ error: 'Failed to fetch Walk Score data' }, { status: 500 });
  }
}
