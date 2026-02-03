import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface Business {
  name: string;
  type: string;
  distance: string;
  address: string;
}

interface TrafficInfo {
  estimatedVPD: number;
  vpdRange: string;
  roadType: string;
  trafficLevel: string;
  congestionPercent: number;
}

interface AnalyzeRequest {
  images: string[];
  address: string;
  coordinates: { lat: number; lng: number } | null;
  nearbyBusinesses: Business[];
  trafficData: TrafficInfo | null;
}

// VPD thresholds for different business types
const VPD_THRESHOLDS = {
  bigBox: { min: 25000, ideal: 35000, examples: ['Walmart', 'Target', 'Costco', 'Home Depot', "Lowe's"] },
  gasStation: { min: 15000, ideal: 25000, examples: ['Shell', 'BP', 'Chevron', 'RaceTrac', "Buc-ee's"] },
  fastFood: { min: 15000, ideal: 20000, examples: ["Chick-fil-A", "McDonald's", "Wendy's", 'Taco Bell', "Zaxby's"] },
  casualDining: { min: 12000, ideal: 18000, examples: ["Chili's", "Applebee's", 'Olive Garden', 'Red Lobster'] },
  coffeeShop: { min: 12000, ideal: 18000, examples: ['Starbucks', 'Dunkin', 'Dutch Bros', 'Scooters'] },
  quickService: { min: 10000, ideal: 15000, examples: ['Subway', 'Jersey Mikes', 'Firehouse Subs', 'Jimmy Johns'] },
  convenience: { min: 8000, ideal: 12000, examples: ['7-Eleven', 'Circle K', 'Wawa', 'QuikTrip'] },
  bank: { min: 10000, ideal: 15000, examples: ['Chase', 'Bank of America', 'Wells Fargo', 'Regions'] },
  pharmacy: { min: 12000, ideal: 18000, examples: ['CVS', 'Walgreens', 'Rite Aid'] },
  autoService: { min: 10000, ideal: 15000, examples: ['Jiffy Lube', 'Tire Kingdom', 'AutoZone', "O'Reilly"] },
  medical: { min: 8000, ideal: 12000, examples: ['Urgent Care', 'Dental Office', 'Medical Clinic'] },
  retail: { min: 10000, ideal: 18000, examples: ['Dollar General', 'Dollar Tree', 'Family Dollar', 'Ross'] },
};

function calculateBusinessSuitability(vpd: number) {
  const suitability: Array<{
    category: string;
    suitabilityScore: number;
    reasoning: string;
    examples: string[];
  }> = [];

  for (const [key, threshold] of Object.entries(VPD_THRESHOLDS)) {
    let score = 0;
    let reasoning = '';

    if (vpd >= threshold.ideal) {
      score = 10;
      reasoning = `Excellent fit - VPD of ${vpd.toLocaleString()} exceeds ideal threshold of ${threshold.ideal.toLocaleString()}`;
    } else if (vpd >= threshold.min) {
      score = Math.round(5 + (5 * (vpd - threshold.min) / (threshold.ideal - threshold.min)));
      reasoning = `Good fit - VPD of ${vpd.toLocaleString()} meets minimum threshold of ${threshold.min.toLocaleString()}`;
    } else if (vpd >= threshold.min * 0.7) {
      score = Math.round(3 + (2 * vpd / threshold.min));
      reasoning = `Marginal fit - VPD of ${vpd.toLocaleString()} is below minimum of ${threshold.min.toLocaleString()} but may work with strong local demand`;
    } else {
      score = Math.round(3 * vpd / threshold.min);
      reasoning = `Poor fit - VPD of ${vpd.toLocaleString()} is significantly below minimum threshold of ${threshold.min.toLocaleString()}`;
    }

    const categoryNames: Record<string, string> = {
      bigBox: 'Big Box Retail',
      gasStation: 'Gas Station / Fuel Center',
      fastFood: 'Fast Food Restaurant',
      casualDining: 'Casual Dining Restaurant',
      coffeeShop: 'Coffee Shop / Drive-Thru',
      quickService: 'Quick Service Restaurant',
      convenience: 'Convenience Store',
      bank: 'Bank / Financial Services',
      pharmacy: 'Pharmacy / Drugstore',
      autoService: 'Auto Service / Parts',
      medical: 'Medical / Healthcare',
      retail: 'Discount Retail',
    };

    suitability.push({
      category: categoryNames[key] || key,
      suitabilityScore: Math.max(1, Math.min(10, score)),
      reasoning,
      examples: threshold.examples,
    });
  }

  // Sort by suitability score descending
  return suitability.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
}

