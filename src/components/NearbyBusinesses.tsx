'use client';

import { useState, useEffect } from 'react';
import { Business } from '@/app/page';

interface NearbyBusinessesProps {
  coordinates: { lat: number; lng: number } | null;
  businesses: Business[];
  setBusinesses: (businesses: Business[]) => void;
  manualBusinesses: Business[];
  setManualBusinesses: (businesses: Business[]) => void;
}

const RADIUS_OPTIONS = [
  { value: 0.1, label: '0.1 mi' },
  { value: 0.25, label: '0.25 mi' },
  { value: 0.5, label: '0.5 mi' },
  { value: 1, label: '1 mi' },
  { value: 2, label: '2 mi' },
  { value: 3, label: '3 mi' },
  { value: 5, label: '5 mi' },
  { value: 10, label: '10 mi' },
  { value: 15, label: '15 mi' },
  { value: 20, label: '20 mi' },
  { value: 25, label: '25 mi' },
];

const BUSINESS_TYPES = [
  'Restaurant',
  'Cafe',
  'Fast Food',
  'Bank',
  'Pharmacy',
  'Gas Station',
  'Grocery',
  'Convenience',
  'Mall',
];

export default function NearbyBusinesses({
  coordinates,
  businesses,
  setBusinesses,
  manualBusinesses,
  setManualBusinesses,
}: NearbyBusinessesProps) {
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [radiusMiles, setRadiusMiles] = useState(0.5);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [newBusiness, setNewBusiness] = useState({
    name: '',
    type: '',
    distance: '',
    address: '',
  });

  const fetchNearbyBusinesses = async (radius?: number) => {
    if (!coordinates) return;

    const radiusMeters = Math.round((radius ?? radiusMiles) * 1609.34); // Convert miles to meters

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

  const handleRadiusChange = (newRadius: number) => {
    setRadiusMiles(newRadius);
    if (coordinates) {
      setBusinesses([]);
      fetchNearbyBusinesses(newRadius);
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

  // Auto-scan when coordinates change
  useEffect(() => {
    if (coordinates) {
      setBusinesses([]); // Clear old results
      fetchNearbyBusinesses(radiusMiles);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinates?.lat, coordinates?.lng]);

  // Filter businesses based on selected types
  const filteredBusinesses = selectedTypes.length === 0
    ? businesses
    : businesses.filter(b => selectedTypes.includes(b.type));

  const addManualBusiness = () => {
    if (!newBusiness.name || !newBusiness.type) return;

    setManualBusinesses([
      ...manualBusinesses,
      {
        ...newBusiness,
        distance: newBusiness.distance || 'N/A',
        address: newBusiness.address || 'Manually added',
      },
    ]);
    setNewBusiness({ name: '', type: '', distance: '', address: '' });
    setShowAddForm(false);
  };

  const removeBusiness = (index: number, isManual: boolean) => {
    if (isManual) {
      setManualBusinesses(manualBusinesses.filter((_, i) => i !== index));
    } else {
      setBusinesses(businesses.filter((_, i) => i !== index));
    }
  };

  const filteredManual = selectedTypes.length === 0
    ? manualBusinesses
    : manualBusinesses.filter(b => selectedTypes.includes(b.type));
  const allBusinesses = [...filteredBusinesses, ...filteredManual];

  const getTypeColor = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('restaurant') || t.includes('food')) return 'tag-orange';
    if (t.includes('retail') || t.includes('store') || t.includes('shop')) return 'tag-blue';
    if (t.includes('gas') || t.includes('fuel')) return 'tag-green';
    return 'tag-cyan';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[var(--text-primary)]">Nearby Businesses</h3>
        <div className="flex gap-2 items-center">
          <select
            value={radiusMiles}
            onChange={(e) => handleRadiusChange(parseFloat(e.target.value))}
            className="terminal-input text-xs py-1 px-2 w-20"
          >
            {RADIUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={() => setShowAddForm(true)}
            className="btn-secondary text-xs py-1 px-3"
          >
            + Add
          </button>
          <button
            onClick={() => fetchNearbyBusinesses()}
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
            Scan
          </button>
        </div>
      </div>

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

      {/* Add Manual Business Form */}
      {showAddForm && (
        <div className="mb-4 p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              type="text"
              placeholder="Business name"
              value={newBusiness.name}
              onChange={(e) => setNewBusiness({ ...newBusiness, name: e.target.value })}
              className="terminal-input text-sm"
            />
            <input
              type="text"
              placeholder="Type (e.g., Restaurant)"
              value={newBusiness.type}
              onChange={(e) => setNewBusiness({ ...newBusiness, type: e.target.value })}
              className="terminal-input text-sm"
            />
            <input
              type="text"
              placeholder="Distance (e.g., 0.2 mi)"
              value={newBusiness.distance}
              onChange={(e) => setNewBusiness({ ...newBusiness, distance: e.target.value })}
              className="terminal-input text-sm"
            />
            <input
              type="text"
              placeholder="Address (optional)"
              value={newBusiness.address}
              onChange={(e) => setNewBusiness({ ...newBusiness, address: e.target.value })}
              className="terminal-input text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={addManualBusiness} className="btn-primary text-xs py-2 px-4">
              Add Business
            </button>
            <button onClick={() => setShowAddForm(false)} className="btn-secondary text-xs py-2 px-4">
              Cancel
            </button>
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
            Enter an address to scan nearby businesses
          </p>
        </div>
      )}

      {/* Business List */}
      {allBusinesses.length > 0 && (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {filteredBusinesses.map((business, index) => (
            <div
              key={`api-${index}`}
              className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{business.name}</span>
                  <span className={`tag ${getTypeColor(business.type)}`}>{business.type}</span>
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-1">
                  {business.distance} • {business.address}
                </div>
              </div>
              <button
                onClick={() => removeBusiness(index, false)}
                className="text-[var(--text-muted)] hover:text-[var(--accent-red)] ml-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          {filteredManual.map((business, index) => (
            <div
              key={`manual-${index}`}
              className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--accent-cyan)] border-opacity-30"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{business.name}</span>
                  <span className={`tag ${getTypeColor(business.type)}`}>{business.type}</span>
                  <span className="text-xs text-[var(--accent-cyan)]">(manual)</span>
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-1">
                  {business.distance} • {business.address}
                </div>
              </div>
              <button
                onClick={() => removeBusiness(index, true)}
                className="text-[var(--text-muted)] hover:text-[var(--accent-red)] ml-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {coordinates && allBusinesses.length === 0 && !loading && (
        <div className="text-center py-6 text-[var(--text-muted)] text-sm">
          {businesses.length > 0 && selectedTypes.length > 0
            ? 'No businesses match your filters'
            : 'Click "Scan" to find nearby businesses or add them manually'}
        </div>
      )}

      {/* Summary */}
      {(businesses.length > 0 || manualBusinesses.length > 0) && (
        <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--text-muted)]">
              {selectedTypes.length > 0 ? 'Showing:' : 'Total businesses:'}
            </span>
            <span className="text-[var(--accent-green)] font-mono">
              {selectedTypes.length > 0
                ? `${allBusinesses.length} of ${businesses.length + manualBusinesses.length}`
                : allBusinesses.length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
