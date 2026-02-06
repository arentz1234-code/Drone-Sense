// Comprehensive Business Intelligence for Site Analysis
// Contains rules, requirements, and classifications for all business types

export type ConstructionPreference = 'new_only' | 'prefers_new' | 'flexible' | 'prefers_conversion';
export type SpaceType = 'freestanding' | 'end_cap' | 'inline' | 'anchor' | 'junior_anchor' | 'pad_site' | 'kiosk';

export interface BusinessRequirements {
  name: string;
  category: string;
  subcategory?: string;
  // Space requirements
  minSqFt: number;
  maxSqFt: number;
  minLotAcres?: number;
  maxLotAcres?: number;
  // Construction
  constructionPreference: ConstructionPreference;
  spaceTypes: SpaceType[];
  // Drive-through
  driveThrough: 'required' | 'preferred' | 'optional' | 'not_applicable';
  driveThroughNotes?: string;
  // Location preferences
  cornerLotPreferred: boolean;
  highwayVisibility: boolean;
  shoppingCenterOk: boolean;
  // Special notes
  notes?: string;
}

// ============ QUICK SERVICE RESTAURANTS (QSR) - DRIVE-THROUGH REQUIRED ============
export const QSR_BUSINESSES: BusinessRequirements[] = [
  {
    name: "Chick-fil-A",
    category: "QSR",
    subcategory: "Chicken",
    minSqFt: 4500,
    maxSqFt: 5500,
    minLotAcres: 1.0,
    maxLotAcres: 1.5,
    constructionPreference: 'new_only',
    spaceTypes: ['freestanding', 'pad_site'],
    driveThrough: 'required',
    driveThroughNotes: 'Needs large lot for dual drive-through lanes, 20+ car stacking',
    cornerLotPreferred: true,
    highwayVisibility: false,
    shoppingCenterOk: false,
    notes: 'NEW CONSTRUCTION ONLY. Extremely selective on sites. Needs excellent traffic flow.'
  },
  {
    name: "McDonald's",
    category: "QSR",
    subcategory: "Burger",
    minSqFt: 4000,
    maxSqFt: 4500,
    minLotAcres: 0.7,
    maxLotAcres: 1.2,
    constructionPreference: 'prefers_new',
    spaceTypes: ['freestanding', 'pad_site', 'end_cap'],
    driveThrough: 'required',
    driveThroughNotes: 'Dual lane becoming standard, 8-12 car stacking minimum',
    cornerLotPreferred: true,
    highwayVisibility: false,
    shoppingCenterOk: false,
    notes: 'Drive-through generates 70%+ of revenue'
  },
  {
    name: "Wendy's",
    category: "QSR",
    subcategory: "Burger",
    minSqFt: 3500,
    maxSqFt: 4200,
    minLotAcres: 0.6,
    maxLotAcres: 1.0,
    constructionPreference: 'prefers_new',
    spaceTypes: ['freestanding', 'pad_site', 'end_cap'],
    driveThrough: 'required',
    cornerLotPreferred: true,
    highwayVisibility: false,
    shoppingCenterOk: false,
  },
  {
    name: "Burger King",
    category: "QSR",
    subcategory: "Burger",
    minSqFt: 3200,
    maxSqFt: 4000,
    minLotAcres: 0.5,
    maxLotAcres: 1.0,
    constructionPreference: 'flexible',
    spaceTypes: ['freestanding', 'pad_site', 'end_cap'],
    driveThrough: 'required',
    cornerLotPreferred: true,
    highwayVisibility: false,
    shoppingCenterOk: false,
  },
  {
    name: "Taco Bell",
    category: "QSR",
    subcategory: "Mexican",
    minSqFt: 2500,
    maxSqFt: 3500,
    minLotAcres: 0.5,
    maxLotAcres: 0.9,
    constructionPreference: 'flexible',
    spaceTypes: ['freestanding', 'pad_site', 'end_cap'],
    driveThrough: 'required',
    cornerLotPreferred: true,
    highwayVisibility: false,
    shoppingCenterOk: false,
  },
  {
    name: "Popeyes",
    category: "QSR",
    subcategory: "Chicken",
    minSqFt: 2800,
    maxSqFt: 3500,
    minLotAcres: 0.5,
    maxLotAcres: 1.0,
    constructionPreference: 'prefers_new',
    spaceTypes: ['freestanding', 'pad_site', 'end_cap'],
    driveThrough: 'required',
    cornerLotPreferred: true,
    highwayVisibility: false,
    shoppingCenterOk: false,
    notes: 'Aggressive expansion - targeting 200+ new locations/year'
  },
  {
    name: "KFC",
    category: "QSR",
    subcategory: "Chicken",
    minSqFt: 2500,
    maxSqFt: 3500,
    minLotAcres: 0.5,
    maxLotAcres: 1.0,
    constructionPreference: 'flexible',
    spaceTypes: ['freestanding', 'pad_site', 'end_cap'],
    driveThrough: 'required',
    cornerLotPreferred: true,
    highwayVisibility: false,
    shoppingCenterOk: false,
  },
  {
    name: "Arby's",
    category: "QSR",
    subcategory: "Sandwich",
    minSqFt: 2800,
    maxSqFt: 3500,
    minLotAcres: 0.5,
    maxLotAcres: 1.0,
    constructionPreference: 'flexible',
    spaceTypes: ['freestanding', 'pad_site', 'end_cap'],
    driveThrough: 'required',
    cornerLotPreferred: true,
    highwayVisibility: false,
    shoppingCenterOk: false,
  },
  {
    name: "Sonic",
    category: "QSR",
    subcategory: "Drive-In",
    minSqFt: 1500,
    maxSqFt: 2500,
    minLotAcres: 0.8,
    maxLotAcres: 1.5,
    constructionPreference: 'new_only',
    spaceTypes: ['freestanding'],
    driveThrough: 'required',
    driveThroughNotes: 'Drive-in stalls required, plus drive-through lane',
    cornerLotPreferred: true,
    highwayVisibility: false,
    shoppingCenterOk: false,
    notes: 'Unique drive-in format requires specific lot configuration'
  },
  {
    name: "Raising Cane's",
    category: "QSR",
    subcategory: "Chicken",
    minSqFt: 3500,
    maxSqFt: 4500,
    minLotAcres: 0.8,
    maxLotAcres: 1.3,
    constructionPreference: 'new_only',
    spaceTypes: ['freestanding', 'pad_site'],
    driveThrough: 'required',
    driveThroughNotes: 'Dual drive-through standard, high volume requires extensive stacking',
    cornerLotPreferred: true,
    highwayVisibility: false,
    shoppingCenterOk: false,
    notes: 'NEW CONSTRUCTION ONLY. Very high volume requires excellent traffic flow.'
  },
  {
    name: "Whataburger",
    category: "QSR",
    subcategory: "Burger",
    minSqFt: 4000,
    maxSqFt: 5000,
    minLotAcres: 0.8,
    maxLotAcres: 1.2,
    constructionPreference: 'prefers_new',
    spaceTypes: ['freestanding', 'pad_site'],
    driveThrough: 'required',
    cornerLotPreferred: true,
    highwayVisibility: false,
    shoppingCenterOk: false,
    notes: 'Strong Texas/Southeast presence, expanding'
  },
  {
    name: "Culver's",
    category: "QSR",
    subcategory: "Burger",
    minSqFt: 4200,
    maxSqFt: 5000,
    minLotAcres: 0.8,
    maxLotAcres: 1.3,
    constructionPreference: 'prefers_new',
    spaceTypes: ['freestanding', 'pad_site'],
    driveThrough: 'required',
    cornerLotPreferred: true,
    highwayVisibility: false,
    shoppingCenterOk: false,
    notes: 'Expanding beyond Midwest stronghold'
  },
  {
    name: "Zaxby's",
    category: "QSR",
    subcategory: "Chicken",
    minSqFt: 3200,
    maxSqFt: 4000,
    minLotAcres: 0.6,
    maxLotAcres: 1.0,
    constructionPreference: 'prefers_new',
    spaceTypes: ['freestanding', 'pad_site', 'end_cap'],
    driveThrough: 'required',
    cornerLotPreferred: true,
    highwayVisibility: false,
    shoppingCenterOk: false,
  },
  {
    name: "Wingstop",
    category: "QSR",
    subcategory: "Chicken",
    minSqFt: 1700,
    maxSqFt: 2200,
    constructionPreference: 'flexible',
    spaceTypes: ['inline', 'end_cap'],
    driveThrough: 'optional',
    driveThroughNotes: 'Adding drive-through to new locations but not required',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
    notes: 'Primarily delivery/takeout focused'
  },
  {
    name: "Dairy Queen",
    category: "QSR",
    subcategory: "Ice Cream/Burger",
    minSqFt: 2400,
    maxSqFt: 3500,
    minLotAcres: 0.5,
    maxLotAcres: 1.0,
    constructionPreference: 'flexible',
    spaceTypes: ['freestanding', 'pad_site', 'end_cap'],
    driveThrough: 'required',
    cornerLotPreferred: true,
    highwayVisibility: false,
    shoppingCenterOk: false,
    notes: 'Flexible - new build OR existing space conversion'
  },
  {
    name: "Jimmy John's",
    category: "QSR",
    subcategory: "Sandwich",
    minSqFt: 1200,
    maxSqFt: 1800,
    constructionPreference: 'flexible',
    spaceTypes: ['inline', 'end_cap'],
    driveThrough: 'preferred',
    driveThroughNotes: 'Can take existing retail but drive-through needs specific setup',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
    notes: 'Small footprint, delivery focused'
  },
];

