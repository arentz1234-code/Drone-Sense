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
  bigBox: { min: 25000, ideal: 35000, examples: ['Walmart', 'Target', 'Costco', 'Home Depot', "Lowe's", 'Best Buy', 'Kohl\'s'] },
  gasStation: { min: 15000, ideal: 25000, examples: ['Shell', 'BP', 'Chevron', 'RaceTrac', "Buc-ee's", 'QuikTrip', 'Wawa', 'Sheetz'] },
  fastFood: { min: 15000, ideal: 20000, examples: ["Chick-fil-A", "McDonald's", "Wendy's", 'Taco Bell', "Zaxby's", "Popeyes", "Raising Cane's", "Whataburger", "Five Guys", "Shake Shack", "In-N-Out"] },
  casualDining: { min: 12000, ideal: 18000, examples: ["Chili's", "Applebee's", 'Olive Garden', 'Red Lobster', 'Texas Roadhouse', 'Outback', 'Buffalo Wild Wings', 'Red Robin'] },
  coffeeShop: { min: 12000, ideal: 18000, examples: ['Starbucks', 'Dunkin', 'Dutch Bros', 'Scooters', 'PJ\'s Coffee', '7 Brew', 'Black Rifle Coffee'] },
  quickService: { min: 10000, ideal: 15000, examples: ['Subway', 'Jersey Mike\'s', 'Firehouse Subs', 'Jimmy John\'s', 'Chipotle', 'Moe\'s', 'Qdoba', 'Wingstop', 'Tropical Smoothie'] },
  convenience: { min: 8000, ideal: 12000, examples: ['7-Eleven', 'Circle K', 'Wawa', 'QuikTrip', 'Speedway', 'Casey\'s'] },
  bank: { min: 10000, ideal: 15000, examples: ['Chase', 'Bank of America', 'Wells Fargo', 'Regions', 'PNC', 'Truist', 'TD Bank'] },
  pharmacy: { min: 12000, ideal: 18000, examples: ['CVS', 'Walgreens', 'Rite Aid'] },
  autoService: { min: 10000, ideal: 15000, examples: ['Jiffy Lube', 'Tire Kingdom', 'AutoZone', "O'Reilly", 'Advance Auto Parts', 'Discount Tire', 'Take 5 Oil Change', 'Valvoline'] },
  medical: { min: 8000, ideal: 12000, examples: ['Urgent Care', 'Dental Office', 'Medical Clinic', 'CareNow', 'AFC Urgent Care', 'MedExpress'] },
  retail: { min: 10000, ideal: 18000, examples: ['Dollar General', 'Dollar Tree', 'Family Dollar', 'Ross', 'TJ Maxx', 'Marshalls', 'Five Below', 'Ulta', 'Sephora'] },
};

// Check if a business name matches any of the examples (fuzzy match)
function businessExistsInArea(businessName: string, examples: string[]): boolean {
  const normalizedName = businessName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return examples.some(example => {
    const normalizedExample = example.toLowerCase().replace(/[^a-z0-9]/g, '');
    return normalizedName.includes(normalizedExample) || normalizedExample.includes(normalizedName);
  });
}

// Get list of existing business names from nearby businesses
function getExistingBusinessNames(nearbyBusinesses: Business[]): string[] {
  return nearbyBusinesses.map(b => b.name);
}

// Filter examples to exclude businesses that already exist nearby
function filterExistingBusinesses(examples: string[], nearbyBusinesses: Business[]): string[] {
  const existingNames = nearbyBusinesses.map(b => b.name.toLowerCase().replace(/[^a-z0-9]/g, ''));

  return examples.filter(example => {
    const normalizedExample = example.toLowerCase().replace(/[^a-z0-9]/g, '');
    // Check if this business already exists in the nearby area
    const exists = existingNames.some(existing =>
      existing.includes(normalizedExample) || normalizedExample.includes(existing)
    );
    return !exists;
  });
}

