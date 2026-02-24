// Re-export demographics types
export * from './demographics';

// Business types
export interface Business {
  name: string;
  type: string;
  distance: string;
  address: string;
}

// Traffic types
export interface TrafficInfo {
  estimatedVPD: number;
  vpdRange: string;
  vpdSource?: string;
  roadType: string;
  trafficLevel: string;
  congestionPercent: number;
  currentSpeed?: number;
  freeFlowSpeed?: number;
  roads?: Array<{ roadName: string; vpd: number; year: number }>;
  hasMultipleRoads?: boolean;
  averageVPD?: number;
}

// Access point types (for parcel boundary road intersections)
export interface AccessPoint {
  coordinates: [number, number]; // [lat, lng]
  roadName: string;
  type: 'entrance' | 'exit' | 'access';
  roadType?: string; // OSM highway type (primary, secondary, residential, etc.)
  distance?: number; // Distance from parcel boundary in meters
  vpd?: number; // Official VPD from FDOT if available
  vpdYear?: number; // Year of VPD count
  vpdSource?: 'fdot' | 'estimated'; // Source of VPD data
  estimatedVpd?: number; // Estimated VPD based on road classification
}

// Top recommendation type (ranked by score)
export interface TopRecommendation {
  name: string;
  category: string;
  score: number;
}

// Business suitability types
export interface BusinessSuitability {
  category: string;
  suitabilityScore: number;
  reasoning: string;
  examples: string[];
  existingInArea?: string[];
  lotSizeIssue?: string;
}

