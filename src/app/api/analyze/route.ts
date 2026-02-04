import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface Business {
  name: string;
  type: string;
  distance: string;
  address: string;
}

// Feasibility score breakdown
export interface FeasibilityScore {
  overall: number;
  breakdown: {
    trafficScore: number;
    demographicsScore: number;
    competitionScore: number;
    accessScore: number;
  };
  details: {
    traffic: string;
    demographics: string;
    competition: string;
    access: string;
  };
  rating: 'Excellent' | 'Good' | 'Fair' | 'Poor';
}

interface TrafficInfo {
  estimatedVPD: number;
  vpdRange: string;
  roadType: string;
  trafficLevel: string;
  congestionPercent: number;
}

interface DemographicsInfo {
  population: number;
  medianHouseholdIncome: number;
  perCapitaIncome: number;
  incomeLevel: 'low' | 'moderate' | 'middle' | 'upper-middle' | 'high';
  povertyRate: number;
  medianAge: number;
  educationBachelorsOrHigher: number;
  employmentRate: number;
  consumerProfile: {
    type: string;
    description: string;
    preferredBusinesses: string[];
  };
}

interface AnalyzeRequest {
  images: string[];
  address: string;
  coordinates: { lat: number; lng: number } | null;
  nearbyBusinesses: Business[];
  trafficData: TrafficInfo | null;
  demographicsData: DemographicsInfo | null;
}

