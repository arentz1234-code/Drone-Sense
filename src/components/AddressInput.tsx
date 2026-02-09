'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';

// Dynamic import for mini map to avoid SSR issues
const MiniMap = dynamic(() => import('./MiniMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[200px] bg-[var(--bg-tertiary)] rounded-lg">
      <div className="text-center text-[var(--text-muted)]">
        <svg className="animate-spin w-6 h-6 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
        <p className="text-xs">Loading map...</p>
      </div>
    </div>
  )
});

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
  const [reverseGeocoding, setReverseGeocoding] = useState(false);
  const [showMap, setShowMap] = useState(false);

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

  // Reverse geocode coordinates to get address
  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string | null> => {
    setReverseGeocoding(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
        { headers: { 'User-Agent': 'DroneSense/1.0' } }
      );

      if (!response.ok) throw new Error('Reverse geocoding failed');

      const data = await response.json();

      if (data.address) {
        const { house_number, road, city, town, village, state, postcode } = data.address;
        const streetAddress = house_number && road ? `${house_number} ${road}` : road || '';
        const locality = city || town || village || '';
        const parts = [streetAddress, locality, state, postcode].filter(Boolean);
        return parts.join(', ') || data.display_name || null;
      }

      return data.display_name || null;
    } catch (err) {
      console.error('Reverse geocoding error:', err);
      return null;
    } finally {
      setReverseGeocoding(false);
    }
  }, []);

  // Handle pin drop or drag on mini map
  const handlePinChange = useCallback(async (coords: { lat: number; lng: number }) => {
    setCoordinates(coords);

    // Reverse geocode to get address
    const newAddress = await reverseGeocode(coords.lat, coords.lng);
    if (newAddress) {
      setAddress(newAddress);
    }
  }, [setCoordinates, setAddress, reverseGeocode]);

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
            {reverseGeocoding && (
              <span className="text-xs text-[var(--accent-cyan)] flex items-center gap-1">
                <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Getting address...
              </span>
            )}
          </div>
        )}

        {/* Toggle Map Button */}
        <button
          onClick={() => setShowMap(!showMap)}
          className="w-full py-2 px-3 text-sm border border-dashed border-[var(--border-color)] rounded-lg hover:border-[var(--accent-cyan)] hover:bg-[var(--bg-tertiary)] transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {showMap ? 'Hide Map' : 'Or drop a pin on the map'}
          <svg className={`w-4 h-4 transition-transform ${showMap ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Mini Map for Pin Dropping */}
        {showMap && (
          <div className="relative rounded-lg overflow-hidden border border-[var(--border-color)]">
            <MiniMap
              coordinates={coordinates}
              onPinChange={handlePinChange}
            />
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-center">
              <div className="bg-[var(--bg-primary)]/90 backdrop-blur-sm px-3 py-1.5 rounded text-xs text-[var(--text-muted)] flex items-center gap-2">
                <svg className="w-4 h-4 text-[var(--accent-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
                Click to drop pin, drag to adjust
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
