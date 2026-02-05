import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { RETAILER_REQUIREMENTS, RetailerRequirements, getRegionFromState } from '@/data/retailerRequirements';

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
  isCollegeTown?: boolean;
  collegeEnrollment?: number;
  collegeEnrollmentPercent?: number;
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
  // ============ CAR WASH ============
  carWashExpress: {
    min: 15000, ideal: 25000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 0.4, ideal: 0.8 }, // Express car wash needs 0.4-0.8 acres
    examples: ['Zips Car Wash', 'Take 5 Car Wash', 'Splash Car Wash', 'Goo Goo Express', 'Whistle Express']
  },
  carWashFull: {
    min: 12000, ideal: 20000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 0.8, ideal: 1.5 }, // Full service car wash needs 0.8-1.5 acres
    examples: ['Mister Car Wash', 'Delta Sonic', 'Autobell', 'Flagship Carwash', 'Palms Car Wash']
  },
  // ============ AUTOMOTIVE ============
  carDealershipUsed: {
    min: 15000, ideal: 25000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 1.5, ideal: 3.0 }, // Used car lots need 1.5-3 acres
    examples: ['CarMax', 'Carvana', 'DriveTime', 'AutoNation USA', 'Enterprise Car Sales']
  },
  carDealershipNew: {
    min: 20000, ideal: 30000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 3.0, ideal: 6.0 }, // New car dealerships need 3-6 acres
    examples: ['Toyota', 'Honda', 'Ford', 'Chevrolet', 'BMW', 'Mercedes-Benz', 'Lexus']
  },
  tireShop: {
    min: 10000, ideal: 18000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 0.3, ideal: 0.6 }, // Tire shops need 0.3-0.6 acres
    examples: ['Discount Tire', 'Tire Kingdom', 'Big O Tires', 'Firestone', 'NTB', 'Mavis Tire']
  },
  oilChange: {
    min: 10000, ideal: 18000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 0.15, ideal: 0.3 }, // Oil change shops need 0.15-0.3 acres
    examples: ['Jiffy Lube', 'Valvoline', 'Take 5 Oil Change', 'Express Oil Change', 'Grease Monkey']
  },
  autoBodyShop: {
    min: 8000, ideal: 15000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.5, ideal: 1.0 }, // Body shops need 0.5-1 acre
    examples: ['Caliber Collision', 'ABRA Auto Body', 'Gerber Collision', 'Service King', 'Maaco']
  },
  // ============ HOTELS & LODGING ============
  hotelBudget: {
    min: 15000, ideal: 25000,
    incomePreference: ['low', 'moderate'] as const,
    lotSize: { min: 1.0, ideal: 2.0 }, // Budget hotels need 1-2 acres
    examples: ['Motel 6', 'Super 8', 'Red Roof Inn', 'Days Inn', 'Econo Lodge', 'Americas Best Value']
  },
  hotelMidScale: {
    min: 18000, ideal: 28000,
    incomePreference: ['moderate', 'middle'] as const,
    lotSize: { min: 1.5, ideal: 2.5 }, // Mid-scale hotels need 1.5-2.5 acres
    examples: ['Hampton Inn', 'Holiday Inn Express', 'La Quinta', 'Best Western', 'Comfort Inn', 'Fairfield Inn']
  },
  hotelUpscale: {
    min: 20000, ideal: 30000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 2.0, ideal: 4.0 }, // Upscale hotels need 2-4 acres
    examples: ['Marriott', 'Hilton', 'Hyatt', 'Sheraton', 'DoubleTree', 'Embassy Suites', 'Courtyard']
  },
  // ============ STORAGE ============
  selfStorage: {
    min: 8000, ideal: 15000,
    incomePreference: ['low', 'moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 2.0, ideal: 5.0 }, // Self storage needs 2-5 acres
    examples: ['Public Storage', 'Extra Space Storage', 'CubeSmart', 'Life Storage', 'U-Haul', 'StorQuest']
  },
  rvBoatStorage: {
    min: 5000, ideal: 10000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 3.0, ideal: 8.0 }, // RV/Boat storage needs 3-8 acres
    examples: ['Boat & RV Storage', 'Good Neighbor RV', 'SecurCare RV Storage']
  },
  // ============ CHILDCARE & EDUCATION ============
  daycare: {
    min: 8000, ideal: 12000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.5, ideal: 1.0 }, // Daycares need 0.5-1 acre
    examples: ['KinderCare', 'Bright Horizons', 'The Learning Experience', 'Primrose Schools', 'Kiddie Academy', 'Goddard School']
  },
  tutoringCenter: {
    min: 8000, ideal: 12000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 0.1, ideal: 0.25 }, // Tutoring centers need 0.1-0.25 acres (strip mall)
    examples: ['Kumon', 'Mathnasium', 'Sylvan Learning', 'Huntington Learning', 'Club Z', 'Eye Level']
  },
  tradeSchool: {
    min: 10000, ideal: 18000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 1.0, ideal: 2.5 }, // Trade schools need 1-2.5 acres
    examples: ['UTI', 'Lincoln Tech', 'Paul Mitchell', 'Aveda Institute', 'Empire Beauty School']
  },
  // ============ PET SERVICES ============
  petStore: {
    min: 12000, ideal: 18000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.8, ideal: 1.5 }, // Pet stores need 0.8-1.5 acres
    examples: ['PetSmart', 'Petco', 'Pet Supplies Plus', 'Hollywood Feed', 'Chuck & Don\'s']
  },
  vetClinic: {
    min: 8000, ideal: 12000,
    incomePreference: ['moderate', 'middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 0.25, ideal: 0.5 }, // Vet clinics need 0.25-0.5 acres
    examples: ['Banfield Pet Hospital', 'VCA Animal Hospital', 'BluePearl', 'Veterinary Emergency Group']
  },
  petGrooming: {
    min: 6000, ideal: 10000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.1, ideal: 0.2 }, // Pet grooming needs 0.1-0.2 acres
    examples: ['PetSmart Grooming', 'Petco Grooming', 'Dogtopia', 'Scenthound', 'Aussie Pet Mobile']
  },
  doggyDaycare: {
    min: 8000, ideal: 12000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 0.5, ideal: 1.0 }, // Doggy daycare needs 0.5-1 acre
    examples: ['Camp Bow Wow', 'Dogtopia', 'Wag Hotels', 'K9 Resorts', 'Central Bark']
  },
  // ============ PERSONAL SERVICES ============
  hairSalon: {
    min: 6000, ideal: 10000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 0.1, ideal: 0.2 }, // Hair salons need 0.1-0.2 acres
    examples: ['Great Clips', 'Sport Clips', 'Supercuts', 'Cost Cutters', 'Fantastic Sams']
  },
  salonPremium: {
    min: 10000, ideal: 15000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 0.15, ideal: 0.3 }, // Premium salons need 0.15-0.3 acres
    examples: ['Ulta Salon', 'Drybar', 'Madison Reed', 'Regis Salons', 'JC Penney Salon']
  },
  nailSalon: {
    min: 6000, ideal: 10000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.08, ideal: 0.15 }, // Nail salons need 0.08-0.15 acres
    examples: ['Nail Garden', 'Regal Nails', 'Tips & Toes', 'Polished Perfect']
  },
  spa: {
    min: 10000, ideal: 15000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 0.15, ideal: 0.3 }, // Spas need 0.15-0.3 acres
    examples: ['Massage Envy', 'Hand & Stone', 'European Wax Center', 'Elements Massage', 'Spavia']
  },
  barbershop: {
    min: 5000, ideal: 8000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 0.05, ideal: 0.1 }, // Barbershops need 0.05-0.1 acres
    examples: ['Floyd\'s 99 Barbershop', 'The Boardroom', 'Roosters', 'V\'s Barbershop']
  },
  tattooShop: {
    min: 5000, ideal: 10000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 0.05, ideal: 0.1 }, // Tattoo shops need 0.05-0.1 acres
    examples: ['Ink & Iron', 'Studio 21', 'Sacred Art', 'Black Ink']
  },
  // ============ RETAIL SPECIALTY ============
  cellPhoneStore: {
    min: 10000, ideal: 15000,
    incomePreference: ['low', 'moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.08, ideal: 0.15 }, // Cell phone stores need 0.08-0.15 acres
    examples: ['Verizon', 'AT&T', 'T-Mobile', 'Sprint', 'Cricket', 'Metro by T-Mobile', 'Boost Mobile']
  },
  liquorStore: {
    min: 8000, ideal: 12000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 0.15, ideal: 0.3 }, // Liquor stores need 0.15-0.3 acres
    examples: ['Total Wine', 'BevMo', 'ABC Fine Wine & Spirits', 'Spec\'s', 'Twin Liquors']
  },
  tobaccoVape: {
    min: 6000, ideal: 10000,
    incomePreference: ['low', 'moderate'] as const,
    lotSize: { min: 0.05, ideal: 0.1 }, // Tobacco/vape shops need 0.05-0.1 acres
    examples: ['Smoker Friendly', 'Wild Bill\'s Tobacco', 'Tobacco Plus', 'VaporFi']
  },
  pawnShop: {
    min: 6000, ideal: 10000,
    incomePreference: ['low', 'moderate'] as const,
    lotSize: { min: 0.1, ideal: 0.2 }, // Pawn shops need 0.1-0.2 acres
    examples: ['Cash America', 'First Cash', 'EZCorp', 'SuperPawn', 'Cash Pawn']
  },
  mattressStore: {
    min: 10000, ideal: 15000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.2, ideal: 0.4 }, // Mattress stores need 0.2-0.4 acres
    examples: ['Mattress Firm', 'Sleep Number', 'Tempur-Pedic', 'Ashley Sleep', 'Purple']
  },
  furnitureValue: {
    min: 12000, ideal: 18000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 1.0, ideal: 2.0 }, // Value furniture stores need 1-2 acres
    examples: ['Big Lots', 'At Home', 'Tuesday Morning', 'Rooms To Go', 'American Freight']
  },
  furniturePremium: {
    min: 15000, ideal: 22000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 1.5, ideal: 3.0 }, // Premium furniture stores need 1.5-3 acres
    examples: ['Ashley Furniture', 'Pottery Barn', 'Crate & Barrel', 'West Elm', 'Ethan Allen', 'Restoration Hardware']
  },
  // ============ SERVICES ============
  laundromat: {
    min: 5000, ideal: 8000,
    incomePreference: ['low', 'moderate'] as const,
    lotSize: { min: 0.15, ideal: 0.3 }, // Laundromats need 0.15-0.3 acres
    examples: ['Speed Queen', 'Wash House', 'Spin Cycle', 'Clean Laundry']
  },
  dryCleaner: {
    min: 6000, ideal: 10000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.1, ideal: 0.2 }, // Dry cleaners need 0.1-0.2 acres
    examples: ['Martinizing', 'ZIPS Dry Cleaners', 'Tide Cleaners', 'Lapels']
  },
  shippingStore: {
    min: 8000, ideal: 12000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.08, ideal: 0.15 }, // Shipping stores need 0.08-0.15 acres
    examples: ['The UPS Store', 'FedEx Office', 'Postal Connections', 'PostNet', 'Pak Mail']
  },
  printCopy: {
    min: 8000, ideal: 12000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.1, ideal: 0.2 }, // Print shops need 0.1-0.2 acres
    examples: ['FedEx Office', 'Staples', 'Office Depot', 'AlphaGraphics', 'Minuteman Press']
  },
  // ============ FOOD & BEVERAGE SPECIALTY ============
  pizzaDelivery: {
    min: 8000, ideal: 12000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 0.1, ideal: 0.2 }, // Pizza delivery needs 0.1-0.2 acres
    examples: ['Domino\'s', 'Pizza Hut', 'Papa John\'s', 'Little Caesars', 'Marco\'s Pizza', 'Hungry Howie\'s']
  },
  pizzaSitDown: {
    min: 10000, ideal: 15000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.4, ideal: 0.8 }, // Sit-down pizza needs 0.4-0.8 acres
    examples: ['Mellow Mushroom', 'Blaze Pizza', 'MOD Pizza', 'Pieology', 'Your Pie', '&pizza']
  },
  iceCream: {
    min: 8000, ideal: 12000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.08, ideal: 0.15 }, // Ice cream shops need 0.08-0.15 acres
    examples: ['Baskin-Robbins', 'Cold Stone Creamery', 'Dairy Queen', 'Marble Slab', 'Bruster\'s', 'Handel\'s']
  },
  frozenYogurt: {
    min: 8000, ideal: 12000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.08, ideal: 0.15 }, // Frozen yogurt needs 0.08-0.15 acres
    examples: ['Menchie\'s', 'sweetFrog', 'Orange Leaf', 'TCBY', 'Pinkberry', 'Yogurtland']
  },
  smoothieJuice: {
    min: 10000, ideal: 15000,
    incomePreference: ['moderate', 'middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 0.1, ideal: 0.2 }, // Smoothie/juice bars need 0.1-0.2 acres
    examples: ['Smoothie King', 'Jamba', 'Tropical Smoothie', 'Juice It Up!', 'Clean Juice', 'Nekter']
  },
  donutBakery: {
    min: 8000, ideal: 12000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 0.1, ideal: 0.2 }, // Donut/bakery shops need 0.1-0.2 acres
    examples: ['Krispy Kreme', 'Dunkin\'', 'Duck Donuts', 'Shipley Do-Nuts', 'Hurts Donut', 'Cinnabon']
  },
  sportsBar: {
    min: 12000, ideal: 18000,
    incomePreference: ['moderate', 'middle'] as const,
    lotSize: { min: 0.6, ideal: 1.2 }, // Sports bars need 0.6-1.2 acres
    examples: ['Buffalo Wild Wings', 'Hooters', 'Twin Peaks', 'Walk-On\'s', 'Tilted Kilt', 'Miller\'s Ale House']
  },
  breweryTaproom: {
    min: 10000, ideal: 15000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 0.4, ideal: 1.0 }, // Breweries/taprooms need 0.4-1 acre
    examples: ['World of Beer', 'Yard House', 'BJ\'s Brewhouse', 'Gordon Biersch', 'Rock Bottom']
  },
  wineBar: {
    min: 8000, ideal: 12000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 0.1, ideal: 0.25 }, // Wine bars need 0.1-0.25 acres
    examples: ['Cooper\'s Hawk', 'The Wine Loft', 'Vino Volo', 'Total Wine Bar']
  },
  mexicanCasual: {
    min: 12000, ideal: 18000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 0.4, ideal: 0.8 }, // Casual Mexican needs 0.4-0.8 acres
    examples: ['Taco Bell', 'Del Taco', 'Taco Cabana', 'Taco Bueno', 'Qdoba', 'Moe\'s']
  },
  mexicanSitDown: {
    min: 12000, ideal: 18000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.8, ideal: 1.5 }, // Sit-down Mexican needs 0.8-1.5 acres
    examples: ['Chili\'s', 'On The Border', 'Chuy\'s', 'El Fenix', 'Abuelo\'s', 'El Torito']
  },
  asianFastCasual: {
    min: 10000, ideal: 15000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.3, ideal: 0.6 }, // Asian fast casual needs 0.3-0.6 acres
    examples: ['Panda Express', 'Pei Wei', 'Noodles & Company', 'Pick Up Stix', 'Teriyaki Madness']
  },
  asianSitDown: {
    min: 12000, ideal: 18000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 0.6, ideal: 1.2 }, // Sit-down Asian needs 0.6-1.2 acres
    examples: ['P.F. Chang\'s', 'Benihana', 'Kona Grill', 'RA Sushi', 'Seasons 52']
  },
  // ============ ENTERTAINMENT ============
  movieTheater: {
    min: 20000, ideal: 30000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 4.0, ideal: 8.0 }, // Movie theaters need 4-8 acres
    examples: ['AMC', 'Regal', 'Cinemark', 'Marcus Theatres', 'Alamo Drafthouse', 'Studio Movie Grill']
  },
  bowlingAlley: {
    min: 12000, ideal: 18000,
    incomePreference: ['moderate', 'middle'] as const,
    lotSize: { min: 2.0, ideal: 4.0 }, // Bowling alleys need 2-4 acres
    examples: ['Bowlero', 'AMF', 'Main Event', 'Lucky Strike', 'Round1', 'Dave & Buster\'s']
  },
  arcadeFEC: {
    min: 15000, ideal: 22000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 1.5, ideal: 3.0 }, // Family entertainment centers need 1.5-3 acres
    examples: ['Dave & Buster\'s', 'Main Event', 'Round1', 'Chuck E. Cheese', 'Scene75', 'Andretti']
  },
  trampolinePark: {
    min: 12000, ideal: 18000,
    incomePreference: ['moderate', 'middle'] as const,
    lotSize: { min: 1.5, ideal: 2.5 }, // Trampoline parks need 1.5-2.5 acres
    examples: ['Sky Zone', 'Urban Air', 'Launch Trampoline', 'Altitude', 'Rockin\' Jump', 'Defy']
  },
  miniGolf: {
    min: 10000, ideal: 15000,
    incomePreference: ['moderate', 'middle'] as const,
    lotSize: { min: 1.0, ideal: 2.0 }, // Mini golf needs 1-2 acres
    examples: ['Topgolf', 'Drive Shack', 'PopStroke', 'Puttshack', 'Monster Mini Golf']
  },
  martialArts: {
    min: 6000, ideal: 10000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.15, ideal: 0.3 }, // Martial arts studios need 0.15-0.3 acres
    examples: ['ATA Martial Arts', 'Premier Martial Arts', 'TITLE Boxing', '9Round', 'UFC Gym']
  },
  yogaPilates: {
    min: 8000, ideal: 12000,
    incomePreference: ['middle', 'upper-middle', 'high'] as const,
    lotSize: { min: 0.1, ideal: 0.2 }, // Yoga/Pilates studios need 0.1-0.2 acres
    examples: ['CorePower Yoga', 'Club Pilates', 'Pure Barre', 'YogaWorks', 'Bikram Yoga']
  },
  danceStudio: {
    min: 6000, ideal: 10000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.15, ideal: 0.3 }, // Dance studios need 0.15-0.3 acres
    examples: ['Arthur Murray', 'Fred Astaire', 'Dance With Me', 'Jazzercise']
  },
  // ============ GROCERY ============
  groceryValue: {
    min: 15000, ideal: 22000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 1.5, ideal: 3.0 }, // Value grocers need 1.5-3 acres
    examples: ['ALDI', 'Lidl', 'Save-A-Lot', 'WinCo', 'Food 4 Less', 'Grocery Outlet']
  },
  groceryMid: {
    min: 18000, ideal: 28000,
    incomePreference: ['moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 3.0, ideal: 5.0 }, // Mid-tier grocers need 3-5 acres
    examples: ['Kroger', 'Publix', 'H-E-B', 'Albertsons', 'Safeway', 'Food Lion', 'Harris Teeter']
  },
  groceryPremium: {
    min: 20000, ideal: 30000,
    incomePreference: ['upper-middle', 'high'] as const,
    lotSize: { min: 2.0, ideal: 4.0 }, // Premium grocers need 2-4 acres
    examples: ['Whole Foods', 'Trader Joe\'s', 'Sprouts', 'Fresh Market', 'Natural Grocers']
  },
  // ============ TRUCK STOP ============
  truckStop: {
    min: 25000, ideal: 40000,
    incomePreference: ['low', 'moderate'] as const,
    lotSize: { min: 5.0, ideal: 15.0 }, // Truck stops need 5-15 acres
    examples: ['Pilot Flying J', 'Love\'s Travel Stops', 'TA Travel Centers', 'Petro', 'Sapp Bros']
  },
  // ============ COLLEGE TOWN FAVORITES ============
  // These businesses thrive in college markets despite low census income
  collegeTownFastCasual: {
    min: 10000, ideal: 18000,
    incomePreference: ['low', 'moderate', 'middle', 'upper-middle'] as const, // Works across income levels in college towns
    lotSize: { min: 0.4, ideal: 0.8 },
    examples: ["Chick-fil-A", "Chipotle", "Raising Cane's", "Wingstop", "Panda Express", "Moe's Southwest Grill", "Blaze Pizza", "Five Guys"]
  },
  collegeTownCoffee: {
    min: 8000, ideal: 15000,
    incomePreference: ['low', 'moderate', 'middle', 'upper-middle'] as const,
    lotSize: { min: 0.2, ideal: 0.5 },
    examples: ["Starbucks", "Dunkin'", "Panera Bread", "McAlister's Deli", "Scooters Coffee", "Dutch Bros"]
  },
  collegeTownLateNight: {
    min: 8000, ideal: 12000,
    incomePreference: ['low', 'moderate'] as const,
    lotSize: { min: 0.3, ideal: 0.6 },
    examples: ["Insomnia Cookies", "Waffle House", "Cookout", "Taco Bell", "Jimmy John's", "Domino's", "Papa John's"]
  },
  collegeTownServices: {
    min: 6000, ideal: 10000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 0.2, ideal: 0.5 },
    examples: ["Planet Fitness", "Urgent Care", "Phone Repair", "Print/Copy Shop", "Great Clips", "Sport Clips"]
  },
  collegeTownEntertainment: {
    min: 10000, ideal: 15000,
    incomePreference: ['low', 'moderate', 'middle'] as const,
    lotSize: { min: 0.5, ideal: 1.5 },
    examples: ["Buffalo Wild Wings", "Sports Bar", "Brewpub", "Topgolf", "Dave & Buster's", "Main Event"]
  },
};

