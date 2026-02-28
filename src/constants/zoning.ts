export interface ZoningInfo {
  color: string;
  label: string;
  category: string;
  allowedUses: string[];
  description: string;
}

export const ZONING_DATA: Record<string, ZoningInfo> = {
  // Commercial (Blues)
  'C-1': {
    color: '#3B82F6',
    label: 'Neighborhood Commercial',
    category: 'Commercial',
    description: 'Small-scale retail and service businesses serving nearby residential areas',
    allowedUses: ['Retail stores', 'Restaurants', 'Personal services', 'Banks', 'Medical offices', 'Pharmacies'],
  },
  'C-2': {
    color: '#2563EB',
    label: 'General Commercial',
    category: 'Commercial',
    description: 'Wide range of retail, service, and entertainment uses with moderate intensity',
    allowedUses: ['Retail stores', 'Restaurants', 'Hotels', 'Auto services', 'Entertainment venues', 'Office buildings', 'Banks', 'Medical facilities'],
  },
  'C-3': {
    color: '#1D4ED8',
    label: 'Highway Commercial',
    category: 'Commercial',
    description: 'Auto-oriented commercial uses along major highways and arterials',
    allowedUses: ['Gas stations', 'Auto dealerships', 'Big-box retail', 'Fast food', 'Hotels', 'Truck stops', 'Shopping centers'],
  },
  'CC': {
    color: '#1E40AF',
    label: 'Community Commercial',
    category: 'Commercial',
    description: 'Regional shopping centers serving multiple neighborhoods',
    allowedUses: ['Shopping centers', 'Department stores', 'Restaurants', 'Entertainment', 'Professional offices', 'Banks'],
  },
  'CN': {
    color: '#60A5FA',
    label: 'Commercial Neighborhood',
    category: 'Commercial',
    description: 'Small-scale neighborhood retail and services',
    allowedUses: ['Convenience stores', 'Cafes', 'Dry cleaners', 'Small offices', 'Personal services'],
  },
  'CG': {
    color: '#2563EB',
    label: 'Commercial General',
    category: 'Commercial',
    description: 'General commercial uses including retail and services',
    allowedUses: ['Retail', 'Restaurants', 'Services', 'Office', 'Entertainment'],
  },
  'MU': {
    color: '#8B5CF6',
    label: 'Mixed Use',
    category: 'Mixed-Use',
    description: 'Combination of residential, commercial, and office uses in one development',
    allowedUses: ['Retail', 'Restaurants', 'Apartments', 'Condos', 'Office space', 'Live/work units', 'Entertainment'],
  },
  'MXD': {
    color: '#8B5CF6',
    label: 'Mixed Use Development',
    category: 'Mixed-Use',
    description: 'Integrated mixed-use development district',
    allowedUses: ['Retail', 'Office', 'Residential', 'Hotels', 'Entertainment', 'Restaurants'],
  },

  // Industrial (Oranges)
  'M-1': {
    color: '#F97316',
    label: 'Light Industrial',
    category: 'Industrial',
    description: 'Light manufacturing, warehousing, and distribution with limited outdoor operations',
    allowedUses: ['Warehouses', 'Distribution centers', 'Light manufacturing', 'Flex space', 'Research facilities', 'Wholesale'],
  },
  'M-2': {
    color: '#EA580C',
    label: 'Heavy Industrial',
    category: 'Industrial',
    description: 'Heavy manufacturing and processing with significant outdoor operations',
    allowedUses: ['Heavy manufacturing', 'Processing plants', 'Foundries', 'Refineries', 'Bulk storage', 'Trucking terminals'],
  },
  'I': {
    color: '#C2410C',
    label: 'Industrial',
    category: 'Industrial',
    description: 'General industrial uses including manufacturing and warehousing',
    allowedUses: ['Manufacturing', 'Warehousing', 'Distribution', 'Industrial services'],
  },
  'I-1': {
    color: '#F97316',
    label: 'Light Industrial',
    category: 'Industrial',
    description: 'Light industrial and warehouse uses',
    allowedUses: ['Warehouses', 'Light manufacturing', 'Flex space', 'Distribution'],
  },
  'I-2': {
    color: '#EA580C',
    label: 'General Industrial',
    category: 'Industrial',
    description: 'General industrial and manufacturing uses',
    allowedUses: ['Manufacturing', 'Processing', 'Warehousing', 'Heavy equipment'],
  },
  'IP': {
    color: '#F59E0B',
    label: 'Industrial Park',
    category: 'Industrial',
    description: 'Planned industrial development with landscaping and design standards',
    allowedUses: ['Light manufacturing', 'Warehouses', 'Office/warehouse', 'R&D facilities', 'Flex space'],
  },

  // Residential (Greens)
  'R-1': {
    color: '#22C55E',
    label: 'Single Family Residential',
    category: 'Residential',
    description: 'Low-density single-family detached homes',
    allowedUses: ['Single-family homes', 'Home occupations', 'Accessory structures'],
  },
  'R-2': {
    color: '#16A34A',
    label: 'Low-Density Multi-Family',
    category: 'Residential',
    description: 'Duplexes, townhomes, and low-rise apartments',
    allowedUses: ['Duplexes', 'Townhomes', 'Small apartments', 'Single-family homes'],
  },
  'R-3': {
    color: '#15803D',
    label: 'High-Density Multi-Family',
    category: 'Residential',
    description: 'Apartments and condominiums at higher density',
    allowedUses: ['Apartments', 'Condominiums', 'Senior housing', 'Assisted living'],
  },
  'RM': {
    color: '#14532D',
    label: 'Residential Mixed',
    category: 'Residential',
    description: 'Mix of single-family and multi-family residential',
    allowedUses: ['Single-family', 'Duplexes', 'Townhomes', 'Small apartments'],
  },
  'RS': {
    color: '#22C55E',
    label: 'Residential Single-Family',
    category: 'Residential',
    description: 'Single-family residential district',
    allowedUses: ['Single-family homes', 'Home occupations'],
  },
  'RMF': {
    color: '#15803D',
    label: 'Residential Multi-Family',
    category: 'Residential',
    description: 'Multi-family residential development',
    allowedUses: ['Apartments', 'Condos', 'Townhomes'],
  },
  'PUD': {
    color: '#10B981',
    label: 'Planned Unit Development',
    category: 'Residential',
    description: 'Master-planned development with flexible standards',
    allowedUses: ['Mixed residential types', 'Neighborhood commercial', 'Parks', 'Community facilities'],
  },
  'PD': {
    color: '#10B981',
    label: 'Planned Development',
    category: 'Mixed-Use',
    description: 'Flexible planned development district',
    allowedUses: ['Per approved plan', 'Mixed uses possible', 'Varies by project'],
  },

  // Office (Cyans)
  'O': {
    color: '#06B6D4',
    label: 'Office',
    category: 'Office',
    description: 'Professional and business office uses',
    allowedUses: ['Professional offices', 'Medical offices', 'Financial services', 'Corporate headquarters'],
  },
  'O-1': {
    color: '#06B6D4',
    label: 'Office Low Intensity',
    category: 'Office',
    description: 'Low-intensity office development',
    allowedUses: ['Professional offices', 'Medical offices', 'Small businesses'],
  },
  'O-2': {
    color: '#0891B2',
    label: 'Office High Intensity',
    category: 'Office',
    description: 'High-intensity office development',
    allowedUses: ['Office buildings', 'Corporate campuses', 'Medical centers'],
  },
  'OP': {
    color: '#0891B2',
    label: 'Office Park',
    category: 'Office',
    description: 'Planned office park with landscaping standards',
    allowedUses: ['Office buildings', 'Corporate campuses', 'R&D facilities', 'Medical offices'],
  },
  'BP': {
    color: '#0E7490',
    label: 'Business Park',
    category: 'Office',
    description: 'Mixed office and light industrial in park setting',
    allowedUses: ['Office buildings', 'Light industrial', 'Flex space', 'R&D', 'Data centers'],
  },

  // Agricultural & Rural
  'AG': {
    color: '#84CC16',
    label: 'Agricultural',
    category: 'Agricultural',
    description: 'Farming, ranching, and agricultural operations',
    allowedUses: ['Farming', 'Ranching', 'Nurseries', 'Agritourism', 'Farm stands', 'Single-family homes'],
  },
  'A': {
    color: '#84CC16',
    label: 'Agricultural',
    category: 'Agricultural',
    description: 'Agricultural district',
    allowedUses: ['Farming', 'Agricultural operations', 'Rural residential'],
  },
  'A-1': {
    color: '#84CC16',
    label: 'Agricultural',
    category: 'Agricultural',
    description: 'Primary agricultural district',
    allowedUses: ['Farming', 'Ranching', 'Rural residential'],
  },
  'RR': {
    color: '#65A30D',
    label: 'Rural Residential',
    category: 'Agricultural',
    description: 'Large-lot rural residential with agricultural uses',
    allowedUses: ['Single-family homes', 'Hobby farms', 'Equestrian', 'Agricultural'],
  },

  // Public & Institutional
  'P': {
    color: '#A3A3A3',
    label: 'Public/Institutional',
    category: 'Public',
    description: 'Government, educational, and institutional facilities',
    allowedUses: ['Government buildings', 'Schools', 'Churches', 'Hospitals', 'Libraries', 'Community centers'],
  },
  'INST': {
    color: '#A3A3A3',
    label: 'Institutional',
    category: 'Public',
    description: 'Institutional uses including schools and hospitals',
    allowedUses: ['Schools', 'Colleges', 'Hospitals', 'Religious facilities', 'Government'],
  },
  'GC': {
    color: '#A3A3A3',
    label: 'Government/Civic',
    category: 'Public',
    description: 'Government and civic facilities',
    allowedUses: ['Government offices', 'Courts', 'Fire stations', 'Police stations'],
  },

  // Open Space & Recreation
  'OS': {
    color: '#4ADE80',
    label: 'Open Space',
    category: 'Open Space',
    description: 'Parks, recreation areas, and conservation lands',
    allowedUses: ['Parks', 'Recreation facilities', 'Conservation areas', 'Trails', 'Golf courses'],
  },
  'REC': {
    color: '#4ADE80',
    label: 'Recreation',
    category: 'Open Space',
    description: 'Recreational facilities and parks',
    allowedUses: ['Parks', 'Sports facilities', 'Golf courses', 'Recreation centers'],
  },
  'CON': {
    color: '#22C55E',
    label: 'Conservation',
    category: 'Open Space',
    description: 'Environmental conservation and preservation',
    allowedUses: ['Conservation', 'Nature preserves', 'Limited recreation'],
  },

  // Other
  'U': {
    color: '#737373',
    label: 'Unzoned',
    category: 'Other',
    description: 'No zoning designation - uses determined by county regulations',
    allowedUses: ['Varies', 'Check with local planning department'],
  },
  'VL': {
    color: '#737373',
    label: 'Vacant Land',
    category: 'Other',
    description: 'Vacant land awaiting development or rezoning',
    allowedUses: ['Per underlying zoning', 'Development potential varies'],
  },
};

