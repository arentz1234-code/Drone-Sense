import { NextResponse } from 'next/server';

interface DemographicsRequest {
  coordinates: { lat: number; lng: number };
}

export interface DemographicsData {
  population: number;
  medianHouseholdIncome: number;
  perCapitaIncome: number;
  incomeLevel: 'low' | 'moderate' | 'middle' | 'upper-middle' | 'high';
  povertyRate: number;
  medianAge: number;
  householdSize: number;
  educationBachelorsOrHigher: number;
  employmentRate: number;
  totalHouseholds: number;
  ownerOccupiedHousing: number;
  renterOccupiedHousing: number;
  source: string;
  tractId?: string;
  // College town indicators
  isCollegeTown: boolean;
  collegeEnrollment: number;
  collegeEnrollmentPercent: number;
  // Consumer spending indicators
  consumerProfile: {
    type: string;
    description: string;
    preferredBusinesses: string[];
  };
}

// Get FIPS codes from coordinates using Census Bureau Geocoder API
async function getGeographyFromCoords(lat: number, lng: number): Promise<{
  stateCode: string;
  countyCode: string;
  tractCode: string;
} | null> {
  try {
    // Census Bureau's geocoder is more reliable than FCC API
    const url = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&layers=Census%20Tracts&format=json`;
    const response = await fetch(url);

    if (!response.ok) return null;

    const data = await response.json();

    // Extract from Census Tracts layer
    const tracts = data.result?.geographies?.['Census Tracts'];
    if (!tracts || tracts.length === 0) return null;

    const tract = tracts[0];
    return {
      stateCode: tract.STATE,
      countyCode: tract.COUNTY,
      tractCode: tract.TRACT,
    };
  } catch (error) {
    console.error('Census Geocoder API error:', error);
    return null;
  }
}

// Fetch demographics from Census API
async function fetchCensusData(
  stateCode: string,
  countyCode: string,
  tractCode: string
): Promise<DemographicsData | null> {
  try {
    // American Community Survey 5-Year Estimates
    // Variables: https://api.census.gov/data/2022/acs/acs5/variables.html
    const variables = [
      'B01003_001E', // Total Population
      'B19013_001E', // Median Household Income
      'B19301_001E', // Per Capita Income
      'B17001_002E', // Population below poverty level
      'B01002_001E', // Median Age
      'B25010_001E', // Average Household Size
      'B15003_022E', // Bachelor's degree
      'B15003_023E', // Master's degree
      'B15003_024E', // Professional degree
      'B15003_025E', // Doctorate degree
      'B15003_001E', // Total population 25+ (for education %)
      'B23025_004E', // Employed population
      'B23025_003E', // Civilian labor force
      'B11001_001E', // Total Households
      'B25003_002E', // Owner-occupied housing
      'B25003_003E', // Renter-occupied housing
      'B14001_008E', // Enrolled in college undergraduate
      'B14001_009E', // Enrolled in graduate/professional school
    ].join(',');

    const url = `https://api.census.gov/data/2022/acs/acs5?get=${variables}&for=tract:${tractCode}&in=state:${stateCode}%20county:${countyCode}`;

    console.log('Census API URL:', url);
    const response = await fetch(url);

    if (!response.ok) {
      console.log('Census API not ok:', response.status);
      // Try 2021 data if 2022 not available
      const url2021 = url.replace('/2022/', '/2021/');
      const response2021 = await fetch(url2021);
      if (!response2021.ok) return null;
      const data = await response2021.json();
      return parseCensusData(data, stateCode, countyCode, tractCode);
    }

    const data = await response.json();
    return parseCensusData(data, stateCode, countyCode, tractCode);
  } catch (error) {
    console.error('Census API error:', error);
    return null;
  }
}

