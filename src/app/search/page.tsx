'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSearchFavorites, QuickFeasibility } from '@/hooks/useSearchFavorites';
import { ZONING_TYPES, getBusinessRequirement, getBusinessTypeOptions } from '@/lib/business-requirements';
import PropertyCompare from '@/components/PropertyCompare';

// Dynamically import MapResults to avoid SSR issues with Leaflet
const MapResults = dynamic(() => import('@/components/MapResults'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] bg-[var(--bg-tertiary)] rounded-lg flex items-center justify-center">
      <div className="animate-pulse text-[var(--text-muted)]">Loading map...</div>
    </div>
  ),
});

// Dynamically import SearchMapSelector
const SearchMapSelector = dynamic(() => import('@/components/SearchMapSelector'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[300px] bg-[var(--bg-tertiary)] rounded-lg flex items-center justify-center">
      <div className="animate-pulse text-[var(--text-muted)]">Loading map...</div>
    </div>
  ),
});


interface SearchResults {
  totalParcels: number;
  matchingParcels: number;
  results: QuickFeasibility[];
  searchArea: string;
  searchTime: number;
}

interface SearchFilters {
  center: { lat: number; lng: number } | null;
  radiusMiles: number;
  minScore: number;
  maxScore: number;
  propertyType: 'all' | 'vacant' | 'commercial';
  minAcres: number | null;
  maxAcres: number | null;
  zoningTypes: string[];
  minRoadFrontage: number | null;
  cornerLotOnly: boolean;
  businessType: string | null;
}

type SortField = 'score' | 'lotSize' | 'address' | 'vpd';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'grid' | 'map' | 'compare';

// Asset class categorization based on zoning codes
type AssetClass = 'Retail' | 'Office' | 'Industrial' | 'Mixed-Use' | 'Vacant Land' | 'Hospitality' | 'Medical' | 'Multifamily' | 'Other';

const ASSET_CLASS_CONFIG: Record<AssetClass, { color: string; icon: string; keywords: string[] }> = {
  'Retail': {
    color: 'text-emerald-400 bg-emerald-400/15 border-emerald-400/40',
    icon: '🏪',
    keywords: ['C-1', 'C-2', 'CG', 'CR', 'CBD', 'RETAIL', 'COMMERCIAL', 'CC', 'CN', 'CS', 'GC', 'NC'],
  },
  'Office': {
    color: 'text-blue-400 bg-blue-400/15 border-blue-400/40',
    icon: '🏢',
    keywords: ['O-1', 'O-2', 'OP', 'OC', 'OFFICE', 'BP', 'BUSINESS PARK'],
  },
  'Industrial': {
    color: 'text-orange-400 bg-orange-400/15 border-orange-400/40',
    icon: '🏭',
    keywords: ['I-1', 'I-2', 'IG', 'IL', 'IH', 'INDUSTRIAL', 'M-1', 'M-2', 'MANUFACTURING', 'WAREHOUSE'],
  },
  'Mixed-Use': {
    color: 'text-purple-400 bg-purple-400/15 border-purple-400/40',
    icon: '🏙️',
    keywords: ['MU', 'MX', 'MIXED', 'PD', 'PUD', 'PLANNED', 'TOD', 'TND'],
  },
  'Vacant Land': {
    color: 'text-yellow-400 bg-yellow-400/15 border-yellow-400/40',
    icon: '🌿',
    keywords: ['VL', 'VAC', 'VACANT', 'AG', 'AGRICULTURAL', 'RURAL', 'UNIMPROVED'],
  },
  'Hospitality': {
    color: 'text-pink-400 bg-pink-400/15 border-pink-400/40',
    icon: '🏨',
    keywords: ['HOTEL', 'MOTEL', 'HOSPITALITY', 'RESORT', 'T-1', 'TOURIST'],
  },
  'Medical': {
    color: 'text-red-400 bg-red-400/15 border-red-400/40',
    icon: '🏥',
    keywords: ['MEDICAL', 'HOSPITAL', 'HEALTH', 'CLINIC'],
  },
  'Multifamily': {
    color: 'text-cyan-400 bg-cyan-400/15 border-cyan-400/40',
    icon: '🏘️',
    keywords: ['R-3', 'R-4', 'R-5', 'RM', 'RH', 'MULTIFAMILY', 'APARTMENT', 'MF', 'HDR'],
  },
  'Other': {
    color: 'text-gray-400 bg-gray-400/15 border-gray-400/40',
    icon: '📍',
    keywords: [],
  },
};

function getAssetClass(zoning?: string): AssetClass {
  if (!zoning) return 'Other';
  const upper = zoning.toUpperCase();

  for (const [assetClass, config] of Object.entries(ASSET_CLASS_CONFIG)) {
    if (assetClass === 'Other') continue;
    for (const keyword of config.keywords) {
      if (upper.includes(keyword)) {
        return assetClass as AssetClass;
      }
    }
  }
  return 'Other';
}