export async function POST(request: Request) {
  try {
    const body: AnalyzeRequest = await request.json();
    const { images, address, nearbyBusinesses, trafficData } = body;

    if (!images || images.length === 0) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GOOGLE_GEMINI_API_KEY not configured');
      return NextResponse.json({
        ...getMockAnalysis(nearbyBusinesses, trafficData),
        usingMockData: true,
        reason: 'API key not configured'
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Prepare business context
    const businessContext = nearbyBusinesses.length > 0
      ? `\n\nNearby businesses within scanning radius:\n${nearbyBusinesses.map(b => `- ${b.name} (${b.type}) - ${b.distance}`).join('\n')}`
      : '\n\nNo nearby business data available.';

    // Prepare traffic context
    let trafficContext = '\n\nNo traffic data available.';
    let businessSuitability: ReturnType<typeof calculateBusinessSuitability> = [];

    if (trafficData) {
      trafficContext = `\n\nTraffic Data:
- Estimated VPD (Vehicles Per Day): ${trafficData.estimatedVPD.toLocaleString()}
- VPD Range: ${trafficData.vpdRange}
- Road Type: ${trafficData.roadType}
- Current Traffic Level: ${trafficData.trafficLevel}
- Congestion: ${trafficData.congestionPercent}%

VPD Guidelines for Business Types:
- Big Box Stores (Walmart, Target): 25,000-35,000+ VPD ideal
- Gas Stations: 15,000-25,000+ VPD ideal (corner lots preferred)
- Fast Food (Chick-fil-A, McDonald's): 15,000-20,000+ VPD ideal
- Coffee Shops (Starbucks, Dunkin): 12,000-18,000+ VPD ideal
- Quick Service Restaurants: 10,000-15,000+ VPD ideal
- Convenience Stores: 8,000-12,000+ VPD ideal
- Banks/Pharmacies: 10,000-18,000+ VPD ideal`;

      businessSuitability = calculateBusinessSuitability(trafficData.estimatedVPD);
    }

    // Prepare image content for Gemini
    const imageParts = images.map((img) => {
      const match = img.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        return {
          inlineData: {
            mimeType: match[1],
            data: match[2],
          },
        };
      }
      return null;
    }).filter(Boolean);

    const prompt = `You are an expert commercial real estate analyst and site evaluator. Analyze these drone/aerial images of a property located at: ${address}
${businessContext}
${trafficContext}

Please provide a comprehensive site analysis in the following JSON format:
{
  "viabilityScore": <number 1-10>,
  "terrain": "<brief description of terrain - flat, sloped, rocky, etc.>",
  "accessibility": "<road access, visibility from main roads, parking potential, corner lot status>",
  "existingStructures": "<any buildings, foundations, or structures visible>",
  "vegetation": "<trees, landscaping, clearing needed>",
  "lotSizeEstimate": "<estimated lot size in acres or sq ft>",
  "businessRecommendation": "<Based on the VPD data and nearby businesses, provide a SPECIFIC recommendation. Example: 'With ${trafficData?.estimatedVPD?.toLocaleString() || 'the estimated'} VPD, this site is ${trafficData && trafficData.estimatedVPD >= 20000 ? 'well-suited' : 'suitable'} for [specific business types]. Given the existing [nearby business types], a [specific recommendation] would complement the area and capture drive-by traffic.'>",
  "constructionPotential": "<detailed assessment of construction viability, challenges, and opportunities>",
  "keyFindings": ["<finding 1>", "<finding 2>", "<finding 3>", "<finding 4>", "<finding 5>"],
  "recommendations": ["<recommendation 1>", "<recommendation 2>", "<recommendation 3>", "<recommendation 4>", "<recommendation 5>"]
}

IMPORTANT: In your businessRecommendation, be VERY SPECIFIC about what types of businesses would work based on the VPD:
- If VPD is 25,000+: Recommend big box retail, major gas stations, popular fast food chains
- If VPD is 15,000-25,000: Recommend fast food, coffee shops, gas stations, banks
- If VPD is 10,000-15,000: Recommend quick service restaurants, convenience stores, auto service
- If VPD is below 10,000: Recommend local services, medical offices, smaller retail

Consider corner lot potential for gas stations. Consider clustering effects with existing nearby businesses.
Return ONLY valid JSON, no markdown or explanation.`;

    const result = await model.generateContent([
      prompt,
      ...imageParts as any[],
    ]);

    const response = await result.response;
    let analysisText = response.text().trim();

    // Remove markdown code blocks if present
    if (analysisText.startsWith('```json')) {
      analysisText = analysisText.slice(7);
    }
    if (analysisText.startsWith('```')) {
      analysisText = analysisText.slice(3);
    }
    if (analysisText.endsWith('```')) {
      analysisText = analysisText.slice(0, -3);
    }

    const analysis = JSON.parse(analysisText.trim());

    // Add business suitability data
    if (businessSuitability.length > 0) {
      analysis.businessSuitability = businessSuitability;
    }

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Analysis error:', error);

    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({
        error: 'Analysis failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        usingMockData: true,
        ...getMockAnalysis([], null)
      });
    }

    return NextResponse.json({ ...getMockAnalysis([], null), usingMockData: true });
  }
}

