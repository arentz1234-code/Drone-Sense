export const ZONING_COLORS: Record<string, { color: string; label: string; category: string }> = {
  // Commercial (Blues)
  'C-1': { color: '#3B82F6', label: 'Neighborhood Commercial', category: 'Commercial' },
  'C-2': { color: '#2563EB', label: 'General Commercial', category: 'Commercial' },
  'C-3': { color: '#1D4ED8', label: 'Highway Commercial', category: 'Commercial' },
  'CC': { color: '#1E40AF', label: 'Community Commercial', category: 'Commercial' },
  'MU': { color: '#8B5CF6', label: 'Mixed Use', category: 'Mixed-Use' },

  // Industrial (Oranges)
  'M-1': { color: '#F97316', label: 'Light Industrial', category: 'Industrial' },
  'M-2': { color: '#EA580C', label: 'Heavy Industrial', category: 'Industrial' },
  'I': { color: '#C2410C', label: 'Industrial', category: 'Industrial' },
  'IP': { color: '#F59E0B', label: 'Industrial Park', category: 'Industrial' },

  // Residential (Greens)
  'R-1': { color: '#22C55E', label: 'Single Family', category: 'Residential' },
  'R-2': { color: '#16A34A', label: 'Multi-Family Low', category: 'Residential' },
  'R-3': { color: '#15803D', label: 'Multi-Family High', category: 'Residential' },
  'RM': { color: '#14532D', label: 'Residential Mixed', category: 'Residential' },
  'PUD': { color: '#10B981', label: 'Planned Unit Dev', category: 'Residential' },

  // Office (Cyans)
  'O': { color: '#06B6D4', label: 'Office', category: 'Office' },
  'OP': { color: '#0891B2', label: 'Office Park', category: 'Office' },
  'BP': { color: '#0E7490', label: 'Business Park', category: 'Office' },

  // Other
  'AG': { color: '#84CC16', label: 'Agricultural', category: 'Agricultural' },
  'P': { color: '#A3A3A3', label: 'Public/Institutional', category: 'Public' },
  'OS': { color: '#4ADE80', label: 'Open Space', category: 'Open Space' },
  'U': { color: '#737373', label: 'Unzoned', category: 'Other' },
};

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