// VPD thresholds, income preferences, and lot size requirements for different business types
// Lot sizes in acres (min = minimum viable, ideal = optimal size)
const VPD_THRESHOLDS = {
  bigBox: {
    min: 25000, ideal: 35000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 8, ideal: 15 }, // Big box stores need 8-15+ acres
    examples: ['Walmart', 'Target', 'Costco', 'Home Depot', "Lowe's", 'Best Buy', 'Kohl\'s']
  },
  gasStation: {
    min: 15000, ideal: 25000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 0.5, ideal: 1.5 }, // Gas stations need 0.5-1.5 acres
    examples: ['Shell', 'BP', 'Chevron', 'RaceTrac', "Buc-ee's", 'QuikTrip', 'Wawa', 'Sheetz']
  },
  fastFoodValue: {
    min: 12000, ideal: 18000,
    incomePreference: ['low', 'moderate'] as const,
    lotSize: { min: 0.4, ideal: 0.8 }, // Fast food needs 0.4-0.8 acres for building + drive-thru
    examples: ["Hardee's", "McDonald's", "Wendy's", 'Taco Bell', "Popeyes", "Little Caesars", "Checkers/Rally's", "Krystal", "Captain D's", "Cook Out"]
  },
  fastFoodPremium: {
    min: 15000, ideal: 22000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 0.5, ideal: 1.0 }, // Premium fast food needs 0.5-1 acre
    examples: ["Chick-fil-A", "Raising Cane's", "Five Guys", "Shake Shack", "In-N-Out", "Whataburger", "Culver's", "PDQ"]
  },
  casualDiningValue: {
    min: 12000, ideal: 18000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 0.8, ideal: 1.5 }, // Casual dining needs 0.8-1.5 acres
    examples: ["Applebee's", "IHOP", "Denny's", "Waffle House", "Cracker Barrel", "Golden Corral", "Huddle House"]
  },
  casualDiningPremium: {
    min: 15000, ideal: 20000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 1.0, ideal: 2.0 }, // Premium casual dining needs 1-2 acres
    examples: ["Olive Garden", "Red Lobster", "Texas Roadhouse", "Outback", "The Cheesecake Factory", "P.F. Chang's", "BJ's Restaurant"]
  },
  coffeeValue: {
    min: 10000, ideal: 15000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 0.2, ideal: 0.5 }, // Coffee shops need 0.2-0.5 acres
    examples: ['Dunkin', 'Scooters', '7 Brew', "McDonald's McCafe"]
  },
  coffeePremium: {
    min: 15000, ideal: 20000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 0.25, ideal: 0.6 }, // Premium coffee needs 0.25-0.6 acres
    examples: ['Starbucks', 'Dutch Bros', 'Black Rifle Coffee', 'Peet\'s Coffee']
  },
  quickServiceValue: {
    min: 8000, ideal: 12000,
    incomePreference: ['low', 'moderate'] as const,
    lotSize: { min: 0.2, ideal: 0.5 }, // Quick service needs 0.2-0.5 acres
    examples: ['Subway', 'Wingstop', 'Zaxby\'s', 'Moe\'s', 'Tropical Smoothie']
  },
  quickServicePremium: {
    min: 12000, ideal: 18000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 0.3, ideal: 0.6 }, // Premium quick service needs 0.3-0.6 acres
    examples: ['Chipotle', 'Jersey Mike\'s', 'Firehouse Subs', 'Panera Bread', 'Cava', 'Sweetgreen', 'MOD Pizza']
  },
  convenience: {
    min: 8000, ideal: 12000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 0.3, ideal: 0.8 }, // Convenience stores need 0.3-0.8 acres
    examples: ['7-Eleven', 'Circle K', 'Wawa', 'QuikTrip', 'Speedway', 'Casey\'s']
  },
  discountRetail: {
    min: 8000, ideal: 12000,
    incomePreference: ['low', 'moderate'] as const,
    lotSize: { min: 0.5, ideal: 1.2 }, // Discount retail needs 0.5-1.2 acres
    examples: ['Dollar General', 'Dollar Tree', 'Family Dollar', 'Five Below', 'Big Lots', 'Save-A-Lot', 'ALDI']
  },
  retailPremium: {
    min: 15000, ideal: 22000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 1.5, ideal: 3.0 }, // Premium retail needs 1.5-3 acres
    examples: ['Target', 'TJ Maxx', 'Ross', 'Marshalls', 'HomeGoods', 'Ulta', 'Sephora', 'Trader Joe\'s', 'Whole Foods']
  },
  bank: {
    min: 10000, ideal: 15000,
    incomePreference: ['moderate', 'middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 0.2, ideal: 0.5 }, // Banks need 0.2-0.5 acres
    examples: ['Chase', 'Bank of America', 'Wells Fargo', 'Regions', 'PNC', 'Truist', 'TD Bank']
  },
  financialServices: {
    min: 6000, ideal: 10000,
    incomePreference: ['low', 'moderate'] as const,
    lotSize: { min: 0.1, ideal: 0.3 }, // Financial services need 0.1-0.3 acres
    examples: ['Check Into Cash', 'Advance America', 'ACE Cash Express', 'Check \'n Go', 'Title Max', 'Rent-A-Center', 'Aaron\'s']
  },
  pharmacy: {
    min: 12000, ideal: 18000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.8, ideal: 1.5 }, // Pharmacies need 0.8-1.5 acres (with drive-thru)
    examples: ['CVS', 'Walgreens', 'Rite Aid']
  },
  autoService: {
    min: 10000, ideal: 15000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 0.3, ideal: 0.7 }, // Auto service needs 0.3-0.7 acres
    examples: ['Jiffy Lube', 'AutoZone', "O'Reilly", 'Advance Auto Parts', 'Discount Tire', 'Take 5 Oil Change', 'Valvoline']
  },
  autoServicePremium: {
    min: 15000, ideal: 20000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 0.5, ideal: 1.0 }, // Premium auto service needs 0.5-1 acre
    examples: ['Firestone', 'Goodyear', 'Caliber Collision', 'Christian Brothers Auto']
  },
  fitness: {
    min: 10000, ideal: 15000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 1.0, ideal: 2.0 }, // Fitness centers need 1-2 acres
    examples: ['Planet Fitness', 'Crunch Fitness', 'Anytime Fitness', 'Gold\'s Gym']
  },
  fitnessPremium: {
    min: 15000, ideal: 20000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 1.5, ideal: 3.0 }, // Premium fitness needs 1.5-3 acres
    examples: ['LA Fitness', 'Lifetime Fitness', 'Orangetheory', 'F45', 'CrossFit', 'Equinox']
  },
  medical: {
    min: 8000, ideal: 12000,
    incomePreference: ['low', 'moderate', 'middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 0.2, ideal: 0.5 }, // Medical offices need 0.2-0.5 acres
    examples: ['Urgent Care', 'Dental Office', 'Medical Clinic', 'CareNow', 'AFC Urgent Care', 'MedExpress']
  },
};

