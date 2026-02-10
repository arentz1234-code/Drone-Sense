import { NextRequest, NextResponse } from 'next/server';

export interface EnvironmentalRiskResponse {
  floodZone: {
    zone: string;
    risk: 'low' | 'medium' | 'high';
    description: string;
    panel?: string;
  };
  wetlands: {
    present: boolean;
    distance?: number;
    types?: string[];
  };
  brownfields: {
    present: boolean;
    count: number;
    sites?: { name: string; distance: number; status: string }[];
  };
  superfund: {
    present: boolean;
    count: number;
    sites?: { name: string; distance: number; status: string }[];
  };
  overallRiskScore: number;
  riskFactors: string[];
}

async function fetchFloodZone(lat: number, lng: number): Promise<EnvironmentalRiskResponse['floodZone']> {
  try {
    // FEMA NFHL REST API
    const url = `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=FLD_ZONE,ZONE_SUBTY,SFHA_TF&returnGeometry=false&f=json`;

    const response = await fetch(url);
    if (!response.ok) throw new Error('FEMA API error');

    const data = await response.json();
    const feature = data.features?.[0]?.attributes;

    if (!feature) {
      return {
        zone: 'X',
        risk: 'low',
        description: 'Area of minimal flood hazard',
      };
    }

    const zone = feature.FLD_ZONE || 'X';
    const isSFHA = feature.SFHA_TF === 'T';

    let risk: 'low' | 'medium' | 'high' = 'low';
    let description = 'Area of minimal flood hazard';

    if (zone.startsWith('A') || zone.startsWith('V')) {
      risk = 'high';
      description = zone.startsWith('V')
        ? 'Coastal high hazard area with velocity hazard (wave action)'
        : 'High-risk flood zone (1% annual chance of flooding)';
    } else if (zone === 'X' && isSFHA) {
      risk = 'medium';
      description = 'Moderate flood hazard area (0.2% annual chance)';
    } else if (zone === 'B' || zone === 'C') {
      risk = 'medium';
      description = 'Moderate to low risk flood zone';
    }

    return { zone, risk, description };
  } catch (error) {
    console.error('Flood zone fetch error:', error);
    return {
      zone: 'Unknown',
      risk: 'medium',
      description: 'Unable to determine flood zone - recommend manual verification',
    };
  }
}

async function fetchWetlands(lat: number, lng: number): Promise<EnvironmentalRiskResponse['wetlands']> {
  try {
    // NWI Wetlands API - check within 500m buffer
    const buffer = 0.005; // ~500m
    const bbox = `${lng - buffer},${lat - buffer},${lng + buffer},${lat + buffer}`;
    const url = `https://www.fws.gov/wetlandsmapservice/rest/services/Wetlands/MapServer/0/query?geometry=${bbox}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=WETLAND_TYPE&returnGeometry=false&f=json`;

    const response = await fetch(url);
    if (!response.ok) throw new Error('Wetlands API error');

    const data = await response.json();
    const features = data.features || [];

    if (features.length === 0) {
      return { present: false };
    }

    const types = [...new Set(features.map((f: { attributes: { WETLAND_TYPE: string } }) => f.attributes.WETLAND_TYPE))];

    return {
      present: true,
      distance: 0, // Within buffer
      types: types as string[],
    };
  } catch (error) {
    console.error('Wetlands fetch error:', error);
    return { present: false };
  }
}

