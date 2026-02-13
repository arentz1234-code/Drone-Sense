import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { RETAILER_REQUIREMENTS, RetailerRequirements, getRegionFromState, US_REGIONS } from '@/data/retailerRequirements';
import {
  ALL_BUSINESSES,
  getBusinessesThatFitLot,
  getBusinessesForShoppingCenter,
  getNewConstructionOnlyBusinesses,
  assessDriveThroughFeasibility,
  BusinessRequirements,
  CONSTRUCTION_LABELS,
} from '@/data/BusinessIntelligence';
import { LOT_SIZE_REFERENCE } from '@/data/lotSizeReference';

// Helper to get tenant examples from CRE Lot Size Reference spreadsheet
function getTenantsFromSpreadsheet(category: string): string[] {
  const categoryMap: Record<string, string[]> = {
    'qsr': ['QUICK-SERVICE RESTAURANT (QSR)'],
    'casual_dining': ['CASUAL / FULL-SERVICE RESTAURANT'],
    'coffee': ['QUICK-SERVICE RESTAURANT (QSR)'],
    'convenience': ['CONVENIENCE STORE / GAS STATION'],
    'discount_retail': ['DOLLAR STORE / DISCOUNT'],
    'retail': ['DEPARTMENT STORE / MALL ANCHOR', 'HOME IMPROVEMENT / SPECIALTY RETAIL'],
    'bank': ['BANK / FINANCIAL'],
    'pharmacy': ['PHARMACY / HEALTH / MEDICAL'],
    'auto_service': ['AUTO PARTS / SERVICE / DEALERSHIP'],
    'fitness': ['CLUB / FITNESS / ENTERTAINMENT'],
    'medical': ['PHARMACY / HEALTH / MEDICAL'],
    'grocery': ['GROCERY / SUPERMARKET'],
    'big_box': ['BIG BOX / WAREHOUSE RETAIL'],
    'hotel': ['HOTEL / HOSPITALITY'],
    'office': ['OFFICE'],
    'industrial': ['INDUSTRIAL / WAREHOUSE / DISTRIBUTION'],
  };

  const categories = categoryMap[category] || [];
  const tenants = LOT_SIZE_REFERENCE
    .filter(t => categories.includes(t.category))
    .map(t => t.tenant);

  return tenants.slice(0, 8);
}

// Re-export for use in other files
export type { RetailerMatch } from '@/app/api/retailer-match/route';

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
    environmentalScore: number;
    marketScore: number;
  };
  details: {
    traffic: string;
    demographics: string;
    competition: string;
    access: string;
    environmental: string;
    market: string;
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
  isCollegeTown?: boolean;
  collegeEnrollment?: number;
  collegeEnrollmentPercent?: number;
  consumerProfile: {
    type: string;
    description: string;
    preferredBusinesses: string[];
  };
}

interface EnvironmentalRiskInfo {
  floodZone: { zone: string; risk: string };
  wetlands: { present: boolean };
  brownfields: { present: boolean; count?: number };
  superfund: { present: boolean; count?: number };
  overallRiskScore: number;
  riskFactors?: string[];
}

interface MarketCompInfo {
  address: string;
  salePrice: number;
  pricePerSqft: number;
  sqft: number;
  saleDate: string;
  distance: string;
  propertyType: string;
}

