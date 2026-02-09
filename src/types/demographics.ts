export interface NearbyUniversity {
  name: string;
  enrollment: number;
  city: string;
  state: string;
  distance?: number;
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
  // Nearby university data (from College Scorecard)
  nearbyUniversities?: NearbyUniversity[];
  totalNearbyUniversityEnrollment?: number;
  // Consumer spending indicators
  consumerProfile: {
    type: string;
    description: string;
    preferredBusinesses: string[];
  };
}