// Parse lot size estimate string to extract acreage
function parseLotSize(lotSizeEstimate: string | undefined): number | null {
  if (!lotSizeEstimate || lotSizeEstimate.toLowerCase().includes('unable')) {
    return null;
  }

  // Try to extract numbers from strings like "1.2 - 1.5 acres", "Approximately 0.75 acres", etc.
  const matches = lotSizeEstimate.match(/(\d+\.?\d*)\s*(?:-|to)?\s*(\d+\.?\d*)?\s*acre/i);
  if (matches) {
    // If range, take the average
    if (matches[2]) {
      return (parseFloat(matches[1]) + parseFloat(matches[2])) / 2;
    }
    return parseFloat(matches[1]);
  }

  // Try to extract just a number followed by acre
  const simpleMatch = lotSizeEstimate.match(/(\d+\.?\d*)\s*acre/i);
  if (simpleMatch) {
    return parseFloat(simpleMatch[1]);
  }

  // Try square feet conversion (43,560 sq ft = 1 acre)
  const sqftMatch = lotSizeEstimate.match(/(\d+,?\d*)\s*(?:sq\.?\s*ft|square\s*feet)/i);
  if (sqftMatch) {
    const sqft = parseFloat(sqftMatch[1].replace(',', ''));
    return sqft / 43560;
  }

  return null;
}

