'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchHistory, SearchHistoryItem } from '@/hooks/useSearchHistory';

interface AddressInputProps {
  address: string;
  setAddress: (address: string) => void;
  coordinates: { lat: number; lng: number } | null;
  setCoordinates: (coords: { lat: number; lng: number } | null) => void;
}

export default function AddressInput({
  address,
  setAddress,
  coordinates,
  setCoordinates,
}: AddressInputProps) {
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const { getRecentSearches, clearHistory } = useSearchHistory();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const recentSearches = getRecentSearches(5);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGeocode = async () => {
    if (!address.trim()) return;

    setLoading(true);
    setShowDropdown(false);
    try {
      const response = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Address not found');
      }

      setCoordinates({
        lat: data.lat,
        lng: data.lng,
      });
    } catch (error) {
      console.error('Geocoding error:', error);
      const errorMessage = error instanceof Error && error.message === 'Address not found'
        ? "We couldn't find that address. Try including the city and state (e.g., '123 Main St, Tallahassee, FL') or drop a pin on the map instead."
        : "We couldn't locate that address. Check your connection and try again, or drop a pin on the map instead.";
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRecent = (item: SearchHistoryItem) => {
    setAddress(item.address);
    setCoordinates(item.coordinates);
    setShowDropdown(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowDropdown(false);
    } else if (e.key === 'Enter' && address.trim()) {
      handleGeocode();
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div>
      <h3 className="font-semibold text-[var(--text-primary)] mb-4">Property Location</h3>

      <div className="space-y-4">
        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onFocus={() => recentSearches.length > 0 && setShowDropdown(true)}
                onKeyDown={handleKeyDown}
                placeholder="Enter property address..."
                className="terminal-input w-full"
              />

              {/* Recent Searches Dropdown */}
              {showDropdown && recentSearches.length > 0 && (
                <div
                  ref={dropdownRef}
                  className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg shadow-lg z-50 overflow-hidden address-dropdown-mobile"
                  style={{
                    maxHeight: 'min(40vh, 300px)',
                    overflowY: 'auto',
                    WebkitOverflowScrolling: 'touch',
                  }}
                >
                  <div className="p-2 border-b border-[var(--border-color)] flex items-center justify-between">
                    <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide">
                      Recent Searches
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm('Are you sure you want to delete all search history? This cannot be undone.')) {
                          clearHistory();
                          setShowDropdown(false);
                        }
                      }}
                      className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-red)] transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                  <ul className="max-h-64 overflow-y-auto">
                    {recentSearches.map((item) => (
                      <li key={item.id}>
                        <button
                          onClick={() => handleSelectRecent(item)}
                          className="w-full px-3 py-2.5 text-left hover:bg-[var(--bg-tertiary)] transition-colors flex items-center gap-3 group"
                        >
                          <svg
                            className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-cyan)] flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[var(--text-primary)] truncate group-hover:text-[var(--accent-cyan)] transition-colors">
                              {item.address}
                            </p>
                            <p className="text-xs text-[var(--text-muted)]">
                              {formatDate(item.timestamp)}
                              {item.feasibilityScore !== null && (
                                <span className="ml-2">
                                  Score: <span className="text-[var(--accent-green)]">{item.feasibilityScore.toFixed(1)}</span>
                                </span>
                              )}
                            </p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <button
              onClick={handleGeocode}
              disabled={loading || !address.trim()}
              className="btn-secondary flex items-center gap-2"
            >
              {loading ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
              Locate
            </button>
          </div>
        </div>

        {/* Coordinates Display */}
        {coordinates && (
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)]">LAT:</span>
              <span className="text-[var(--accent-green)] font-mono">{coordinates.lat.toFixed(6)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)]">LNG:</span>
              <span className="text-[var(--accent-green)] font-mono">{coordinates.lng.toFixed(6)}</span>
            </div>
          </div>
        )}

        {!coordinates && address && (
          <div className="text-center py-8 border border-dashed border-[var(--border-color)] rounded-lg">
            <p className="text-[var(--text-muted)] text-sm">
              Click &quot;Locate&quot; to find coordinates
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