// ============ COFFEE SHOPS ============
export const COFFEE_BUSINESSES: BusinessRequirements[] = [
  {
    name: "Starbucks",
    category: "Coffee",
    minSqFt: 1800,
    maxSqFt: 2500,
    minLotAcres: 0.4,
    maxLotAcres: 0.8,
    constructionPreference: 'flexible',
    spaceTypes: ['freestanding', 'pad_site', 'end_cap', 'inline'],
    driveThrough: 'preferred',
    driveThroughNotes: 'Drive-through preferred but flexible on format',
    cornerLotPreferred: true,
    highwayVisibility: false,
    shoppingCenterOk: true,
    notes: 'Very flexible - new builds, conversions, end caps, inline'
  },
  {
    name: "Dunkin'",
    category: "Coffee",
    minSqFt: 1500,
    maxSqFt: 2400,
    minLotAcres: 0.4,
    maxLotAcres: 0.7,
    constructionPreference: 'prefers_new',
    spaceTypes: ['freestanding', 'pad_site', 'end_cap'],
    driveThrough: 'required',
    driveThroughNotes: 'Drive-through required for most new locations',
    cornerLotPreferred: true,
    highwayVisibility: false,
    shoppingCenterOk: false,
  },
  {
    name: "Dutch Bros",
    category: "Coffee",
    minSqFt: 800,
    maxSqFt: 1200,
    minLotAcres: 0.3,
    maxLotAcres: 0.5,
    constructionPreference: 'new_only',
    spaceTypes: ['freestanding', 'kiosk'],
    driveThrough: 'required',
    driveThroughNotes: 'Drive-through ONLY, small footprint kiosk style',
    cornerLotPreferred: true,
    highwayVisibility: false,
    shoppingCenterOk: false,
    notes: 'NEW CONSTRUCTION, small footprint, drive-through only'
  },
  {
    name: "Scooter's Coffee",
    category: "Coffee",
    minSqFt: 600,
    maxSqFt: 1000,
    minLotAcres: 0.2,
    maxLotAcres: 0.4,
    constructionPreference: 'new_only',
    spaceTypes: ['kiosk', 'freestanding'],
    driveThrough: 'required',
    driveThroughNotes: 'Drive-through kiosk format',
    cornerLotPreferred: true,
    highwayVisibility: false,
    shoppingCenterOk: false,
    notes: 'Drive-through kiosk, small lot needed'
  },
  {
    name: "7 Brew",
    category: "Coffee",
    minSqFt: 500,
    maxSqFt: 900,
    minLotAcres: 0.25,
    maxLotAcres: 0.4,
    constructionPreference: 'new_only',
    spaceTypes: ['kiosk', 'freestanding'],
    driveThrough: 'required',
    driveThroughNotes: 'Drive-through only, new construction',
    cornerLotPreferred: true,
    highwayVisibility: false,
    shoppingCenterOk: false,
    notes: 'Drive-through only, new construction required'
  },
];