// Legacy export for backward compatibility
export const ZONING_COLORS: Record<string, { color: string; label: string; category: string }> = Object.fromEntries(
  Object.entries(ZONING_DATA).map(([key, value]) => [key, { color: value.color, label: value.label, category: value.category }])
);

// Fallback colors by category
export const CATEGORY_COLORS: Record<string, string> = {
  'Commercial': '#3B82F6',
  'Industrial': '#F97316',
  'Residential': '#22C55E',
  'Office': '#06B6D4',
  'Mixed-Use': '#8B5CF6',
  'Agricultural': '#84CC16',
  'Public': '#A3A3A3',
  'Open Space': '#4ADE80',
  'Other': '#737373',
};

export function getZoningColor(zoning?: string): string {
  if (!zoning) return '#3388ff';
  const code = zoning.toUpperCase().trim();

  // Direct match
  if (ZONING_COLORS[code]) return ZONING_COLORS[code].color;

  // Partial match (e.g., "C-2 GENERAL COMMERCIAL" -> "C-2")
  for (const [key, value] of Object.entries(ZONING_COLORS)) {
    if (code.startsWith(key) || code.includes(key)) return value.color;
  }

  // Category-based fallback
  if (code.includes('COMMERCIAL') || code.startsWith('C')) return CATEGORY_COLORS['Commercial'];
  if (code.includes('INDUSTRIAL') || code.startsWith('M') || code.startsWith('I')) return CATEGORY_COLORS['Industrial'];
  if (code.includes('RESIDENTIAL') || code.startsWith('R')) return CATEGORY_COLORS['Residential'];
  if (code.includes('OFFICE') || code.startsWith('O') || code.startsWith('B')) return CATEGORY_COLORS['Office'];
  if (code.includes('MIXED')) return CATEGORY_COLORS['Mixed-Use'];
  if (code.includes('AGRICULTURAL') || code.startsWith('A')) return CATEGORY_COLORS['Agricultural'];

  return '#3388ff'; // Default blue
}