// Calculate comprehensive feasibility score
function calculateFeasibilityScore(
  trafficData: TrafficInfo | null,
  demographicsData: DemographicsInfo | null,
  nearbyBusinesses: Business[]
): FeasibilityScore {
  let trafficScore = 5; // Default middle score
  let demographicsScore = 5;
  let competitionScore = 5;
  let accessScore = 5;

  let trafficDetail = 'No traffic data available';
  let demographicsDetail = 'No demographics data available';
  let competitionDetail = 'No nearby business data';
  let accessDetail = 'Unable to assess access';

  // TRAFFIC SCORE (0-10)
  if (trafficData) {
    const vpd = trafficData.estimatedVPD;
    if (vpd >= 30000) {
      trafficScore = 10;
      trafficDetail = `Excellent traffic: ${vpd.toLocaleString()} VPD supports all business types`;
    } else if (vpd >= 20000) {
      trafficScore = 9;
      trafficDetail = `Very high traffic: ${vpd.toLocaleString()} VPD ideal for most retail`;
    } else if (vpd >= 15000) {
      trafficScore = 8;
      trafficDetail = `High traffic: ${vpd.toLocaleString()} VPD supports drive-thru concepts`;
    } else if (vpd >= 10000) {
      trafficScore = 6;
      trafficDetail = `Moderate traffic: ${vpd.toLocaleString()} VPD suitable for quick service`;
    } else if (vpd >= 5000) {
      trafficScore = 4;
      trafficDetail = `Low-moderate traffic: ${vpd.toLocaleString()} VPD limits options`;
    } else {
      trafficScore = 2;
      trafficDetail = `Low traffic: ${vpd.toLocaleString()} VPD - local service only`;
    }

    // Bonus for road type
    if (trafficData.roadType.includes('Major') || trafficData.roadType.includes('Motorway')) {
      accessScore = Math.min(10, accessScore + 2);
      accessDetail = `${trafficData.roadType} with high visibility`;
    } else if (trafficData.roadType.includes('Secondary')) {
      accessScore = 6;
      accessDetail = `${trafficData.roadType} - good local access`;
    } else {
      accessScore = 4;
      accessDetail = `${trafficData.roadType} - limited visibility`;
    }
  }

  // DEMOGRAPHICS SCORE (0-10)
  if (demographicsData) {
    const income = demographicsData.medianHouseholdIncome;
    const employment = demographicsData.employmentRate;
    const population = demographicsData.population;

    // Income scoring
    let incomeScore = 5;
    if (income >= 85000) incomeScore = 9;
    else if (income >= 65000) incomeScore = 8;
    else if (income >= 50000) incomeScore = 7;
    else if (income >= 35000) incomeScore = 5;
    else incomeScore = 4;

    // Employment bonus
    const employmentBonus = employment >= 95 ? 1 : employment >= 90 ? 0.5 : 0;

    // Population density consideration
    const populationBonus = population >= 5000 ? 1 : population >= 2000 ? 0.5 : 0;

    demographicsScore = Math.min(10, Math.round(incomeScore + employmentBonus + populationBonus));
    demographicsDetail = `${demographicsData.consumerProfile.type} market - $${income.toLocaleString()} median income, ${population.toLocaleString()} pop, ${employment}% employed`;
  }

  // COMPETITION SCORE (0-10) - Balance is good, oversaturation is bad
  if (nearbyBusinesses.length > 0) {
    const businessCount = nearbyBusinesses.length;

    // Count business types
    const typeCount: Record<string, number> = {};
    nearbyBusinesses.forEach(b => {
      const type = b.type || 'Other';
      typeCount[type] = (typeCount[type] || 0) + 1;
    });

    const uniqueTypes = Object.keys(typeCount).length;

    // Some competition is good (shows area is viable), too much is bad
    if (businessCount >= 5 && businessCount <= 20 && uniqueTypes >= 3) {
      competitionScore = 9;
      competitionDetail = `Healthy mix: ${businessCount} businesses, ${uniqueTypes} categories - proven commercial area`;
    } else if (businessCount >= 3 && businessCount <= 30) {
      competitionScore = 7;
      competitionDetail = `Good activity: ${businessCount} businesses nearby - established area`;
    } else if (businessCount > 30) {
      competitionScore = 5;
      competitionDetail = `High density: ${businessCount} businesses - competitive market`;
    } else if (businessCount < 3) {
      competitionScore = 4;
      competitionDetail = `Limited activity: Only ${businessCount} businesses - unproven area`;
    }

    // Check for anchor stores (positive signal)
    const hasAnchor = nearbyBusinesses.some(b =>
      ['walmart', 'target', 'costco', 'home depot', 'lowes', 'publix', 'kroger'].some(
        anchor => b.name.toLowerCase().includes(anchor)
      )
    );
    if (hasAnchor) {
      competitionScore = Math.min(10, competitionScore + 1);
      competitionDetail += ' + anchor tenant present';
    }
  }

  // Calculate overall score (weighted average)
  const weights = {
    traffic: 0.35,      // 35% - traffic is critical
    demographics: 0.25, // 25% - demographics matter
    competition: 0.20,  // 20% - market validation
    access: 0.20        // 20% - visibility/access
  };

  const overall = Math.round(
    trafficScore * weights.traffic +
    demographicsScore * weights.demographics +
    competitionScore * weights.competition +
    accessScore * weights.access
  );

  // Determine rating
  let rating: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  if (overall >= 8) rating = 'Excellent';
  else if (overall >= 6) rating = 'Good';
  else if (overall >= 4) rating = 'Fair';
  else rating = 'Poor';

  return {
    overall,
    breakdown: {
      trafficScore,
      demographicsScore,
      competitionScore,
      accessScore
    },
    details: {
      traffic: trafficDetail,
      demographics: demographicsDetail,
      competition: competitionDetail,
      access: accessDetail
    },
    rating
  };
}

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