// ============ FAST CASUAL (No Drive-Through Required) ============
export const FAST_CASUAL_BUSINESSES: BusinessRequirements[] = [
  {
    name: "Chipotle",
    category: "Fast Casual",
    subcategory: "Mexican",
    minSqFt: 2200,
    maxSqFt: 2800,
    constructionPreference: 'flexible',
    spaceTypes: ['end_cap', 'inline', 'freestanding'],
    driveThrough: 'optional',
    driveThroughNotes: 'Adding Chipotlanes to new locations',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
    notes: 'Prefers end caps, inline retail, shopping centers'
  },
  {
    name: "Moe's Southwest Grill",
    category: "Fast Casual",
    subcategory: "Mexican",
    minSqFt: 2000,
    maxSqFt: 2800,
    constructionPreference: 'flexible',
    spaceTypes: ['end_cap', 'inline'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
  },
  {
    name: "Qdoba",
    category: "Fast Casual",
    subcategory: "Mexican",
    minSqFt: 2200,
    maxSqFt: 2800,
    constructionPreference: 'flexible',
    spaceTypes: ['end_cap', 'inline'],
    driveThrough: 'optional',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
  },
  {
    name: "Five Guys",
    category: "Fast Casual",
    subcategory: "Burger",
    minSqFt: 2000,
    maxSqFt: 2800,
    constructionPreference: 'flexible',
    spaceTypes: ['end_cap', 'inline'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
    notes: 'No drive-through, focuses on dine-in and takeout'
  },
  {
    name: "Firehouse Subs",
    category: "Fast Casual",
    subcategory: "Sandwich",
    minSqFt: 1500,
    maxSqFt: 2200,
    constructionPreference: 'flexible',
    spaceTypes: ['end_cap', 'inline'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
  },
  {
    name: "Jersey Mike's",
    category: "Fast Casual",
    subcategory: "Sandwich",
    minSqFt: 1400,
    maxSqFt: 2000,
    constructionPreference: 'flexible',
    spaceTypes: ['end_cap', 'inline'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
  },
  {
    name: "Subway",
    category: "Fast Casual",
    subcategory: "Sandwich",
    minSqFt: 1000,
    maxSqFt: 1600,
    constructionPreference: 'flexible',
    spaceTypes: ['inline', 'end_cap'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
    notes: 'Very flexible on location, small footprint'
  },
  {
    name: "McAlister's Deli",
    category: "Fast Casual",
    subcategory: "Deli",
    minSqFt: 2800,
    maxSqFt: 3500,
    constructionPreference: 'flexible',
    spaceTypes: ['end_cap', 'freestanding'],
    driveThrough: 'optional',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
  },
  {
    name: "Panera Bread",
    category: "Fast Casual",
    subcategory: "Bakery/Cafe",
    minSqFt: 4000,
    maxSqFt: 4800,
    minLotAcres: 0.6,
    maxLotAcres: 1.0,
    constructionPreference: 'flexible',
    spaceTypes: ['freestanding', 'end_cap'],
    driveThrough: 'preferred',
    driveThroughNotes: 'Adding drive-through to most new locations',
    cornerLotPreferred: true,
    highwayVisibility: false,
    shoppingCenterOk: true,
  },
  {
    name: "Panda Express",
    category: "Fast Casual",
    subcategory: "Asian",
    minSqFt: 2000,
    maxSqFt: 3000,
    constructionPreference: 'flexible',
    spaceTypes: ['freestanding', 'end_cap', 'inline'],
    driveThrough: 'optional',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
  },
  {
    name: "Blaze Pizza",
    category: "Fast Casual",
    subcategory: "Pizza",
    minSqFt: 2200,
    maxSqFt: 2800,
    constructionPreference: 'flexible',
    spaceTypes: ['end_cap', 'inline'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
  },
  {
    name: "MOD Pizza",
    category: "Fast Casual",
    subcategory: "Pizza",
    minSqFt: 2400,
    maxSqFt: 3000,
    constructionPreference: 'flexible',
    spaceTypes: ['end_cap', 'inline'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
  },
];

// ============ CASUAL DINING / SIT-DOWN ============
export const CASUAL_DINING_BUSINESSES: BusinessRequirements[] = [
  {
    name: "Applebee's",
    category: "Casual Dining",
    minSqFt: 5000,
    maxSqFt: 6500,
    minLotAcres: 1.0,
    maxLotAcres: 1.5,
    constructionPreference: 'flexible',
    spaceTypes: ['freestanding', 'end_cap'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: true,
    shoppingCenterOk: true,
    notes: 'Needs large parking lot, high visibility'
  },
  {
    name: "Chili's",
    category: "Casual Dining",
    minSqFt: 5500,
    maxSqFt: 7000,
    minLotAcres: 1.0,
    maxLotAcres: 1.5,
    constructionPreference: 'flexible',
    spaceTypes: ['freestanding', 'end_cap'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: true,
    shoppingCenterOk: true,
  },
  {
    name: "Olive Garden",
    category: "Casual Dining",
    minSqFt: 7500,
    maxSqFt: 8500,
    minLotAcres: 1.5,
    maxLotAcres: 2.0,
    constructionPreference: 'prefers_new',
    spaceTypes: ['freestanding'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: true,
    shoppingCenterOk: false,
    notes: 'Needs substantial parking, typically freestanding'
  },
  {
    name: "Red Lobster",
    category: "Casual Dining",
    minSqFt: 7000,
    maxSqFt: 8000,
    minLotAcres: 1.5,
    maxLotAcres: 2.0,
    constructionPreference: 'flexible',
    spaceTypes: ['freestanding'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: true,
    shoppingCenterOk: false,
  },
  {
    name: "Outback Steakhouse",
    category: "Casual Dining",
    minSqFt: 6000,
    maxSqFt: 7000,
    minLotAcres: 1.2,
    maxLotAcres: 1.8,
    constructionPreference: 'flexible',
    spaceTypes: ['freestanding', 'end_cap'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: true,
    shoppingCenterOk: true,
  },
  {
    name: "Texas Roadhouse",
    category: "Casual Dining",
    minSqFt: 7000,
    maxSqFt: 8000,
    minLotAcres: 1.5,
    maxLotAcres: 2.0,
    constructionPreference: 'prefers_new',
    spaceTypes: ['freestanding'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: true,
    shoppingCenterOk: false,
    notes: 'Strong performer, needs large parking lot'
  },
  {
    name: "Cracker Barrel",
    category: "Casual Dining",
    minSqFt: 9000,
    maxSqFt: 11000,
    minLotAcres: 2.5,
    maxLotAcres: 4.0,
    constructionPreference: 'new_only',
    spaceTypes: ['freestanding'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: true,
    shoppingCenterOk: false,
    notes: 'ALWAYS new construction, needs highway visibility, includes retail gift shop'
  },
  {
    name: "IHOP",
    category: "Casual Dining",
    minSqFt: 4000,
    maxSqFt: 5000,
    minLotAcres: 0.8,
    maxLotAcres: 1.2,
    constructionPreference: 'flexible',
    spaceTypes: ['freestanding', 'end_cap'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: true,
    shoppingCenterOk: true,
  },
  {
    name: "Denny's",
    category: "Casual Dining",
    minSqFt: 4200,
    maxSqFt: 5500,
    minLotAcres: 0.8,
    maxLotAcres: 1.3,
    constructionPreference: 'flexible',
    spaceTypes: ['freestanding', 'end_cap'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: true,
    shoppingCenterOk: true,
  },
  {
    name: "Waffle House",
    category: "Casual Dining",
    minSqFt: 1600,
    maxSqFt: 2100,
    minLotAcres: 0.3,
    maxLotAcres: 0.6,
    constructionPreference: 'flexible',
    spaceTypes: ['freestanding'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: true,
    shoppingCenterOk: false,
    notes: 'Flexible, small footprint, loves highway exits. 24/7 operation.'
  },
  {
    name: "Buffalo Wild Wings",
    category: "Casual Dining",
    subcategory: "Sports Bar",
    minSqFt: 5000,
    maxSqFt: 6500,
    minLotAcres: 1.0,
    maxLotAcres: 1.5,
    constructionPreference: 'flexible',
    spaceTypes: ['freestanding', 'end_cap'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
    notes: 'Sports bar format, needs high visibility'
  },
];

// ============ GAS STATIONS & CONVENIENCE ============
export const GAS_STATION_BUSINESSES: BusinessRequirements[] = [
  {
    name: "QuikTrip",
    category: "Gas Station",
    subcategory: "Travel Center",
    minSqFt: 5000,
    maxSqFt: 7000,
    minLotAcres: 1.5,
    maxLotAcres: 3.0,
    constructionPreference: 'new_only',
    spaceTypes: ['freestanding'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: true,
    highwayVisibility: true,
    shoppingCenterOk: false,
    notes: 'Large lots, new construction, highway/major road access'
  },
  {
    name: "RaceTrac",
    category: "Gas Station",
    subcategory: "Travel Center",
    minSqFt: 5000,
    maxSqFt: 6500,
    minLotAcres: 1.5,
    maxLotAcres: 2.5,
    constructionPreference: 'new_only',
    spaceTypes: ['freestanding'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: true,
    highwayVisibility: true,
    shoppingCenterOk: false,
    notes: 'New construction, large footprint'
  },
  {
    name: "Buc-ee's",
    category: "Gas Station",
    subcategory: "Travel Center",
    minSqFt: 50000,
    maxSqFt: 75000,
    minLotAcres: 25,
    maxLotAcres: 50,
    constructionPreference: 'new_only',
    spaceTypes: ['freestanding'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: true,
    shoppingCenterOk: false,
    notes: 'MASSIVE lots (25-50+ acres), new construction only, interstate highway required'
  },
  {
    name: "Wawa",
    category: "Gas Station",
    subcategory: "Convenience",
    minSqFt: 5000,
    maxSqFt: 6000,
    minLotAcres: 1.0,
    maxLotAcres: 1.8,
    constructionPreference: 'prefers_new',
    spaceTypes: ['freestanding'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: true,
    highwayVisibility: false,
    shoppingCenterOk: false,
    notes: 'New construction preferred, 5,000+ sq ft stores'
  },
  {
    name: "Sheetz",
    category: "Gas Station",
    subcategory: "Convenience",
    minSqFt: 5000,
    maxSqFt: 6000,
    minLotAcres: 1.0,
    maxLotAcres: 2.0,
    constructionPreference: 'new_only',
    spaceTypes: ['freestanding'],
    driveThrough: 'optional',
    driveThroughNotes: 'Drive-through food service available',
    cornerLotPreferred: true,
    highwayVisibility: false,
    shoppingCenterOk: false,
    notes: 'New construction, drive-through food'
  },
  {
    name: "7-Eleven",
    category: "Gas Station",
    subcategory: "Convenience",
    minSqFt: 2400,
    maxSqFt: 3500,
    minLotAcres: 0.5,
    maxLotAcres: 1.0,
    constructionPreference: 'flexible',
    spaceTypes: ['freestanding'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: true,
    highwayVisibility: false,
    shoppingCenterOk: false,
    notes: 'Flexible, small footprint, conversions OK'
  },
  {
    name: "Circle K",
    category: "Gas Station",
    subcategory: "Convenience",
    minSqFt: 2800,
    maxSqFt: 4000,
    minLotAcres: 0.5,
    maxLotAcres: 1.2,
    constructionPreference: 'flexible',
    spaceTypes: ['freestanding'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: true,
    highwayVisibility: false,
    shoppingCenterOk: false,
    notes: 'Very flexible, conversions common'
  },
];

// ============ GROCERY & SUPERMARKETS ============
export const GROCERY_BUSINESSES: BusinessRequirements[] = [
  {
    name: "Walmart Supercenter",
    category: "Grocery",
    subcategory: "Big Box",
    minSqFt: 150000,
    maxSqFt: 200000,
    minLotAcres: 15,
    maxLotAcres: 25,
    constructionPreference: 'new_only',
    spaceTypes: ['anchor'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: true,
    shoppingCenterOk: false,
    notes: '150,000+ sq ft, massive parking, new construction'
  },
  {
    name: "Walmart Neighborhood Market",
    category: "Grocery",
    minSqFt: 38000,
    maxSqFt: 45000,
    minLotAcres: 3,
    maxLotAcres: 5,
    constructionPreference: 'flexible',
    spaceTypes: ['anchor', 'junior_anchor'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
    notes: '40,000 sq ft, can anchor smaller centers'
  },
  {
    name: "Kroger",
    category: "Grocery",
    minSqFt: 45000,
    maxSqFt: 65000,
    minLotAcres: 4,
    maxLotAcres: 8,
    constructionPreference: 'flexible',
    spaceTypes: ['anchor'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
    notes: 'Anchor position, 45,000-65,000 sq ft'
  },
  {
    name: "Publix",
    category: "Grocery",
    minSqFt: 45000,
    maxSqFt: 55000,
    minLotAcres: 4,
    maxLotAcres: 7,
    constructionPreference: 'prefers_new',
    spaceTypes: ['anchor'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
    notes: 'Anchor position, Southeast focus'
  },
  {
    name: "Aldi",
    category: "Grocery",
    subcategory: "Discount",
    minSqFt: 18000,
    maxSqFt: 25000,
    minLotAcres: 1.5,
    maxLotAcres: 3,
    constructionPreference: 'flexible',
    spaceTypes: ['freestanding', 'junior_anchor'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
    notes: '20,000-25,000 sq ft, flexible on location'
  },
  {
    name: "Lidl",
    category: "Grocery",
    subcategory: "Discount",
    minSqFt: 20000,
    maxSqFt: 25000,
    minLotAcres: 2,
    maxLotAcres: 3.5,
    constructionPreference: 'prefers_new',
    spaceTypes: ['freestanding', 'junior_anchor'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
    notes: '20,000-25,000 sq ft, flexible on location'
  },
  {
    name: "Trader Joe's",
    category: "Grocery",
    subcategory: "Specialty",
    minSqFt: 10000,
    maxSqFt: 15000,
    minLotAcres: 1,
    maxLotAcres: 2,
    constructionPreference: 'prefers_conversion',
    spaceTypes: ['junior_anchor', 'end_cap'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
    notes: '10,000-15,000 sq ft, prefers existing retail conversions'
  },
  {
    name: "Whole Foods",
    category: "Grocery",
    subcategory: "Premium",
    minSqFt: 25000,
    maxSqFt: 50000,
    minLotAcres: 2.5,
    maxLotAcres: 5,
    constructionPreference: 'flexible',
    spaceTypes: ['anchor', 'junior_anchor'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
    notes: '25,000-50,000 sq ft, affluent areas, new or conversion'
  },
  {
    name: "Dollar General",
    category: "Grocery",
    subcategory: "Discount",
    minSqFt: 7500,
    maxSqFt: 10000,
    minLotAcres: 0.8,
    maxLotAcres: 1.5,
    constructionPreference: 'flexible',
    spaceTypes: ['freestanding', 'end_cap'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
    notes: '9,000 sq ft, rural/suburban, very flexible, new builds common'
  },
  {
    name: "Dollar Tree",
    category: "Grocery",
    subcategory: "Discount",
    minSqFt: 8000,
    maxSqFt: 12000,
    constructionPreference: 'flexible',
    spaceTypes: ['inline', 'end_cap', 'freestanding'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
    notes: '8,000-10,000 sq ft, inline or freestanding'
  },
];

// ============ PHARMACIES ============
export const PHARMACY_BUSINESSES: BusinessRequirements[] = [
  {
    name: "CVS",
    category: "Pharmacy",
    minSqFt: 10000,
    maxSqFt: 13000,
    minLotAcres: 1.0,
    maxLotAcres: 1.8,
    constructionPreference: 'prefers_new',
    spaceTypes: ['freestanding'],
    driveThrough: 'required',
    driveThroughNotes: 'Drive-through pharmacy required',
    cornerLotPreferred: true,
    highwayVisibility: false,
    shoppingCenterOk: false,
    notes: '10,000-13,000 sq ft, corner lots preferred, drive-through pharmacy'
  },
  {
    name: "Walgreens",
    category: "Pharmacy",
    minSqFt: 13000,
    maxSqFt: 15000,
    minLotAcres: 1.2,
    maxLotAcres: 2.0,
    constructionPreference: 'prefers_new',
    spaceTypes: ['freestanding'],
    driveThrough: 'required',
    driveThroughNotes: 'Drive-through pharmacy required',
    cornerLotPreferred: true,
    highwayVisibility: false,
    shoppingCenterOk: false,
    notes: '14,000 sq ft, corner lots, drive-through pharmacy'
  },
];

// ============ BANKS ============
export const BANK_BUSINESSES: BusinessRequirements[] = [
  {
    name: "Chase",
    category: "Bank",
    minSqFt: 3000,
    maxSqFt: 5000,
    minLotAcres: 0.5,
    maxLotAcres: 1.0,
    constructionPreference: 'prefers_new',
    spaceTypes: ['freestanding', 'pad_site'],
    driveThrough: 'required',
    driveThroughNotes: 'Drive-through banking required',
    cornerLotPreferred: true,
    highwayVisibility: false,
    shoppingCenterOk: false,
    notes: 'Drive-through required, corner lots, 3,000-5,000 sq ft'
  },
  {
    name: "Bank of America",
    category: "Bank",
    minSqFt: 3500,
    maxSqFt: 5500,
    minLotAcres: 0.5,
    maxLotAcres: 1.0,
    constructionPreference: 'prefers_new',
    spaceTypes: ['freestanding', 'pad_site'],
    driveThrough: 'required',
    cornerLotPreferred: true,
    highwayVisibility: false,
    shoppingCenterOk: false,
  },
  {
    name: "Wells Fargo",
    category: "Bank",
    minSqFt: 3000,
    maxSqFt: 5000,
    minLotAcres: 0.5,
    maxLotAcres: 1.0,
    constructionPreference: 'prefers_new',
    spaceTypes: ['freestanding', 'pad_site'],
    driveThrough: 'required',
    cornerLotPreferred: true,
    highwayVisibility: false,
    shoppingCenterOk: false,
  },
];

// ============ FITNESS ============
export const FITNESS_BUSINESSES: BusinessRequirements[] = [
  {
    name: "Planet Fitness",
    category: "Fitness",
    minSqFt: 18000,
    maxSqFt: 25000,
    constructionPreference: 'flexible',
    spaceTypes: ['junior_anchor', 'anchor'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
    notes: '20,000 sq ft, anchor or junior anchor'
  },
  {
    name: "LA Fitness",
    category: "Fitness",
    minSqFt: 40000,
    maxSqFt: 55000,
    minLotAcres: 3,
    maxLotAcres: 5,
    constructionPreference: 'flexible',
    spaceTypes: ['anchor'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
    notes: '40,000-55,000 sq ft, large parking'
  },
  {
    name: "Anytime Fitness",
    category: "Fitness",
    minSqFt: 4000,
    maxSqFt: 6000,
    constructionPreference: 'flexible',
    spaceTypes: ['inline', 'end_cap'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
    notes: '4,000-6,000 sq ft, inline or end cap'
  },
  {
    name: "Orange Theory",
    category: "Fitness",
    minSqFt: 2800,
    maxSqFt: 4000,
    constructionPreference: 'flexible',
    spaceTypes: ['inline', 'end_cap'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
    notes: '2,500-4,000 sq ft, flexible'
  },
];

// ============ RETAIL ============
export const RETAIL_BUSINESSES: BusinessRequirements[] = [
  {
    name: "Target",
    category: "Retail",
    subcategory: "Big Box",
    minSqFt: 120000,
    maxSqFt: 140000,
    minLotAcres: 10,
    maxLotAcres: 15,
    constructionPreference: 'new_only',
    spaceTypes: ['anchor'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: true,
    shoppingCenterOk: false,
    notes: '130,000 sq ft, anchor, massive parking'
  },
  {
    name: "TJ Maxx",
    category: "Retail",
    subcategory: "Off-Price",
    minSqFt: 25000,
    maxSqFt: 32000,
    constructionPreference: 'flexible',
    spaceTypes: ['junior_anchor'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
    notes: '25,000-30,000 sq ft, junior anchor'
  },
  {
    name: "HomeGoods",
    category: "Retail",
    subcategory: "Home",
    minSqFt: 22000,
    maxSqFt: 28000,
    constructionPreference: 'flexible',
    spaceTypes: ['junior_anchor'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
    notes: '15,000-25,000 sq ft'
  },
  {
    name: "Ulta",
    category: "Retail",
    subcategory: "Beauty",
    minSqFt: 10000,
    maxSqFt: 12000,
    constructionPreference: 'flexible',
    spaceTypes: ['inline', 'end_cap'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
    notes: '10,000 sq ft, inline or end cap'
  },
  {
    name: "PetSmart",
    category: "Retail",
    subcategory: "Pet",
    minSqFt: 15000,
    maxSqFt: 20000,
    constructionPreference: 'flexible',
    spaceTypes: ['end_cap', 'freestanding'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
    notes: '15,000-20,000 sq ft, end cap or freestanding'
  },
  {
    name: "Best Buy",
    category: "Retail",
    subcategory: "Electronics",
    minSqFt: 30000,
    maxSqFt: 45000,
    constructionPreference: 'flexible',
    spaceTypes: ['freestanding', 'anchor'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
    notes: '30,000-45,000 sq ft, freestanding or anchor'
  },
  {
    name: "Home Depot",
    category: "Retail",
    subcategory: "Home Improvement",
    minSqFt: 100000,
    maxSqFt: 130000,
    minLotAcres: 10,
    maxLotAcres: 15,
    constructionPreference: 'new_only',
    spaceTypes: ['anchor'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: true,
    shoppingCenterOk: false,
    notes: '100,000+ sq ft, massive lots, new construction'
  },
  {
    name: "Lowe's",
    category: "Retail",
    subcategory: "Home Improvement",
    minSqFt: 100000,
    maxSqFt: 130000,
    minLotAcres: 10,
    maxLotAcres: 15,
    constructionPreference: 'new_only',
    spaceTypes: ['anchor'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: true,
    shoppingCenterOk: false,
    notes: '100,000+ sq ft, massive lots, new construction'
  },
];

// ============ MEDICAL ============
export const MEDICAL_BUSINESSES: BusinessRequirements[] = [
  {
    name: "Urgent Care",
    category: "Medical",
    minSqFt: 3000,
    maxSqFt: 5000,
    constructionPreference: 'flexible',
    spaceTypes: ['freestanding', 'end_cap'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: true,
    shoppingCenterOk: true,
    notes: '3,000-5,000 sq ft, high visibility, easy access'
  },
  {
    name: "Dental Office",
    category: "Medical",
    minSqFt: 1500,
    maxSqFt: 3000,
    constructionPreference: 'flexible',
    spaceTypes: ['inline', 'end_cap', 'freestanding'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
    notes: '1,500-3,000 sq ft, inline or freestanding'
  },
  {
    name: "Veterinary Clinic",
    category: "Medical",
    minSqFt: 2500,
    maxSqFt: 5000,
    constructionPreference: 'flexible',
    spaceTypes: ['freestanding', 'end_cap'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
    notes: '2,500-5,000 sq ft, freestanding preferred'
  },
];

// ============ AUTOMOTIVE ============
export const AUTO_BUSINESSES: BusinessRequirements[] = [
  {
    name: "AutoZone",
    category: "Automotive",
    subcategory: "Parts",
    minSqFt: 6000,
    maxSqFt: 8000,
    minLotAcres: 0.5,
    maxLotAcres: 1.0,
    constructionPreference: 'flexible',
    spaceTypes: ['freestanding', 'end_cap'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
    notes: '6,000-8,000 sq ft, freestanding or end cap'
  },
  {
    name: "Jiffy Lube",
    category: "Automotive",
    subcategory: "Oil Change",
    minSqFt: 2000,
    maxSqFt: 3500,
    minLotAcres: 0.3,
    maxLotAcres: 0.6,
    constructionPreference: 'prefers_new',
    spaceTypes: ['freestanding'],
    driveThrough: 'required',
    driveThroughNotes: 'Drive-through service bays',
    cornerLotPreferred: true,
    highwayVisibility: false,
    shoppingCenterOk: false,
    notes: 'Small lots, drive-through service bays'
  },
  {
    name: "Discount Tire",
    category: "Automotive",
    subcategory: "Tires",
    minSqFt: 6000,
    maxSqFt: 8000,
    minLotAcres: 0.6,
    maxLotAcres: 1.2,
    constructionPreference: 'prefers_new',
    spaceTypes: ['freestanding'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: false,
    notes: 'Need service bay space, 6,000+ sq ft'
  },
];

// ============ HOTELS ============
export const HOTEL_BUSINESSES: BusinessRequirements[] = [
  {
    name: "Hampton Inn",
    category: "Hotel",
    subcategory: "Mid-Range",
    minSqFt: 50000,
    maxSqFt: 75000,
    minLotAcres: 2,
    maxLotAcres: 3,
    constructionPreference: 'new_only',
    spaceTypes: ['freestanding'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: true,
    shoppingCenterOk: false,
    notes: '2-3 acres, highway or commercial areas'
  },
  {
    name: "Holiday Inn Express",
    category: "Hotel",
    subcategory: "Mid-Range",
    minSqFt: 45000,
    maxSqFt: 70000,
    minLotAcres: 2,
    maxLotAcres: 3,
    constructionPreference: 'new_only',
    spaceTypes: ['freestanding'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: true,
    shoppingCenterOk: false,
    notes: '2-3 acres, highway visibility'
  },
];

// ============ ENTERTAINMENT ============
export const ENTERTAINMENT_BUSINESSES: BusinessRequirements[] = [
  {
    name: "TopGolf",
    category: "Entertainment",
    minSqFt: 65000,
    maxSqFt: 75000,
    minLotAcres: 10,
    maxLotAcres: 15,
    constructionPreference: 'new_only',
    spaceTypes: ['freestanding'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: true,
    shoppingCenterOk: false,
    notes: '65,000 sq ft, 10+ acres, NEW CONSTRUCTION ONLY'
  },
  {
    name: "Dave & Buster's",
    category: "Entertainment",
    minSqFt: 25000,
    maxSqFt: 40000,
    minLotAcres: 2,
    maxLotAcres: 4,
    constructionPreference: 'flexible',
    spaceTypes: ['anchor', 'junior_anchor'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: true,
    notes: '25,000-40,000 sq ft, entertainment districts'
  },
];

// ============ STORAGE ============
export const STORAGE_BUSINESSES: BusinessRequirements[] = [
  {
    name: "Public Storage",
    category: "Storage",
    minSqFt: 50000,
    maxSqFt: 100000,
    minLotAcres: 2,
    maxLotAcres: 5,
    constructionPreference: 'flexible',
    spaceTypes: ['freestanding'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: false,
    notes: '2-5 acres, flexible, often conversions'
  },
  {
    name: "Extra Space Storage",
    category: "Storage",
    minSqFt: 50000,
    maxSqFt: 100000,
    minLotAcres: 2,
    maxLotAcres: 5,
    constructionPreference: 'prefers_conversion',
    spaceTypes: ['freestanding'],
    driveThrough: 'not_applicable',
    cornerLotPreferred: false,
    highwayVisibility: false,
    shoppingCenterOk: false,
    notes: 'Prefers conversions of existing buildings'
  },
];

// ============ COMBINED DATABASE ============
export const ALL_BUSINESSES: BusinessRequirements[] = [
  ...QSR_BUSINESSES,
  ...COFFEE_BUSINESSES,
  ...FAST_CASUAL_BUSINESSES,
  ...CASUAL_DINING_BUSINESSES,
  ...GAS_STATION_BUSINESSES,
  ...GROCERY_BUSINESSES,
  ...PHARMACY_BUSINESSES,
  ...BANK_BUSINESSES,
  ...FITNESS_BUSINESSES,
  ...RETAIL_BUSINESSES,
  ...MEDICAL_BUSINESSES,
  ...AUTO_BUSINESSES,
  ...HOTEL_BUSINESSES,
  ...ENTERTAINMENT_BUSINESSES,
  ...STORAGE_BUSINESSES,
];

// ============ HELPER FUNCTIONS ============

export function getBusinessByName(name: string): BusinessRequirements | undefined {
  return ALL_BUSINESSES.find(b => b.name.toLowerCase() === name.toLowerCase());
}

export function getBusinessesByCategory(category: string): BusinessRequirements[] {
  return ALL_BUSINESSES.filter(b => b.category.toLowerCase() === category.toLowerCase());
}

export function getBusinessesThatFitLot(lotAcres: number, sqFt?: number): BusinessRequirements[] {
  return ALL_BUSINESSES.filter(b => {
    // Check lot size
    if (b.minLotAcres && lotAcres < b.minLotAcres * 0.8) return false;
    if (b.maxLotAcres && lotAcres > b.maxLotAcres * 2) return false;

    // Check sq ft if provided
    if (sqFt) {
      if (sqFt < b.minSqFt * 0.7) return false;
      if (sqFt > b.maxSqFt * 1.5) return false;
    }

    return true;
  });
}

export function getBusinessesForShoppingCenter(): BusinessRequirements[] {
  return ALL_BUSINESSES.filter(b => b.shoppingCenterOk);
}

export function getBusinessesThatNeedDriveThrough(): BusinessRequirements[] {
  return ALL_BUSINESSES.filter(b => b.driveThrough === 'required');
}

export function getNewConstructionOnlyBusinesses(): BusinessRequirements[] {
  return ALL_BUSINESSES.filter(b => b.constructionPreference === 'new_only');
}

export function getFlexibleBusinesses(): BusinessRequirements[] {
  return ALL_BUSINESSES.filter(b => b.constructionPreference === 'flexible' || b.constructionPreference === 'prefers_conversion');
}

export function assessDriveThroughFeasibility(
  lotAcres: number,
  hasCornerAccess: boolean,
  estimatedStackingSpace: number // in cars
): { feasible: boolean; notes: string } {
  if (lotAcres < 0.4) {
    return { feasible: false, notes: 'Lot too small for drive-through stacking' };
  }

  if (estimatedStackingSpace < 6) {
    return { feasible: false, notes: 'Insufficient stacking space (need 8-12 cars minimum for QSR)' };
  }

  if (!hasCornerAccess && lotAcres < 0.7) {
    return { feasible: false, notes: 'Single access point limits drive-through traffic flow' };
  }

  if (estimatedStackingSpace >= 12) {
    return { feasible: true, notes: 'Excellent drive-through potential with dual lane capability' };
  }

  if (estimatedStackingSpace >= 8) {
    return { feasible: true, notes: 'Good drive-through potential for single lane operation' };
  }

  return { feasible: true, notes: 'Marginal drive-through feasibility - may limit to lower volume concepts' };
}

export function getRecommendationsForSite(
  lotAcres: number,
  sqFt: number | null,
  isShoppingCenter: boolean,
  hasDriveThroughPotential: boolean,
  isNewConstruction: boolean,
  hasHighwayVisibility: boolean,
  hasCornerLot: boolean
): BusinessRequirements[] {
  let candidates = [...ALL_BUSINESSES];

  // Filter by shopping center compatibility
  if (isShoppingCenter) {
    candidates = candidates.filter(b => b.shoppingCenterOk);
  }

  // Filter by lot size
  candidates = candidates.filter(b => {
    if (b.minLotAcres && lotAcres < b.minLotAcres * 0.7) return false;
    return true;
  });

  // Filter by sq ft if provided
  if (sqFt) {
    candidates = candidates.filter(b => {
      if (sqFt < b.minSqFt * 0.6) return false;
      if (sqFt > b.maxSqFt * 2) return false;
      return true;
    });
  }

  // Filter by drive-through requirement
  if (!hasDriveThroughPotential) {
    candidates = candidates.filter(b => b.driveThrough !== 'required');
  }

  // Filter by construction preference
  if (!isNewConstruction) {
    candidates = candidates.filter(b => b.constructionPreference !== 'new_only');
  }

  // Boost corner lot businesses if applicable
  if (hasCornerLot) {
    candidates.sort((a, b) => {
      if (a.cornerLotPreferred && !b.cornerLotPreferred) return -1;
      if (!a.cornerLotPreferred && b.cornerLotPreferred) return 1;
      return 0;
    });
  }

  // Boost highway visibility businesses if applicable
  if (hasHighwayVisibility) {
    candidates.sort((a, b) => {
      if (a.highwayVisibility && !b.highwayVisibility) return -1;
      if (!a.highwayVisibility && b.highwayVisibility) return 1;
      return 0;
    });
  }

  return candidates;
}

// Construction preference labels for display
export const CONSTRUCTION_LABELS: Record<ConstructionPreference, string> = {
  'new_only': 'New Construction Only',
  'prefers_new': 'Prefers New Construction',
  'flexible': 'Flexible (New or Conversion)',
  'prefers_conversion': 'Prefers Existing Space'
};

// Space type labels for display
export const SPACE_TYPE_LABELS: Record<SpaceType, string> = {
  'freestanding': 'Freestanding Building',
  'end_cap': 'End Cap',
  'inline': 'Inline Retail',
  'anchor': 'Anchor Tenant',
  'junior_anchor': 'Junior Anchor',
  'pad_site': 'Pad Site',
  'kiosk': 'Kiosk/Small Format'
};
