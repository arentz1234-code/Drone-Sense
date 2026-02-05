'use client';

import { useState, useEffect } from 'react';
import { Business } from '@/app/page';

interface MarketContext {
  population?: number;
  medianIncome?: number;
  isCollegeTown?: boolean;
  vpd?: number;
}

interface NearbyBusinessesProps {
  coordinates: { lat: number; lng: number } | null;
  businesses: Business[];
  setBusinesses: (businesses: Business[]) => void;
  marketContext?: MarketContext;
}

// Intelligently determine search radius based on market context
function calculateSmartRadius(context: MarketContext): { radius: number; reasoning: string } {
  const { population = 0, vpd = 0, isCollegeTown = false } = context;

  // College towns: students create dense, walkable markets
  if (isCollegeTown) {
    return {
      radius: 0.5,
      reasoning: 'College town - focused neighborhood market (0.5 mi)'
    };
  }

  // High traffic corridor: wider service area
  if (vpd >= 25000) {
    return {
      radius: 2,
      reasoning: 'High-traffic corridor - regional draw (2 mi)'
    };
  }

  // Small town: need to search wider, fewer options
  if (population > 0 && population < 5000) {
    return {
      radius: 5,
      reasoning: 'Small town market - wider search (5 mi)'
    };
  }

  // Medium town
  if (population >= 5000 && population < 25000) {
    return {
      radius: 2,
      reasoning: 'Town-wide market (2 mi)'
    };
  }

  // Suburban / medium traffic
  if (vpd >= 15000 || (population >= 25000 && population < 100000)) {
    return {
      radius: 1.5,
      reasoning: 'Suburban market area (1.5 mi)'
    };
  }

  // Urban / high density
  if (population >= 100000) {
    return {
      radius: 0.75,
      reasoning: 'Urban neighborhood market (0.75 mi)'
    };
  }

  // Default: moderate suburban
  return {
    radius: 1,
    reasoning: 'Local market area (1 mi)'
  };
}

// Analyze market saturation for different business types
function analyzeMarketSaturation(businesses: Business[], population: number): {
  type: string;
  count: number;
  saturation: 'undersaturated' | 'balanced' | 'saturated';
  note: string;
}[] {
  const typeCount: Record<string, number> = {};
  businesses.forEach(b => {
    const type = b.type || 'Other';
    typeCount[type] = (typeCount[type] || 0) + 1;
  });

  // Population thresholds per business type (approximate)
  const thresholds: Record<string, number> = {
    'Grocery': 8000,      // 1 grocery per 8k people
    'Fast Food': 3000,    // 1 fast food per 3k people
    'Restaurant': 2000,   // 1 restaurant per 2k people
    'Gas Station': 5000,  // 1 gas station per 5k people
    'Pharmacy': 10000,    // 1 pharmacy per 10k people
    'Bank': 8000,         // 1 bank per 8k people
    'Cafe': 4000,         // 1 cafe per 4k people
    'Convenience': 3000,  // 1 convenience per 3k people
  };

  return Object.entries(typeCount).map(([type, count]) => {
    const threshold = thresholds[type] || 5000;
    const expectedCount = Math.max(1, Math.floor(population / threshold));
    const ratio = count / expectedCount;

    let saturation: 'undersaturated' | 'balanced' | 'saturated';
    let note: string;

    if (ratio < 0.7) {
      saturation = 'undersaturated';
      note = `Room for ${Math.ceil(expectedCount - count)} more`;
    } else if (ratio > 1.5) {
      saturation = 'saturated';
      note = `High competition (${count} serving ${population.toLocaleString()} people)`;
    } else {
      saturation = 'balanced';
      note = 'Healthy market density';
    }

    return { type, count, saturation, note };
  });
}

const BUSINESS_TYPES = [
  'Restaurant',
  'Cafe',
  'Fast Food',
  'Bank',
  'Pharmacy',
  'Gas Station',
  'Grocery',
  'Convenience',
];