function calculateBusinessSuitability(
  vpd: number,
  nearbyBusinesses: Business[],
  demographics: DemographicsInfo | null,
  lotSizeAcres: number | null = null
) {
  const suitability: Array<{
    category: string;
    suitabilityScore: number;
    reasoning: string;
    examples: string[];
    existingInArea: string[];
    lotSizeIssue?: string;
  }> = [];

  const incomeLevel = demographics?.incomeLevel || 'middle';

  for (const [key, threshold] of Object.entries(VPD_THRESHOLDS)) {
    let score = 0;
    let reasoning = '';
    let lotSizeIssue: string | undefined;

    // Check VPD fit
    if (vpd >= threshold.ideal) {
      score = 10;
      reasoning = `Excellent traffic - VPD of ${vpd.toLocaleString()} exceeds ideal threshold`;
    } else if (vpd >= threshold.min) {
      score = Math.round(5 + (5 * (vpd - threshold.min) / (threshold.ideal - threshold.min)));
      reasoning = `Good traffic - VPD of ${vpd.toLocaleString()} meets threshold`;
    } else if (vpd >= threshold.min * 0.7) {
      score = Math.round(3 + (2 * vpd / threshold.min));
      reasoning = `Marginal traffic - VPD of ${vpd.toLocaleString()} is below ideal`;
    } else {
      score = Math.round(3 * vpd / threshold.min);
      reasoning = `Low traffic - VPD of ${vpd.toLocaleString()} below threshold`;
    }

    // Check demographics/income fit
    const incomeMatches = (threshold.incomePreference as readonly string[]).includes(incomeLevel);
    if (demographics) {
      if (incomeMatches) {
        score = Math.min(10, score + 2);
        reasoning += `. Demographics match - ${incomeLevel} income area is ideal for this concept`;
      } else {
        score = Math.max(1, score - 3);
        reasoning += `. Demographics mismatch - ${incomeLevel} income area may not be optimal (prefers ${threshold.incomePreference.join('/')})`;
      }
    }

    // Check lot size fit
    if (lotSizeAcres !== null && threshold.lotSize) {
      if (lotSizeAcres >= threshold.lotSize.ideal) {
        // Lot is ideal size or larger - bonus
        score = Math.min(10, score + 1);
        reasoning += `. Lot size (${lotSizeAcres.toFixed(2)} acres) is ideal for this concept`;
      } else if (lotSizeAcres >= threshold.lotSize.min) {
        // Lot meets minimum - no change to score
        reasoning += `. Lot size (${lotSizeAcres.toFixed(2)} acres) meets minimum requirements`;
      } else {
        // Lot is too small - significant penalty
        const shortfall = threshold.lotSize.min - lotSizeAcres;
        const penaltyPercent = shortfall / threshold.lotSize.min;
        const penalty = Math.min(8, Math.round(penaltyPercent * 10));
        score = Math.max(1, score - penalty);
        lotSizeIssue = `LOT TOO SMALL: Need ${threshold.lotSize.min} acres min, site has ~${lotSizeAcres.toFixed(2)} acres`;
        reasoning += `. ${lotSizeIssue}`;
      }
    }

    const categoryNames: Record<string, string> = {
      bigBox: 'Big Box Retail',
      gasStation: 'Gas Station / Fuel Center',
      fastFoodValue: 'Value Fast Food',
      fastFoodPremium: 'Premium Fast Food',
      casualDiningValue: 'Value Casual Dining',
      casualDiningPremium: 'Premium Casual Dining',
      coffeeValue: 'Value Coffee/Drive-Thru',
      coffeePremium: 'Premium Coffee',
      quickServiceValue: 'Value Quick Service',
      quickServicePremium: 'Premium Quick Service',
      convenience: 'Convenience Store',
      discountRetail: 'Discount Retail',
      retailPremium: 'Premium Retail',
      bank: 'Bank / Financial Services',
      financialServices: 'Check Cashing / Title Loans',
      pharmacy: 'Pharmacy / Drugstore',
      autoService: 'Auto Service / Parts',
      autoServicePremium: 'Premium Auto Service',
      fitness: 'Value Fitness',
      fitnessPremium: 'Premium Fitness',
      medical: 'Medical / Healthcare',
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
      reasoning += '. Market saturated - all major brands present.';
      score = Math.max(1, score - 3);
    } else if (existingInArea.length > 0) {
      reasoning += `. ${existingInArea.length} competitor(s) nearby.`;
    }

    suitability.push({
      category: categoryNames[key] || key,
      suitabilityScore: Math.max(1, Math.min(10, score)),
      reasoning,
      examples: availableExamples.length > 0 ? availableExamples : ['Market may be saturated'],
      existingInArea,
      ...(lotSizeIssue && { lotSizeIssue }),
    });
  }

  // Sort by suitability score descending
  return suitability.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
}

