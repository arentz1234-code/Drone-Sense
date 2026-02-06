import { NextRequest, NextResponse } from 'next/server';

export interface ExtendedDemographicsResponse {
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
  incomeData: { range: string; percent: number }[];
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
    const geographies = geoData.result?.geographies?.['Census Tracts']?.[0];

    if (!geographies) {
      // Return estimated data if census lookup fails
      return getEstimatedData();
    }

    const state = geographies.STATE;
    const county = geographies.COUNTY;
    const tract = geographies.TRACT;

    // Fetch ACS 5-year data
    const censusApiKey = process.env.CENSUS_API_KEY || '';
    const variables = [
      'B01003_001E', // Total population
      'B11001_001E', // Total households
      'B19013_001E', // Median household income
      // Age distribution
      'B01001_003E', // Male under 5
      'B01001_004E', // Male 5-9
      'B01001_005E', // Male 10-14
      'B01001_006E', // Male 15-17
      'B01001_007E', // Male 18-19
      'B01001_008E', // Male 20
      'B01001_009E', // Male 21
      'B01001_010E', // Male 22-24
      'B01001_011E', // Male 25-29
      'B01001_012E', // Male 30-34
      'B01001_013E', // Male 35-39
      'B01001_014E', // Male 40-44
      'B01001_015E', // Male 45-49
      'B01001_016E', // Male 50-54
      'B01001_017E', // Male 55-59
      'B01001_018E', // Male 60-61
      'B01001_019E', // Male 62-64
      'B01001_020E', // Male 65-66
      'B01001_021E', // Male 67-69
      'B01001_022E', // Male 70-74
      'B01001_023E', // Male 75-79
      'B01001_024E', // Male 80-84
      'B01001_025E', // Male 85+
      // Education
      'B15003_017E', // High school diploma
      'B15003_018E', // GED
      'B15003_019E', // Some college less than 1 year
      'B15003_020E', // Some college 1+ years no degree
      'B15003_021E', // Associate's degree
      'B15003_022E', // Bachelor's degree
      'B15003_023E', // Master's degree
      'B15003_024E', // Professional degree
      'B15003_025E', // Doctorate
      'B15003_001E', // Total 25+
    ].join(',');

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

    // Calculate age distribution (simplified)
    const totalPop = population || 1;
    const under18 = (parseInt(values[3]) || 0) + (parseInt(values[4]) || 0) + (parseInt(values[5]) || 0) + (parseInt(values[6]) || 0);
    const age18to24 = (parseInt(values[7]) || 0) + (parseInt(values[8]) || 0) + (parseInt(values[9]) || 0) + (parseInt(values[10]) || 0);
    const age25to34 = (parseInt(values[11]) || 0) + (parseInt(values[12]) || 0);
    const age35to44 = (parseInt(values[13]) || 0) + (parseInt(values[14]) || 0);
    const age45to54 = (parseInt(values[15]) || 0) + (parseInt(values[16]) || 0);
    const age55to64 = (parseInt(values[17]) || 0) + (parseInt(values[18]) || 0) + (parseInt(values[19]) || 0);
    const age65plus = (parseInt(values[20]) || 0) + (parseInt(values[21]) || 0) + (parseInt(values[22]) || 0) + (parseInt(values[23]) || 0) + (parseInt(values[24]) || 0) + (parseInt(values[25]) || 0);

    const ageData = [
      { age: 'Under 18', percent: Math.round((under18 / totalPop) * 100) },
      { age: '18-24', percent: Math.round((age18to24 / totalPop) * 100) },
      { age: '25-34', percent: Math.round((age25to34 / totalPop) * 100) },
      { age: '35-44', percent: Math.round((age35to44 / totalPop) * 100) },
      { age: '45-54', percent: Math.round((age45to54 / totalPop) * 100) },
      { age: '55-64', percent: Math.round((age55to64 / totalPop) * 100) },
      { age: '65+', percent: Math.round((age65plus / totalPop) * 100) },
    ];

    // Calculate education levels
    const total25Plus = parseInt(values[35]) || 1;
    const highSchool = (parseInt(values[26]) || 0) + (parseInt(values[27]) || 0);
    const someCollege = (parseInt(values[28]) || 0) + (parseInt(values[29]) || 0);
    const associates = parseInt(values[30]) || 0;
    const bachelors = parseInt(values[31]) || 0;
    const graduate = (parseInt(values[32]) || 0) + (parseInt(values[33]) || 0) + (parseInt(values[34]) || 0);

    const educationData = [
      { level: 'High School', percent: Math.round((highSchool / total25Plus) * 100) },
      { level: 'Some College', percent: Math.round((someCollege / total25Plus) * 100) },
      { level: "Associate's", percent: Math.round((associates / total25Plus) * 100) },
      { level: "Bachelor's", percent: Math.round((bachelors / total25Plus) * 100) },
      { level: 'Graduate+', percent: Math.round((graduate / total25Plus) * 100) },
    ];

    // Estimate income distribution based on median
    const incomeData = estimateIncomeDistribution(medianIncome);

    return { population, households, medianIncome, ageData, educationData, incomeData };
  } catch (error) {
    console.error('Census API error:', error);
    return getEstimatedData();
  }
}

function getEstimatedData() {
  return {
    population: 5000,
    households: 2000,
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
    incomeData: estimateIncomeDistribution(55000),
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

function estimateConsumerSpending(medianIncome: number, households: number): number {
  // Consumer spending estimate based on income and households
  const spendingRate = 0.65; // Households typically spend 65% of income
  return Math.round(medianIncome * spendingRate * households);
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

    const response: ExtendedDemographicsResponse = {
      multiRadius,
      growthTrend: estimateGrowthTrend(baseData.medianIncome),
      consumerSpending: estimateConsumerSpending(baseData.medianIncome, multiRadius.threeMile.households),
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