interface AnalyzeRequest {
  images: string[];
  address: string;
  coordinates: { lat: number; lng: number } | null;
  nearbyBusinesses: Business[];
  trafficData: TrafficInfo | null;
  demographicsData: DemographicsInfo | null;
  environmentalRisk: EnvironmentalRiskInfo | null;
  marketComps: MarketCompInfo[] | null;
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
    examples: ["Buc-ee's", 'QuikTrip (QT)', 'RaceTrac', 'Wawa', 'Sheetz', '7-Eleven / Circle K (Standard)'] // From CRE Lot Size Reference
  },
  fastFoodValue: {
    min: 12000, ideal: 18000,
    incomePreference: ['low', 'moderate'] as const,
    lotSize: { min: 0.4, ideal: 0.8 }, // Fast food needs 0.4-0.8 acres for building + drive-thru
    examples: ["McDonald's", "Wendy's", 'Taco Bell', "Popeyes", "Burger King", "Sonic Drive-In"] // From CRE Lot Size Reference
  },
  fastFoodPremium: {
    min: 15000, ideal: 22000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 0.5, ideal: 1.0 }, // Premium fast food needs 0.5-1 acre
    examples: ["Chick-fil-A", "Raising Cane's", "Whataburger", "Culver's", "Zaxby's", "Popeyes"] // From CRE Lot Size Reference
  },
  casualDiningValue: {
    min: 12000, ideal: 18000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 0.8, ideal: 1.5 }, // Casual dining needs 0.8-1.5 acres
    examples: ["Chili's / Applebee's", "IHOP / Denny's", "Waffle House", "Cracker Barrel"] // From CRE Lot Size Reference
  },
  casualDiningPremium: {
    min: 15000, ideal: 20000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 1.0, ideal: 2.0 }, // Premium casual dining needs 1-2 acres
    examples: ["Olive Garden / Red Lobster", "Texas Roadhouse", "Buffalo Wild Wings"] // From CRE Lot Size Reference
  },
  coffeeValue: {
    min: 10000, ideal: 15000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 0.2, ideal: 0.5 }, // Coffee shops need 0.2-0.5 acres
    examples: ["Dunkin'", "Panera Bread", "McDonald's"] // From CRE Lot Size Reference
  },
  coffeePremium: {
    min: 15000, ideal: 20000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 0.25, ideal: 0.6 }, // Premium coffee needs 0.25-0.6 acres
    examples: ['Starbucks (Drive-Thru)', 'Panera Bread'] // From CRE Lot Size Reference
  },
  quickServiceValue: {
    min: 8000, ideal: 12000,
    incomePreference: ['low', 'moderate'] as const,
    lotSize: { min: 0.2, ideal: 0.5 }, // Quick service needs 0.2-0.5 acres
    examples: ['Wingstop', "Zaxby's", 'Popeyes', 'Taco Bell'] // From CRE Lot Size Reference
  },
  quickServicePremium: {
    min: 12000, ideal: 18000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 0.3, ideal: 0.6 }, // Premium quick service needs 0.3-0.6 acres
    examples: ['Chipotle', 'Panera Bread', 'Panda Express', "Culver's"] // From CRE Lot Size Reference
  },
  convenience: {
    min: 8000, ideal: 12000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 0.3, ideal: 0.8 }, // Convenience stores need 0.3-0.8 acres
    examples: ['7-Eleven / Circle K (Standard)', 'Wawa', 'QuikTrip (QT)', 'RaceTrac', 'Sheetz'] // From CRE Lot Size Reference
  },
  discountRetail: {
    min: 8000, ideal: 12000,
    incomePreference: ['low', 'moderate'] as const,
    lotSize: { min: 0.5, ideal: 1.2 }, // Discount retail needs 0.5-1.2 acres
    examples: ['Dollar General', 'Dollar Tree / Family Dollar', 'Five Below', "Ollie's Bargain Outlet"] // From CRE Lot Size Reference
  },
  retailPremium: {
    min: 15000, ideal: 22000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 1.5, ideal: 3.0 }, // Premium retail needs 1.5-3 acres
    examples: ['Target', 'TJ Maxx / Marshalls / HomeGoods', 'Ross Dress for Less', 'Burlington', 'Ulta Beauty', "Trader Joe's", 'Whole Foods Market'] // From CRE Lot Size Reference
  },
  bank: {
    min: 10000, ideal: 15000,
    incomePreference: ['moderate', 'middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 0.2, ideal: 0.5 }, // Banks need 0.2-0.5 acres
    examples: ['Bank Branch (Chase, Wells Fargo, etc.)'] // From CRE Lot Size Reference
  },
  financialServices: {
    min: 6000, ideal: 10000,
    incomePreference: ['low', 'moderate'] as const,
    lotSize: { min: 0.1, ideal: 0.3 }, // Financial services need 0.1-0.3 acres
    examples: ["Aaron's / Rent-A-Center"] // From CRE Lot Size Reference
  },
  pharmacy: {
    min: 12000, ideal: 18000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.8, ideal: 1.5 }, // Pharmacies need 0.8-1.5 acres (with drive-thru)
    examples: ['CVS Pharmacy', 'Walgreens'] // From CRE Lot Size Reference
  },
  autoService: {
    min: 10000, ideal: 15000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 0.3, ideal: 0.7 }, // Auto service needs 0.3-0.7 acres
    examples: ['Jiffy Lube / Take 5 Oil Change', "AutoZone / O'Reilly / Advance Auto", 'Tire Shop (Discount Tire)'] // From CRE Lot Size Reference
  },
  autoServicePremium: {
    min: 15000, ideal: 20000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 0.5, ideal: 1.0 }, // Premium auto service needs 0.5-1 acre
    examples: ['Car Wash (Express Tunnel)', 'Collision Center / Body Shop', 'Auto Dealership (New Car)'] // From CRE Lot Size Reference
  },
  fitness: {
    min: 10000, ideal: 15000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 1.0, ideal: 2.0 }, // Fitness centers need 1-2 acres
    examples: ['Planet Fitness', 'Chuck E. Cheese'] // From CRE Lot Size Reference
  },
  fitnessPremium: {
    min: 15000, ideal: 20000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 1.5, ideal: 3.0 }, // Premium fitness needs 1.5-3 acres
    examples: ['LA Fitness / Esporta', 'Lifetime Fitness', "Dave & Buster's", 'Main Event', 'Topgolf'] // From CRE Lot Size Reference
  },
  medical: {
    min: 8000, ideal: 12000,
    incomePreference: ['low', 'moderate', 'middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 0.2, ideal: 0.5 }, // Medical offices need 0.2-0.5 acres
    examples: ['Urgent Care', 'Dental Office', 'Medical Clinic', 'CareNow', 'AFC Urgent Care', 'MedExpress']
  },
  // ============ CAR WASH ============
  carWashExpress: {
    min: 15000, ideal: 25000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 0.4, ideal: 0.8 }, // Express car wash needs 0.4-0.8 acres
    examples: ['Car Wash (Express Tunnel)'] // From CRE Lot Size Reference
  },
  carWashFull: {
    min: 12000, ideal: 20000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 0.8, ideal: 1.5 }, // Full service car wash needs 0.8-1.5 acres
    examples: ['Car Wash (Express Tunnel)'] // From CRE Lot Size Reference - same category
  },
  // ============ AUTOMOTIVE ============
  carDealershipUsed: {
    min: 15000, ideal: 25000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 1.5, ideal: 3.0 }, // Used car lots need 1.5-3 acres
    examples: ['Auto Dealership (New Car)'] // From CRE Lot Size Reference
  },
  carDealershipNew: {
    min: 20000, ideal: 30000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 3.0, ideal: 6.0 }, // New car dealerships need 3-6 acres
    examples: ['Auto Dealership (New Car)'] // From CRE Lot Size Reference
  },
  tireShop: {
    min: 10000, ideal: 18000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 0.3, ideal: 0.6 }, // Tire shops need 0.3-0.6 acres
    examples: ['Tire Shop (Discount Tire)'] // From CRE Lot Size Reference
  },
  oilChange: {
    min: 10000, ideal: 18000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 0.15, ideal: 0.3 }, // Oil change shops need 0.15-0.3 acres
    examples: ['Jiffy Lube / Take 5 Oil Change'] // From CRE Lot Size Reference
  },
  autoBodyShop: {
    min: 8000, ideal: 15000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.5, ideal: 1.0 }, // Body shops need 0.5-1 acre
    examples: ['Collision Center / Body Shop'] // From CRE Lot Size Reference
  },
  // ============ HOTELS & LODGING ============
  hotelBudget: {
    min: 15000, ideal: 25000,
    incomePreference: ['low', 'moderate'] as const,
    lotSize: { min: 1.0, ideal: 2.0 }, // Budget hotels need 1-2 acres
    examples: ['Economy Hotel (Holiday Inn Express, 80 keys)'] // From CRE Lot Size Reference
  },
  hotelMidScale: {
    min: 18000, ideal: 28000,
    incomePreference: ['moderate', 'middle'] as const,
    lotSize: { min: 1.5, ideal: 2.5 }, // Mid-scale hotels need 1.5-2.5 acres
    examples: ['Select Service Hotel (Hampton Inn, 80-120 keys)'] // From CRE Lot Size Reference
  },
  hotelUpscale: {
    min: 20000, ideal: 30000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 2.0, ideal: 4.0 }, // Upscale hotels need 2-4 acres
    examples: ['Full-Service Hotel (Marriott, 200+ keys)'] // From CRE Lot Size Reference
  },
  // ============ STORAGE ============
  selfStorage: {
    min: 8000, ideal: 15000,
    incomePreference: ['low', 'moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 2.0, ideal: 5.0 }, // Self storage needs 2-5 acres
    examples: ['Self-Storage Facility', 'U-Haul / Public Storage (multi-story)'] // From CRE Lot Size Reference
  },
  rvBoatStorage: {
    min: 5000, ideal: 10000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 3.0, ideal: 8.0 }, // RV/Boat storage needs 3-8 acres
    examples: ['Self-Storage Facility'] // From CRE Lot Size Reference - closest match
  },
  // ============ CHILDCARE & EDUCATION ============
  daycare: {
    min: 8000, ideal: 12000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.5, ideal: 1.0 }, // Daycares need 0.5-1 acre
    examples: ['Childcare Center (KinderCare, Primrose)'] // From CRE Lot Size Reference
  },
  tutoringCenter: {
    min: 8000, ideal: 12000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 0.1, ideal: 0.25 }, // Tutoring centers need 0.1-0.25 acres (strip mall)
    examples: ['Childcare Center (KinderCare, Primrose)'] // From CRE Lot Size Reference - closest education match
  },
  tradeSchool: {
    min: 10000, ideal: 18000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 1.0, ideal: 2.5 }, // Trade schools need 1-2.5 acres
    examples: ['Small Industrial / Flex Space'] // From CRE Lot Size Reference - similar footprint
  },
  // ============ PET SERVICES ============
  petStore: {
    min: 12000, ideal: 18000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.8, ideal: 1.5 }, // Pet stores need 0.8-1.5 acres
    examples: ['PetSmart / Petco'] // From CRE Lot Size Reference
  },
  vetClinic: {
    min: 8000, ideal: 12000,
    incomePreference: ['moderate', 'middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 0.25, ideal: 0.5 }, // Vet clinics need 0.25-0.5 acres
    examples: ['PetSmart / Petco'] // From CRE Lot Size Reference - often co-located
  },
  petGrooming: {
    min: 6000, ideal: 10000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.1, ideal: 0.2 }, // Pet grooming needs 0.1-0.2 acres
    examples: ['PetSmart / Petco'] // From CRE Lot Size Reference - grooming services
  },
  doggyDaycare: {
    min: 8000, ideal: 12000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 0.5, ideal: 1.0 }, // Doggy daycare needs 0.5-1 acre
    examples: ['PetSmart / Petco'] // From CRE Lot Size Reference - doggy daycare services
  },
  // ============ PERSONAL SERVICES ============
  hairSalon: {
    min: 6000, ideal: 10000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 0.1, ideal: 0.2 }, // Hair salons need 0.1-0.2 acres
    examples: ['Ulta Beauty'] // From CRE Lot Size Reference - closest match
  },
  salonPremium: {
    min: 10000, ideal: 15000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 0.15, ideal: 0.3 }, // Premium salons need 0.15-0.3 acres
    examples: ['Ulta Beauty'] // From CRE Lot Size Reference
  },
  nailSalon: {
    min: 6000, ideal: 10000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.08, ideal: 0.15 }, // Nail salons need 0.08-0.15 acres
    examples: ['Ulta Beauty'] // From CRE Lot Size Reference - closest match
  },
  spa: {
    min: 10000, ideal: 15000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 0.15, ideal: 0.3 }, // Spas need 0.15-0.3 acres
    examples: ['Ulta Beauty'] // From CRE Lot Size Reference - beauty services
  },
  barbershop: {
    min: 5000, ideal: 8000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 0.05, ideal: 0.1 }, // Barbershops need 0.05-0.1 acres
    examples: ['Ulta Beauty'] // From CRE Lot Size Reference - closest personal care match
  },
  tattooShop: {
    min: 5000, ideal: 10000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 0.05, ideal: 0.1 }, // Tattoo shops need 0.05-0.1 acres
    examples: ['Small Industrial / Flex Space'] // From CRE Lot Size Reference - similar footprint
  },
  // ============ RETAIL SPECIALTY ============
  cellPhoneStore: {
    min: 10000, ideal: 15000,
    incomePreference: ['low', 'moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.08, ideal: 0.15 }, // Cell phone stores need 0.08-0.15 acres
    examples: ['Best Buy'] // From CRE Lot Size Reference - electronics retail
  },
  liquorStore: {
    min: 8000, ideal: 12000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 0.15, ideal: 0.3 }, // Liquor stores need 0.15-0.3 acres
    examples: ['Dollar General', 'Dollar Tree / Family Dollar'] // From CRE Lot Size Reference - small retail
  },
  tobaccoVape: {
    min: 6000, ideal: 10000,
    incomePreference: ['low', 'moderate'] as const,
    lotSize: { min: 0.05, ideal: 0.1 }, // Tobacco/vape shops need 0.05-0.1 acres
    examples: ['Dollar General'] // From CRE Lot Size Reference - small retail format
  },
  pawnShop: {
    min: 6000, ideal: 10000,
    incomePreference: ['low', 'moderate'] as const,
    lotSize: { min: 0.1, ideal: 0.2 }, // Pawn shops need 0.1-0.2 acres
    examples: ["Aaron's / Rent-A-Center"] // From CRE Lot Size Reference - similar market
  },
  mattressStore: {
    min: 10000, ideal: 15000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.2, ideal: 0.4 }, // Mattress stores need 0.2-0.4 acres
    examples: ['Mattress Firm / Sleep Number'] // From CRE Lot Size Reference
  },
  furnitureValue: {
    min: 12000, ideal: 18000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 1.0, ideal: 2.0 }, // Value furniture stores need 1-2 acres
    examples: ["Aaron's / Rent-A-Center", 'Burlington'] // From CRE Lot Size Reference
  },
  furniturePremium: {
    min: 15000, ideal: 22000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 1.5, ideal: 3.0 }, // Premium furniture stores need 1.5-3 acres
    examples: ['TJ Maxx / Marshalls / HomeGoods', 'Ross Dress for Less'] // From CRE Lot Size Reference
  },
  // ============ SERVICES ============
  laundromat: {
    min: 5000, ideal: 8000,
    incomePreference: ['low', 'moderate'] as const,
    lotSize: { min: 0.15, ideal: 0.3 }, // Laundromats need 0.15-0.3 acres
    examples: ['Dollar General'] // From CRE Lot Size Reference - similar small retail format
  },
  dryCleaner: {
    min: 6000, ideal: 10000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.1, ideal: 0.2 }, // Dry cleaners need 0.1-0.2 acres
    examples: ['Dollar General'] // From CRE Lot Size Reference - similar small retail format
  },
  shippingStore: {
    min: 8000, ideal: 12000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.08, ideal: 0.15 }, // Shipping stores need 0.08-0.15 acres
    examples: ['Staples / Office Depot'] // From CRE Lot Size Reference
  },
  printCopy: {
    min: 8000, ideal: 12000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.1, ideal: 0.2 }, // Print shops need 0.1-0.2 acres
    examples: ['Staples / Office Depot'] // From CRE Lot Size Reference
  },
  // ============ FOOD & BEVERAGE SPECIALTY ============
  pizzaDelivery: {
    min: 8000, ideal: 12000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 0.1, ideal: 0.2 }, // Pizza delivery needs 0.1-0.2 acres
    examples: ["McDonald's", "Wendy's", "Taco Bell"] // From CRE Lot Size Reference - similar QSR format
  },
  pizzaSitDown: {
    min: 10000, ideal: 15000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.4, ideal: 0.8 }, // Sit-down pizza needs 0.4-0.8 acres
    examples: ['Panera Bread', 'Chipotle'] // From CRE Lot Size Reference - fast-casual similar format
  },
  iceCream: {
    min: 8000, ideal: 12000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.08, ideal: 0.15 }, // Ice cream shops need 0.08-0.15 acres
    examples: ["Dunkin'", "Starbucks (Drive-Thru)"] // From CRE Lot Size Reference - similar small format
  },
  frozenYogurt: {
    min: 8000, ideal: 12000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.08, ideal: 0.15 }, // Frozen yogurt needs 0.08-0.15 acres
    examples: ["Dunkin'", "Starbucks (Drive-Thru)"] // From CRE Lot Size Reference - similar small format
  },
  smoothieJuice: {
    min: 10000, ideal: 15000,
    incomePreference: ['moderate', 'middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 0.1, ideal: 0.2 }, // Smoothie/juice bars need 0.1-0.2 acres
    examples: ["Dunkin'", "Starbucks (Drive-Thru)"] // From CRE Lot Size Reference - similar format
  },
  donutBakery: {
    min: 8000, ideal: 12000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 0.1, ideal: 0.2 }, // Donut/bakery shops need 0.1-0.2 acres
    examples: ["Dunkin'", 'Panera Bread'] // From CRE Lot Size Reference
  },
  sportsBar: {
    min: 12000, ideal: 18000,
    incomePreference: ['moderate', 'middle'] as const,
    lotSize: { min: 0.6, ideal: 1.2 }, // Sports bars need 0.6-1.2 acres
    examples: ['Buffalo Wild Wings'] // From CRE Lot Size Reference
  },
  breweryTaproom: {
    min: 10000, ideal: 15000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 0.4, ideal: 1.0 }, // Breweries/taprooms need 0.4-1 acre
    examples: ['Buffalo Wild Wings', "Chili's / Applebee's"] // From CRE Lot Size Reference - similar sit-down format
  },
  wineBar: {
    min: 8000, ideal: 12000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 0.1, ideal: 0.25 }, // Wine bars need 0.1-0.25 acres
    examples: ['Buffalo Wild Wings'] // From CRE Lot Size Reference - similar format
  },
  mexicanCasual: {
    min: 12000, ideal: 18000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 0.4, ideal: 0.8 }, // Casual Mexican needs 0.4-0.8 acres
    examples: ['Taco Bell', 'Chipotle'] // From CRE Lot Size Reference
  },
  mexicanSitDown: {
    min: 12000, ideal: 18000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.8, ideal: 1.5 }, // Sit-down Mexican needs 0.8-1.5 acres
    examples: ["Chili's / Applebee's", "Olive Garden / Red Lobster"] // From CRE Lot Size Reference - similar casual dining
  },
  asianFastCasual: {
    min: 10000, ideal: 15000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.3, ideal: 0.6 }, // Asian fast casual needs 0.3-0.6 acres
    examples: ['Panda Express', 'Chipotle'] // From CRE Lot Size Reference
  },
  asianSitDown: {
    min: 12000, ideal: 18000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 0.6, ideal: 1.2 }, // Sit-down Asian needs 0.6-1.2 acres
    examples: ["Olive Garden / Red Lobster", 'Texas Roadhouse'] // From CRE Lot Size Reference - similar casual dining
  },
  // ============ ENTERTAINMENT ============
  movieTheater: {
    min: 20000, ideal: 30000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 4.0, ideal: 8.0 }, // Movie theaters need 4-8 acres
    examples: ['Movie Theater (AMC/Regal, 12-16 screen)'] // From CRE Lot Size Reference
  },
  bowlingAlley: {
    min: 12000, ideal: 18000,
    incomePreference: ['moderate', 'middle'] as const,
    lotSize: { min: 2.0, ideal: 4.0 }, // Bowling alleys need 2-4 acres
    examples: ['Main Event', "Dave & Buster's"] // From CRE Lot Size Reference
  },
  arcadeFEC: {
    min: 15000, ideal: 22000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 1.5, ideal: 3.0 }, // Family entertainment centers need 1.5-3 acres
    examples: ["Dave & Buster's", 'Main Event', 'Chuck E. Cheese'] // From CRE Lot Size Reference
  },
  trampolinePark: {
    min: 12000, ideal: 18000,
    incomePreference: ['moderate', 'middle'] as const,
    lotSize: { min: 1.5, ideal: 2.5 }, // Trampoline parks need 1.5-2.5 acres
    examples: ["Dave & Buster's", 'Main Event', 'Chuck E. Cheese'] // From CRE Lot Size Reference - family entertainment
  },
  miniGolf: {
    min: 10000, ideal: 15000,
    incomePreference: ['moderate', 'middle'] as const,
    lotSize: { min: 1.0, ideal: 2.0 }, // Mini golf needs 1-2 acres
    examples: ['Topgolf'] // From CRE Lot Size Reference
  },
  martialArts: {
    min: 6000, ideal: 10000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.15, ideal: 0.3 }, // Martial arts studios need 0.15-0.3 acres
    examples: ['Planet Fitness', 'LA Fitness / Esporta'] // From CRE Lot Size Reference - fitness category
  },
  yogaPilates: {
    min: 8000, ideal: 12000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 0.1, ideal: 0.2 }, // Yoga/Pilates studios need 0.1-0.2 acres
    examples: ['Planet Fitness', 'Lifetime Fitness'] // From CRE Lot Size Reference - fitness category
  },
  danceStudio: {
    min: 6000, ideal: 10000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.15, ideal: 0.3 }, // Dance studios need 0.15-0.3 acres
    examples: ['Planet Fitness'] // From CRE Lot Size Reference - fitness category
  },
  // ============ GROCERY ============
  groceryValue: {
    min: 15000, ideal: 22000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 1.5, ideal: 3.0 }, // Value grocers need 1.5-3 acres
    examples: ['Aldi', 'Lidl'] // From CRE Lot Size Reference
  },
  groceryMid: {
    min: 18000, ideal: 28000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 3.0, ideal: 5.0 }, // Mid-tier grocers need 3-5 acres
    examples: ['Kroger', 'Publix'] // From CRE Lot Size Reference
  },
  groceryPremium: {
    min: 20000, ideal: 30000,
    incomePreference: ['upper-middle', 'high'] as const,
    lotSize: { min: 2.0, ideal: 4.0 }, // Premium grocers need 2-4 acres
    examples: ['Whole Foods Market', "Trader Joe's", 'Sprouts Farmers Market'] // From CRE Lot Size Reference
  },
  // ============ TRUCK STOP ============
  truckStop: {
    min: 25000, ideal: 40000,
    incomePreference: ['low', 'moderate'] as const,
    lotSize: { min: 5.0, ideal: 15.0 }, // Truck stops need 5-15 acres
    examples: ["Love's Travel Stop", 'Pilot / Flying J'] // From CRE Lot Size Reference
  },
  // ============ COLLEGE TOWN FAVORITES ============
  // These businesses thrive in college markets despite low census income
  collegeTownFastCasual: {
    min: 10000, ideal: 18000,
    incomePreference: ['low', 'moderate', 'middle', 'upper-middle'] as const, // Works across income levels in college towns
    lotSize: { min: 0.4, ideal: 0.8 },
    examples: ["Chick-fil-A", "Chipotle", "Raising Cane's", "Wingstop", "Panda Express", "Panera Bread", "Taco Bell", "Wendy's"] // From CRE Lot Size Reference
  },
  collegeTownCoffee: {
    min: 8000, ideal: 15000,
    incomePreference: ['low', 'moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.2, ideal: 0.5 },
    examples: ["Starbucks (Drive-Thru)", "Dunkin'", "Panera Bread"] // From CRE Lot Size Reference
  },
  collegeTownLateNight: {
    min: 8000, ideal: 12000,
    incomePreference: ['low', 'moderate'] as const,
    lotSize: { min: 0.3, ideal: 0.6 },
    examples: ["Waffle House", "Taco Bell", "McDonald's", "Wendy's", "Popeyes"] // From CRE Lot Size Reference
  },
  collegeTownServices: {
    min: 6000, ideal: 10000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 0.2, ideal: 0.5 },
    examples: ["Planet Fitness", "McDonald's", "Wendy's", "Chick-fil-A"] // From CRE Lot Size Reference
  },
  collegeTownEntertainment: {
    min: 10000, ideal: 15000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 0.5, ideal: 1.5 },
    examples: ["Buffalo Wild Wings", "Topgolf", "Dave & Buster's", "Main Event", "Chuck E. Cheese"] // From CRE Lot Size Reference
  },
};