function calculateBusinessSuitability(vpd: number, nearbyBusinesses: Business[]) {
  const suitability: Array<{
    category: string;
    suitabilityScore: number;
    reasoning: string;
    examples: string[];
    existingInArea: string[];
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

    // Find which businesses from this category already exist in the area
    const existingInArea = threshold.examples.filter(example => {
      const normalizedExample = example.toLowerCase().replace(/[^a-z0-9]/g, '');
      return nearbyBusinesses.some(b => {
        const normalizedName = b.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return normalizedName.includes(normalizedExample) || normalizedExample.includes(normalizedName);
      });
    });

    // Filter out existing businesses from recommendations
    const availableExamples = filterExistingBusinesses(threshold.examples, nearbyBusinesses);

    // If all examples exist, lower the score and note it
    if (availableExamples.length === 0) {
      reasoning += '. All major brands in this category already exist in the area.';
      score = Math.max(1, score - 3);
    } else if (existingInArea.length > 0) {
      reasoning += `. Note: ${existingInArea.join(', ')} already in area.`;
    }

    suitability.push({
      category: categoryNames[key] || key,
      suitabilityScore: Math.max(1, Math.min(10, score)),
      reasoning,
      examples: availableExamples.length > 0 ? availableExamples : ['Market may be saturated'],
      existingInArea,
    });
  }

  // Sort by suitability score descending
  return suitability.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
}

// Generate top specific recommendations excluding existing businesses
function generateTopRecommendations(vpd: number, nearbyBusinesses: Business[]): string[] {
  const recommendations: Array<{ name: string; score: number; reason: string }> = [];

  for (const [key, threshold] of Object.entries(VPD_THRESHOLDS)) {
    // Check if VPD supports this category
    if (vpd < threshold.min * 0.7) continue;

    const availableExamples = filterExistingBusinesses(threshold.examples, nearbyBusinesses);

    let categoryScore = 0;
    if (vpd >= threshold.ideal) categoryScore = 10;
    else if (vpd >= threshold.min) categoryScore = 7;
    else categoryScore = 4;

    for (const example of availableExamples.slice(0, 3)) {
      recommendations.push({
        name: example,
        score: categoryScore,
        reason: `VPD supports ${key.replace(/([A-Z])/g, ' $1').toLowerCase()} concept`
      });
    }
  }

  // Sort by score and return top recommendations
  recommendations.sort((a, b) => b.score - a.score);
  return recommendations.slice(0, 10).map(r => r.name);
}

