'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

interface SearchMapSelectorProps {
  center: { lat: number; lng: number } | null;
  radiusMiles: number;
  onCenterChange: (center: { lat: number; lng: number }) => void;
  onRadiusChange: (radius: number) => void;
  results?: QuickFeasibility[];
}

// Get color based on score
function getScoreColor(score: number): string {
  if (score >= 8) return '#22C55E'; // green
  if (score >= 5) return '#EAB308'; // yellow
  return '#EF4444'; // red
}

function getScoreDarkColor(score: number): string {
  if (score >= 8) return '#16A34A';
  if (score >= 5) return '#CA8A04';
  return '#DC2626';
}

// Create custom score pin icon
function createScorePinIcon(score: number, rank: number): L.DivIcon {
  const color = getScoreColor(score);
  const darkColor = getScoreDarkColor(score);
  const scoreText = score.toFixed(1);

  return L.divIcon({
    className: 'custom-score-pin',
    html: `
      <div class="score-pin-wrapper" style="position: relative; width: 36px; height: 48px; cursor: pointer;">
        <svg width="36" height="48" viewBox="0 0 36 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));">
          <path d="M18 47C18 47 34 31 34 18C34 8.611 26.389 1 18 1C9.611 1 2 8.611 2 18C2 31 18 47 18 47Z" fill="${color}" stroke="${darkColor}" stroke-width="2"/>
          <circle cx="18" cy="18" r="12" fill="white" fill-opacity="0.95"/>
        </svg>
        <div style="position: absolute; top: 7px; left: 0; right: 0; text-align: center; font-size: 10px; font-weight: 700; color: ${darkColor}; line-height: 1;">
          ${scoreText}
        </div>
        <div style="position: absolute; top: -5px; right: -3px; width: 16px; height: 16px; background: #1e293b; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; color: white; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">
          ${rank}
        </div>
      </div>
    `,
    iconSize: [36, 48],
    iconAnchor: [18, 48],
    popupAnchor: [0, -48],
  });
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
  results = [],
}: SearchMapSelectorProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const resultMarkersRef = useRef<L.Marker[]>([]);
  const [addressSearch, setAddressSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [geolocating, setGeolocating] = useState(false);

  // Get top 10 results sorted by score
  const topResults = [...results]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

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

      // Fit map to circle bounds if no results, otherwise fit will happen in results effect
      if (topResults.length === 0) {
        map.fitBounds(circleRef.current.getBounds(), { padding: [20, 20] });
      }
    }
  }, [center, radiusMiles]);

  // Update result markers when results change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing result markers
    resultMarkersRef.current.forEach(marker => marker.remove());
    resultMarkersRef.current = [];

    if (topResults.length === 0) return;

    // Add markers for top results
    topResults.forEach((property, index) => {
      const icon = createScorePinIcon(property.score, index + 1);

      const marker = L.marker([property.coordinates.lat, property.coordinates.lng], {
        icon,
        zIndexOffset: 1000 - index, // Higher ranked = higher z-index
      }).addTo(map);

      // Create popup content
      const popupContent = `
        <div style="min-width: 200px; font-family: system-ui, -apple-system, sans-serif;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: #1e293b; color: white; font-size: 11px; font-weight: 700;">
              #${index + 1}
            </span>
            <p style="font-weight: 600; color: #111; font-size: 13px; line-height: 1.3; margin: 0; flex: 1;">
              ${property.address}
            </p>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
            <span style="padding: 4px 10px; border-radius: 12px; background: ${getScoreColor(property.score)}; color: white; font-size: 12px; font-weight: 700;">
              ${property.score.toFixed(1)} Score
            </span>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; font-size: 11px; margin-bottom: 10px; background: #f5f5f5; padding: 8px; border-radius: 6px;">
            <div><span style="color: #666;">VPD:</span> <strong style="color: #111;">${property.estimatedVPD?.toLocaleString() || 'N/A'}</strong></div>
            <div><span style="color: #666;">Acres:</span> <strong style="color: #111;">${property.lotSizeAcres?.toFixed(2) || 'N/A'}</strong></div>
            <div><span style="color: #666;">Zoning:</span> <strong style="color: #111;">${property.zoning || 'N/A'}</strong></div>
            <div><span style="color: #666;">Businesses:</span> <strong style="color: #111;">${property.nearbyBusinesses ?? 'N/A'}</strong></div>
          </div>
          <a href="/?lat=${property.coordinates.lat}&lng=${property.coordinates.lng}"
             style="display: block; text-align: center; padding: 8px 12px; background: #0891b2; color: white; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 600;">
            View Full Analysis
          </a>
        </div>
      `;

      marker.bindPopup(popupContent, { maxWidth: 280 });
      resultMarkersRef.current.push(marker);
    });

    // Fit map to show all results plus circle
    if (topResults.length > 0 && circleRef.current) {
      const bounds = L.latLngBounds([]);

      // Add circle bounds
      bounds.extend(circleRef.current.getBounds());

      // Add all result markers
      topResults.forEach(property => {
        bounds.extend([property.coordinates.lat, property.coordinates.lng]);
      });

      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [topResults.length, topResults.map(r => r.parcelId).join(',')]);

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
        <style jsx global>{`
          .custom-score-pin {
            background: transparent !important;
            border: none !important;
          }
          .score-pin-wrapper {
            animation: pinDrop 0.4s ease-out;
            transition: transform 0.2s ease;
          }
          .score-pin-wrapper:hover {
            transform: scale(1.15) translateY(-2px);
          }
          @keyframes pinDrop {
            0% { transform: translateY(-30px); opacity: 0; }
            60% { transform: translateY(4px); }
            100% { transform: translateY(0); opacity: 1; }
          }
        `}</style>
        <div
          ref={mapRef}
          className={`w-full rounded-lg border border-[var(--border-color)] overflow-hidden transition-all duration-300 ${
            topResults.length > 0 ? 'h-[450px]' : 'h-[300px]'
          }`}
        />
        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
          Click map to set search center
        </div>
        {center && (
          <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
          </div>
        )}
        {topResults.length > 0 && (
          <div className="absolute top-2 left-2 bg-[var(--bg-secondary)] rounded-lg px-3 py-2 shadow-lg border border-[var(--border-color)] z-[1000]">
            <h4 className="text-sm font-bold text-[var(--accent-cyan)]">Top {topResults.length} Properties</h4>
            <p className="text-xs text-[var(--text-muted)]">Click pins for details</p>
          </div>
        )}
      </div>
    </div>
  );
}