// District types for location-appropriate recommendations
type DistrictType = 'historic_downtown' | 'suburban_retail' | 'highway_corridor' | 'neighborhood' | 'college_campus' | 'general';

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
  stateCode: string | null
): { matches: RetailerMatchResult[]; totalMatches: number } {
  const matches: RetailerMatchResult[] = [];

  for (const retailer of RETAILER_REQUIREMENTS) {
    // Only include actively expanding retailers
    if (!retailer.activelyExpanding) continue;

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

  const incomeLevel = demographics?.incomeLevel || 'middle';

  for (const [key, threshold] of Object.entries(VPD_THRESHOLDS)) {
    // Check if this category is inappropriate for the district
    if (districtInfo?.inappropriateCategories.includes(key)) {
      // Skip this category entirely for this district type
      continue;
    }

    // Skip value-oriented categories in high income areas
    // These businesses target budget-conscious consumers, not affluent markets
    const valueCategories = ['fastFoodValue', 'casualDiningValue', 'coffeeValue', 'quickServiceValue', 'discountRetail'];
    const isHighIncomeArea = incomeLevel === 'upper-middle' || incomeLevel === 'high';
    if (valueCategories.includes(key) && isHighIncomeArea) {
      continue;
    }

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
  lotSizeAcres: number | null = null,
  districtInfo: DistrictInfo | null = null
): string[] {
  const recommendations: Array<{ name: string; score: number; reason: string }> = [];
  const incomeLevel = demographics?.incomeLevel || 'middle';

  // If historic downtown, add downtown-specific recommendations first
  if (districtInfo?.type === 'historic_downtown') {
    const allDowntownOptions = [
      ...DOWNTOWN_BUSINESSES.dining,
      ...DOWNTOWN_BUSINESSES.retail,
      ...DOWNTOWN_BUSINESSES.services,
      ...DOWNTOWN_BUSINESSES.entertainment
    ];
    const availableDowntown = filterExistingBusinesses(allDowntownOptions, nearbyBusinesses);
    for (const business of availableDowntown.slice(0, 10)) {
      recommendations.push({
        name: business,
        score: 12, // High score for downtown-appropriate businesses
        reason: 'Ideal for historic downtown district'
      });
    }
  }

  for (const [key, threshold] of Object.entries(VPD_THRESHOLDS)) {
    // Skip categories inappropriate for this district
    if (districtInfo?.inappropriateCategories.includes(key)) {
      continue;
    }

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
        ...getMockAnalysis(nearbyBusinesses, trafficData, demographicsData, 1.35, address),
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
        districtInfo
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
    const feasibilityScore = calculateFeasibilityScore(trafficData, demographicsData, nearbyBusinesses);
    analysis.feasibilityScore = feasibilityScore;
    // Override viabilityScore with our calculated score
    analysis.viabilityScore = feasibilityScore.overall;

    // Calculate retailer expansion matches
    // Extract state code from address (simple extraction - last two chars before zip)
    let stateCode: string | null = null;
    const stateMatch = address.match(/\b([A-Z]{2})\s*\d{5}/);
    if (stateMatch) {
      stateCode = stateMatch[1];
    }

    const retailerMatches = calculateRetailerMatches(
      lotSizeAcres,
      trafficData?.estimatedVPD || null,
      demographicsData?.medianHouseholdIncome || null,
      demographicsData?.incomeLevel || null,
      demographicsData?.population || null,
      stateCode
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

function getMockAnalysis(nearbyBusinesses: Business[], trafficData: TrafficInfo | null, demographicsData: DemographicsInfo | null = null, lotSizeAcres: number | null = 1.35, address: string = '') {
  const vpd = trafficData?.estimatedVPD || 15000;
  const businessSuitability = calculateBusinessSuitability(vpd, nearbyBusinesses, demographicsData, lotSizeAcres);
  const topRecommendations = generateTopRecommendations(vpd, nearbyBusinesses, demographicsData, lotSizeAcres);
  const feasibilityScore = calculateFeasibilityScore(trafficData, demographicsData, nearbyBusinesses);

  // Extract state code from address
  let stateCode: string | null = null;
  const stateMatch = address.match(/\b([A-Z]{2})\s*\d{5}/);
  if (stateMatch) {
    stateCode = stateMatch[1];
  }

  const retailerMatches = calculateRetailerMatches(
    lotSizeAcres,
    vpd,
    demographicsData?.medianHouseholdIncome || null,
    demographicsData?.incomeLevel || null,
    demographicsData?.population || null,
    stateCode
  );

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
    retailerMatches,
  };
}
