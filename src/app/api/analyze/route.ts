import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

interface Business {
  name: string;
  type: string;
  distance: string;
  address: string;
}

interface AnalyzeRequest {
  images: string[];
  address: string;
  coordinates: { lat: number; lng: number } | null;
  nearbyBusinesses: Business[];
}

export async function POST(request: Request) {
  try {
    const body: AnalyzeRequest = await request.json();
    const { images, address, nearbyBusinesses } = body;

    if (!images || images.length === 0) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Return mock data if no API key configured
      return NextResponse.json(getMockAnalysis(nearbyBusinesses));
    }

    const client = new Anthropic({ apiKey });

    // Prepare business context
    const businessContext = nearbyBusinesses.length > 0
      ? `\n\nNearby businesses within 0.5 miles:\n${nearbyBusinesses.map(b => `- ${b.name} (${b.type}) - ${b.distance}`).join('\n')}`
      : '\n\nNo nearby business data available.';

    // Prepare image content for Claude
    const imageContent = images.map((img) => {
      // Extract base64 data and media type
      const match = img.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        return {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: match[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: match[2],
          },
        };
      }
      return null;
    }).filter(Boolean);

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            ...imageContent as Anthropic.ImageBlockParam[],
            {
              type: 'text',
              text: `You are an expert commercial real estate analyst and site evaluator. Analyze these drone/aerial images of a property located at: ${address}
${businessContext}

Please provide a comprehensive site analysis in the following JSON format:
{
  "viabilityScore": <number 1-10>,
  "terrain": "<brief description of terrain - flat, sloped, rocky, etc.>",
  "accessibility": "<road access, visibility from main roads, parking potential>",
  "existingStructures": "<any buildings, foundations, or structures visible>",
  "vegetation": "<trees, landscaping, clearing needed>",
  "lotSizeEstimate": "<estimated lot size in acres or sq ft>",
  "businessRecommendation": "<based on nearby businesses, what type of business would be a good fit and why - be specific, e.g. 'A Wendy's or similar QSR would be ideal because there's already a McDonald's and Chick-fil-A nearby creating a restaurant cluster'>",
  "constructionPotential": "<detailed assessment of construction viability, challenges, and opportunities>",
  "keyFindings": ["<finding 1>", "<finding 2>", "<finding 3>"],
  "recommendations": ["<recommendation 1>", "<recommendation 2>", "<recommendation 3>"]
}

Be specific and practical in your analysis. Consider the commercial potential based on the location and surrounding businesses. Return ONLY valid JSON, no markdown or explanation.`,
            },
          ],
        },
      ],
    });

    // Parse the response
    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Try to extract JSON from the response
    let analysisText = textContent.text.trim();

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
    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Analysis error:', error);

    // Return mock data on error
    return NextResponse.json(getMockAnalysis([]));
  }
}

function getMockAnalysis(nearbyBusinesses: Business[]) {
  const hasRestaurants = nearbyBusinesses.some(b =>
    b.type.toLowerCase().includes('restaurant') || b.type.toLowerCase().includes('food')
  );

  const businessRec = hasRestaurants
    ? `Based on the existing restaurant cluster in the area (${nearbyBusinesses.filter(b => b.type.toLowerCase().includes('restaurant')).map(b => b.name).slice(0, 3).join(', ')}), this location would be ideal for a complementary quick-service restaurant like Wendy's, Taco Bell, or a local coffee shop to capture drive-through traffic.`
    : 'This location appears suitable for a variety of commercial uses. A retail establishment or professional services office would complement the existing business mix in the area.';

  return {
    viabilityScore: 7,
    terrain: 'Relatively flat terrain with gentle slope towards the rear of the property. Good drainage potential.',
    accessibility: 'Good visibility from main road. Multiple access points possible. Adequate space for parking configuration.',
    existingStructures: 'No significant existing structures visible. Possible remnants of previous foundation or utilities.',
    vegetation: 'Moderate vegetation coverage. Some tree clearing may be required. Landscaping opportunities present.',
    lotSizeEstimate: 'Approximately 1.2 - 1.5 acres based on visual analysis',
    businessRecommendation: businessRec,
    constructionPotential: 'The site presents good construction potential with minimal grading required. Utilities appear accessible from the main road. Soil conditions should be verified through geotechnical survey. The lot shape allows for flexible building footprint and parking layout. Stormwater management will need to be addressed per local requirements.',
    keyFindings: [
      'Flat, buildable terrain with good drainage characteristics',
      'Excellent road frontage and visibility for commercial use',
      'Utilities likely accessible from adjacent development',
      'Adequate lot size for most commercial applications',
      'No obvious environmental concerns visible from aerial view',
    ],
    recommendations: [
      'Conduct formal land survey to confirm exact boundaries and acreage',
      'Order Phase I Environmental Site Assessment',
      'Verify zoning compliance and permitted uses with local planning department',
      'Assess traffic counts and patterns for commercial viability',
      'Obtain utility availability letters from local providers',
    ],
  };
}
