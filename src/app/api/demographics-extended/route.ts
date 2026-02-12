import { NextRequest, NextResponse } from 'next/server';

export interface ExtendedDemographicsResponse {
  // Base demographics fields (for direct access)
  population: number;
  medianHouseholdIncome: number;
  employmentRate: number;
  totalHouseholds: number;
  // Multi-radius data
  multiRadius: {
    oneMile: { population: number; households: number; medianIncome: number };
    threeMile: { population: number; households: number; medianIncome: number };
    fiveMile: { population: number; households: number; medianIncome: number };
  };
  growthTrend: number;
  consumerSpending: number;
  ageDistribution: { age: string; percent: number }[];
  educationLevels: { level: string; percent: number }[];
  incomeDistribution: { range: string; percent: number }[];
}

async function fetchCensusData(lat: number, lng: number): Promise<{
  population: number;
  households: number;
  medianIncome: number;
  ageData: { age: string; percent: number }[];
  educationData: { level: string; percent: number }[];
  incomeData: { range: string; percent: number; count?: number }[];
  consumerSpendingFromBrackets: number;
}> {
  try {
    // Get FIPS codes from coordinates
    const geoResponse = await fetch(
      `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&layers=10&format=json`
    );

    if (!geoResponse.ok) {
      throw new Error('Failed to get census geography');
    }

    const geoData = await geoResponse.json();
    // Try Census Tracts first, then fall back to Census Block Groups
    let geographies = geoData.result?.geographies?.['Census Tracts']?.[0];
    if (!geographies) {
      geographies = geoData.result?.geographies?.['Census Block Groups']?.[0];
    }

    if (!geographies) {
      // Return estimated data if census lookup fails
      console.log('Census geocoding: No geographies found');
      return getEstimatedData();
    }

    const state = geographies.STATE;
    const county = geographies.COUNTY;
    const tract = geographies.TRACT;

    // Fetch ACS 5-year data
    const censusApiKey = process.env.CENSUS_API_KEY || '';
    // Census API has a 50 variable limit per request
    // Focus on essentials: population, households, income, education, and income distribution
    const variables = [
      'B01003_001E', // Total population (index 0)
      'B11001_001E', // Total households (index 1)
      'B19013_001E', // Median household income (index 2)
      // Education (indices 3-12)
      'B15003_017E', // High school diploma
      'B15003_018E', // GED
      'B15003_019E', // Some college less than 1 year
      'B15003_020E', // Some college 1+ years no degree
      'B15003_021E', // Associate's degree
      'B15003_022E', // Bachelor's degree
      'B15003_023E', // Master's degree
      'B15003_024E', // Professional degree
      'B15003_025E', // Doctorate
      'B15003_001E', // Total 25+ (index 12)
      // Income Distribution - B19001 (indices 13-28)
      'B19001_002E', // Less than $10,000
      'B19001_003E', // $10,000 to $14,999
      'B19001_004E', // $15,000 to $19,999
      'B19001_005E', // $20,000 to $24,999
      'B19001_006E', // $25,000 to $29,999
      'B19001_007E', // $30,000 to $34,999
      'B19001_008E', // $35,000 to $39,999
      'B19001_009E', // $40,000 to $44,999
      'B19001_010E', // $45,000 to $49,999
      'B19001_011E', // $50,000 to $59,999
      'B19001_012E', // $60,000 to $74,999
      'B19001_013E', // $75,000 to $99,999
      'B19001_014E', // $100,000 to $124,999
      'B19001_015E', // $125,000 to $149,999
      'B19001_016E', // $150,000 to $199,999
      'B19001_017E', // $200,000 or more
    ].join(','); // Total: 29 variables

    const censusUrl = `https://api.census.gov/data/2022/acs/acs5?get=${variables}&for=tract:${tract}&in=state:${state}%20county:${county}${censusApiKey ? `&key=${censusApiKey}` : ''}`;

    const censusResponse = await fetch(censusUrl);

    if (!censusResponse.ok) {
      return getEstimatedData();
    }

    const censusData = await censusResponse.json();
    const values = censusData[1];

    const population = parseInt(values[0]) || 0;
    const households = parseInt(values[1]) || 0;
    const medianIncome = parseInt(values[2]) || 0;

    // Age distribution - estimated based on national averages with income adjustment
    // (Real age data would require additional API calls)
    const isYoungArea = medianIncome > 80000; // Higher income often indicates younger professional areas
    const ageData = isYoungArea ? [
      { age: 'Under 18', percent: 18 },
      { age: '18-24', percent: 12 },
      { age: '25-34', percent: 18 },
      { age: '35-44', percent: 16 },
      { age: '45-54', percent: 14 },
      { age: '55-64', percent: 12 },
      { age: '65+', percent: 10 },
    ] : [
      { age: 'Under 18', percent: 22 },
      { age: '18-24', percent: 10 },
      { age: '25-34', percent: 14 },
      { age: '35-44', percent: 13 },
      { age: '45-54', percent: 14 },
      { age: '55-64', percent: 13 },
      { age: '65+', percent: 14 },
    ];

    // Calculate education levels from real Census data (indices 3-12)
    const total25Plus = parseInt(values[12]) || 1;
    const highSchool = (parseInt(values[3]) || 0) + (parseInt(values[4]) || 0);
    const someCollege = (parseInt(values[5]) || 0) + (parseInt(values[6]) || 0);
    const associates = parseInt(values[7]) || 0;
    const bachelors = parseInt(values[8]) || 0;
    const graduate = (parseInt(values[9]) || 0) + (parseInt(values[10]) || 0) + (parseInt(values[11]) || 0);

    const educationData = [
      { level: 'High School', percent: Math.round((highSchool / total25Plus) * 100) },
      { level: 'Some College', percent: Math.round((someCollege / total25Plus) * 100) },
      { level: "Associate's", percent: Math.round((associates / total25Plus) * 100) },
      { level: "Bachelor's", percent: Math.round((bachelors / total25Plus) * 100) },
      { level: 'Graduate+', percent: Math.round((graduate / total25Plus) * 100) },
    ];

    // Parse real income distribution data from Census B19001 variables
    // Variables start at index 13 (after education variables)
    const incomeUnder10k = parseInt(values[13]) || 0;
    const income10to15k = parseInt(values[14]) || 0;
    const income15to20k = parseInt(values[15]) || 0;
    const income20to25k = parseInt(values[16]) || 0;
    const income25to30k = parseInt(values[17]) || 0;
    const income30to35k = parseInt(values[18]) || 0;
    const income35to40k = parseInt(values[19]) || 0;
    const income40to45k = parseInt(values[20]) || 0;
    const income45to50k = parseInt(values[21]) || 0;
    const income50to60k = parseInt(values[22]) || 0;
    const income60to75k = parseInt(values[23]) || 0;
    const income75to100k = parseInt(values[24]) || 0;
    const income100to125k = parseInt(values[25]) || 0;
    const income125to150k = parseInt(values[26]) || 0;
    const income150to200k = parseInt(values[27]) || 0;
    const income200kPlus = parseInt(values[28]) || 0;

    // Group into display ranges
    const totalHouseholdsForIncome = households || 1;
    const under25k = incomeUnder10k + income10to15k + income15to20k + income20to25k;
    const range25to50k = income25to30k + income30to35k + income35to40k + income40to45k + income45to50k;
    const range50to75k = income50to60k + income60to75k;
    const range75to100k = income75to100k;
    const range100to150k = income100to125k + income125to150k;
    const range150kPlus = income150to200k + income200kPlus;

    const incomeData = [
      { range: '<$25K', percent: Math.round((under25k / totalHouseholdsForIncome) * 100), count: under25k },
      { range: '$25K-$50K', percent: Math.round((range25to50k / totalHouseholdsForIncome) * 100), count: range25to50k },
      { range: '$50K-$75K', percent: Math.round((range50to75k / totalHouseholdsForIncome) * 100), count: range50to75k },
      { range: '$75K-$100K', percent: Math.round((range75to100k / totalHouseholdsForIncome) * 100), count: range75to100k },
      { range: '$100K-$150K', percent: Math.round((range100to150k / totalHouseholdsForIncome) * 100), count: range100to150k },
      { range: '$150K+', percent: Math.round((range150kPlus / totalHouseholdsForIncome) * 100), count: range150kPlus },
    ];

    // Calculate consumer spending from real income bracket data
    // Using BLS Consumer Expenditure Survey spending rates by income bracket
    const consumerSpendingFromBrackets = calculateRealConsumerSpending({
      under25k,
      range25to50k,
      range50to75k,
      range75to100k,
      range100to150k,
      range150kPlus,
    });

    return { population, households, medianIncome, ageData, educationData, incomeData, consumerSpendingFromBrackets };
  } catch (error) {
    console.error('Census API error:', error);
    return getEstimatedData();
  }
}