// Quick search presets
const QUICK_PRESETS = [
  { label: 'High Traffic Retail', minScore: 7, propertyType: 'commercial' as const, businessType: 'fast_food' },
  { label: 'Development Sites', minScore: 5, propertyType: 'vacant' as const, businessType: null },
  { label: 'Medical/Office', minScore: 6, propertyType: 'commercial' as const, businessType: 'medical_clinic' },
  { label: 'All Properties', minScore: 1, propertyType: 'all' as const, businessType: null },
];

export default function SearchPage() {
  // Filter state
  const [filters, setFilters] = useState<SearchFilters>({
    center: null,
    radiusMiles: 1,
    minScore: 1,
    maxScore: 10,
    propertyType: 'all',
    minAcres: null,
    maxAcres: null,
    zoningTypes: [],
    minRoadFrontage: null,
    cornerLotOnly: false,
    businessType: null,
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Compare state
  const [compareList, setCompareList] = useState<QuickFeasibility[]>([]);

  // Favorites hook
  const { favorites, isFavorite, toggleFavorite } = useSearchFavorites();

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.minAcres !== null) count++;
    if (filters.maxAcres !== null) count++;
    if (filters.zoningTypes.length > 0) count++;
    if (filters.minRoadFrontage) count++;
    if (filters.cornerLotOnly) count++;
    if (filters.businessType) count++;
    if (filters.minScore > 1 || filters.maxScore < 10) count++;
    return count;
  }, [filters]);

  // Load persisted results from sessionStorage on mount
  useEffect(() => {
    try {
      const savedResults = sessionStorage.getItem('batchSearchResults');
      const savedFilters = sessionStorage.getItem('batchSearchFilters');
      const savedCompareList = sessionStorage.getItem('batchSearchCompareList');

      if (savedResults) {
        setResults(JSON.parse(savedResults));
      }
      if (savedFilters) {
        setFilters(JSON.parse(savedFilters));
      }
      if (savedCompareList) {
        setCompareList(JSON.parse(savedCompareList));
      }
    } catch (e) {
      console.error('Error loading saved search results:', e);
    }
  }, []);

  // Save results to sessionStorage when they change
  useEffect(() => {
    if (results) {
      sessionStorage.setItem('batchSearchResults', JSON.stringify(results));
    }
  }, [results]);

  // Save filters to sessionStorage when they change
  useEffect(() => {
    if (filters.center) {
      sessionStorage.setItem('batchSearchFilters', JSON.stringify(filters));
    }
  }, [filters]);

  // Save compare list to sessionStorage when it changes
  useEffect(() => {
    sessionStorage.setItem('batchSearchCompareList', JSON.stringify(compareList));
  }, [compareList]);

  // Reset search function
  const resetSearch = useCallback(() => {
    setResults(null);
    setFilters({
      center: null,
      radiusMiles: 1,
      minScore: 1,
      maxScore: 10,
      propertyType: 'all',
      minAcres: null,
      maxAcres: null,
      zoningTypes: [],
      minRoadFrontage: null,
      cornerLotOnly: false,
      businessType: null,
    });
    setCompareList([]);
    setError(null);
    setCollapsedClasses(new Set());
    setActivePreset(null);
    sessionStorage.removeItem('batchSearchResults');
    sessionStorage.removeItem('batchSearchFilters');
    sessionStorage.removeItem('batchSearchCompareList');
  }, []);

  // Apply quick preset
  const applyPreset = useCallback((preset: typeof QUICK_PRESETS[0]) => {
    setFilters(prev => ({
      ...prev,
      minScore: preset.minScore,
      propertyType: preset.propertyType,
      businessType: preset.businessType,
    }));
    setActivePreset(preset.label);

    // Auto-apply business requirements if applicable
    if (preset.businessType) {
      const requirements = getBusinessRequirement(preset.businessType);
      if (requirements) {
        setFilters(prev => ({
          ...prev,
          minAcres: requirements.minAcres,
          maxAcres: requirements.maxAcres,
          zoningTypes: requirements.zoning,
          minRoadFrontage: requirements.minRoadFrontage || null,
          cornerLotOnly: requirements.preferCornerLot || false,
        }));
      }
    }
  }, []);

  // Update filters when business type changes
  const handleBusinessTypeChange = useCallback((businessType: string | null) => {
    setActivePreset(null);
    if (!businessType) {
      setFilters(prev => ({
        ...prev,
        businessType: null,
      }));
      return;
    }

    const requirements = getBusinessRequirement(businessType);
    if (requirements) {
      setFilters(prev => ({
        ...prev,
        businessType,
        minAcres: requirements.minAcres,
        maxAcres: requirements.maxAcres,
        zoningTypes: requirements.zoning,
        minRoadFrontage: requirements.minRoadFrontage || null,
        cornerLotOnly: requirements.preferCornerLot || false,
      }));
      setShowAdvancedFilters(true);
    }
  }, []);

  // Handle zoning type toggle
  const handleZoningToggle = useCallback((zoningCode: string) => {
    setActivePreset(null);
    setFilters(prev => ({
      ...prev,
      zoningTypes: prev.zoningTypes.includes(zoningCode)
        ? prev.zoningTypes.filter(z => z !== zoningCode)
        : [...prev.zoningTypes, zoningCode],
    }));
  }, []);

  // Search handler - now uses radius-based search
  const handleSearch = async () => {
    if (!filters.center) {
      setError('Please select a location on the map or enter an address');
      return;
    }

    setLoading(true);
    setError(null);
    setProgress(0);
    setResults(null);
    setCollapsedClasses(new Set());

    try {
      // Step 1: Get parcels within radius
      setProgress(10);
      const parcelsResponse = await fetch('/api/search/parcels-radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          center: filters.center,
          radiusMiles: filters.radiusMiles,
          propertyType: filters.propertyType,
        }),
      });

      if (!parcelsResponse.ok) {
        const data = await parcelsResponse.json();
        throw new Error(data.error || 'Failed to fetch parcels');
      }

      const parcelsData = await parcelsResponse.json();
      setProgress(30);

      const radiusDisplay = Number.isInteger(filters.radiusMiles) ? filters.radiusMiles : filters.radiusMiles.toFixed(1);
      const searchAreaLabel = `${radiusDisplay} mile${filters.radiusMiles !== 1 ? 's' : ''} radius`;

      if (parcelsData.parcels.length === 0) {
        setResults({
          totalParcels: 0,
          matchingParcels: 0,
          results: [],
          searchArea: searchAreaLabel,
          searchTime: parcelsData.searchTime || 0,
        });
        setLoading(false);
        return;
      }

      // Step 2: Batch analyze parcels with demographics from search center
      const analyzeResponse = await fetch('/api/search/batch-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parcels: parcelsData.parcels,
          minScore: filters.minScore,
          searchCenter: filters.center, // Pass center for area demographics
        }),
      });

      setProgress(80);

      if (!analyzeResponse.ok) {
        const data = await analyzeResponse.json();
        throw new Error(data.error || 'Failed to analyze parcels');
      }

      const analysisData = await analyzeResponse.json();
      setProgress(100);

      setResults({
        totalParcels: parcelsData.totalCount,
        matchingParcels: analysisData.results.length,
        results: analysisData.results,
        searchArea: searchAreaLabel,
        searchTime: analysisData.searchTime,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  // Apply client-side filters
  const filteredResults = useMemo(() => {
    if (!results) return [];

    return results.results.filter(property => {
      // Filter by score range
      if (property.score < filters.minScore || property.score > filters.maxScore) {
        return false;
      }

      if (filters.minAcres !== null && (property.lotSizeAcres === undefined || property.lotSizeAcres < filters.minAcres)) {
        return false;
      }
      if (filters.maxAcres !== null && (property.lotSizeAcres === undefined || property.lotSizeAcres > filters.maxAcres)) {
        return false;
      }

      if (filters.zoningTypes.length > 0 && property.zoning) {
        const propertyZoning = property.zoning.toUpperCase();
        const matchesZoning = filters.zoningTypes.some(z =>
          propertyZoning.includes(z.toUpperCase())
        );
        if (!matchesZoning) return false;
      }

      if (filters.businessType) {
        const requirements = getBusinessRequirement(filters.businessType);
        if (requirements && property.estimatedVPD !== undefined && property.estimatedVPD < requirements.minVPD) {
          return false;
        }
      }

      return true;
    });
  }, [results, filters]);

  // Sort results
  const sortedResults = useMemo(() => {
    return [...filteredResults].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'score':
          comparison = a.score - b.score;
          break;
        case 'lotSize':
          comparison = (a.lotSizeAcres || 0) - (b.lotSizeAcres || 0);
          break;
        case 'address':
          comparison = a.address.localeCompare(b.address);
          break;
        case 'vpd':
          comparison = (a.estimatedVPD || 0) - (b.estimatedVPD || 0);
          break;
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });
  }, [filteredResults, sortField, sortDirection]);

  // Group results by asset class
  const groupedResults = useMemo(() => {
    const groups: Record<AssetClass, typeof sortedResults> = {
      'Retail': [], 'Office': [], 'Industrial': [], 'Mixed-Use': [],
      'Vacant Land': [], 'Hospitality': [], 'Medical': [], 'Multifamily': [], 'Other': [],
    };
    for (const property of sortedResults) {
      const assetClass = getAssetClass(property.zoning);
      groups[assetClass].push(property);
    }
    // Return only non-empty groups, sorted by count descending
    return Object.entries(groups)
      .filter(([, items]) => items.length > 0)
      .sort((a, b) => b[1].length - a[1].length) as [AssetClass, typeof sortedResults][];
  }, [sortedResults]);

  // Collapsed asset class state
  const [collapsedClasses, setCollapsedClasses] = useState<Set<AssetClass>>(new Set());

  const toggleAssetClass = useCallback((assetClass: AssetClass) => {
    setCollapsedClasses(prev => {
      const next = new Set(prev);
      if (next.has(assetClass)) next.delete(assetClass);
      else next.add(assetClass);
      return next;
    });
  }, []);

  // Compare handlers
  const addToCompare = useCallback((property: QuickFeasibility) => {
    if (compareList.length >= 4) return;
    if (compareList.some(p => p.parcelId === property.parcelId)) return;
    setCompareList(prev => [...prev, property]);
  }, [compareList]);

  const removeFromCompare = useCallback((parcelId: string) => {
    setCompareList(prev => prev.filter(p => p.parcelId !== parcelId));
  }, []);

  const clearCompare = useCallback(() => {
    setCompareList([]);
  }, []);

  // Score color helper
  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-400 bg-green-400/20 border-green-400/50';
    if (score >= 5) return 'text-yellow-400 bg-yellow-400/20 border-yellow-400/50';
    return 'text-red-400 bg-red-400/20 border-red-400/50';
  };

  // Score badge style
  const getScoreBadgeStyle = (score: number) => {
    if (score >= 8) return 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-green-500/25';
    if (score >= 6) return 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-cyan-500/25';
    if (score >= 4) return 'bg-gradient-to-br from-yellow-500 to-orange-500 text-white shadow-yellow-500/25';
    return 'bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-red-500/25';
  };

  // Export to CSV
  const exportToCSV = useCallback(() => {
    if (!results) return;

    const headers = ['Address', 'Parcel ID', 'Lot Size (sqft)', 'Lot Size (acres)', 'Feasibility Score', 'Traffic Score', 'Business Density', 'Zoning Score', 'Access Score', 'Estimated VPD', 'Zoning', 'Latitude', 'Longitude'];
    const rows = sortedResults.map(r => [
      `"${r.address}"`,
      r.parcelId,
      r.lotSize || '',
      r.lotSizeAcres?.toFixed(2) || '',
      r.score.toFixed(1),
      r.factors.trafficScore.toFixed(1),
      r.factors.businessDensity.toFixed(1),
      r.factors.zoningScore.toFixed(1),
      r.factors.accessScore.toFixed(1),
      r.estimatedVPD || '',
      r.zoning || '',
      r.coordinates.lat,
      r.coordinates.lng,
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `property-search-${filters.radiusMiles}mi-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [results, sortedResults, filters.radiusMiles]);

  // Business type options
  const businessTypeOptions = getBusinessTypeOptions();

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
      {/* Header */}
      <div className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)] flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-3 group">
                {/* Feasora Logo - Crosshair style (matches main header) */}
                <div className="w-10 h-10 flex items-center justify-center">
                  <svg className="w-10 h-10 text-[#00D4FF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="6" />
                    <circle cx="12" cy="12" r="2" fill="currentColor" />
                    <line x1="12" y1="2" x2="12" y2="6" />
                    <line x1="12" y1="18" x2="12" y2="22" />
                    <line x1="2" y1="12" x2="6" y2="12" />
                    <line x1="18" y1="12" x2="22" y2="12" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-cyan)] transition-colors">Property Search</h1>
                  <p className="text-sm text-[var(--text-muted)]">Feasora.ai</p>
                </div>
              </Link>
            </div>
            {results && (
              <button
                onClick={resetSearch}
                className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                New Search
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 flex flex-col">
        {/* Main Search Card */}
        <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden mb-6">
          {/* Map Section */}
          <div className="p-4 sm:p-6">
            <SearchMapSelector
              center={filters.center}
              radiusMiles={filters.radiusMiles}
              onCenterChange={(center) => setFilters(prev => ({ ...prev, center }))}
              onRadiusChange={(radiusMiles) => setFilters(prev => ({ ...prev, radiusMiles }))}
              results={sortedResults}
            />
          </div>

          {/* Quick Presets */}
          <div className="px-4 sm:px-6 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[var(--text-muted)] font-medium">Quick:</span>
              {QUICK_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                    activePreset === preset.label
                      ? 'bg-[var(--accent-cyan)] text-black border-[var(--accent-cyan)]'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border-color)] hover:border-[var(--accent-cyan)]/50'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Filter Controls */}
          <div className="border-t border-[var(--border-color)] bg-[var(--bg-tertiary)]/50 p-4 sm:p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">
              {/* Score Range */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                  Min Score
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.5"
                    value={filters.minScore}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setFilters(prev => ({ ...prev, minScore: Math.min(val, prev.maxScore) }));
                      setActivePreset(null);
                    }}
                    className="flex-1 accent-[var(--accent-cyan)] h-2"
                  />
                  <span className="text-sm font-bold text-[var(--accent-cyan)] w-8 text-right">{filters.minScore}</span>
                </div>
              </div>

              {/* Property Type */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Property Type</label>
                <select
                  value={filters.propertyType}
                  onChange={(e) => {
                    setFilters(prev => ({ ...prev, propertyType: e.target.value as 'all' | 'vacant' | 'commercial' }));
                    setActivePreset(null);
                  }}
                  className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg focus:outline-none focus:border-[var(--accent-cyan)] text-sm"
                >
                  <option value="all">All Types</option>
                  <option value="vacant">Vacant Land</option>
                  <option value="commercial">Commercial</option>
                </select>
              </div>

              {/* Business Type Preset */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Business Type</label>
                <select
                  value={filters.businessType || ''}
                  onChange={(e) => handleBusinessTypeChange(e.target.value || null)}
                  className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg focus:outline-none focus:border-[var(--accent-cyan)] text-sm"
                >
                  <option value="">Any Business</option>
                  {businessTypeOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Search Button */}
              <div className="flex items-end">
                <button
                  onClick={handleSearch}
                  disabled={loading || !filters.center}
                  className="w-full py-2.5 px-4 bg-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/90 disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-muted)] text-black font-semibold rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-[var(--accent-cyan)]/20 disabled:shadow-none"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="hidden sm:inline">Searching...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span className="hidden sm:inline">Search Area</span>
                      <span className="sm:hidden">Search</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Advanced Filters Toggle */}
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent-cyan)] transition-colors"
            >
              <svg
                className={`w-4 h-4 transition-transform ${showAdvancedFilters ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span>Advanced Filters</span>
              {activeFilterCount > 0 && (
                <span className="px-2 py-0.5 bg-[var(--accent-cyan)] text-black rounded-full text-xs font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Advanced Filters Panel */}
            {showAdvancedFilters && (
              <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  {/* Min/Max Acreage */}
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Acreage Range</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={filters.minAcres ?? ''}
                        onChange={(e) => {
                          setFilters(prev => ({ ...prev, minAcres: e.target.value ? parseFloat(e.target.value) : null }));
                          setActivePreset(null);
                        }}
                        placeholder="Min"
                        step="0.1"
                        min="0"
                        className="w-1/2 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg focus:outline-none focus:border-[var(--accent-cyan)] text-sm"
                      />
                      <input
                        type="number"
                        value={filters.maxAcres ?? ''}
                        onChange={(e) => {
                          setFilters(prev => ({ ...prev, maxAcres: e.target.value ? parseFloat(e.target.value) : null }));
                          setActivePreset(null);
                        }}
                        placeholder="Max"
                        step="0.1"
                        min="0"
                        className="w-1/2 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg focus:outline-none focus:border-[var(--accent-cyan)] text-sm"
                      />
                    </div>
                  </div>

                  {/* Road Frontage */}
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                      Min Frontage: {filters.minRoadFrontage ?? 0} ft
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="500"
                      step="25"
                      value={filters.minRoadFrontage ?? 0}
                      onChange={(e) => {
                        setFilters(prev => ({ ...prev, minRoadFrontage: parseInt(e.target.value) || null }));
                        setActivePreset(null);
                      }}
                      className="w-full accent-[var(--accent-cyan)] h-2"
                    />
                  </div>

                  {/* Corner Lot */}
                  <div className="flex items-center">
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <div className={`w-10 h-6 rounded-full p-1 transition-colors ${filters.cornerLotOnly ? 'bg-[var(--accent-cyan)]' : 'bg-[var(--bg-tertiary)]'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${filters.cornerLotOnly ? 'translate-x-4' : ''}`} />
                      </div>
                      <span className="text-sm text-[var(--text-secondary)]">Corner Lot Only</span>
                    </label>
                  </div>

                  {/* Clear Filters */}
                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => {
                        setFilters(prev => ({
                          ...prev,
                          minAcres: null,
                          maxAcres: null,
                          zoningTypes: [],
                          minRoadFrontage: null,
                          cornerLotOnly: false,
                          businessType: null,
                        }));
                        setActivePreset(null);
                      }}
                      className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Clear Filters
                    </button>
                  </div>
                </div>

                {/* Zoning Types */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">Zoning Types</label>
                  <div className="flex flex-wrap gap-2">
                    {ZONING_TYPES.map(zone => (
                      <button
                        key={zone.code}
                        onClick={() => handleZoningToggle(zone.code)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          filters.zoningTypes.includes(zone.code)
                            ? 'bg-[var(--accent-cyan)] text-black'
                            : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:border-[var(--accent-cyan)]/50'
                        }`}
                        title={zone.label}
                      >
                        {zone.code}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Progress Bar */}
            {loading && (
              <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
                <div className="h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[var(--accent-cyan)] to-cyan-400 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-2 text-center">
                  {progress < 30
                    ? `Scanning ${filters.radiusMiles >= 1 ? 'grid cells in' : ''} ${Number.isInteger(filters.radiusMiles) ? filters.radiusMiles : filters.radiusMiles.toFixed(1)} mile radius...`
                    : progress < 80
                      ? 'Analyzing properties with real traffic data...'
                      : 'Finalizing results...'}
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        {results && (
          <div className="flex-1 flex flex-col">
            {/* Results Header - Sticky */}
            <div className="sticky top-0 z-20 bg-[var(--bg-primary)] py-3 -mx-4 sm:-mx-6 px-4 sm:px-6 border-b border-[var(--border-color)] flex-shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                {/* Stats */}
                <div className="flex items-center gap-4 sm:gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-[var(--accent-cyan)]/20 flex items-center justify-center">
                      <span className="text-lg font-bold text-[var(--accent-cyan)]">{sortedResults.length}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">Properties</p>
                      <p className="text-xs text-[var(--text-muted)]">in {results.searchArea}</p>
                    </div>
                  </div>
                  {compareList.length > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 rounded-lg">
                      <span className="text-sm font-medium text-purple-400">{compareList.length}/4 comparing</span>
                    </div>
                  )}
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2 sm:gap-3">
                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-[var(--bg-tertiary)] rounded-lg p-1">
                    {[
                      { mode: 'grid' as ViewMode, icon: (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                        </svg>
                      )},
                      { mode: 'map' as ViewMode, icon: (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                      )},
                      { mode: 'compare' as ViewMode, icon: (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      )},
                    ].map(({ mode, icon }) => (
                      <button
                        key={mode}
                        onClick={() => setViewMode(mode)}
                        className={`p-2 rounded transition-colors ${
                          viewMode === mode
                            ? 'bg-[var(--accent-cyan)] text-black'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                        }`}
                        title={mode.charAt(0).toUpperCase() + mode.slice(1)}
                      >
                        {icon}
                        {mode === 'compare' && compareList.length > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 text-white rounded-full text-xs flex items-center justify-center">
                            {compareList.length}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Sort Controls */}
                  {viewMode === 'grid' && (
                    <div className="hidden sm:flex items-center gap-2">
                      <select
                        value={sortField}
                        onChange={(e) => setSortField(e.target.value as SortField)}
                        className="px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent-cyan)]"
                      >
                        <option value="score">Score</option>
                        <option value="lotSize">Lot Size</option>
                        <option value="vpd">VPD</option>
                        <option value="address">Address</option>
                      </select>
                      <button
                        onClick={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')}
                        className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                        title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
                      >
                        <svg className={`w-4 h-4 transition-transform ${sortDirection === 'asc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* Export Button */}
                  <button
                    onClick={exportToCSV}
                    className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    title="Export to CSV"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* View Content */}
            <div className="mt-6 flex-1 flex flex-col">
              {viewMode === 'map' && (
                <div className="rounded-xl overflow-hidden border border-[var(--border-color)]">
                  <MapResults
                    results={sortedResults}
                    compareList={compareList.map(p => p.parcelId)}
                    onAddToCompare={addToCompare}
                    favoriteIds={favorites.map(f => f.parcelId)}
                    onToggleFavorite={toggleFavorite}
                  />
                </div>
              )}

              {viewMode === 'compare' && (
                <PropertyCompare
                  properties={compareList}
                  onRemove={removeFromCompare}
                  onClear={clearCompare}
                />
              )}

              {viewMode === 'grid' && (
                <div className="space-y-4 flex-1 flex flex-col">
                  {groupedResults.length > 0 ? (
                    <>
                      {/* Asset Class Summary Bar */}
                      <div className="flex flex-wrap gap-2 pb-4">
                        {groupedResults.map(([assetClass, items]) => {
                          const config = ASSET_CLASS_CONFIG[assetClass];
                          const isCollapsed = collapsedClasses.has(assetClass);
                          return (
                            <button
                              key={assetClass}
                              onClick={() => toggleAssetClass(assetClass)}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                                isCollapsed
                                  ? 'bg-[var(--bg-tertiary)] border-[var(--border-color)] opacity-50'
                                  : config.color
                              }`}
                            >
                              <span>{config.icon}</span>
                              <span className="font-medium hidden sm:inline">{assetClass}</span>
                              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                                isCollapsed ? 'bg-[var(--bg-secondary)]' : 'bg-black/20'
                              }`}>
                                {items.length}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Asset Class Sections */}
                      {groupedResults.map(([assetClass, items]) => {
                        const config = ASSET_CLASS_CONFIG[assetClass];
                        const isCollapsed = collapsedClasses.has(assetClass);
                        const avgScore = items.reduce((sum, p) => sum + p.score, 0) / items.length;
                        const topScore = items[0]?.score || 0;

                        return (
                          <div key={assetClass} className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden">
                            {/* Asset Class Header */}
                            <button
                              onClick={() => toggleAssetClass(assetClass)}
                              className="w-full p-4 flex items-center justify-between cursor-pointer hover:bg-[var(--bg-tertiary)]/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">{config.icon}</span>
                                <div className="text-left">
                                  <h3 className="text-lg font-bold text-[var(--text-primary)]">{assetClass}</h3>
                                  <p className="text-xs text-[var(--text-muted)]">
                                    {items.length} {items.length === 1 ? 'property' : 'properties'} &middot; Avg: {avgScore.toFixed(1)} &middot; Top: {topScore.toFixed(1)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`px-3 py-1 rounded-full border text-sm font-bold ${config.color}`}>
                                  {items.length}
                                </span>
                                <svg
                                  className={`w-5 h-5 text-[var(--text-muted)] transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
                                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </button>

                            {/* Properties Grid */}
                            {!isCollapsed && (
                              <div className="p-4 pt-0 border-t border-[var(--border-color)]">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                                  {items.map((property) => {
                                    const isInCompare = compareList.some(p => p.parcelId === property.parcelId);
                                    const isFav = isFavorite(property.parcelId);

                                    return (
                                      <div
                                        key={property.parcelId}
                                        className={`group relative bg-[var(--bg-tertiary)] rounded-xl border transition-all hover:shadow-lg ${
                                          isInCompare
                                            ? 'border-purple-500/50 shadow-purple-500/10'
                                            : 'border-[var(--border-color)] hover:border-[var(--accent-cyan)]/50'
                                        }`}
                                      >
                                        {/* Score Badge - Top Right */}
                                        <div className={`absolute -top-2 -right-2 w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-lg ${getScoreBadgeStyle(property.score)}`}>
                                          {property.score.toFixed(1)}
                                        </div>

                                        <div className="p-4">
                                          {/* Header */}
                                          <div className="pr-10 mb-2">
                                            <p className="font-medium text-sm text-[var(--text-primary)] truncate" title={property.address}>
                                              {property.address}
                                            </p>
                                            {/* Property Context Badges */}
                                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                              {/* Property Type */}
                                              {property.propertyType && property.propertyType !== 'Unknown' && (
                                                <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                                                  property.propertyType.toLowerCase().includes('vacant')
                                                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                                    : property.propertyType.toLowerCase().includes('parking')
                                                    ? 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                                                    : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                                }`}>
                                                  {property.propertyType}
                                                </span>
                                              )}
                                              {/* Occupancy Status */}
                                              {property.occupancyStatus && property.occupancyStatus !== 'unknown' && (
                                                <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded flex items-center gap-1 ${
                                                  property.occupancyStatus === 'occupied'
                                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                    : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                                }`}>
                                                  <span className={`w-1.5 h-1.5 rounded-full ${
                                                    property.occupancyStatus === 'occupied' ? 'bg-green-400' : 'bg-orange-400'
                                                  }`}></span>
                                                  {property.occupancyStatus === 'occupied' ? 'Occupied' : 'Vacant'}
                                                </span>
                                              )}
                                              {/* Building Info */}
                                              {property.buildingSqFt && property.buildingSqFt > 0 && (
                                                <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                                                  {(property.buildingSqFt / 1000).toFixed(1)}k SF
                                                </span>
                                              )}
                                              {/* Year Built */}
                                              {property.yearBuilt && property.yearBuilt > 1900 && (
                                                <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                                                  {property.yearBuilt}
                                                </span>
                                              )}
                                            </div>
                                          </div>

                                          {/* Stats Grid */}
                                          <div className="grid grid-cols-2 gap-2 mb-3">
                                            <div className="bg-[var(--bg-secondary)] rounded-lg p-2">
                                              <p className="text-[10px] text-[var(--text-muted)]">Lot Size</p>
                                              <p className="font-semibold text-sm">{property.lotSizeAcres?.toFixed(2) || '—'} ac</p>
                                            </div>
                                            <div className="bg-[var(--bg-secondary)] rounded-lg p-2">
                                              <p className="text-[10px] text-[var(--text-muted)]">Est. VPD</p>
                                              <p className="font-semibold text-sm">{property.estimatedVPD?.toLocaleString() || '—'}</p>
                                            </div>
                                            <div className="bg-[var(--bg-secondary)] rounded-lg p-2">
                                              <p className="text-[10px] text-[var(--text-muted)]">Zoning</p>
                                              <p className="font-semibold text-sm truncate" title={property.zoning}>{property.zoning || '—'}</p>
                                            </div>
                                            <div className="bg-[var(--bg-secondary)] rounded-lg p-2">
                                              <p className="text-[10px] text-[var(--text-muted)]">Nearby Biz</p>
                                              <p className="font-semibold text-sm">{property.nearbyBusinesses ?? '—'}</p>
                                            </div>
                                          </div>

                                          {/* Score Breakdown Mini - All 10 factors */}
                                          <div className="grid grid-cols-5 gap-0.5 mb-3">
                                            {[
                                              { label: 'VPD', value: property.factors.trafficScore, title: 'Traffic/VPD Score' },
                                              { label: 'Demo', value: property.factors.demographicsScore ?? 5, title: 'Demographics Score' },
                                              { label: 'Comp', value: property.factors.competitionScore ?? property.factors.businessDensity, title: 'Competition/Business Density' },
                                              { label: 'Road', value: property.factors.accessScore, title: 'Road Access Score' },
                                              { label: 'Env', value: property.factors.environmentalScore ?? 7, title: 'Environmental Score' },
                                              { label: 'Mkt', value: property.factors.marketScore ?? 5, title: 'Market Comps Score' },
                                              { label: 'Walk', value: property.factors.walkabilityScore ?? 5, title: 'Walkability Score' },
                                              { label: 'Safe', value: property.factors.safetyScore ?? 5, title: 'Safety/Crime Score' },
                                              { label: 'Dev', value: property.factors.developmentScore ?? 5, title: 'Development Momentum' },
                                              { label: 'Sat', value: property.factors.saturationScore ?? 5, title: 'Market Saturation' },
                                            ].map((factor) => {
                                              const val = typeof factor.value === 'number' ? factor.value : 5;
                                              const colorClass = val >= 7 ? 'text-green-400' : val >= 5 ? 'text-yellow-400' : 'text-red-400';
                                              return (
                                                <div
                                                  key={factor.label}
                                                  className="text-center py-1 bg-[var(--bg-secondary)] rounded"
                                                  title={`${factor.title}: ${val.toFixed(1)}/10`}
                                                >
                                                  <div className="text-[8px] text-[var(--text-muted)] uppercase leading-tight">{factor.label}</div>
                                                  <div className={`text-[10px] font-bold ${colorClass}`}>{val.toFixed(0)}</div>
                                                </div>
                                              );
                                            })}
                                          </div>

                                          {/* Actions */}
                                          <div className="flex gap-2">
                                            <Link
                                              href={`/?lat=${property.coordinates.lat}&lng=${property.coordinates.lng}&address=${encodeURIComponent(property.address)}`}
                                              className="flex-1 py-2 text-center text-sm font-medium bg-[var(--accent-cyan)]/20 text-[var(--accent-cyan)] rounded-lg hover:bg-[var(--accent-cyan)]/30 transition-colors"
                                            >
                                              Analyze
                                            </Link>
                                            <button
                                              onClick={() => isInCompare ? removeFromCompare(property.parcelId) : addToCompare(property)}
                                              disabled={!isInCompare && compareList.length >= 4}
                                              className={`px-3 py-2 rounded-lg transition-colors ${
                                                isInCompare
                                                  ? 'bg-purple-500/20 text-purple-400'
                                                  : compareList.length >= 4
                                                  ? 'bg-[var(--bg-secondary)] text-[var(--text-muted)] cursor-not-allowed'
                                                  : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'
                                              }`}
                                              title={isInCompare ? 'Remove from compare' : compareList.length >= 4 ? 'Max 4 properties' : 'Add to compare'}
                                            >
                                              {isInCompare ? '−' : '+'}
                                            </button>
                                            <button
                                              onClick={() => toggleFavorite(property)}
                                              className={`px-3 py-2 rounded-lg transition-colors ${
                                                isFav
                                                  ? 'bg-red-500/20 text-red-400'
                                                  : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-red-400'
                                              }`}
                                              title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                                            >
                                              <svg className="w-4 h-4" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                              </svg>
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <div className="text-center py-16">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
                        <svg className="w-8 h-8 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">No properties found</h3>
                      <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">
                        Try adjusting your filters or increasing the search radius to find more properties.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty State - No Search Yet */}
        {!results && !loading && (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
              <svg className="w-10 h-10 text-[var(--accent-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">Ready to search</h3>
            <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">
              Click on the map or enter an address to set your search center, then click &quot;Search Area&quot; to find properties.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
