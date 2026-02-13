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

export default function SearchPage() {
  // Filter state
  const [filters, setFilters] = useState<SearchFilters>({
    center: null,
    radiusMiles: 1,
    minScore: 5,
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

  // Compare state
  const [compareList, setCompareList] = useState<QuickFeasibility[]>([]);

  // Favorites hook
  const { favorites, isFavorite, toggleFavorite } = useSearchFavorites();

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
      minScore: 5,
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
    sessionStorage.removeItem('batchSearchResults');
    sessionStorage.removeItem('batchSearchFilters');
    sessionStorage.removeItem('batchSearchCompareList');
  }, []);

  // Update filters when business type changes
  const handleBusinessTypeChange = useCallback((businessType: string | null) => {
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

      const searchAreaLabel = `${filters.radiusMiles} mile${filters.radiusMiles !== 1 ? 's' : ''} radius`;

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

      // Step 2: Batch analyze parcels
      const analyzeResponse = await fetch('/api/search/batch-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parcels: parcelsData.parcels,
          minScore: filters.minScore,
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
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <Link href="/" className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <h2 className="text-2xl font-bold">Property Search</h2>
        </div>
        <p className="text-[var(--text-secondary)]">
          Search for properties within a radius - click the map or enter an address
        </p>
      </div>

      {/* Search Form */}
      <div className="terminal-card mb-8">
        <div className="terminal-header">
          <div className="terminal-dot red"></div>
          <div className="terminal-dot yellow"></div>
          <div className="terminal-dot green"></div>
          <span className="terminal-title">search_area.module</span>
        </div>
        <div className="terminal-body">
          {/* Map Selector */}
          <div className="mb-6">
            <SearchMapSelector
              center={filters.center}
              radiusMiles={filters.radiusMiles}
              onCenterChange={(center) => setFilters(prev => ({ ...prev, center }))}
              onRadiusChange={(radiusMiles) => setFilters(prev => ({ ...prev, radiusMiles }))}
            />
          </div>

          {/* Filter Controls */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            {/* Min Score */}
            <div>
              <label className="block text-sm text-[var(--text-muted)] mb-2">
                Minimum Score: {filters.minScore}
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={filters.minScore}
                onChange={(e) => setFilters(prev => ({ ...prev, minScore: parseInt(e.target.value) }))}
                className="w-full accent-[var(--accent-cyan)]"
              />
              <div className="flex justify-between text-xs text-[var(--text-muted)]">
                <span>1</span>
                <span>10</span>
              </div>
            </div>

            {/* Property Type */}
            <div>
              <label className="block text-sm text-[var(--text-muted)] mb-2">Property Type</label>
              <select
                value={filters.propertyType}
                onChange={(e) => setFilters(prev => ({ ...prev, propertyType: e.target.value as 'all' | 'vacant' | 'commercial' }))}
                className="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg focus:outline-none focus:border-[var(--accent-cyan)]"
              >
                <option value="all">All Properties</option>
                <option value="vacant">Vacant Land</option>
                <option value="commercial">Commercial</option>
              </select>
            </div>

            {/* Business Type Preset */}
            <div>
              <label className="block text-sm text-[var(--text-muted)] mb-2">Business Type</label>
              <select
                value={filters.businessType || ''}
                onChange={(e) => handleBusinessTypeChange(e.target.value || null)}
                className="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg focus:outline-none focus:border-[var(--accent-cyan)]"
              >
                <option value="">No preset</option>
                {businessTypeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Search Button */}
            <div className="flex items-end gap-2">
              <button
                onClick={handleSearch}
                disabled={loading || !filters.center}
                className="flex-1 btn-primary flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Searching...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Search Area
                  </>
                )}
              </button>
              {results && (
                <button
                  onClick={resetSearch}
                  disabled={loading}
                  className="btn-secondary flex items-center justify-center gap-2 px-4"
                  title="Clear results and start new search"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Advanced Filters Toggle */}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="flex items-center gap-2 text-sm text-[var(--accent-cyan)] hover:text-[var(--accent-cyan)]/80 mb-4"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showAdvancedFilters ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Advanced Filters
            {(filters.minAcres || filters.maxAcres || filters.zoningTypes.length > 0 || filters.minRoadFrontage || filters.cornerLotOnly) && (
              <span className="px-1.5 py-0.5 bg-[var(--accent-cyan)]/20 text-[var(--accent-cyan)] rounded text-xs">
                Active
              </span>
            )}
          </button>

          {/* Advanced Filters Panel */}
          {showAdvancedFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-[var(--bg-tertiary)] rounded-lg mb-4">
              {/* Min/Max Acreage */}
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-2">Acreage Range</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={filters.minAcres ?? ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, minAcres: e.target.value ? parseFloat(e.target.value) : null }))}
                    placeholder="Min"
                    step="0.1"
                    min="0"
                    className="w-1/2 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg focus:outline-none focus:border-[var(--accent-cyan)] text-sm"
                  />
                  <input
                    type="number"
                    value={filters.maxAcres ?? ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, maxAcres: e.target.value ? parseFloat(e.target.value) : null }))}
                    placeholder="Max"
                    step="0.1"
                    min="0"
                    className="w-1/2 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg focus:outline-none focus:border-[var(--accent-cyan)] text-sm"
                  />
                </div>
              </div>

              {/* Road Frontage */}
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-2">
                  Min Road Frontage: {filters.minRoadFrontage ?? 0} ft
                </label>
                <input
                  type="range"
                  min="0"
                  max="500"
                  step="25"
                  value={filters.minRoadFrontage ?? 0}
                  onChange={(e) => setFilters(prev => ({ ...prev, minRoadFrontage: parseInt(e.target.value) || null }))}
                  className="w-full accent-[var(--accent-cyan)]"
                />
                <div className="flex justify-between text-xs text-[var(--text-muted)]">
                  <span>0</span>
                  <span>500 ft</span>
                </div>
              </div>

              {/* Corner Lot */}
              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.cornerLotOnly}
                    onChange={(e) => setFilters(prev => ({ ...prev, cornerLotOnly: e.target.checked }))}
                    className="w-4 h-4 accent-[var(--accent-cyan)]"
                  />
                  <span className="text-sm text-[var(--text-secondary)]">Corner Lot Only</span>
                </label>
              </div>

              {/* Clear Filters */}
              <div className="flex items-center justify-end">
                <button
                  onClick={() => setFilters(prev => ({
                    ...prev,
                    minAcres: null,
                    maxAcres: null,
                    zoningTypes: [],
                    minRoadFrontage: null,
                    cornerLotOnly: false,
                    businessType: null,
                  }))}
                  className="text-sm text-red-400 hover:text-red-300"
                >
                  Clear Filters
                </button>
              </div>

              {/* Zoning Types - Full Width */}
              <div className="md:col-span-2 lg:col-span-4">
                <label className="block text-sm text-[var(--text-muted)] mb-2">Zoning Types</label>
                <div className="flex flex-wrap gap-2">
                  {ZONING_TYPES.map(zone => (
                    <label
                      key={zone.code}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer text-xs transition-colors ${
                        filters.zoningTypes.includes(zone.code)
                          ? 'bg-[var(--accent-cyan)]/20 border border-[var(--accent-cyan)] text-[var(--accent-cyan)]'
                          : 'bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--accent-cyan)]/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={filters.zoningTypes.includes(zone.code)}
                        onChange={() => handleZoningToggle(zone.code)}
                        className="hidden"
                      />
                      {zone.code}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {loading && (
            <div className="mt-4">
              <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--accent-cyan)] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1 text-center">
                {progress < 30 ? 'Fetching parcels in radius...' : progress < 80 ? 'Analyzing properties with real traffic data...' : 'Finalizing results...'}
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {results && (
        <>
          {/* Results Header */}
          <div className="terminal-card mb-4">
            <div className="terminal-header">
              <div className="terminal-dot red"></div>
              <div className="terminal-dot yellow"></div>
              <div className="terminal-dot green"></div>
              <span className="terminal-title">search_results.output</span>
            </div>
            <div className="terminal-body">
              <div className="flex flex-wrap items-center justify-between gap-4">
                {/* Stats */}
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-2xl font-bold text-[var(--accent-cyan)]">{sortedResults.length}</p>
                    <p className="text-xs text-[var(--text-muted)]">Matching Properties</p>
                  </div>
                  <div>
                    <p className="text-lg text-[var(--text-secondary)]">{results.totalParcels}</p>
                    <p className="text-xs text-[var(--text-muted)]">Total in {results.searchArea}</p>
                  </div>
                  <div>
                    <p className="text-lg text-[var(--text-secondary)]">{(results.searchTime / 1000).toFixed(1)}s</p>
                    <p className="text-xs text-[var(--text-muted)]">Search Time</p>
                  </div>
                  {compareList.length > 0 && (
                    <div>
                      <p className="text-lg text-purple-400">{compareList.length}/4</p>
                      <p className="text-xs text-[var(--text-muted)]">In Compare</p>
                    </div>
                  )}
                </div>

                {/* Controls */}
                <div className="flex items-center gap-4">
                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-[var(--bg-tertiary)] rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`px-3 py-1.5 rounded text-sm transition-colors ${
                        viewMode === 'grid'
                          ? 'bg-[var(--accent-cyan)] text-black'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      Grid
                    </button>
                    <button
                      onClick={() => setViewMode('map')}
                      className={`px-3 py-1.5 rounded text-sm transition-colors ${
                        viewMode === 'map'
                          ? 'bg-[var(--accent-cyan)] text-black'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      Map
                    </button>
                    <button
                      onClick={() => setViewMode('compare')}
                      className={`px-3 py-1.5 rounded text-sm transition-colors ${
                        viewMode === 'compare'
                          ? 'bg-[var(--accent-cyan)] text-black'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      Compare
                      {compareList.length > 0 && (
                        <span className="ml-1.5 px-1.5 py-0.5 bg-purple-500 text-white rounded-full text-xs">
                          {compareList.length}
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Sort Controls */}
                  {viewMode === 'grid' && (
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-[var(--text-muted)]">Sort:</label>
                      <select
                        value={sortField}
                        onChange={(e) => setSortField(e.target.value as SortField)}
                        className="px-2 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-sm"
                      >
                        <option value="score">Feasibility Score</option>
                        <option value="lotSize">Lot Size</option>
                        <option value="vpd">Est. VPD</option>
                        <option value="address">Address</option>
                      </select>
                      <button
                        onClick={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')}
                        className="p-1 hover:bg-[var(--bg-tertiary)] rounded"
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
                    className="btn-secondary flex items-center gap-2 text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export CSV
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* View Content */}
          {viewMode === 'map' && (
            <div className="mb-8">
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
            <div className="mb-8">
              <PropertyCompare
                properties={compareList}
                onRemove={removeFromCompare}
                onClear={clearCompare}
              />
            </div>
          )}

          {viewMode === 'grid' && (
            <div className="space-y-4">
              {groupedResults.length > 0 ? (
                <>
                  {/* Asset Class Summary Bar */}
                  <div className="terminal-card">
                    <div className="terminal-body">
                      <div className="flex flex-wrap gap-2">
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
                              <span className="font-medium">{assetClass}</span>
                              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                                isCollapsed ? 'bg-[var(--bg-secondary)]' : 'bg-black/20'
                              }`}>
                                {items.length}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Asset Class Sections */}
                  {groupedResults.map(([assetClass, items]) => {
                    const config = ASSET_CLASS_CONFIG[assetClass];
                    const isCollapsed = collapsedClasses.has(assetClass);
                    const avgScore = items.reduce((sum, p) => sum + p.score, 0) / items.length;
                    const topScore = items[0]?.score || 0;

                    return (
                      <div key={assetClass} className="terminal-card">
                        {/* Asset Class Header */}
                        <button
                          onClick={() => toggleAssetClass(assetClass)}
                          className="w-full terminal-body flex items-center justify-between cursor-pointer hover:bg-[var(--bg-tertiary)]/50 transition-colors rounded-t-lg"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{config.icon}</span>
                            <div className="text-left">
                              <h3 className="text-lg font-bold">{assetClass}</h3>
                              <p className="text-xs text-[var(--text-muted)]">
                                {items.length} {items.length === 1 ? 'property' : 'properties'} &middot; Avg Score: {avgScore.toFixed(1)} &middot; Top: {topScore.toFixed(1)}
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
                          <div className="terminal-body border-t border-[var(--border-color)]">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {items.map((property) => {
                                const isInCompare = compareList.some(p => p.parcelId === property.parcelId);
                                const isFav = isFavorite(property.parcelId);

                                return (
                                  <div
                                    key={property.parcelId}
                                    className={`p-4 bg-[var(--bg-tertiary)] rounded-lg border transition-colors ${
                                      isInCompare
                                        ? 'border-purple-500/50'
                                        : 'border-[var(--border-color)] hover:border-[var(--accent-cyan)]/50'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between mb-3">
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate" title={property.address}>
                                          {property.address}
                                        </p>
                                        <p className="text-xs text-[var(--text-muted)]">ID: {property.parcelId}</p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => toggleFavorite(property)}
                                          className={`p-1 rounded transition-colors ${
                                            isFav
                                              ? 'text-red-400 hover:text-red-300'
                                              : 'text-[var(--text-muted)] hover:text-red-400'
                                          }`}
                                          title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                                        >
                                          <svg className="w-5 h-5" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                          </svg>
                                        </button>
                                        <div className={`px-2 py-1 rounded border text-sm font-bold ${getScoreColor(property.score)}`}>
                                          {property.score.toFixed(1)}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                                      <div>
                                        <span className="text-[var(--text-muted)]">Lot Size:</span>
                                        <p className="font-medium">{property.lotSizeAcres?.toFixed(2) || 'N/A'} acres</p>
                                      </div>
                                      <div>
                                        <span className="text-[var(--text-muted)]">Est. VPD:</span>
                                        <p className="font-medium">{property.estimatedVPD?.toLocaleString() || 'N/A'}</p>
                                      </div>
                                      <div>
                                        <span className="text-[var(--text-muted)]">Zoning:</span>
                                        <p className="font-medium">{property.zoning || 'N/A'}</p>
                                      </div>
                                      <div>
                                        <span className="text-[var(--text-muted)]">Nearby Businesses:</span>
                                        <p className="font-medium">{property.nearbyBusinesses ?? 'N/A'}</p>
                                      </div>
                                    </div>

                                    {/* Score Breakdown */}
                                    <div className="flex gap-1 mb-3">
                                      {[
                                        { label: 'Traffic', value: property.factors.trafficScore },
                                        { label: 'Business', value: property.factors.businessDensity },
                                        { label: 'Zoning', value: property.factors.zoningScore },
                                        { label: 'Access', value: property.factors.accessScore },
                                      ].map((factor) => (
                                        <div
                                          key={factor.label}
                                          className="flex-1 text-center p-1 bg-[var(--bg-secondary)] rounded"
                                          title={`${factor.label}: ${factor.value.toFixed(1)}`}
                                        >
                                          <div className="text-[8px] text-[var(--text-muted)] uppercase">{factor.label}</div>
                                          <div className="text-xs font-medium">{factor.value.toFixed(1)}</div>
                                        </div>
                                      ))}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                      <Link
                                        href={`/?lat=${property.coordinates.lat}&lng=${property.coordinates.lng}`}
                                        className="flex-1 text-center py-1.5 text-xs bg-[var(--accent-cyan)]/20 text-[var(--accent-cyan)] rounded hover:bg-[var(--accent-cyan)]/30 transition-colors"
                                      >
                                        View Analysis
                                      </Link>
                                      <button
                                        onClick={() => isInCompare ? removeFromCompare(property.parcelId) : addToCompare(property)}
                                        disabled={!isInCompare && compareList.length >= 4}
                                        className={`px-3 py-1.5 text-xs rounded transition-colors ${
                                          isInCompare
                                            ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                                            : compareList.length >= 4
                                            ? 'bg-[var(--bg-secondary)] text-[var(--text-muted)] cursor-not-allowed'
                                            : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'
                                        }`}
                                        title={isInCompare ? 'Remove from compare' : compareList.length >= 4 ? 'Max 4 properties' : 'Add to compare'}
                                      >
                                        {isInCompare ? '- Compare' : '+ Compare'}
                                      </button>
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
                <div className="terminal-card">
                  <div className="terminal-body text-center py-12 text-[var(--text-muted)]">
                    <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p>No properties found matching your criteria</p>
                    <p className="text-sm mt-2">Try adjusting your filters or increasing the search radius</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