function getEstimatedData() {
  // Fallback with estimated data when Census API fails
  const estimatedHouseholds = 2000;
  const incomeData = estimateIncomeDistribution(55000);

  // Estimate consumer spending using average distribution
  const estimatedConsumerSpending = calculateRealConsumerSpending({
    under25k: Math.round(estimatedHouseholds * 0.15),
    range25to50k: Math.round(estimatedHouseholds * 0.22),
    range50to75k: Math.round(estimatedHouseholds * 0.23),
    range75to100k: Math.round(estimatedHouseholds * 0.18),
    range100to150k: Math.round(estimatedHouseholds * 0.14),
    range150kPlus: Math.round(estimatedHouseholds * 0.08),
  });

  return {
    population: 5000,
    households: estimatedHouseholds,
    medianIncome: 55000,
    ageData: [
      { age: 'Under 18', percent: 22 },
      { age: '18-24', percent: 10 },
      { age: '25-34', percent: 14 },
      { age: '35-44', percent: 13 },
      { age: '45-54', percent: 14 },
      { age: '55-64', percent: 13 },
      { age: '65+', percent: 14 },
    ],
    educationData: [
      { level: 'High School', percent: 28 },
      { level: 'Some College', percent: 21 },
      { level: "Associate's", percent: 8 },
      { level: "Bachelor's", percent: 20 },
      { level: 'Graduate+', percent: 12 },
    ],
    incomeData,
    consumerSpendingFromBrackets: estimatedConsumerSpending,
  };
}