// Generate top specific recommendations excluding existing businesses
function generateTopRecommendations(
  vpd: number,
  nearbyBusinesses: Business[],
  demographics: DemographicsInfo | null,
  lotSizeAcres: number | null = null
): string[] {
  const recommendations: Array<{ name: string; score: number; reason: string }> = [];
  const incomeLevel = demographics?.incomeLevel || 'middle';

  for (const [key, threshold] of Object.entries(VPD_THRESHOLDS)) {
    // Check if VPD supports this category
    if (vpd < threshold.min * 0.7) continue;

    // Check if lot size supports this category (if lot size is known)
    if (lotSizeAcres !== null && threshold.lotSize && lotSizeAcres < threshold.lotSize.min) {
      // Lot is too small for this category - skip it
      continue;
    }

    const availableExamples = filterExistingBusinesses(threshold.examples, nearbyBusinesses);

    let categoryScore = 0;
    if (vpd >= threshold.ideal) categoryScore = 10;
    else if (vpd >= threshold.min) categoryScore = 7;
    else categoryScore = 4;

    // Boost score if demographics match
    const incomeMatches = (threshold.incomePreference as readonly string[]).includes(incomeLevel);
    if (incomeMatches) {
      categoryScore += 3;
    } else {
      categoryScore -= 2;
    }

    // Boost score if lot size is ideal for this concept
    if (lotSizeAcres !== null && threshold.lotSize && lotSizeAcres >= threshold.lotSize.ideal) {
      categoryScore += 1;
    }

    for (const example of availableExamples.slice(0, 3)) {
      recommendations.push({
        name: example,
        score: categoryScore,
        reason: `VPD supports ${key.replace(/([A-Z])/g, ' $1').toLowerCase()} concept`
      });
    }
  }

  // Also add preferred businesses from demographics (but filter by lot size)
  if (demographics?.consumerProfile?.preferredBusinesses) {
    const demoPreferred = filterExistingBusinesses(
      demographics.consumerProfile.preferredBusinesses,
      nearbyBusinesses
    );
    for (const business of demoPreferred.slice(0, 5)) {
      // Check if not already in recommendations
      if (!recommendations.some(r => r.name.toLowerCase() === business.toLowerCase())) {
        // Check if lot size can accommodate (estimate based on business type)
        let canFit = true;
        if (lotSizeAcres !== null) {
          // Big box stores need 8+ acres
          const bigBoxNames = ['walmart', 'target', 'costco', 'home depot', 'lowes', 'best buy', 'kohls'];
          if (bigBoxNames.some(b => business.toLowerCase().includes(b)) && lotSizeAcres < 8) {
            canFit = false;
          }
          // Premium retail needs 1.5+ acres
          const premiumRetailNames = ['tj maxx', 'ross', 'marshalls', 'homegoods', 'whole foods', 'trader joe'];
          if (premiumRetailNames.some(b => business.toLowerCase().includes(b)) && lotSizeAcres < 1.5) {
            canFit = false;
          }
          // Fitness centers need 1+ acre
          const fitnessNames = ['planet fitness', 'la fitness', 'lifetime', 'crunch', 'gold'];
          if (fitnessNames.some(b => business.toLowerCase().includes(b)) && lotSizeAcres < 1.0) {
            canFit = false;
          }
        }

        if (canFit) {
          recommendations.push({
            name: business,
            score: 12, // High priority for demographic matches
            reason: `Matches ${demographics.consumerProfile.type} consumer profile`
          });
        }
      }
    }
  }

  // Sort by score and return top recommendations
  recommendations.sort((a, b) => b.score - a.score);
  return recommendations.slice(0, 10).map(r => r.name);
}