// Generate business intelligence context for AI prompt
function generateBusinessIntelligenceContext(address: string, nearbyBusinesses: Business[]): string {
  const addressLower = address.toLowerCase();
  const isShoppingCenter = /\b(suite|ste|unit|#)\s*\d*[a-z]?\b/i.test(address) ||
    ['plaza', 'center', 'mall', 'shopping', 'village', 'commons', 'square'].some(kw => addressLower.includes(kw));

  // Get key business requirements examples
  const driveThruRequired = ALL_BUSINESSES.filter(b => b.driveThrough === 'required').slice(0, 10);
  const newConstructionOnly = getNewConstructionOnlyBusinesses().slice(0, 8);
  const shoppingCenterOk = getBusinessesForShoppingCenter().slice(0, 10);

  let context = `\n\n=== BUSINESS INTELLIGENCE RULES ===\n`;

  // Shopping center specific rules
  if (isShoppingCenter) {
    context += `\n** SHOPPING CENTER LOCATION DETECTED **
DO NOT RECOMMEND these businesses (require freestanding locations):
- Gas Stations (Shell, BP, RaceTrac, QuikTrip, Wawa, Buc-ee's)
- Car Washes (any type)
- Auto Service/Repair
- Hotels/Motels
- Self Storage

APPROPRIATE for shopping centers: ${shoppingCenterOk.map(b => b.name).join(', ')}\n`;
  }

  context += `
DRIVE-THROUGH REQUIREMENTS (DO NOT recommend if lot cannot support drive-through):
These businesses REQUIRE drive-through and need 0.5-1.5 acre lots with corner access:
${driveThruRequired.map(b => `- ${b.name}: ${b.minSqFt}-${b.maxSqFt} sq ft, ${b.minLotAcres || 0.5}-${b.maxLotAcres || 1.5} acres${b.driveThroughNotes ? ` (${b.driveThroughNotes})` : ''}`).join('\n')}

NEW CONSTRUCTION ONLY (will not convert existing buildings):
${newConstructionOnly.map(b => `- ${b.name}: ${b.notes || 'Requires new construction'}`).join('\n')}

LOT SIZE REQUIREMENTS:
- Chick-fil-A: 1.0-1.5 acres (dual drive-through, 20+ car stacking)
- Raising Cane's: 0.8-1.3 acres (high volume drive-through)
- Buc-ee's: 15-25 acres (travel center)
- Walmart Supercenter: 15-25 acres
- Standard QSR (McDonald's, Wendy's): 0.5-1.0 acres
- Coffee Drive-Through: 0.2-0.5 acres
- Banks: 0.5-1.0 acres (drive-through required)
- Pharmacies (CVS, Walgreens): 1.0-2.0 acres (corner lot, drive-through)

COMPETITION = MARKET VALIDATION:
Gas stations, pharmacies, coffee shops, and fast food often cluster together.
If you see 2+ gas stations nearby, this is a POSITIVE indicator for more fuel/convenience.
CVS and Walgreens often locate on opposite corners - this validates the market.`;

  return context;
}

// District types for location-appropriate recommendations
type DistrictType = 'historic_downtown' | 'suburban_retail' | 'highway_corridor' | 'neighborhood' | 'college_campus' | 'shopping_center' | 'general';

interface DistrictInfo {
  type: DistrictType;
  description: string;
  appropriateCategories: string[];
  inappropriateCategories: string[];
}

// Detect district type based on address, nearby businesses, and context
function detectDistrictType(
  address: string,
  nearbyBusinesses: Business[],
  lotSizeAcres: number | null,
  vpd: number | null,
  isCollegeTown: boolean
): DistrictInfo {
  const addressLower = address.toLowerCase();
  const businessNames = nearbyBusinesses.map(b => b.name.toLowerCase()).join(' ');
  const businessTypes = nearbyBusinesses.map(b => b.type.toLowerCase()).join(' ');

  // Downtown/Historic District indicators
  const downtownKeywords = ['downtown', 'main st', 'main street', 'historic', 'town square', 'court square', 'city center', 'old town'];
  const downtownBusinessIndicators = ['boutique', 'gallery', 'antique', 'cafe', 'bistro', 'tavern', 'brewery', 'bookstore', 'salon'];

  const hasDowntownAddress = downtownKeywords.some(kw => addressLower.includes(kw));
  const hasDowntownBusinesses = downtownBusinessIndicators.some(ind =>
    businessNames.includes(ind) || businessTypes.includes(ind)
  );
  const isSmallLot = lotSizeAcres !== null && lotSizeAcres < 0.5;
  const isLowVPD = vpd !== null && vpd < 15000; // Pedestrian areas have less car traffic
  const hasHighBusinessDensity = nearbyBusinesses.length > 15;

  // Score downtown likelihood
  let downtownScore = 0;
  if (hasDowntownAddress) downtownScore += 3;
  if (hasDowntownBusinesses) downtownScore += 2;
  if (isSmallLot) downtownScore += 1;
  if (hasHighBusinessDensity) downtownScore += 1;

  // Highway corridor indicators
  const highwayKeywords = ['highway', 'hwy', 'interstate', 'i-', 'exit', 'frontage'];
  const hasHighwayAddress = highwayKeywords.some(kw => addressLower.includes(kw));
  const isHighVPD = vpd !== null && vpd >= 25000;

  // Shopping center / Strip mall detection
  // Suite numbers (A, B, C, #123, Ste, Suite, Unit) indicate multi-tenant retail
  const shoppingCenterKeywords = ['plaza', 'shopping center', 'strip mall', 'retail center', 'town center', 'marketplace', 'shopping'];
  const hasSuiteNumber = /\b(suite|ste|unit|#)\s*\d*[a-z]?\b/i.test(address) || /\s[a-z]$/i.test(address.trim());
  const hasShoppingCenterAddress = shoppingCenterKeywords.some(kw => addressLower.includes(kw));

  if (hasSuiteNumber || hasShoppingCenterAddress) {
    return {
      type: 'shopping_center',
      description: 'Shopping center / Strip mall - inline retail space with shared parking',
      appropriateCategories: [
        'fastFoodValue', 'fastFoodPremium', 'casualDiningValue', 'casualDiningPremium',
        'coffeeValue', 'coffeePremium', 'quickServiceValue', 'quickServicePremium',
        'retailPremium', 'discountRetail', 'bank', 'pharmacy', 'fitness', 'medical',
        'hairSalon', 'salonPremium', 'nailSalon', 'cellPhoneStore'
      ],
      inappropriateCategories: [
        // Gas stations need standalone lots with fuel tanks, dedicated access
        'gasStation', 'convenience',
        // Car-centric businesses need their own lots
        'carWashExpress', 'carWashFull', 'autoService', 'autoServicePremium',
        'oilChange', 'tireShop', 'autoBodyShop',
        'carDealershipNew', 'carDealershipUsed',
        // Too large for shopping center inline space
        'bigBox', 'truckStop', 'selfStorage', 'rvBoatStorage',
        'hotelBudget', 'hotelMidScale', 'hotelUpscale'
      ]
    };
  }

  // College campus area
  if (isCollegeTown && (addressLower.includes('university') || addressLower.includes('college') || businessNames.includes('university'))) {
    return {
      type: 'college_campus',
      description: 'College campus area - student-focused retail and dining',
      appropriateCategories: [
        'collegeTownFastCasual', 'collegeTownCoffee', 'collegeTownLateNight',
        'collegeTownServices', 'collegeTownEntertainment', 'fastFoodPremium',
        'coffeePremium', 'fastCasual'
      ],
      inappropriateCategories: [
        'bigBox', 'carDealershipNew', 'carDealershipUsed', 'truckStop',
        'discountRetail', 'financialServices'
      ]
    };
  }

  // Historic Downtown
  if (downtownScore >= 3 || (hasDowntownAddress && isSmallLot)) {
    return {
      type: 'historic_downtown',
      description: 'Historic downtown district - boutique retail, dining, and specialty shops',
      appropriateCategories: [
        'coffeePremium', 'coffeeValue', 'fastCasual', 'casualDiningPremium',
        'retailPremium', 'bank', 'medical', 'fitness'
      ],
      inappropriateCategories: [
        'gasStation', 'discountRetail', 'bigBox', 'truckStop', 'carWashExpress',
        'carWashFull', 'carDealershipNew', 'carDealershipUsed', 'fastFoodValue',
        'financialServices', 'autoService', 'convenienceStore'
      ]
    };
  }

  // Highway corridor
  if (hasHighwayAddress || isHighVPD) {
    return {
      type: 'highway_corridor',
      description: 'Highway corridor - high visibility, drive-thru friendly, travel services',
      appropriateCategories: [
        'gasStation', 'fastFoodValue', 'fastFoodPremium', 'convenienceStore',
        'hotelBudget', 'hotelMidscale', 'truckStop', 'autoService', 'carWashExpress'
      ],
      inappropriateCategories: [
        'retailPremium', 'fitnessPremium'
      ]
    };
  }

  // Suburban retail (default for most commercial areas)
  if (lotSizeAcres && lotSizeAcres >= 1) {
    return {
      type: 'suburban_retail',
      description: 'Suburban retail corridor - diverse mix of retail and services',
      appropriateCategories: [], // All categories allowed
      inappropriateCategories: ['truckStop'] // Only truck stops inappropriate
    };
  }

  // Neighborhood commercial
  return {
    type: 'neighborhood',
    description: 'Neighborhood commercial - local services and convenience',
    appropriateCategories: [
      'coffeeValue', 'coffeePremium', 'fastFoodValue', 'fastFoodPremium',
      'convenienceStore', 'pharmacy', 'medical', 'bank', 'fitness'
    ],
    inappropriateCategories: [
      'bigBox', 'truckStop', 'carDealershipNew', 'carDealershipUsed'
    ]
  };
}

// Downtown-specific business recommendations
const DOWNTOWN_BUSINESSES = {
  dining: [
    'Farm-to-table Restaurant', 'Craft Brewery/Brewpub', 'Wine Bar', 'Tapas Bar',
    'Upscale Bistro', 'Artisan Pizza', 'Specialty Coffee Roaster', 'Brunch Spot',
    'Cocktail Lounge', 'Rooftop Bar', 'Fine Dining'
  ],
  retail: [
    'Boutique Clothing', 'Art Gallery', 'Antique Shop', 'Bookstore',
    'Gift Shop', 'Jewelry Store', 'Home Decor', 'Specialty Food Market',
    'Flower Shop', 'Record/Vinyl Shop'
  ],
  services: [
    'Upscale Salon/Spa', 'Yoga/Pilates Studio', 'Boutique Fitness',
    'Co-working Space', 'Photography Studio', 'Law Office', 'Architecture Firm'
  ],
  entertainment: [
    'Live Music Venue', 'Comedy Club', 'Theater', 'Escape Room',
    'Axe Throwing', 'Board Game Cafe'
  ]
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
  nearbyBusinesses: Business[],
  environmentalRisk: EnvironmentalRiskInfo | null,
  marketComps: MarketCompInfo[] | null
): FeasibilityScore {
  let trafficScore = 5; // Default middle score
  let demographicsScore = 5;
  let competitionScore = 5;
  let accessScore = 5;
  let environmentalScore = 5;
  let marketScore = 5;

  let trafficDetail = 'No traffic data available';
  let demographicsDetail = 'No demographics data available';
  let competitionDetail = 'No nearby business data';
  let accessDetail = 'Unable to assess access';
  let environmentalDetail = 'No environmental data available';
  let marketDetail = 'No market comp data available';

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
    const isCollegeTown = demographicsData.isCollegeTown || false;
    const collegePercent = demographicsData.collegeEnrollmentPercent || 0;

    // Income scoring - adjusted for college towns
    let incomeScore = 5;
    if (isCollegeTown) {
      // College towns: student spending power exceeds census income data
      // Parents, loans, and financial aid boost effective purchasing power
      // Treat college towns as middle-to-upper-middle income markets
      if (collegePercent >= 25) {
        incomeScore = 8; // Major university = strong spending power
      } else if (collegePercent >= 15) {
        incomeScore = 7.5;
      } else {
        incomeScore = 7;
      }
    } else {
      // Standard income scoring for non-college areas
      if (income >= 85000) incomeScore = 9;
      else if (income >= 65000) incomeScore = 8;
      else if (income >= 50000) incomeScore = 7;
      else if (income >= 35000) incomeScore = 5;
      else incomeScore = 4;
    }

    // Employment bonus - lower for college towns since students aren't employed
    const employmentBonus = isCollegeTown
      ? 0.5 // College towns get partial bonus regardless of employment rate
      : (employment >= 95 ? 1 : employment >= 90 ? 0.5 : 0);

    // Population density consideration - college towns often have high density
    const populationBonus = population >= 5000 ? 1 : population >= 2000 ? 0.5 : 0;

    demographicsScore = Math.min(10, Math.round(incomeScore + employmentBonus + populationBonus));

    if (isCollegeTown) {
      demographicsDetail = `College Town market (${collegePercent}% students) - Strong student spending power despite $${income.toLocaleString()} census income, ${population.toLocaleString()} pop`;
    } else {
      demographicsDetail = `${demographicsData.consumerProfile.type} market - $${income.toLocaleString()} median income, ${population.toLocaleString()} pop, ${employment}% employed`;
    }
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

  // ENVIRONMENTAL SCORE (0-10) - Lower risk = higher score
  if (environmentalRisk) {
    const riskScore = environmentalRisk.overallRiskScore; // 0-100, higher is better (less risk)

    // Convert 0-100 risk score to 0-10 feasibility score
    environmentalScore = Math.round(riskScore / 10);

    // Build detail string
    const riskFactors: string[] = [];

    if (environmentalRisk.floodZone.risk === 'high') {
      riskFactors.push('High flood risk');
      environmentalScore = Math.max(0, environmentalScore - 2);
    } else if (environmentalRisk.floodZone.risk === 'moderate') {
      riskFactors.push('Moderate flood risk');
      environmentalScore = Math.max(0, environmentalScore - 1);
    }

    if (environmentalRisk.wetlands.present) {
      riskFactors.push('Wetlands present');
      environmentalScore = Math.max(0, environmentalScore - 1);
    }

    if (environmentalRisk.brownfields.present) {
      const count = environmentalRisk.brownfields.count || 1;
      riskFactors.push(`${count} brownfield site(s) nearby`);
      environmentalScore = Math.max(0, environmentalScore - 1);
    }

    if (environmentalRisk.superfund.present) {
      const count = environmentalRisk.superfund.count || 1;
      riskFactors.push(`${count} Superfund site(s) nearby`);
      environmentalScore = Math.max(0, environmentalScore - 2);
    }

    environmentalScore = Math.min(10, Math.max(0, environmentalScore));

    if (riskFactors.length === 0) {
      environmentalDetail = `Low environmental risk (${riskScore}/100) - Clear for development`;
    } else {
      environmentalDetail = `Environmental concerns: ${riskFactors.join(', ')} (Risk score: ${riskScore}/100)`;
    }
  }

  // MARKET SCORE (0-10) - Based on comparable sales validation
  if (marketComps && marketComps.length > 0) {
    const avgPricePerSqft = marketComps.reduce((sum, c) => sum + c.pricePerSqft, 0) / marketComps.length;
    const compCount = marketComps.length;

    // More comps = more market validation
    if (compCount >= 5) {
      marketScore = 8;
      marketDetail = `Strong market activity: ${compCount} recent sales, avg $${Math.round(avgPricePerSqft)}/sqft`;
    } else if (compCount >= 3) {
      marketScore = 7;
      marketDetail = `Good market activity: ${compCount} recent sales, avg $${Math.round(avgPricePerSqft)}/sqft`;
    } else {
      marketScore = 5;
      marketDetail = `Limited market data: ${compCount} recent sales, avg $${Math.round(avgPricePerSqft)}/sqft`;
    }

    // Bonus for higher price per sqft (indicates desirable area)
    if (avgPricePerSqft >= 200) {
      marketScore = Math.min(10, marketScore + 2);
      marketDetail += ' - Premium market';
    } else if (avgPricePerSqft >= 150) {
      marketScore = Math.min(10, marketScore + 1);
      marketDetail += ' - Strong market';
    }
  }

  // Calculate overall score (weighted average)
  const weights = {
    traffic: 0.25,        // 25% - traffic is critical
    demographics: 0.20,   // 20% - demographics matter
    competition: 0.15,    // 15% - market validation
    access: 0.15,         // 15% - visibility/access
    environmental: 0.15,  // 15% - environmental risk
    market: 0.10          // 10% - market comps validation
  };

  const overall = Math.round(
    (trafficScore * weights.traffic +
    demographicsScore * weights.demographics +
    competitionScore * weights.competition +
    accessScore * weights.access +
    environmentalScore * weights.environmental +
    marketScore * weights.market) * 10
  ) / 10;

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
      accessScore,
      environmentalScore,
      marketScore
    },
    details: {
      traffic: trafficDetail,
      demographics: demographicsDetail,
      competition: competitionDetail,
      environmental: environmentalDetail,
      market: marketDetail,
      access: accessDetail
    },
    rating
  };
}