function getMockAnalysis(nearbyBusinesses: Business[], trafficData: TrafficInfo | null) {
  const vpd = trafficData?.estimatedVPD || 15000;
  const businessSuitability = calculateBusinessSuitability(vpd);

  const hasRestaurants = nearbyBusinesses.some(b =>
    b.type.toLowerCase().includes('restaurant') || b.type.toLowerCase().includes('food')
  );

  let businessRec = '';
  if (vpd >= 25000) {
    businessRec = `With an estimated ${vpd.toLocaleString()} VPD, this is a prime commercial location suitable for major retailers like Target or Walmart, high-traffic gas stations like Buc-ee's or RaceTrac, or popular fast food chains like Chick-fil-A. The high traffic volume supports any drive-through concept.`;
  } else if (vpd >= 15000) {
    businessRec = `With an estimated ${vpd.toLocaleString()} VPD, this site is well-suited for fast food restaurants (McDonald's, Wendy's), coffee shops (Starbucks, Dunkin), gas stations, or banks. The traffic volume supports drive-through operations effectively.`;
  } else if (vpd >= 10000) {
    businessRec = `With an estimated ${vpd.toLocaleString()} VPD, this location is suitable for quick service restaurants (Subway, Jersey Mike's), convenience stores, auto service centers, or smaller retail. Consider businesses that can capture local community traffic.`;
  } else {
    businessRec = `With an estimated ${vpd.toLocaleString()} VPD, this location is better suited for local services, medical/dental offices, or neighborhood retail. High-traffic concepts requiring 15,000+ VPD may struggle at this location.`;
  }

  if (hasRestaurants) {
    businessRec += ` Given the existing restaurant cluster nearby, a complementary food concept or supporting retail would benefit from the established traffic pattern.`;
  }

  return {
    viabilityScore: 7,
    terrain: 'Relatively flat terrain with gentle slope towards the rear of the property. Good drainage potential.',
    accessibility: 'Good visibility from main road. Multiple access points possible. Adequate space for parking configuration.',
    existingStructures: 'No significant existing structures visible. Possible remnants of previous foundation or utilities.',
    vegetation: 'Moderate vegetation coverage. Some tree clearing may be required. Landscaping opportunities present.',
    lotSizeEstimate: 'Approximately 1.2 - 1.5 acres based on visual analysis',
    businessRecommendation: businessRec,
    constructionPotential: 'The site presents good construction potential with minimal grading required. Utilities appear accessible from the main road. Soil conditions should be verified through geotechnical survey.',
    keyFindings: [
      'Flat, buildable terrain with good drainage characteristics',
      'Excellent road frontage and visibility for commercial use',
      `Traffic volume of ${vpd.toLocaleString()} VPD supports commercial development`,
      'Utilities likely accessible from adjacent development',
      'No obvious environmental concerns visible from aerial view',
    ],
    recommendations: [
      'Conduct formal land survey to confirm exact boundaries and acreage',
      'Verify zoning compliance and permitted uses with local planning department',
      `Target businesses requiring ${vpd >= 15000 ? '15,000-25,000' : '8,000-15,000'} VPD based on traffic data`,
      'Assess corner lot potential for gas station or drive-through concepts',
      'Obtain utility availability letters from local providers',
    ],
    businessSuitability,
  };
}
