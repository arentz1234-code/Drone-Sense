// Business type presets for property search filters
// Each preset defines ideal requirements for commercial site selection

export interface BusinessRequirement {
  label: string;
  description: string;
  minAcres: number;
  maxAcres: number;
  minVPD: number;
  zoning: string[];
  minRoadFrontage?: number;
  preferCornerLot?: boolean;
}

export const BUSINESS_REQUIREMENTS: Record<string, BusinessRequirement> = {
  'fast-food': {
    label: 'Fast Food Restaurant',
    description: 'Quick-service restaurant with drive-thru',
    minAcres: 0.5,
    maxAcres: 1.5,
    minVPD: 20000,
    zoning: ['C-1', 'C-2', 'CG', 'CR', 'CBD', 'MU', 'PD'],
    minRoadFrontage: 150,
    preferCornerLot: true,
  },
  'dollar-store': {
    label: 'Dollar Store',
    description: 'Discount retail store (Dollar General, Dollar Tree)',
    minAcres: 0.75,
    maxAcres: 2.0,
    minVPD: 10000,
    zoning: ['C-1', 'C-2', 'CG', 'CR', 'MU', 'PD'],
    minRoadFrontage: 100,
    preferCornerLot: false,
  },
  'gas-station': {
    label: 'Gas Station / Convenience Store',
    description: 'Fuel station with convenience retail',
    minAcres: 0.75,
    maxAcres: 2.5,
    minVPD: 25000,
    zoning: ['C-2', 'CG', 'CR', 'CBD', 'PD'],
    minRoadFrontage: 200,
    preferCornerLot: true,
  },
  'auto-dealer': {
    label: 'Auto Dealership',
    description: 'New or used car dealership',
    minAcres: 2.0,
    maxAcres: 10.0,
    minVPD: 15000,
    zoning: ['C-2', 'CG', 'I-1', 'PD'],
    minRoadFrontage: 300,
    preferCornerLot: false,
  },
  'medical': {
    label: 'Medical / Urgent Care',
    description: 'Medical office, clinic, or urgent care facility',
    minAcres: 0.5,
    maxAcres: 3.0,
    minVPD: 10000,
    zoning: ['C-1', 'C-2', 'CG', 'CR', 'MU', 'PD', 'O-1', 'O-2'],
    minRoadFrontage: 100,
    preferCornerLot: false,
  },
  'retail-center': {
    label: 'Retail Center / Strip Mall',
    description: 'Multi-tenant retail shopping center',
    minAcres: 2.0,
    maxAcres: 15.0,
    minVPD: 20000,
    zoning: ['C-2', 'CG', 'CR', 'CBD', 'MU', 'PD'],
    minRoadFrontage: 250,
    preferCornerLot: true,
  },
  'bank': {
    label: 'Bank Branch',
    description: 'Full-service bank with drive-thru',
    minAcres: 0.5,
    maxAcres: 1.5,
    minVPD: 15000,
    zoning: ['C-1', 'C-2', 'CG', 'CR', 'CBD', 'MU', 'PD'],
    minRoadFrontage: 150,
    preferCornerLot: true,
  },
  'pharmacy': {
    label: 'Pharmacy / Drugstore',
    description: 'Retail pharmacy (CVS, Walgreens)',
    minAcres: 0.75,
    maxAcres: 2.0,
    minVPD: 20000,
    zoning: ['C-1', 'C-2', 'CG', 'CR', 'CBD', 'MU', 'PD'],
    minRoadFrontage: 150,
    preferCornerLot: true,
  },
};

// Common zoning types for filter UI
export const ZONING_TYPES = [
  { code: 'C-1', label: 'C-1 - Neighborhood Commercial' },
  { code: 'C-2', label: 'C-2 - General Commercial' },
  { code: 'CG', label: 'CG - Commercial General' },
  { code: 'CR', label: 'CR - Commercial Regional' },
  { code: 'CBD', label: 'CBD - Central Business District' },
  { code: 'PD', label: 'PD - Planned Development' },
  { code: 'MU', label: 'MU - Mixed Use' },
  { code: 'I-1', label: 'I-1 - Light Industrial' },
  { code: 'I-2', label: 'I-2 - Heavy Industrial' },
  { code: 'O-1', label: 'O-1 - Office' },
  { code: 'O-2', label: 'O-2 - Office Park' },
];

// Helper to get business requirement by key
export function getBusinessRequirement(key: string): BusinessRequirement | null {
  return BUSINESS_REQUIREMENTS[key] || null;
}

// Helper to get all business type options for dropdown
export function getBusinessTypeOptions(): Array<{ value: string; label: string }> {
  return Object.entries(BUSINESS_REQUIREMENTS).map(([key, req]) => ({
    value: key,
    label: req.label,
  }));
}
