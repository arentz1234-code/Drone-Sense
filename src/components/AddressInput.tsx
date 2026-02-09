'use client';

import { useState } from 'react';

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

  const handleGeocode = async () => {
    if (!address.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Geocoding failed');
      }

      setCoordinates({
        lat: data.lat,
        lng: data.lng,
      });
    } catch (error) {
      console.error('Geocoding error:', error);
      alert(error instanceof Error ? error.message : 'Failed to locate address. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3 className="font-semibold text-[var(--text-primary)] mb-4">Property Location</h3>

      <div className="space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter property address..."
            className="terminal-input flex-1"
          />
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

        {/* Hint to use main map */}
        <p className="text-xs text-[var(--text-muted)] text-center">
          You can also drop a pin on the map below to set location
        </p>
      </div>
    </div>
  );
}