async function fetchBrownfields(lat: number, lng: number): Promise<EnvironmentalRiskResponse['brownfields']> {
  try {
    // EPA FRS (Facility Registry Service) - filter for brownfield-related sites
    const radiusMeters = 1609; // 1 mile
    const url = `https://gispub.epa.gov/arcgis/rest/services/OEI/FRS_INTERESTS/MapServer/7/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&distance=${radiusMeters}&units=esriSRUnit_Meter&where=INTEREST_TYPE+LIKE+'%25BROWNFIELD%25'+OR+INTEREST_TYPE+LIKE+'%25RCRA%25'+OR+INTEREST_TYPE+LIKE+'%25CERCLA%25'&outFields=PRIMARY_NAME,INTEREST_TYPE,ACTIVE_STATUS,LATITUDE83,LONGITUDE83&returnGeometry=false&f=json`;

    const response = await fetch(url);
    if (!response.ok) {
      return { present: false, count: 0 };
    }

    const data = await response.json();
    const features = data.features || [];

    if (features.length === 0) {
      return { present: false, count: 0 };
    }

    const sites = features.slice(0, 5).map((feature: { attributes: { PRIMARY_NAME: string; INTEREST_TYPE: string; ACTIVE_STATUS: string; LATITUDE83: number; LONGITUDE83: number } }) => {
      const attrs = feature.attributes;
      // Calculate actual distance
      let distance = 0.5;
      if (attrs.LATITUDE83 && attrs.LONGITUDE83) {
        const R = 3959;
        const dLat = (attrs.LATITUDE83 - lat) * Math.PI / 180;
        const dLon = (attrs.LONGITUDE83 - lng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat * Math.PI / 180) * Math.cos(attrs.LATITUDE83 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      }
      return {
        name: attrs.PRIMARY_NAME || 'Unknown Site',
        distance: Math.round(distance * 100) / 100,
        status: attrs.ACTIVE_STATUS || attrs.INTEREST_TYPE || 'Unknown',
      };
    });

    return {
      present: true,
      count: features.length,
      sites,
    };
  } catch (error) {
    console.error('Brownfields fetch error:', error);
    return { present: false, count: 0 };
  }
}

async function fetchSuperfund(lat: number, lng: number): Promise<EnvironmentalRiskResponse['superfund']> {
  try {
    // ArcGIS Online Superfund NPL Sites layer
    const radiusMeters = 3219; // 2 miles for superfund (larger search area due to significance)
    const url = `https://services.arcgis.com/cJ9YHowT8TU7DUyn/ArcGIS/rest/services/Superfund_National_Priorities_List_(NPL)_Sites_with_Status_Information/FeatureServer/0/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&distance=${radiusMeters}&units=esriSRUnit_Meter&outFields=*&returnGeometry=true&f=json`;

    const response = await fetch(url);
    if (!response.ok) {
      return { present: false, count: 0 };
    }

    const data = await response.json();
    const features = data.features || [];

    if (features.length === 0) {
      return { present: false, count: 0 };
    }

    const sites = features.slice(0, 3).map((feature: { attributes: { site_name?: string; npl_status?: string; Site_Name?: string; NPL_Status?: string }; geometry?: { x: number; y: number } }) => {
      const attrs = feature.attributes;
      // Calculate actual distance from geometry if available
      let distance = 1.0;
      if (feature.geometry?.x && feature.geometry?.y) {
        const R = 3959;
        const dLat = (feature.geometry.y - lat) * Math.PI / 180;
        const dLon = (feature.geometry.x - lng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat * Math.PI / 180) * Math.cos(feature.geometry.y * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      }
      return {
        name: attrs.site_name || attrs.Site_Name || 'Unknown Site',
        distance: Math.round(distance * 100) / 100,
        status: attrs.npl_status || attrs.NPL_Status || 'Active',
      };
    });

    return {
      present: true,
      count: features.length,
      sites,
    };
  } catch (error) {
    console.error('Superfund fetch error:', error);
    return { present: false, count: 0 };
  }
}

function calculateOverallRisk(
  floodZone: EnvironmentalRiskResponse['floodZone'],
  wetlands: EnvironmentalRiskResponse['wetlands'],
  brownfields: EnvironmentalRiskResponse['brownfields'],
  superfund: EnvironmentalRiskResponse['superfund']
): { score: number; factors: string[] } {
  let score = 100; // Start with perfect score
  const factors: string[] = [];

  // Flood zone impact
  if (floodZone.risk === 'high') {
    score -= 35;
    factors.push('High-risk flood zone significantly impacts development potential');
  } else if (floodZone.risk === 'medium') {
    score -= 15;
    factors.push('Moderate flood risk may require flood insurance');
  }

  // Wetlands impact
  if (wetlands.present) {
    score -= 25;
    factors.push('Nearby wetlands may restrict development and require permits');
  }

  // Brownfields impact
  if (brownfields.present) {
    score -= 20;
    factors.push(`${brownfields.count} brownfield site(s) nearby may require environmental assessment`);
  }

  // Superfund impact
  if (superfund.present) {
    score -= 30;
    factors.push(`${superfund.count} Superfund site(s) nearby - significant environmental concern`);
  }

  return { score: Math.max(0, score), factors };
}

export async function POST(request: NextRequest) {
  try {
    const { lat, lng } = await request.json();

    if (!lat || !lng) {
      return NextResponse.json({ error: 'Coordinates required' }, { status: 400 });
    }

    // Fetch all environmental data in parallel
    const [floodZone, wetlands, brownfields, superfund] = await Promise.all([
      fetchFloodZone(lat, lng),
      fetchWetlands(lat, lng),
      fetchBrownfields(lat, lng),
      fetchSuperfund(lat, lng),
    ]);

    const { score, factors } = calculateOverallRisk(floodZone, wetlands, brownfields, superfund);

    const response: EnvironmentalRiskResponse = {
      floodZone,
      wetlands,
      brownfields,
      superfund,
      overallRiskScore: score,
      riskFactors: factors,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Environmental risk error:', error);
    return NextResponse.json({ error: 'Failed to fetch environmental data' }, { status: 500 });
  }
}