// Calculate retailer matches for expansion intelligence
interface RetailerMatchResult {
  name: string;
  category: string;
  matchScore: number;
  matchDetails: {
    lotSize: { matches: boolean; note: string };
    traffic: { matches: boolean; note: string };
    demographics: { matches: boolean; note: string };
    region: { matches: boolean; note: string };
  };
  activelyExpanding: boolean;
  franchiseAvailable: boolean;
  corporateOnly: boolean;
  franchiseFee?: number;
  totalInvestment?: string;
  expansionRegions: string[];
  notes?: string;
}

function calculateRetailerMatches(
  lotSizeAcres: number | null,
  vpd: number | null,
  medianIncome: number | null,
  incomeLevel: 'low' | 'moderate' | 'middle' | 'upper-middle' | 'high' | null,
  population: number | null,
  stateCode: string | null,
  isCollegeTown: boolean = false
): { matches: RetailerMatchResult[]; totalMatches: number } {
  const matches: RetailerMatchResult[] = [];

  for (const retailer of RETAILER_REQUIREMENTS) {
    // Only include actively expanding retailers
    if (!retailer.activelyExpanding) continue;

    // Skip discount retailers in college town markets (student income is deceptively low)
    if (isCollegeTown && retailer.category === 'Discount Retail') {
      continue;
    }

    const matchDetails = {
      lotSize: { matches: false, note: '' },
      traffic: { matches: false, note: '' },
      demographics: { matches: false, note: '' },
      region: { matches: false, note: '' },
    };

    let totalScore = 0;
    let weightedFactors = 0;

    // === LOT SIZE MATCHING (30% weight) ===
    if (lotSizeAcres !== null) {
      const lotWeight = 30;
      weightedFactors += lotWeight;

      if (lotSizeAcres >= retailer.minLotSize && lotSizeAcres <= retailer.maxLotSize * 1.5) {
        matchDetails.lotSize.matches = true;
        matchDetails.lotSize.note = `${retailer.minLotSize}-${retailer.maxLotSize} acres needed, site has ${lotSizeAcres.toFixed(1)} acres`;
        totalScore += lotWeight;
      } else if (lotSizeAcres >= retailer.minLotSize * 0.8) {
        matchDetails.lotSize.matches = true;
        matchDetails.lotSize.note = `Site is slightly small (${lotSizeAcres.toFixed(1)} vs ${retailer.minLotSize} min)`;
        totalScore += lotWeight * 0.6;
      } else {
        matchDetails.lotSize.matches = false;
        matchDetails.lotSize.note = `Site too small: needs ${retailer.minLotSize}+ acres, has ${lotSizeAcres.toFixed(1)}`;
        if (lotSizeAcres < retailer.minLotSize * 0.5) {
          continue; // Disqualify
        }
        totalScore += lotWeight * 0.2;
      }
    } else {
      matchDetails.lotSize.note = 'Lot size not available';
    }

    // === TRAFFIC/VPD MATCHING (25% weight) ===
    if (vpd !== null) {
      const vpdWeight = 25;
      weightedFactors += vpdWeight;

      if (vpd >= retailer.idealVPD) {
        matchDetails.traffic.matches = true;
        matchDetails.traffic.note = `Excellent: ${vpd.toLocaleString()} VPD (ideal is ${retailer.idealVPD.toLocaleString()}+)`;
        totalScore += vpdWeight;
      } else if (vpd >= retailer.minVPD) {
        matchDetails.traffic.matches = true;
        matchDetails.traffic.note = `Good: ${vpd.toLocaleString()} VPD meets minimum of ${retailer.minVPD.toLocaleString()}`;
        totalScore += vpdWeight * 0.7;
      } else if (vpd >= retailer.minVPD * 0.7) {
        matchDetails.traffic.matches = false;
        matchDetails.traffic.note = `Below ideal: ${vpd.toLocaleString()} VPD (needs ${retailer.minVPD.toLocaleString()}+)`;
        totalScore += vpdWeight * 0.3;
      } else {
        matchDetails.traffic.matches = false;
        matchDetails.traffic.note = `Insufficient: ${vpd.toLocaleString()} VPD (needs ${retailer.minVPD.toLocaleString()}+)`;
      }
    } else {
      matchDetails.traffic.note = 'Traffic data not available';
    }

    // === DEMOGRAPHICS MATCHING (25% weight) ===
    const demoWeight = 25;
    weightedFactors += demoWeight;
    let demoScore = 0;
    const demoNotes: string[] = [];
    let disqualifiedByIncome = false;

    // STRICT income level check - disqualify if significantly mismatched
    if (incomeLevel && retailer.incomePreference.includes(incomeLevel)) {
      demoScore += 0.4;
      demoNotes.push(`Income level (${incomeLevel}) matches target`);
    } else if (incomeLevel) {
      // Check for severe mismatch - value retailers in high income areas
      const isValueRetailer = retailer.incomePreference.includes('low') && !retailer.incomePreference.includes('upper-middle') && !retailer.incomePreference.includes('high');
      const isHighIncomeArea = incomeLevel === 'upper-middle' || incomeLevel === 'high';
      const isPremiumRetailer = retailer.incomePreference.includes('high') || retailer.incomePreference.includes('upper-middle');
      const isLowIncomeArea = incomeLevel === 'low';

      if (isValueRetailer && isHighIncomeArea) {
        // Disqualify value retailers from high income areas
        disqualifiedByIncome = true;
        demoNotes.push(`DISQUALIFIED: ${retailer.name} targets low-income areas, not ${incomeLevel} ($${medianIncome?.toLocaleString() || 'N/A'})`);
      } else if (isPremiumRetailer && isLowIncomeArea) {
        // Disqualify premium retailers from low income areas
        disqualifiedByIncome = true;
        demoNotes.push(`DISQUALIFIED: ${retailer.name} targets affluent areas, not ${incomeLevel}`);
      } else {
        demoNotes.push(`Income level (${incomeLevel}) may not be ideal`);
        demoScore += 0.1; // Small score for partial match
      }
    }

    // Skip this retailer if disqualified by income
    if (disqualifiedByIncome) {
      continue;
    }

    if (medianIncome !== null) {
      // STRICT check: if income exceeds max by more than 30%, disqualify
      if (retailer.maxMedianIncome && medianIncome > retailer.maxMedianIncome * 1.3) {
        // Disqualify - income way too high for this retailer
        continue;
      } else if (retailer.minMedianIncome && medianIncome < retailer.minMedianIncome * 0.7) {
        // Disqualify - income way too low for this retailer
        continue;
      } else if (retailer.minMedianIncome && medianIncome < retailer.minMedianIncome) {
        demoNotes.push(`Income below minimum ($${medianIncome.toLocaleString()} vs $${retailer.minMedianIncome.toLocaleString()})`);
        demoScore += 0.1;
      } else if (retailer.maxMedianIncome && medianIncome > retailer.maxMedianIncome) {
        demoNotes.push(`Income above target ($${medianIncome.toLocaleString()} vs $${retailer.maxMedianIncome.toLocaleString()} max)`);
        demoScore += 0.1;
      } else if (retailer.minMedianIncome && medianIncome >= retailer.minMedianIncome) {
        demoScore += 0.3;
      } else {
        demoScore += 0.2;
      }
    }

    if (population !== null) {
      if (population >= retailer.minPopulation) {
        demoScore += 0.3;
        demoNotes.push(`Population (${population.toLocaleString()}) meets minimum`);
      } else if (population >= retailer.minPopulation * 0.7) {
        demoScore += 0.15;
        demoNotes.push(`Population slightly below target (${population.toLocaleString()} vs ${retailer.minPopulation.toLocaleString()})`);
      } else {
        demoNotes.push(`Population too low (${population.toLocaleString()} vs ${retailer.minPopulation.toLocaleString()} needed)`);
      }
    }

    matchDetails.demographics.matches = demoScore >= 0.5;
    matchDetails.demographics.note = demoNotes.join('; ') || 'Demographics data not available';
    totalScore += demoWeight * demoScore;

    // === REGION MATCHING (20% weight) ===
    const regionWeight = 20;
    weightedFactors += regionWeight;

    if (stateCode) {
      const siteRegions = getRegionFromState(stateCode);
      const expandingInRegion = retailer.expansionRegions.some(r =>
        r === 'National' || siteRegions.includes(r) || r === stateCode
      );

      if (expandingInRegion) {
        matchDetails.region.matches = true;
        if (retailer.expansionRegions.includes('National')) {
          matchDetails.region.note = 'Expanding nationally';
        } else {
          matchDetails.region.note = `Actively targeting: ${retailer.expansionRegions.join(', ')}`;
        }
        totalScore += regionWeight;
      } else {
        matchDetails.region.matches = false;
        matchDetails.region.note = `Not currently expanding in this region (targeting: ${retailer.expansionRegions.join(', ')})`;
        totalScore += regionWeight * 0.2;
      }
    } else {
      matchDetails.region.note = 'Location data not available';
      totalScore += regionWeight * 0.5;
    }

    // Calculate final score
    const finalScore = weightedFactors > 0
      ? Math.round((totalScore / weightedFactors) * 100)
      : 50;

    // Only include if score is reasonable
    if (finalScore < 30) continue;

    matches.push({
      name: retailer.name,
      category: retailer.category,
      matchScore: finalScore,
      matchDetails,
      activelyExpanding: retailer.activelyExpanding,
      franchiseAvailable: retailer.franchiseAvailable,
      corporateOnly: retailer.corporateOnly,
      franchiseFee: retailer.franchiseFee,
      totalInvestment: retailer.totalInvestmentMin && retailer.totalInvestmentMax
        ? `$${(retailer.totalInvestmentMin / 1000000).toFixed(1)}M - $${(retailer.totalInvestmentMax / 1000000).toFixed(1)}M`
        : undefined,
      expansionRegions: retailer.expansionRegions,
      notes: retailer.notes,
    });
  }

  // Sort by match score descending
  matches.sort((a, b) => b.matchScore - a.matchScore);

  return {
    matches: matches.slice(0, 20),
    totalMatches: matches.length,
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
  lotSizeAcres: number | null = null,
  districtInfo: DistrictInfo | null = null
) {
  const suitability: Array<{
    category: string;
    suitabilityScore: number;
    reasoning: string;
    examples: string[];
    existingInArea: string[];
    lotSizeIssue?: string;
    districtIssue?: string;
  }> = [];

  console.log('DEBUG demographics object:', JSON.stringify(demographics, null, 2));
  const incomeLevel = demographics?.incomeLevel || 'middle';
  console.log('DEBUG calculateBusinessSuitability - incomeLevel:', incomeLevel, 'demographics.incomeLevel:', demographics?.incomeLevel);

  for (const [key, threshold] of Object.entries(VPD_THRESHOLDS)) {
    // Check if this category is inappropriate for the district
    if (districtInfo?.inappropriateCategories.includes(key)) {
      // Skip this category entirely for this district type
      continue;
    }

    // Skip value-oriented categories in middle+ income areas
    // These businesses target budget-conscious consumers
    const valueCategories = ['fastFoodValue', 'casualDiningValue', 'coffeeValue', 'quickServiceValue', 'discountRetail', 'financialServices'];
    const isMiddleOrHigherIncome = incomeLevel === 'middle' || incomeLevel === 'upper-middle' || incomeLevel === 'high';
    if (valueCategories.includes(key) && isMiddleOrHigherIncome) {
      continue;
    }

    // Skip premium categories in low income areas
    const premiumCategories = ['fastFoodPremium', 'casualDiningPremium', 'coffeePremium', 'quickServicePremium', 'retailPremium', 'fitnessPremium', 'autoServicePremium'];
    const isLowIncomeArea = incomeLevel === 'low';
    if (premiumCategories.includes(key) && isLowIncomeArea) {
      continue;
    }

    // Skip discount retail in college town markets (students have higher spending power than income suggests)
    const isCollegeTown = demographics?.isCollegeTown || false;
    if (key === 'discountRetail' && isCollegeTown) {
      continue;
    }

    let score = 0;
    let reasoning = '';
    let lotSizeIssue: string | undefined;

    // Check VPD fit - more graduated scoring
    // Cap base traffic score at 7, require other factors to reach 10
    if (vpd >= threshold.ideal * 1.5) {
      score = 8; // Significantly exceeds ideal
      reasoning = `Excellent traffic - VPD of ${vpd.toLocaleString()} well exceeds ideal`;
    } else if (vpd >= threshold.ideal) {
      score = 7; // Meets ideal
      reasoning = `Strong traffic - VPD of ${vpd.toLocaleString()} meets ideal threshold`;
    } else if (vpd >= threshold.min) {
      score = Math.round(4 + (3 * (vpd - threshold.min) / (threshold.ideal - threshold.min)));
      reasoning = `Good traffic - VPD of ${vpd.toLocaleString()} meets minimum`;
    } else if (vpd >= threshold.min * 0.7) {
      score = Math.round(2 + (2 * vpd / threshold.min));
      reasoning = `Marginal traffic - VPD of ${vpd.toLocaleString()} is below ideal`;
    } else {
      score = Math.round(2 * vpd / threshold.min);
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
      // Car Wash
      carWashExpress: 'Express Car Wash',
      carWashFull: 'Full Service Car Wash',
      // Automotive
      carDealershipUsed: 'Used Car Dealership',
      carDealershipNew: 'New Car Dealership',
      tireShop: 'Tire Shop',
      oilChange: 'Oil Change / Lube',
      autoBodyShop: 'Auto Body / Collision',
      // Hotels
      hotelBudget: 'Budget Hotel / Motel',
      hotelMidScale: 'Mid-Scale Hotel',
      hotelUpscale: 'Upscale Hotel',
      // Storage
      selfStorage: 'Self Storage',
      rvBoatStorage: 'RV / Boat Storage',
      // Childcare & Education
      daycare: 'Daycare / Childcare',
      tutoringCenter: 'Tutoring Center',
      tradeSchool: 'Trade School / Vocational',
      // Pet Services
      petStore: 'Pet Store',
      vetClinic: 'Veterinary Clinic',
      petGrooming: 'Pet Grooming',
      doggyDaycare: 'Doggy Daycare / Boarding',
      // Personal Services
      hairSalon: 'Hair Salon (Value)',
      salonPremium: 'Salon (Premium)',
      nailSalon: 'Nail Salon',
      spa: 'Spa / Massage',
      barbershop: 'Barbershop',
      tattooShop: 'Tattoo Shop',
      // Retail Specialty
      cellPhoneStore: 'Cell Phone Store',
      liquorStore: 'Liquor Store',
      tobaccoVape: 'Tobacco / Vape Shop',
      pawnShop: 'Pawn Shop',
      mattressStore: 'Mattress Store',
      furnitureValue: 'Furniture (Value)',
      furniturePremium: 'Furniture (Premium)',
      // Services
      laundromat: 'Laundromat',
      dryCleaner: 'Dry Cleaner',
      shippingStore: 'Shipping / Pack Store',
      printCopy: 'Print / Copy Center',
      // Food & Beverage Specialty
      pizzaDelivery: 'Pizza (Delivery)',
      pizzaSitDown: 'Pizza (Sit-Down)',
      iceCream: 'Ice Cream Shop',
      frozenYogurt: 'Frozen Yogurt',
      smoothieJuice: 'Smoothie / Juice Bar',
      donutBakery: 'Donut / Bakery',
      sportsBar: 'Sports Bar / Wings',
      breweryTaproom: 'Brewery / Taproom',
      wineBar: 'Wine Bar',
      mexicanCasual: 'Mexican (Fast Casual)',
      mexicanSitDown: 'Mexican (Sit-Down)',
      asianFastCasual: 'Asian (Fast Casual)',
      asianSitDown: 'Asian (Sit-Down)',
      // Entertainment
      movieTheater: 'Movie Theater',
      bowlingAlley: 'Bowling Alley',
      arcadeFEC: 'Arcade / Family Entertainment',
      trampolinePark: 'Trampoline Park',
      miniGolf: 'Mini Golf / Driving Range',
      martialArts: 'Martial Arts Studio',
      yogaPilates: 'Yoga / Pilates Studio',
      danceStudio: 'Dance Studio',
      // Grocery
      groceryValue: 'Grocery (Value)',
      groceryMid: 'Grocery (Mid-Tier)',
      groceryPremium: 'Grocery (Premium)',
      // Truck Stop
      truckStop: 'Truck Stop / Travel Center',
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

    // Categories where competition VALIDATES the market (clustering is good)
    // Walmart follows Target, CVS takes opposite corner from Walgreens, gas stations cluster at intersections
    const clusteringCategories = ['gasStation', 'convenience', 'fastFoodValue', 'fastFoodPremium', 'pharmacy', 'bank', 'coffeeValue', 'coffeePremium'];
    const isClusteringCategory = clusteringCategories.includes(key);

    if (existingInArea.length > 0) {
      if (isClusteringCategory) {
        // Competition validates the market - BONUS for proven demand
        const validationBonus = Math.min(2, existingInArea.length);
        score = Math.min(10, score + validationBonus);
        reasoning += `. PROVEN MARKET: ${existingInArea.length} existing ${existingInArea.length === 1 ? 'competitor validates' : 'competitors validate'} demand`;
      } else if (availableExamples.length === 0) {
        // Non-clustering category with all brands present - actually saturated
        reasoning += '. Market may be saturated - most major brands present';
        score = Math.max(1, score - 2);
      } else {
        // Some competition but room for more
        reasoning += `. ${existingInArea.length} competitor(s) nearby - market has proven demand`;
      }
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

// Generate top specific recommendations using RETAILER_REQUIREMENTS spreadsheet
// Score-based matching against ALL address metrics from spreadsheet columns
interface TopRecommendation {
  name: string;
  category: string;
}

function generateTopRecommendations(
  vpd: number,
  nearbyBusinesses: Business[],
  demographics: DemographicsInfo | null,
  lotSizeAcres: number | null = null,
  districtInfo: DistrictInfo | null = null,
  stateCode: string | null = null,
  isCornerLot: boolean = false,
  buildingSqFt: number | null = null
): TopRecommendation[] {
  const recommendations: Array<{ name: string; score: number; category: string }> = [];

  // Get actual metrics from the address
  const actualVPD = vpd || 0;
  const actualPopulation = demographics?.population || 0;
  const actualMedianIncome = demographics?.medianHouseholdIncome || 0;
  const actualIncomeLevel = demographics?.incomeLevel || 'middle';

  // Determine region from state code
  let addressRegion: string | null = null;
  if (stateCode) {
    for (const [region, states] of Object.entries(US_REGIONS)) {
      if (states.includes(stateCode) || states.includes('ALL')) {
        addressRegion = region;
        break;
      }
    }
  }

  // Debug logging
  console.log(`[Recommendations] Input metrics: VPD=${actualVPD}, Pop=${actualPopulation}, Income=$${actualMedianIncome}, Level=${actualIncomeLevel}, State=${stateCode}, Region=${addressRegion}, LotSize=${lotSizeAcres}, Corner=${isCornerLot}`);

  // Get list of existing business names (normalized for comparison)
  const existingNames = nearbyBusinesses.map(b =>
    b.name.toLowerCase().replace(/[^a-z0-9]/g, '')
  );

  // If historic downtown, add downtown-specific recommendations first
  if (districtInfo?.type === 'historic_downtown') {
    const allDowntownOptions = [
      ...DOWNTOWN_BUSINESSES.dining,
      ...DOWNTOWN_BUSINESSES.retail,
      ...DOWNTOWN_BUSINESSES.services,
      ...DOWNTOWN_BUSINESSES.entertainment
    ];
    const availableDowntown = filterExistingBusinesses(allDowntownOptions, nearbyBusinesses);
    for (const business of availableDowntown.slice(0, 5)) {
      recommendations.push({
        name: business,
        score: 100, // High score for downtown-appropriate businesses
        category: 'Downtown'
      });
    }
  }

  // Score each retailer from the spreadsheet against actual metrics
  for (const retailer of RETAILER_REQUIREMENTS) {
    // Check if this retailer already exists nearby
    const retailerNormalized = retailer.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const alreadyExists = existingNames.some(existing =>
      existing.includes(retailerNormalized) || retailerNormalized.includes(existing)
    );
    if (alreadyExists) continue;

    // Skip inappropriate categories for district type
    if (districtInfo?.inappropriateCategories.some(cat =>
      retailer.category.toLowerCase().includes(cat.toLowerCase())
    )) {
      continue;
    }

    let score = 0;
    let matchCount = 0;
    let totalChecks = 0;

    // === VPD SCORING (0-30 points) ===
    totalChecks++;
    if (actualVPD > 0) {
      if (actualVPD >= retailer.idealVPD) {
        score += 30; // Exceeds ideal traffic
        matchCount++;
      } else if (actualVPD >= retailer.minVPD) {
        // Scale between min and ideal
        const vpdRatio = (actualVPD - retailer.minVPD) / (retailer.idealVPD - retailer.minVPD);
        score += 15 + Math.round(vpdRatio * 15); // 15-30 points
        matchCount++;
      } else if (actualVPD >= retailer.minVPD * 0.7) {
        // Close to minimum (within 70%)
        score += 8;
        matchCount += 0.5;
      }
      // Below 70% of min = 0 points
    }

    // === POPULATION SCORING (0-20 points) ===
    totalChecks++;
    if (actualPopulation > 0 && retailer.minPopulation) {
      if (actualPopulation >= retailer.minPopulation) {
        score += 20;
        matchCount++;
      } else if (actualPopulation >= retailer.minPopulation * 0.7) {
        // Close to minimum
        const popRatio = actualPopulation / retailer.minPopulation;
        score += Math.round(popRatio * 20);
        matchCount += 0.5;
      }
    } else if (!retailer.minPopulation) {
      // No population requirement = automatic pass
      score += 15;
      matchCount++;
    }

    // === INCOME SCORING - HARD FILTER ===
    // If income bracket is 2+ away from target, SKIP the retailer entirely
    totalChecks++;
    if (retailer.incomePreference && retailer.incomePreference.length > 0) {
      const incomeOrder = ['low', 'moderate', 'middle', 'upper-middle', 'high'];
      const actualIndex = incomeOrder.indexOf(actualIncomeLevel);

      // Check if actual income level matches retailer's preference
      const incomeMatches = retailer.incomePreference.includes(actualIncomeLevel as typeof retailer.incomePreference[number]);

      if (incomeMatches) {
        score += 25;
        matchCount++;
      } else {
        // Calculate distance from nearest preferred income bracket
        let minDistance = 5;
        for (const pref of retailer.incomePreference) {
          const prefIndex = incomeOrder.indexOf(pref);
          minDistance = Math.min(minDistance, Math.abs(prefIndex - actualIndex));
        }

        if (minDistance === 1) {
          // Adjacent bracket - acceptable with small penalty
          score += 5;
          matchCount += 0.3;
        } else {
          // 2+ brackets away - HARD SKIP
          // Dollar Tree (low/moderate/middle) should NOT show in "high" income areas
          // Whole Foods (upper-middle/high) should NOT show in "low" income areas
          continue;
        }
      }

      // Additional max income enforcement
      if (retailer.maxMedianIncome && actualMedianIncome > 0) {
        if (actualMedianIncome > retailer.maxMedianIncome * 1.2) {
          continue; // 20%+ above max = SKIP
        } else if (actualMedianIncome > retailer.maxMedianIncome) {
          score -= 10;
        } else {
          score += 5;
        }
      }

      if (retailer.minMedianIncome && actualMedianIncome > 0) {
        if (actualMedianIncome < retailer.minMedianIncome * 0.7) {
          // Income is 30%+ below retailer's min target - SKIP this retailer entirely
          continue;
        } else if (actualMedianIncome < retailer.minMedianIncome) {
          score -= 15; // Below min but within 30%
        } else {
          score += 5; // Above minimum
        }
      }
    }

    // === LOT SIZE SCORING (0-15 points) ===
    if (lotSizeAcres !== null && lotSizeAcres > 0) {
      totalChecks++;
      if (lotSizeAcres >= retailer.minLotSize && lotSizeAcres <= retailer.maxLotSize * 2) {
        if (lotSizeAcres <= retailer.maxLotSize) {
          score += 15; // Perfect fit
          matchCount++;
        } else {
          score += 8; // Slightly oversized but workable
          matchCount += 0.5;
        }
      } else if (lotSizeAcres < retailer.minLotSize) {
        // Lot too small - significant penalty
        score -= 10;
      }
      // Very oversized lots get no bonus but no penalty
    }

    // === EXPANSION STATUS SCORING (0-10 points) ===
    if (retailer.activelyExpanding) {
      score += 10; // Actively growing = more likely to consider new sites
    } else {
      score -= 5; // Not expanding = less likely to take new sites
    }

    // === EXPANSION REGION CHECK (0-15 points or SKIP) ===
    if (addressRegion && retailer.expansionRegions && retailer.expansionRegions.length > 0) {
      const expandingInRegion = retailer.expansionRegions.includes('National') ||
        retailer.expansionRegions.includes(addressRegion) ||
        (stateCode && retailer.expansionRegions.includes(stateCode));

      if (expandingInRegion) {
        score += 15; // Target region for expansion
      } else if (retailer.activelyExpanding) {
        score -= 10; // Expanding but not in this region
      }
    }

    // === DRIVE-THRU REQUIREMENT CHECK ===
    if (retailer.driveThruRequired) {
      // Drive-thru typically needs at least 0.5 acres for proper stacking lanes
      if (lotSizeAcres !== null && lotSizeAcres < 0.4) {
        continue; // Lot too small for drive-thru - SKIP this retailer
      }
      // Small lots get penalty even if they might fit
      if (lotSizeAcres !== null && lotSizeAcres < 0.6) {
        score -= 5; // Tight fit for drive-thru
      }
    }

    // === CORNER LOT PREFERENCE (0-8 points) ===
    if (retailer.cornerLotPreferred) {
      if (isCornerLot) {
        score += 8; // Perfect - retailer wants corner, site is corner
      } else {
        score -= 3; // Retailer prefers corner but this isn't one
      }
    }

    // === BUILDING SIZE CHECK ===
    if (buildingSqFt !== null && buildingSqFt > 0) {
      if (retailer.minSqFt && buildingSqFt < retailer.minSqFt * 0.8) {
        continue; // Building too small - SKIP
      }
      if (retailer.maxSqFt && buildingSqFt > retailer.maxSqFt * 1.5) {
        score -= 5; // Building much larger than needed
      }
      if (retailer.minSqFt && retailer.maxSqFt) {
        if (buildingSqFt >= retailer.minSqFt && buildingSqFt <= retailer.maxSqFt) {
          score += 10; // Perfect building size fit
        }
      }
    }

    // === FRANCHISE/CORPORATE SCORING (0-5 points) ===
    if (retailer.franchiseAvailable && !retailer.corporateOnly) {
      score += 5; // Easier to develop - franchise option available
    }
    // Corporate-only retailers are still valid, just no bonus

    // === INVESTMENT LEVEL CONSIDERATION ===
    // Higher income areas can support higher investment concepts
    if (retailer.totalInvestmentMin && actualMedianIncome > 0) {
      if (retailer.totalInvestmentMin > 2000000 && actualIncomeLevel === 'high') {
        score += 5; // Premium concept matches premium area
      } else if (retailer.totalInvestmentMin > 2000000 && (actualIncomeLevel === 'low' || actualIncomeLevel === 'moderate')) {
        score -= 5; // Premium concept in budget area - mismatch
      }
    }

    // Only include if score is positive and meets minimum threshold
    const minScoreThreshold = 30; // Must have solid matches across multiple criteria
    if (score >= minScoreThreshold) {
      recommendations.push({
        name: retailer.name,
        score: score,
        category: retailer.category
      });
    }
  }

  // Sort by score descending
  recommendations.sort((a, b) => b.score - a.score);

  // Log top scores for debugging
  console.log(`[Recommendations] Top 15 scores:`, recommendations.slice(0, 15).map(r => `${r.name}:${r.score}`).join(', '));

  // Deduplicate and limit variety (max 3 per category for better grouping display)
  const categoryCounts: Record<string, number> = {};
  const finalRecommendations: TopRecommendation[] = [];

  for (const rec of recommendations) {
    const category = rec.category;
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;

    // Allow max 3 from same category for variety
    if (categoryCounts[category] <= 3) {
      finalRecommendations.push({ name: rec.name, category: rec.category });
    }

    if (finalRecommendations.length >= 15) break;
  }

  console.log(`[Recommendations] Final: ${finalRecommendations.map(r => r.name).join(', ')}`);
  return finalRecommendations;
}

export async function POST(request: Request) {
  try {
    const body: AnalyzeRequest = await request.json();
    const { images, address, nearbyBusinesses, trafficData, demographicsData, environmentalRisk, marketComps } = body;

    const hasImages = images && images.length > 0;

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GOOGLE_GEMINI_API_KEY not configured');
      return NextResponse.json({
        ...getMockAnalysis(nearbyBusinesses, trafficData, demographicsData, 1.35, address, environmentalRisk, marketComps),
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
    let topRecommendations: TopRecommendation[] = [];

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

    // Extract state code early for recommendations
    let prelimStateCode: string | null = null;
    const prelimStateMatch = address.match(/\b([A-Z]{2})\s*\d{5}/);
    if (prelimStateMatch) {
      prelimStateCode = prelimStateMatch[1];
    }

    if (trafficData) {
      // Initial recommendations for the prompt (will be recalculated with lot size after AI response)
      topRecommendations = generateTopRecommendations(trafficData.estimatedVPD, nearbyBusinesses, demographicsData, null, null, prelimStateCode);

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

TOP RECOMMENDED BUSINESSES (not already in area): ${topRecommendations.map(r => r.name).join(', ')}`;
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

    // Generate business intelligence context based on preliminary lot assessment
    const businessIntelligenceContext = generateBusinessIntelligenceContext(address, nearbyBusinesses);

    const prompt = `You are an expert commercial real estate analyst and site evaluator. ${imageContext} Property located at: ${address}
${businessContext}
${trafficContext}
${businessIntelligenceContext}

Please provide a comprehensive site analysis in the following JSON format:
{
  "viabilityScore": <number 1-10>,
  "terrain": "<${hasImages ? 'brief description of terrain from images - flat, sloped, rocky, etc.' : 'Unable to assess without images'}>",
  "accessibility": "<road access, visibility from main roads, parking potential based on ${hasImages ? 'images and ' : ''}location data>",
  "existingStructures": "<${hasImages ? 'any buildings, foundations, or structures visible in images' : 'Unable to assess without images'}>",
  "vegetation": "<${hasImages ? 'trees, landscaping, clearing needed based on images' : 'Unable to assess without images'}>",
  "lotSizeEstimate": "<${hasImages ? 'estimated lot size in acres (e.g., \"Approximately 0.75 acres\" or \"1.2 - 1.5 acres\")' : 'Unable to estimate without images'}>",
  "businessRecommendation": "<CRITICAL: Only recommend specific businesses that DO NOT already exist in the nearby area. With ${trafficData?.estimatedVPD?.toLocaleString() || 'the estimated'} VPD, recommend specific brands like: ${topRecommendations.slice(0, 5).map(r => r.name).join(', ')}. DO NOT recommend: ${existingBusinessNames || 'N/A'}. Explain why your specific recommendations would work at this location.>",
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
7. NEVER recommend gas stations, car washes, or auto services for shopping center addresses (suite/unit numbers)
8. Only recommend drive-through businesses if the lot can support 0.5+ acres with stacking space
9. For Chick-fil-A or Raising Cane's, lot must be 1.0+ acres with excellent traffic flow
10. Competition nearby is GOOD for gas stations, pharmacies, banks, and QSR - it validates the market

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

    // Detect district type for appropriate recommendations
    const districtInfo = detectDistrictType(
      address,
      nearbyBusinesses,
      lotSizeAcres,
      trafficData?.estimatedVPD || null,
      demographicsData?.isCollegeTown || false
    );
    analysis.districtType = districtInfo.type;
    analysis.districtDescription = districtInfo.description;

    // Recalculate business suitability with lot size and district context
    // Extract state code from address FIRST (needed for recommendations)
    let stateCode: string | null = null;
    const stateMatch = address.match(/\b([A-Z]{2})\s*\d{5}/);
    if (stateMatch) {
      stateCode = stateMatch[1];
    }

    // Determine if corner lot from AI analysis or parcel data
    const isCornerLot = analysis.siteCharacteristics?.toLowerCase().includes('corner') || false;

    // Get building size if available from analysis
    const buildingSqFt = analysis.estimatedLotSize ?
      Math.round(analysis.estimatedLotSize * 43560 * 0.25) : null; // Assume 25% coverage

    if (trafficData) {
      businessSuitability = calculateBusinessSuitability(
        trafficData.estimatedVPD,
        nearbyBusinesses,
        demographicsData,
        lotSizeAcres,
        districtInfo
      );
      topRecommendations = generateTopRecommendations(
        trafficData.estimatedVPD,
        nearbyBusinesses,
        demographicsData,
        lotSizeAcres,
        districtInfo,
        stateCode,
        isCornerLot,
        buildingSqFt
      );

      // Add downtown-specific recommendations if in historic downtown
      if (districtInfo.type === 'historic_downtown') {
        analysis.downtownRecommendations = DOWNTOWN_BUSINESSES;
      }
    }

    // Add business suitability data and top recommendations
    if (businessSuitability.length > 0) {
      analysis.businessSuitability = businessSuitability;
    }
    if (topRecommendations.length > 0) {
      analysis.topRecommendations = topRecommendations;
    }

    // Calculate comprehensive feasibility score
    const feasibilityScore = calculateFeasibilityScore(trafficData, demographicsData, nearbyBusinesses, environmentalRisk, marketComps);
    analysis.feasibilityScore = feasibilityScore;
    // Override viabilityScore with our calculated score
    analysis.viabilityScore = feasibilityScore.overall;

    const retailerMatches = calculateRetailerMatches(
      lotSizeAcres,
      trafficData?.estimatedVPD || null,
      demographicsData?.medianHouseholdIncome || null,
      demographicsData?.incomeLevel || null,
      demographicsData?.population || null,
      stateCode,
      demographicsData?.isCollegeTown || false
    );
    analysis.retailerMatches = retailerMatches;

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

function getMockAnalysis(nearbyBusinesses: Business[], trafficData: TrafficInfo | null, demographicsData: DemographicsInfo | null = null, lotSizeAcres: number | null = 1.35, address: string = '', environmentalRisk: EnvironmentalRiskInfo | null = null, marketComps: MarketCompInfo[] | null = null) {
  const vpd = trafficData?.estimatedVPD || 15000;

  // Extract state code from address FIRST
  let stateCode: string | null = null;
  const stateMatch = address.match(/\b([A-Z]{2})\s*\d{5}/);
  if (stateMatch) {
    stateCode = stateMatch[1];
  }

  const businessSuitability = calculateBusinessSuitability(vpd, nearbyBusinesses, demographicsData, lotSizeAcres);
  const topRecommendations = generateTopRecommendations(vpd, nearbyBusinesses, demographicsData, lotSizeAcres, null, stateCode);
  const feasibilityScore = calculateFeasibilityScore(trafficData, demographicsData, nearbyBusinesses, environmentalRisk, marketComps);

  const retailerMatches = calculateRetailerMatches(
    lotSizeAcres,
    vpd,
    demographicsData?.medianHouseholdIncome || null,
    demographicsData?.incomeLevel || null,
    demographicsData?.population || null,
    stateCode,
    demographicsData?.isCollegeTown || false
  );

  // Build recommendation excluding existing businesses
  let businessRec = '';
  const topRecs = topRecommendations.slice(0, 5).map(r => r.name).join(', ');

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
      `Consider: ${topRecommendations.slice(0, 3).map(r => r.name).join(', ')} based on traffic and market gap`,
      'Assess corner lot potential for gas station or drive-through concepts',
      'Obtain utility availability letters from local providers',
    ],
    businessSuitability,
    topRecommendations,
    retailerMatches,
  };
}