function parseCensusData(
  data: string[][],
  stateCode: string,
  countyCode: string,
  tractCode: string
): DemographicsData | null {
  if (!data || data.length < 2) return null;

  // First row is headers, second row is data
  const values = data[1].map(v => (v === null || v === '-' || v === '') ? 0 : parseInt(v, 10));

  const population = values[0] || 0;
  const medianHouseholdIncome = values[1] || 0;
  const perCapitaIncome = values[2] || 0;
  const povertyPopulation = values[3] || 0;
  const medianAge = values[4] || 0;
  const householdSize = values[5] || 0;
  const bachelors = values[6] || 0;
  const masters = values[7] || 0;
  const professional = values[8] || 0;
  const doctorate = values[9] || 0;
  const totalEducation = values[10] || 1;
  const employed = values[11] || 0;
  const laborForce = values[12] || 1;
  const totalHouseholds = values[13] || 0;
  const ownerOccupied = values[14] || 0;
  const renterOccupied = values[15] || 0;
  const collegeUndergrad = values[16] || 0;
  const collegeGrad = values[17] || 0;

  const povertyRate = population > 0 ? (povertyPopulation / population) * 100 : 0;
  const educationBachelorsOrHigher = ((bachelors + masters + professional + doctorate) / totalEducation) * 100;
  const employmentRate = (employed / laborForce) * 100;

  // College enrollment calculations
  const collegeEnrollment = collegeUndergrad + collegeGrad;
  const collegeEnrollmentPercent = population > 0 ? (collegeEnrollment / population) * 100 : 0;
  const renterPercent = totalHouseholds > 0 ? (renterOccupied / totalHouseholds) * 100 : 0;

  // Detect college town: need BOTH high percentage AND significant absolute numbers
  // A census tract with 400 students isn't a college town market even if it's 25% of the tract
  // True college towns have thousands of students creating real market demand
  const hasSignificantStudentCount = collegeEnrollment >= 1500; // Minimum students to matter
  const hasHighStudentPercent = collegeEnrollmentPercent >= 18;
  const hasVeryYoungPopulation = medianAge < 25;
  const hasMostlyRenters = renterPercent >= 65;

  // Must have significant student count PLUS other signals
  const isCollegeTown = hasSignificantStudentCount && (
    hasHighStudentPercent ||
    (collegeEnrollmentPercent >= 12 && hasVeryYoungPopulation && hasMostlyRenters)
  );

  // Determine income level
  let incomeLevel: 'low' | 'moderate' | 'middle' | 'upper-middle' | 'high';
  if (medianHouseholdIncome < 35000) {
    incomeLevel = 'low';
  } else if (medianHouseholdIncome < 55000) {
    incomeLevel = 'moderate';
  } else if (medianHouseholdIncome < 85000) {
    incomeLevel = 'middle';
  } else if (medianHouseholdIncome < 125000) {
    incomeLevel = 'upper-middle';
  } else {
    incomeLevel = 'high';
  }

  // Determine consumer profile - use college town profile if detected
  const consumerProfile = isCollegeTown
    ? getCollegeTownProfile(medianAge, collegeEnrollmentPercent)
    : getConsumerProfile(medianHouseholdIncome, educationBachelorsOrHigher, medianAge);

  return {
    population,
    medianHouseholdIncome,
    perCapitaIncome,
    incomeLevel,
    povertyRate: Math.round(povertyRate * 10) / 10,
    medianAge,
    householdSize: Math.round(householdSize * 10) / 10,
    educationBachelorsOrHigher: Math.round(educationBachelorsOrHigher * 10) / 10,
    employmentRate: Math.round(employmentRate * 10) / 10,
    totalHouseholds,
    ownerOccupiedHousing: Math.round((ownerOccupied / (totalHouseholds || 1)) * 100),
    renterOccupiedHousing: Math.round((renterOccupied / (totalHouseholds || 1)) * 100),
    source: 'US Census ACS 5-Year Estimates',
    tractId: `${stateCode}${countyCode}${tractCode}`,
    isCollegeTown,
    collegeEnrollment,
    collegeEnrollmentPercent: Math.round(collegeEnrollmentPercent * 10) / 10,
    consumerProfile,
  };
}

// College town consumer profile - students have different spending patterns
function getCollegeTownProfile(
  medianAge: number,
  studentPercent: number
): { type: string; description: string; preferredBusinesses: string[] } {
  // Large university town (very high student concentration)
  if (studentPercent >= 25 || medianAge < 24) {
    return {
      type: 'College Town - Major University',
      description: 'High student population with strong parent-funded spending power. Students spend on food, entertainment, and convenience despite low personal income.',
      preferredBusinesses: [
        // Fast casual favorites for students
        "Chick-fil-A",
        "Chipotle",
        "Raising Cane's",
        "Wingstop",
        "Buffalo Wild Wings",
        "Moe's Southwest Grill",
        "Panda Express",
        "Five Guys",
        "Shake Shack",
        "Blaze Pizza",
        // Coffee & study spots
        "Starbucks",
        "Dunkin'",
        "Panera Bread",
        "McAlister's Deli",
        // Late night & delivery
        "Domino's",
        "Papa John's",
        "Jimmy John's",
        "Insomnia Cookies",
        "Waffle House",
        "Cookout",
        "Taco Bell",
        // Student services
        "Planet Fitness",
        "Student housing",
        "Phone repair shops",
        "Print/copy shops",
        "Urgent care clinics",
        // Retail
        "Target",
        "TJ Maxx",
        "Five Below",
        "GameStop",
        "Vape shops",
        // Bars & nightlife
        "Sports bars",
        "Brewpubs",
        "Late-night eateries",
      ],
    };
  }

  // Moderate college town
  return {
    type: 'College Town',
    description: 'Significant student population mixed with permanent residents. Blend of student-oriented and family businesses thrive.',
    preferredBusinesses: [
      // Fast casual
      "Chick-fil-A",
      "Chipotle",
      "Panera Bread",
      "Zaxby's",
      "Wingstop",
      "McAlister's Deli",
      "Newk's Eatery",
      // Quick service
      "Starbucks",
      "Dunkin'",
      "McDonald's",
      "Chili's",
      "Applebee's",
      // Student-friendly retail
      "Target",
      "Walmart",
      "Kroger/Publix",
      "ALDI",
      "Planet Fitness",
      "Great Clips",
      // Services
      "Urgent care",
      "CVS/Walgreens",
      "Banks with student accounts",
    ],
  };
}