export async function POST(request: Request) {
  try {
    const body: AnalyzeRequest = await request.json();
    const { images, address, nearbyBusinesses, trafficData, demographicsData } = body;

    const hasImages = images && images.length > 0;

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GOOGLE_GEMINI_API_KEY not configured');
      return NextResponse.json({
        ...getMockAnalysis(nearbyBusinesses, trafficData, demographicsData),
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

    // Prepare demographics context
    let demographicsContext = '\n\nNo demographics data available.';
    if (demographicsData) {
      demographicsContext = `\n\nDemographics Data:
- Median Household Income: $${demographicsData.medianHouseholdIncome.toLocaleString()}
- Income Level: ${demographicsData.incomeLevel.toUpperCase()}
- Consumer Profile: ${demographicsData.consumerProfile.type}
- Profile Description: ${demographicsData.consumerProfile.description}
- Population: ${demographicsData.population.toLocaleString()}
- Median Age: ${demographicsData.medianAge}
- Education (Bachelor's+): ${demographicsData.educationBachelorsOrHigher}%
- Poverty Rate: ${demographicsData.povertyRate}%

BUSINESSES THAT FIT THIS DEMOGRAPHIC: ${demographicsData.consumerProfile.preferredBusinesses.slice(0, 10).join(', ')}

INCOME-BASED TARGETING:
- LOW income areas ($0-35k): Dollar General, Hardee's, Waffle House, Little Caesars, Check Cashing
- MODERATE income ($35-55k): Walmart, McDonald's, Wendy's, Applebee's, Planet Fitness
- MIDDLE income ($55-85k): Target, Chick-fil-A, Starbucks, Olive Garden, LA Fitness
- UPPER-MIDDLE income ($85-125k): Whole Foods, Trader Joe's, Panera, Orangetheory
- HIGH income ($125k+): Premium dining, boutique fitness, luxury retail`;
    }

    if (trafficData) {
      // Initial recommendations for the prompt (will be recalculated with lot size after AI response)
      topRecommendations = generateTopRecommendations(trafficData.estimatedVPD, nearbyBusinesses, demographicsData, null);

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
  "lotSizeEstimate": "<${hasImages ? 'estimated lot size in acres (e.g., \"Approximately 0.75 acres\" or \"1.2 - 1.5 acres\")' : 'Unable to estimate without images'}>",
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

    // Parse lot size from AI analysis
    const lotSizeAcres = parseLotSize(analysis.lotSizeEstimate);
    if (lotSizeAcres !== null) {
      analysis.parsedLotSize = lotSizeAcres;
    }

    // Recalculate business suitability with lot size (if available)
    if (trafficData) {
      businessSuitability = calculateBusinessSuitability(
        trafficData.estimatedVPD,
        nearbyBusinesses,
        demographicsData,
        lotSizeAcres
      );
      topRecommendations = generateTopRecommendations(
        trafficData.estimatedVPD,
        nearbyBusinesses,
        demographicsData,
        lotSizeAcres
      );
    }

    // Add business suitability data and top recommendations
    if (businessSuitability.length > 0) {
      analysis.businessSuitability = businessSuitability;
    }
    if (topRecommendations.length > 0) {
      analysis.topRecommendations = topRecommendations;
    }

    // Calculate comprehensive feasibility score
    const feasibilityScore = calculateFeasibilityScore(trafficData, demographicsData, nearbyBusinesses);
    analysis.feasibilityScore = feasibilityScore;
    // Override viabilityScore with our calculated score
    analysis.viabilityScore = feasibilityScore.overall;

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

function getMockAnalysis(nearbyBusinesses: Business[], trafficData: TrafficInfo | null, demographicsData: DemographicsInfo | null = null, lotSizeAcres: number | null = 1.35) {
  const vpd = trafficData?.estimatedVPD || 15000;
  const businessSuitability = calculateBusinessSuitability(vpd, nearbyBusinesses, demographicsData, lotSizeAcres);
  const topRecommendations = generateTopRecommendations(vpd, nearbyBusinesses, demographicsData, lotSizeAcres);
  const feasibilityScore = calculateFeasibilityScore(trafficData, demographicsData, nearbyBusinesses);

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
    viabilityScore: feasibilityScore.overall,
    feasibilityScore,
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