export function getZoningInfo(zoning?: string): { color: string; label: string; category: string } | null {
  if (!zoning) return null;
  const code = zoning.toUpperCase().trim();

  if (ZONING_COLORS[code]) return ZONING_COLORS[code];

  for (const [key, value] of Object.entries(ZONING_COLORS)) {
    if (code.startsWith(key) || code.includes(key)) return value;
  }

  return null;
}

/**
 * Get full zoning details including allowed uses
 */
export function getZoningDetails(zoning?: string): ZoningInfo | null {
  if (!zoning) return null;
  const code = zoning.toUpperCase().trim();

  // Direct match
  if (ZONING_DATA[code]) return ZONING_DATA[code];

  // Try partial match (e.g., "C-2 GENERAL COMMERCIAL" -> "C-2")
  for (const [key, value] of Object.entries(ZONING_DATA)) {
    if (code.startsWith(key + ' ') || code.startsWith(key + '-')) return value;
  }

  // Try finding key within code
  for (const [key, value] of Object.entries(ZONING_DATA)) {
    if (code.includes(key)) return value;
  }

  // Infer from category keywords
  if (code.includes('COMMERCIAL') || code.includes('RETAIL') || code.includes('BUSINESS')) {
    return {
      color: CATEGORY_COLORS['Commercial'],
      label: 'Commercial',
      category: 'Commercial',
      description: 'Commercial zoning district allowing retail and business uses',
      allowedUses: ['Retail', 'Restaurants', 'Services', 'Office'],
    };
  }
  if (code.includes('INDUSTRIAL') || code.includes('MANUFACTURING') || code.includes('WAREHOUSE')) {
    return {
      color: CATEGORY_COLORS['Industrial'],
      label: 'Industrial',
      category: 'Industrial',
      description: 'Industrial zoning district allowing manufacturing and warehousing',
      allowedUses: ['Manufacturing', 'Warehousing', 'Distribution', 'Industrial services'],
    };
  }
  if (code.includes('RESIDENTIAL') || code.includes('DWELLING') || code.includes('HOUSING')) {
    return {
      color: CATEGORY_COLORS['Residential'],
      label: 'Residential',
      category: 'Residential',
      description: 'Residential zoning district',
      allowedUses: ['Single-family homes', 'Multi-family housing'],
    };
  }
  if (code.includes('OFFICE') || code.includes('PROFESSIONAL')) {
    return {
      color: CATEGORY_COLORS['Office'],
      label: 'Office',
      category: 'Office',
      description: 'Office zoning district',
      allowedUses: ['Professional offices', 'Medical offices', 'Business services'],
    };
  }
  if (code.includes('AGRICULTURAL') || code.includes('FARM') || code.includes('RURAL')) {
    return {
      color: CATEGORY_COLORS['Agricultural'],
      label: 'Agricultural',
      category: 'Agricultural',
      description: 'Agricultural zoning district',
      allowedUses: ['Farming', 'Agricultural operations', 'Rural residential'],
    };
  }
  if (code.includes('MIXED') || code.includes('MXD') || code.includes('MU-')) {
    return {
      color: CATEGORY_COLORS['Mixed-Use'],
      label: 'Mixed Use',
      category: 'Mixed-Use',
      description: 'Mixed-use zoning allowing residential and commercial',
      allowedUses: ['Retail', 'Restaurants', 'Residential', 'Office'],
    };
  }

  return null;
}