export async function POST(request: Request) {
  try {
    const body: AnalyzeRequest = await request.json();
    const { images, address, nearbyBusinesses, trafficData } = body;

    const hasImages = images && images.length > 0;

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

    // Get list of existing businesses to exclude
    const existingBusinessNames = nearbyBusinesses.map(b => b.name).join(', ');

    // Prepare business context
    const businessContext = nearbyBusinesses.length > 0
      ? `\n\nNearby businesses within scanning radius (ALREADY EXIST - DO NOT RECOMMEND THESE):\n${nearbyBusinesses.map(b => `- ${b.name} (${b.type}) - ${b.distance}`).join('\n')}`
      : '\n\nNo nearby business data available.';

    // Prepare traffic context
    let trafficContext = '\n\nNo traffic data available.';
    let businessSuitability: ReturnType<typeof calculateBusinessSuitability> = [];
    let topRecommendations: string[] = [];

    if (trafficData) {
      businessSuitability = calculateBusinessSuitability(trafficData.estimatedVPD, nearbyBusinesses);
      topRecommendations = generateTopRecommendations(trafficData.estimatedVPD, nearbyBusinesses);

      trafficContext = `\n\nTraffic Data:
- Estimated VPD (Vehicles Per Day): ${trafficData.estimatedVPD.toLocaleString()}
- VPD Range: ${trafficData.vpdRange}
- Road Type: ${trafficData.roadType}

VPD Guidelines for Business Types:
- Big Box Stores (Walmart, Target): 25,000-35,000+ VPD ideal
- Gas Stations: 15,000-25,000+ VPD ideal (corner lots preferred)
- Fast Food (Chick-fil-A, McDonald's): 15,000-20,000+ VPD ideal
- Coffee Shops (Starbucks, Dunkin): 12,000-18,000+ VPD ideal
- Quick Service Restaurants: 10,000-15,000+ VPD ideal
- Convenience Stores: 8,000-12,000+ VPD ideal
- Banks/Pharmacies: 10,000-18,000+ VPD ideal

TOP RECOMMENDED BUSINESSES (not already in area): ${topRecommendations.join(', ')}`;
    }

    // Prepare image content for Gemini (if images provided)
    const imageParts = hasImages ? images.map((img) => {
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
    }).filter(Boolean) : [];

    const imageContext = hasImages
      ? 'Analyze these drone/aerial images of the property.'
      : 'No images provided - base your analysis on location data, traffic patterns, and nearby businesses only.';

    const prompt = `You are an expert commercial real estate analyst and site evaluator. ${imageContext} Property located at: ${address}
${businessContext}
${trafficContext}

Please provide a comprehensive site analysis in the following JSON format:
{
  "viabilityScore": <number 1-10>,
  "terrain": "<${hasImages ? 'brief description of terrain from images - flat, sloped, rocky, etc.' : 'Unable to assess without images'}>",
  "accessibility": "<road access, visibility from main roads, parking potential based on ${hasImages ? 'images and ' : ''}location data>",
  "existingStructures": "<${hasImages ? 'any buildings, foundations, or structures visible in images' : 'Unable to assess without images'}>",
  "vegetation": "<${hasImages ? 'trees, landscaping, clearing needed based on images' : 'Unable to assess without images'}>",
  "lotSizeEstimate": "<${hasImages ? 'estimated lot size based on images' : 'Unable to estimate without images'}>",
  "businessRecommendation": "<CRITICAL: Only recommend specific businesses that DO NOT already exist in the nearby area. With ${trafficData?.estimatedVPD?.toLocaleString() || 'the estimated'} VPD, recommend specific brands like: ${topRecommendations.slice(0, 5).join(', ')}. DO NOT recommend: ${existingBusinessNames || 'N/A'}. Explain why your specific recommendations would work at this location.>",
  "constructionPotential": "<detailed assessment of construction viability, challenges, and opportunities>",
  "keyFindings": ["<finding 1>", "<finding 2>", "<finding 3>", "<finding 4>", "<finding 5>"],
  "recommendations": ["<recommendation 1>", "<recommendation 2>", "<recommendation 3>", "<recommendation 4>", "<recommendation 5>"]
}

CRITICAL RULES:
1. DO NOT recommend any business that already exists in the nearby businesses list
2. Be VERY SPECIFIC - recommend actual brand names, not generic categories
3. Base recommendations on the VPD data - higher VPD = can support more demanding concepts
4. Consider what's MISSING from the area that would complement existing businesses
5. If the area already has fast food, recommend a DIFFERENT fast food chain that's not there
6. If area has Starbucks, recommend Dutch Bros or Dunkin instead

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

    // Add business suitability data and top recommendations
    if (businessSuitability.length > 0) {
      analysis.businessSuitability = businessSuitability;
    }
    if (topRecommendations.length > 0) {
      analysis.topRecommendations = topRecommendations;
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
  const businessSuitability = calculateBusinessSuitability(vpd, nearbyBusinesses);
  const topRecommendations = generateTopRecommendations(vpd, nearbyBusinesses);

  // Build recommendation excluding existing businesses
  let businessRec = '';
  const topRecs = topRecommendations.slice(0, 5).join(', ');

  if (vpd >= 25000) {
    businessRec = `With an estimated ${vpd.toLocaleString()} VPD, this is a prime commercial location. Top recommendations not currently in the area: ${topRecs}. The high traffic volume supports major retail and drive-through concepts.`;
  } else if (vpd >= 15000) {
    businessRec = `With an estimated ${vpd.toLocaleString()} VPD, this site supports strong commercial development. Recommended businesses not in the area: ${topRecs}. The traffic volume effectively supports drive-through operations.`;
  } else if (vpd >= 10000) {
    businessRec = `With an estimated ${vpd.toLocaleString()} VPD, suitable for neighborhood commercial. Consider: ${topRecs}. These businesses can capture local community traffic effectively.`;
  } else {
    businessRec = `With an estimated ${vpd.toLocaleString()} VPD, this location suits local services. Consider: ${topRecs}. Focus on businesses serving the immediate community.`;
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
      `Consider: ${topRecommendations.slice(0, 3).join(', ')} based on traffic and market gap`,
      'Assess corner lot potential for gas station or drive-through concepts',
      'Obtain utility availability letters from local providers',
    ],
    businessSuitability,
    topRecommendations,
  };
}