function estimateIncomeDistribution(medianIncome: number): { range: string; percent: number }[] {
  // Estimate distribution based on median income
  const isHighIncome = medianIncome > 75000;
  const isLowIncome = medianIncome < 40000;

  if (isHighIncome) {
    return [
      { range: '<$25K', percent: 8 },
      { range: '$25K-$50K', percent: 15 },
      { range: '$50K-$75K', percent: 18 },
      { range: '$75K-$100K', percent: 22 },
      { range: '$100K-$150K', percent: 20 },
      { range: '$150K+', percent: 17 },
    ];
  } else if (isLowIncome) {
    return [
      { range: '<$25K', percent: 25 },
      { range: '$25K-$50K', percent: 30 },
      { range: '$50K-$75K', percent: 22 },
      { range: '$75K-$100K', percent: 12 },
      { range: '$100K-$150K', percent: 7 },
      { range: '$150K+', percent: 4 },
    ];
  }

  return [
    { range: '<$25K', percent: 15 },
    { range: '$25K-$50K', percent: 22 },
    { range: '$50K-$75K', percent: 23 },
    { range: '$75K-$100K', percent: 18 },
    { range: '$100K-$150K', percent: 14 },
    { range: '$150K+', percent: 8 },
  ];
}

// Consumer spending by income bracket based on BLS Consumer Expenditure Survey 2023 data
// These are average annual expenditures per household by income bracket
const BLS_SPENDING_BY_BRACKET = {
  under25k: 32000,      // Average spending for <$25K households
  range25to50k: 45000,  // Average spending for $25K-$50K households
  range50to75k: 58000,  // Average spending for $50K-$75K households
  range75to100k: 72000, // Average spending for $75K-$100K households
  range100to150k: 92000, // Average spending for $100K-$150K households
  range150kPlus: 135000, // Average spending for $150K+ households
};