export default function NearbyBusinesses({
  coordinates,
  businesses,
  setBusinesses,
  marketContext,
}: NearbyBusinessesProps) {
  const [loading, setLoading] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [marketRadius, setMarketRadius] = useState<{ radius: number; reasoning: string } | null>(null);

  const fetchNearbyBusinesses = async (radius: number) => {
    if (!coordinates) return;

    const radiusMeters = Math.round(radius * 1609.34);

    setLoading(true);
    try {
      const response = await fetch('/api/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinates, radius: radiusMeters }),
      });

      if (response.ok) {
        const data = await response.json();
        setBusinesses(data.businesses || []);
      }
    } catch (error) {
      console.error('Error fetching nearby businesses:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTypeFilter = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const clearFilters = () => {
    setSelectedTypes([]);
  };

  // Calculate smart radius when context changes
  useEffect(() => {
    if (marketContext) {
      const smart = calculateSmartRadius(marketContext);
      setMarketRadius(smart);
    }
  }, [marketContext?.population, marketContext?.vpd, marketContext?.isCollegeTown]);

  // Auto-scan when coordinates change and we have a radius
  useEffect(() => {
    if (coordinates && marketRadius) {
      setBusinesses([]);
      fetchNearbyBusinesses(marketRadius.radius);
    }
  }, [coordinates?.lat, coordinates?.lng, marketRadius?.radius]);

  // Filter businesses based on selected types
  const filteredBusinesses = selectedTypes.length === 0
    ? businesses
    : businesses.filter(b => selectedTypes.includes(b.type));

  // Market saturation analysis
  const saturationAnalysis = marketContext?.population
    ? analyzeMarketSaturation(businesses, marketContext.population)
    : [];

  const getTypeColor = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('restaurant') || t.includes('food')) return 'tag-orange';
    if (t.includes('retail') || t.includes('store') || t.includes('shop')) return 'tag-blue';
    if (t.includes('gas') || t.includes('fuel')) return 'tag-green';
    return 'tag-cyan';
  };

  const getSaturationColor = (sat: string) => {
    if (sat === 'undersaturated') return 'text-green-400';
    if (sat === 'saturated') return 'text-red-400';
    return 'text-cyan-400';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[var(--text-primary)]">Market Analysis</h3>
        <button
          onClick={() => marketRadius && fetchNearbyBusinesses(marketRadius.radius)}
          disabled={loading || !coordinates}
          className="btn-secondary text-xs py-1 px-3 flex items-center gap-1"
        >
          {loading ? (
            <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
          ) : (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          Rescan
        </button>
      </div>

      {/* Smart Radius Indicator */}
      {marketRadius && coordinates && (
        <div className="mb-4 p-2 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
          <div className="flex items-center gap-2 text-xs">
            <svg className="w-4 h-4 text-[var(--accent-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <span className="text-[var(--text-secondary)]">{marketRadius.reasoning}</span>
          </div>
        </div>
      )}

      {/* No Location Warning */}
      {!coordinates && (
        <div className="text-center py-8 border border-dashed border-[var(--border-color)] rounded-lg">
          <svg className="w-10 h-10 mx-auto mb-2 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          </svg>
          <p className="text-[var(--text-muted)] text-sm">
            Enter an address to analyze the market
          </p>
        </div>
      )}

      {/* Market Saturation Analysis */}
      {saturationAnalysis.length > 0 && (
        <div className="mb-4">
          <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Market Saturation</span>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {saturationAnalysis.slice(0, 6).map((item, i) => (
              <div key={i} className="p-2 bg-[var(--bg-tertiary)] rounded border border-[var(--border-color)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{item.type}</span>
                  <span className={`text-xs font-bold ${getSaturationColor(item.saturation)}`}>
                    {item.count}
                  </span>
                </div>
                <p className={`text-xs mt-1 ${getSaturationColor(item.saturation)}`}>
                  {item.note}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Type Filters */}
      {businesses.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[var(--text-muted)]">Filter by type:</span>
            {selectedTypes.length > 0 && (
              <button
                onClick={clearFilters}
                className="text-xs text-[var(--accent-cyan)] hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {BUSINESS_TYPES.map(type => (
              <button
                key={type}
                onClick={() => toggleTypeFilter(type)}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  selectedTypes.includes(type)
                    ? 'bg-[var(--accent-cyan)] text-black border-[var(--accent-cyan)]'
                    : 'bg-transparent text-[var(--text-secondary)] border-[var(--border-color)] hover:border-[var(--accent-cyan)]'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Business List */}
      {filteredBusinesses.length > 0 && (
        <div className="space-y-2 max-h-[200px] overflow-y-auto">
          {filteredBusinesses.map((business, index) => (
            <div
              key={`${business.name}-${index}`}
              className="p-2 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-xs">{business.name}</span>
                <span className={`tag text-xs ${getTypeColor(business.type)}`}>{business.type}</span>
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                {business.distance}
              </div>
            </div>
          ))}
        </div>
      )}

      {coordinates && filteredBusinesses.length === 0 && !loading && businesses.length === 0 && (
        <div className="text-center py-6 text-[var(--text-muted)] text-sm">
          Scanning market area...
        </div>
      )}

      {/* Summary */}
      {businesses.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--text-muted)]">
              Businesses in market area:
            </span>
            <span className="text-[var(--accent-green)] font-mono">
              {businesses.length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
