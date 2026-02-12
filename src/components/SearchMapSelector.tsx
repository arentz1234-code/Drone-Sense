'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface SearchMapSelectorProps {
  center: { lat: number; lng: number } | null;
  radiusMiles: number;
  onCenterChange: (center: { lat: number; lng: number }) => void;
  onRadiusChange: (radius: number) => void;
}

const RADIUS_OPTIONS = [
  { value: 0.25, label: '¼ mile' },
  { value: 0.5, label: '½ mile' },
  { value: 1, label: '1 mile' },
  { value: 2, label: '2 miles' },
  { value: 5, label: '5 miles' },
];

// Default center (Tallahassee, FL)
const DEFAULT_CENTER = { lat: 30.4383, lng: -84.2807 };

export default function SearchMapSelector({
  center,
  radiusMiles,
  onCenterChange,
  onRadiusChange,
}: SearchMapSelectorProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const [addressSearch, setAddressSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [geolocating, setGeolocating] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const initialCenter = center || DEFAULT_CENTER;

    const map = L.map(mapRef.current, {
      center: [initialCenter.lat, initialCenter.lng],
      zoom: 14,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Custom marker icon
    const markerIcon = L.divIcon({
      className: 'custom-marker',
      html: `
        <div style="
          width: 24px;
          height: 24px;
          background: #00d4ff;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        "></div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    // Add marker if center exists
    if (center) {
      markerRef.current = L.marker([center.lat, center.lng], { icon: markerIcon })
        .addTo(map);

      // Add radius circle
      circleRef.current = L.circle([center.lat, center.lng], {
        radius: radiusMiles * 1609.34, // Convert miles to meters
        color: '#00d4ff',
        fillColor: '#00d4ff',
        fillOpacity: 0.1,
        weight: 2,
      }).addTo(map);
    }

    // Click handler to set center
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      onCenterChange({ lat, lng });
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update marker and circle when center or radius changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing marker and circle
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    if (circleRef.current) {
      circleRef.current.remove();
      circleRef.current = null;
    }

    if (center) {
      // Custom marker icon
      const markerIcon = L.divIcon({
        className: 'custom-marker',
        html: `
          <div style="
            width: 24px;
            height: 24px;
            background: #00d4ff;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          "></div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      markerRef.current = L.marker([center.lat, center.lng], { icon: markerIcon })
        .addTo(map);

      circleRef.current = L.circle([center.lat, center.lng], {
        radius: radiusMiles * 1609.34,
        color: '#00d4ff',
        fillColor: '#00d4ff',
        fillOpacity: 0.1,
        weight: 2,
      }).addTo(map);

      // Fit map to circle bounds
      map.fitBounds(circleRef.current.getBounds(), { padding: [20, 20] });
    }
  }, [center, radiusMiles]);

  // Geocode address
  const handleAddressSearch = async () => {
    if (!addressSearch.trim()) return;

    setSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressSearch)}&limit=1`,
        { headers: { 'User-Agent': 'DroneSense/1.0' } }
      );

      const results = await response.json();
      if (results.length > 0) {
        const { lat, lon } = results[0];
        onCenterChange({ lat: parseFloat(lat), lng: parseFloat(lon) });
        setAddressSearch('');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    } finally {
      setSearching(false);
    }
  };

  // Use browser geolocation
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setGeolocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onCenterChange({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setGeolocating(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Unable to get your location');
        setGeolocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-4">
      {/* Address Search */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={addressSearch}
            onChange={(e) => setAddressSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch()}
            placeholder="Enter address or intersection..."
            className="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg focus:outline-none focus:border-[var(--accent-cyan)] pr-10"
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <svg className="animate-spin w-4 h-4 text-[var(--accent-cyan)]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
            </div>
          )}
        </div>
        <button
          onClick={handleAddressSearch}
          disabled={searching || !addressSearch.trim()}
          className="px-4 py-2 bg-[var(--accent-cyan)] text-black rounded-lg hover:bg-[var(--accent-cyan)]/80 disabled:opacity-50 transition-colors"
        >
          Search
        </button>
        <button
          onClick={handleUseMyLocation}
          disabled={geolocating}
          className="px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg hover:border-[var(--accent-cyan)] transition-colors flex items-center gap-2"
          title="Use my location"
        >
          {geolocating ? (
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
        </button>
      </div>

      {/* Radius Selection */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-[var(--text-muted)]">Search Radius:</span>
        <div className="flex gap-2">
          {RADIUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => onRadiusChange(option.value)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                radiusMiles === option.value
                  ? 'bg-[var(--accent-cyan)] text-black'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/80'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="relative">
        <div
          ref={mapRef}
          className="w-full h-[300px] rounded-lg border border-[var(--border-color)] overflow-hidden"
        />
        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
          Click map to set search center
        </div>
        {center && (
          <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
          </div>
        )}
      </div>
    </div>
  );
}