function calculateRealConsumerSpending(incomeBrackets: {
  under25k: number;
  range25to50k: number;
  range50to75k: number;
  range75to100k: number;
  range100to150k: number;
  range150kPlus: number;
}): number {
  // Calculate total consumer spending based on household counts per bracket
  // multiplied by BLS average spending for that bracket
  const totalSpending =
    (incomeBrackets.under25k * BLS_SPENDING_BY_BRACKET.under25k) +
    (incomeBrackets.range25to50k * BLS_SPENDING_BY_BRACKET.range25to50k) +
    (incomeBrackets.range50to75k * BLS_SPENDING_BY_BRACKET.range50to75k) +
    (incomeBrackets.range75to100k * BLS_SPENDING_BY_BRACKET.range75to100k) +
    (incomeBrackets.range100to150k * BLS_SPENDING_BY_BRACKET.range100to150k) +
    (incomeBrackets.range150kPlus * BLS_SPENDING_BY_BRACKET.range150kPlus);

  return Math.round(totalSpending);
}

function scaleDataByRadius(baseData: Awaited<ReturnType<typeof fetchCensusData>>, radius: number) {
  // Scale population and households by radius (rough approximation)
  const scaleFactor = radius === 1 ? 1 : radius === 3 ? 4.5 : 10;
  return {
    population: Math.round(baseData.population * scaleFactor),
    households: Math.round(baseData.households * scaleFactor),
    medianIncome: baseData.medianIncome,
  };
}

function estimateGrowthTrend(medianIncome: number): number {
  // Estimate population growth trend based on income (proxy for economic health)
  if (medianIncome > 80000) return 2.5;
  if (medianIncome > 60000) return 1.8;
  if (medianIncome > 45000) return 1.2;
  return 0.5;
}

export async function POST(request: NextRequest) {
  try {
    const { lat, lng, radii = [1, 3, 5] } = await request.json();

    if (!lat || !lng) {
      return NextResponse.json({ error: 'Coordinates required' }, { status: 400 });
    }

    const baseData = await fetchCensusData(lat, lng);

    const multiRadius = {
      oneMile: scaleDataByRadius(baseData, 1),
      threeMile: scaleDataByRadius(baseData, 3),
      fiveMile: scaleDataByRadius(baseData, 5),
    };

    // Scale consumer spending by 3-mile radius factor (4.5x the single tract data)
    const scaledConsumerSpending = Math.round(baseData.consumerSpendingFromBrackets * 4.5);

    // Estimate employment rate based on income (higher income areas typically have higher employment)
    const estimatedEmploymentRate = baseData.medianIncome >= 75000 ? 96 :
      baseData.medianIncome >= 55000 ? 94 :
      baseData.medianIncome >= 40000 ? 92 : 89;

    const response: ExtendedDemographicsResponse = {
      // Base demographics fields for direct access
      population: multiRadius.oneMile.population,
      medianHouseholdIncome: baseData.medianIncome,
      employmentRate: estimatedEmploymentRate,
      totalHouseholds: multiRadius.oneMile.households,
      // Multi-radius data
      multiRadius,
      growthTrend: estimateGrowthTrend(baseData.medianIncome),
      consumerSpending: scaledConsumerSpending,
      ageDistribution: baseData.ageData,
      educationLevels: baseData.educationData,
      incomeDistribution: baseData.incomeData,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Extended demographics error:', error);
    return NextResponse.json({ error: 'Failed to fetch demographics data' }, { status: 500 });
  }
}