// Retailer match types
export interface RetailerMatch {
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

export interface RetailerMatchResult {
  matches: RetailerMatch[];
  totalMatches: number;
  totalRetailersInDatabase?: number;
}

// Feasibility score types
export interface FeasibilityScore {
  overall: number;
  breakdown: {
    trafficScore: number;
    demographicsScore: number;
    competitionScore: number;
    accessScore: number;
    environmentalScore: number;
    marketScore: number;
    economicScore: number;
    siteScore: number;
    // Enhanced scores from new data sources
    walkabilityScore: number;
    safetyScore: number;
    developmentScore: number;
    saturationScore: number;
  };
  details: {
    traffic: string;
    demographics: string;
    competition: string;
    access: string;
    environmental: string;
    market: string;
    economic: string;
    site: string;
    // Enhanced details from new data sources
    walkability: string;
    safety: string;
    development: string;
    saturation: string;
  };
  rating: 'Excellent' | 'Good' | 'Fair' | 'Poor';
}

// Analysis result types
export interface AnalysisResult {
  viabilityScore: number;
  feasibilityScore?: FeasibilityScore;
  terrain: string;
  accessibility: string;
  existingStructures: string;
  vegetation: string;
  lotSizeEstimate: string;
  businessRecommendation: string;
  constructionPotential: string;
  keyFindings: string[];
  recommendations: string[];
  businessSuitability?: BusinessSuitability[];
  topRecommendations?: TopRecommendation[];
  retailerMatches?: RetailerMatchResult;
  districtType?: string;
  districtDescription?: string;
  downtownRecommendations?: {
    dining: string[];
    retail: string[];
    services: string[];
    entertainment: string[];
  };
}

// Extended demographics (combines base with multi-radius)
import { DemographicsData } from './demographics';

export interface ExtendedDemographics extends DemographicsData {
  multiRadius?: {
    oneMile: { population: number; households: number };
    threeMile: { population: number; households: number };
    fiveMile: { population: number; households: number };
  };
  growthTrend?: number;
  consumerSpending?: number;
  ageDistribution?: { age: string; percent: number }[];
  educationLevels?: { level: string; percent: number }[];
  incomeDistribution?: { range: string; percent: number }[];
}

// Environmental risk types
export interface EnvironmentalRisk {
  floodZone: { zone: string; risk: 'low' | 'medium' | 'high'; description: string };
  wetlands: { present: boolean; distance?: number; types?: string[] };
  brownfields: { present: boolean; count: number; sites?: { name: string; distance: number; status: string }[] };
  superfund: { present: boolean; count: number; sites?: { name: string; distance: number; status: string }[] };
  overallRiskScore: number;
  riskFactors?: string[];
}

// Market comp types
export interface MarketComp {
  address: string;
  salePrice: number;
  saleDate: string;
  sqft: number;
  pricePerSqft: number;
  distance: string;
  propertyType: string;
  assetClass?: string; // e.g., Retail, Office, Industrial, Mixed-Use
  yearBuilt?: number;
  lotSize?: number;
  coordinates?: { lat: number; lng: number }; // Location for map display
}

// Selected parcel types
export interface SelectedParcel {
  boundaries: Array<[number, number][]>;
  parcelInfo: {
    apn?: string;
    owner?: string;
    address?: string;
    acres?: number;
    sqft?: number;
    zoning?: string;
    landUse?: string;
  } | null;
  coordinates: { lat: number; lng: number };
  isConfirmed: boolean;
}

// Property photo types
export interface PropertyPhoto {
  url: string;
  label: string;
  type: 'streetView' | 'aerial' | 'map' | 'mapillary' | 'county';
  available: boolean;
}

// Location intelligence types
export interface LocationIntelligence {
  // Opportunity Zone data
  opportunityZone: {
    isInZone: boolean;
    tractId?: string;
    designation?: string; // 'Low-Income Community' | 'Contiguous'
    investmentBenefits?: string[];
  };
  // Daytime population (workers vs residents)
  daytimePopulation: {
    totalWorkers: number; // People who work in this area
    totalResidents: number; // People who live in this area
    workerToResidentRatio: number; // >1 means more workers than residents (commercial area)
    populationType: 'commercial' | 'residential' | 'mixed'; // Based on ratio
    topIndustries?: { industry: string; workers: number }[];
  };
  // Highway/Interstate access
  highwayAccess: {
    nearestHighway: string; // e.g., "I-10", "US-90"
    distanceMiles: number;
    driveTimeMinutes?: number;
    interchangeName?: string;
    hasDirectAccess: boolean; // Within 0.5 miles
  };
}

// Walk Score types
export interface WalkScoreData {
  walkScore: number;
  walkDescription: string;
  transitScore: number | null;
  transitDescription: string | null;
  bikeScore: number | null;
  bikeDescription: string | null;
  pedestrianFriendly: boolean;
  transitAccessible: boolean;
  retailViability: 'excellent' | 'good' | 'fair' | 'poor';
  recommendations: string[];
}

// Crime data types
export interface CrimeData {
  safetyScore: number;
  safetyGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  crimeIndex: number;
  violentCrimeRate: number;
  propertyCrimeRate: number;
  totalCrimeRate: number;
  vsNationalAverage: 'lower' | 'average' | 'higher' | 'much higher';
  vsStateAverage: 'lower' | 'average' | 'higher' | 'much higher';
  businessImpact: {
    insurancePremiumImpact: 'low' | 'moderate' | 'high';
    securityRecommendations: string[];
    operationalConsiderations: string[];
  };
  dataYear: number;
  jurisdiction: string;
  source: string;
}

// Building permits types
export interface BuildingPermitsData {
  currentYear: {
    year: number;
    totalUnits: number;
    singleFamily: number;
    multiFamilyUnits: number;
    totalValue: number;
  };
  previousYear: {
    year: number;
    totalUnits: number;
    singleFamily: number;
    multiFamilyUnits: number;
    totalValue: number;
  };
  yoyChange: {
    unitsPercent: number;
    valuePercent: number;
    trend: 'growing' | 'stable' | 'declining';
  };
  developmentMomentum: number;
  momentumDescription: string;
  marketAnalysis: {
    constructionActivity: 'high' | 'moderate' | 'low';
    newCompetitionRisk: 'high' | 'moderate' | 'low';
    populationGrowthSignal: 'strong' | 'moderate' | 'weak';
    recommendations: string[];
  };
  jurisdiction: string;
  jurisdictionType: 'county' | 'metro' | 'state';
  source: string;
}

// Isochrone types
export interface IsochronePolygon {
  timeMinutes: number;
  coordinates: Array<[number, number]>;
  areaSquareMiles: number;
}

export interface IsochroneData {
  polygons: {
    fiveMinute: IsochronePolygon;
    tenMinute: IsochronePolygon;
    fifteenMinute: IsochronePolygon;
  };
  origin: { lat: number; lng: number };
  tradeAreaAnalysis: {
    fiveMinute: { estimatedPopulation: number; estimatedHouseholds: number };
    tenMinute: { estimatedPopulation: number; estimatedHouseholds: number };
    fifteenMinute: { estimatedPopulation: number; estimatedHouseholds: number };
  };
  radiusComparison: {
    fiveMinuteEquivalentMiles: number;
    tenMinuteEquivalentMiles: number;
    fifteenMinuteEquivalentMiles: number;
    urbanDensity: 'urban' | 'suburban' | 'rural';
  };
  trafficContext: string;
  source: string;
}

// Vacancy / Market saturation types
export interface VacancyData {
  marketSaturationScore: number;
  saturationLevel: 'undersupplied' | 'balanced' | 'saturated' | 'oversupplied';
  establishments: {
    total: number;
    perCapita: number;
    vsNationalAverage: number;
  };
  sectors: {
    retail: { count: number; perCapita: number; saturation: 'low' | 'medium' | 'high' };
    foodService: { count: number; perCapita: number; saturation: 'low' | 'medium' | 'high' };
    healthcare: { count: number; perCapita: number; saturation: 'low' | 'medium' | 'high' };
    professional: { count: number; perCapita: number; saturation: 'low' | 'medium' | 'high' };
    finance: { count: number; perCapita: number; saturation: 'low' | 'medium' | 'high' };
  };
  opportunities: {
    undersuppliedSectors: string[];
    oversuppliedSectors: string[];
    recommendations: string[];
  };
  jurisdiction: string;
  population: number;
  year: number;
  source: string;
}

// Property data (for saving/loading)
export interface PropertyData {
  images: string[];
  address: string;
  coordinates: { lat: number; lng: number } | null;
  businesses: Business[];
  trafficData: TrafficInfo | null;
  demographicsData: ExtendedDemographics | null;
  analysis: AnalysisResult | null;
  environmentalRisk: EnvironmentalRisk | null;
  marketComps: MarketComp[] | null;
  selectedParcel?: SelectedParcel | null;
  locationIntelligence?: LocationIntelligence | null;
  // New data sources
  walkScore?: WalkScoreData | null;
  crimeData?: CrimeData | null;
  buildingPermits?: BuildingPermitsData | null;
  isochrone?: IsochroneData | null;
  vacancyData?: VacancyData | null;
}