function getConsumerProfile(
  income: number,
  education: number,
  age: number
): { type: string; description: string; preferredBusinesses: string[] } {
  // Value-focused consumers (lower income)
  if (income < 40000) {
    return {
      type: 'Value-Focused',
      description: 'Price-sensitive consumers who prioritize value and deals',
      preferredBusinesses: [
        'Dollar General',
        'Dollar Tree',
        'Family Dollar',
        "Hardee's",
        'Waffle House',
        "Zaxby's",
        "Little Caesars",
        "Checkers/Rally's",
        'Save-A-Lot',
        'ALDI',
        'Rent-A-Center',
        'Cash advance/Payday loans',
        'AutoZone',
        "O'Reilly Auto Parts",
      ],
    };
  }

  // Working class consumers (moderate income)
  if (income < 60000) {
    return {
      type: 'Working Class',
      description: 'Middle-income families seeking quality and value balance',
      preferredBusinesses: [
        'Walmart',
        'Kroger',
        "McDonald's",
        "Wendy's",
        'Taco Bell',
        "Arby's",
        "Cracker Barrel",
        'IHOP',
        "Applebee's",
        "Chili's",
        'Planet Fitness',
        'Great Clips',
        'Advance Auto Parts',
      ],
    };
  }

  // Middle class consumers
  if (income < 90000) {
    return {
      type: 'Middle Class',
      description: 'Comfortable consumers balancing quality with budget',
      preferredBusinesses: [
        'Target',
        'Publix',
        "Chick-fil-A",
        "Panera Bread",
        'Chipotle',
        "Olive Garden",
        'Red Lobster',
        'Texas Roadhouse',
        "BJ's Restaurant",
        'HomeGoods',
        'Marshalls',
        'LA Fitness',
        'Sport Clips',
        'Jiffy Lube',
      ],
    };
  }

  // Upper-middle class consumers
  if (income < 150000) {
    return {
      type: 'Upper-Middle Class',
      description: 'Quality-focused consumers willing to pay for premium experiences',
      preferredBusinesses: [
        'Whole Foods',
        'Trader Joes',
        'Starbucks',
        "Cava",
        'Sweetgreen',
        'The Cheesecake Factory',
        'P.F. Changs',
        'Seasons 52',
        'Lifetime Fitness',
        'Orangetheory',
        'Massage Envy',
        'European Wax Center',
        'Tesla Service Center',
      ],
    };
  }

  // Affluent consumers
  return {
    type: 'Affluent',
    description: 'Premium consumers seeking luxury and exclusive experiences',
    preferredBusinesses: [
      'Whole Foods',
      'Fresh Market',
      'Starbucks Reserve',
      'Capital Grille',
      "Ruth's Chris",
      'Fleming\'s',
      'Equinox',
      'SoulCycle',
      'Drybar',
      'Nordstrom',
      'Neiman Marcus',
      'Tesla Showroom',
      'BMW/Mercedes dealership',
    ],
  };
}

export async function POST(request: Request) {
  try {
    const body: DemographicsRequest = await request.json();
    const { coordinates } = body;

    if (!coordinates) {
      return NextResponse.json({ error: 'No coordinates provided' }, { status: 400 });
    }

    const { lat, lng } = coordinates;
    console.log(`Fetching demographics for: ${lat}, ${lng}`);

    // Get census geography codes from coordinates
    const geography = await getGeographyFromCoords(lat, lng);

    if (!geography) {
      return NextResponse.json({
        error: 'Could not determine census tract for this location',
        message: 'Demographics data is only available for US locations',
      }, { status: 404 });
    }

    console.log('Geography:', geography);

    // Fetch census data
    const demographics = await fetchCensusData(
      geography.stateCode,
      geography.countyCode,
      geography.tractCode
    );

    if (!demographics) {
      return NextResponse.json({
        error: 'Could not fetch census data',
        message: 'Census data may not be available for this tract',
      }, { status: 404 });
    }

    return NextResponse.json(demographics);

  } catch (error) {
    console.error('Demographics API error:', error);
    return NextResponse.json({
      error: 'Failed to fetch demographics data',
      message: String(error),
    }, { status: 500 });
  }
}
