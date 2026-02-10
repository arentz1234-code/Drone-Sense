'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';

interface QuickFeasibility {
  parcelId: string;
  address: string;
  coordinates: { lat: number; lng: number };
  lotSize?: number;
  lotSizeAcres?: number;
  score: number;
  factors: {
    trafficScore: number;
    businessDensity: number;
    zoningScore: number;
    accessScore: number;
  };
  zoning?: string;
  nearbyBusinesses?: number;
  estimatedVPD?: number;
}

interface SearchResults {
  totalParcels: number;
  matchingParcels: number;
  results: QuickFeasibility[];
  zipCode: string;
  searchTime: number;
}

type SortField = 'score' | 'lotSize' | 'address';
type SortDirection = 'asc' | 'desc';

const ITEMS_PER_PAGE = 25;

export default function SearchPage() {
  const [zipCode, setZipCode] = useState('');
  const [minScore, setMinScore] = useState(5);
  const [propertyType, setPropertyType] = useState<'all' | 'vacant' | 'commercial'>('all');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  const handleSearch = async () => {
    if (!zipCode || zipCode.length !== 5 || !/^\d{5}$/.test(zipCode)) {
      setError('Please enter a valid 5-digit zip code');
      return;
    }

    setLoading(true);
    setError(null);
    setProgress(0);
    setResults(null);
    setCurrentPage(1);

    try {
      // Step 1: Get parcels in zip code
      setProgress(10);
      const parcelsResponse = await fetch('/api/search/parcels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zipCode, propertyType }),
      });

      if (!parcelsResponse.ok) {
        const data = await parcelsResponse.json();
        throw new Error(data.error || 'Failed to fetch parcels');
      }

      const parcelsData = await parcelsResponse.json();
      setProgress(30);

      if (parcelsData.parcels.length === 0) {
        setResults({
          totalParcels: 0,
          matchingParcels: 0,
          results: [],
          zipCode,
          searchTime: 0,
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
          minScore,
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
        zipCode,
        searchTime: analysisData.searchTime,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-400 bg-green-400/20 border-green-400/50';
    if (score >= 5) return 'text-yellow-400 bg-yellow-400/20 border-yellow-400/50';
    return 'text-red-400 bg-red-400/20 border-red-400/50';
  };

  const sortedResults = results?.results
    ? [...results.results].sort((a, b) => {
        let comparison = 0;
        switch (sortField) {
          case 'score':
            comparison = a.score - b.score;
            break;
          case 'lotSize':
            comparison = (a.lotSize || 0) - (b.lotSize || 0);
            break;
          case 'address':
            comparison = a.address.localeCompare(b.address);
            break;
        }
        return sortDirection === 'desc' ? -comparison : comparison;
      })
    : [];

  const paginatedResults = sortedResults.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const totalPages = Math.ceil(sortedResults.length / ITEMS_PER_PAGE);

  const exportToCSV = useCallback(() => {
    if (!results) return;

    const headers = ['Address', 'Parcel ID', 'Lot Size (sqft)', 'Lot Size (acres)', 'Feasibility Score', 'Traffic Score', 'Business Density', 'Zoning Score', 'Access Score', 'Estimated VPD', 'Zoning', 'Latitude', 'Longitude'];
    const rows = sortedResults.map(r => [
      r.address,
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
    a.download = `property-search-${results.zipCode}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [results, sortedResults]);

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
          Search for properties by zip code and filter by feasibility score
        </p>
      </div>

      {/* Search Form */}
      <div className="terminal-card mb-8">
        <div className="terminal-header">
          <div className="terminal-dot red"></div>
          <div className="terminal-dot yellow"></div>
          <div className="terminal-dot green"></div>
          <span className="terminal-title">search_filters.module</span>
        </div>
        <div className="terminal-body">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Zip Code */}
            <div>
              <label className="block text-sm text-[var(--text-muted)] mb-2">Zip Code</label>
              <input
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="33602"
                className="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg focus:outline-none focus:border-[var(--accent-cyan)]"
                maxLength={5}
              />
            </div>

            {/* Min Score */}
            <div>
              <label className="block text-sm text-[var(--text-muted)] mb-2">
                Minimum Score: {minScore}
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={minScore}
                onChange={(e) => setMinScore(parseInt(e.target.value))}
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
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value as 'all' | 'vacant' | 'commercial')}
                className="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg focus:outline-none focus:border-[var(--accent-cyan)]"
              >
                <option value="all">All Properties</option>
                <option value="vacant">Vacant Land</option>
                <option value="commercial">Commercial</option>
              </select>
            </div>

            {/* Search Button */}
            <div className="flex items-end">
              <button
                onClick={handleSearch}
                disabled={loading || !zipCode}
                className="w-full btn-primary flex items-center justify-center gap-2"
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
                    Search Properties
                  </>
                )}
              </button>
            </div>
          </div>

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
                {progress < 30 ? 'Fetching parcels...' : progress < 80 ? 'Analyzing properties...' : 'Finalizing results...'}
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
        <div className="terminal-card">
          <div className="terminal-header">
            <div className="terminal-dot red"></div>
            <div className="terminal-dot yellow"></div>
            <div className="terminal-dot green"></div>
            <span className="terminal-title">search_results.output</span>
          </div>
          <div className="terminal-body">
            {/* Results Summary */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-2xl font-bold text-[var(--accent-cyan)]">{results.matchingParcels}</p>
                  <p className="text-xs text-[var(--text-muted)]">Matching Properties</p>
                </div>
                <div>
                  <p className="text-lg text-[var(--text-secondary)]">{results.totalParcels}</p>
                  <p className="text-xs text-[var(--text-muted)]">Total in {results.zipCode}</p>
                </div>
                <div>
                  <p className="text-lg text-[var(--text-secondary)]">{(results.searchTime / 1000).toFixed(1)}s</p>
                  <p className="text-xs text-[var(--text-muted)]">Search Time</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Sort Controls */}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-[var(--text-muted)]">Sort:</label>
                  <select
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value as SortField)}
                    className="px-2 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-sm"
                  >
                    <option value="score">Feasibility Score</option>
                    <option value="lotSize">Lot Size</option>
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

            {/* Results Grid */}
            {paginatedResults.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {paginatedResults.map((property) => (
                    <div
                      key={property.parcelId}
                      className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)] hover:border-[var(--accent-cyan)]/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate" title={property.address}>
                            {property.address}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">ID: {property.parcelId}</p>
                        </div>
                        <div className={`px-2 py-1 rounded border text-sm font-bold ${getScoreColor(property.score)}`}>
                          {property.score.toFixed(1)}
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
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 bg-[var(--bg-tertiary)] rounded disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-[var(--text-muted)]">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 bg-[var(--bg-tertiary)] rounded disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-[var(--text-muted)]">
                <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>No properties found matching your criteria</p>
                <p className="text-sm mt-2">Try lowering the minimum score or changing the property type</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
