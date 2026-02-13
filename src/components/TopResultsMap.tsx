'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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

interface TopResultsMapProps {
  results: QuickFeasibility[];
  maxResults?: number;
}

// Get color based on score
function getScoreColor(score: number): string {
  if (score >= 8) return '#22C55E'; // green-500
  if (score >= 5) return '#EAB308'; // yellow-500
  return '#EF4444'; // red-500
}

// Get darker color for pin body
function getScoreDarkColor(score: number): string {
  if (score >= 8) return '#16A34A'; // green-600
  if (score >= 5) return '#CA8A04'; // yellow-600
  return '#DC2626'; // red-600
}

// Create custom pin icon with score
function createScoreIcon(score: number, rank: number): L.DivIcon {
  const color = getScoreColor(score);
  const darkColor = getScoreDarkColor(score);
  const scoreText = score.toFixed(1);

  return L.divIcon({
    className: 'custom-score-pin',
    html: `
      <div class="score-pin-container" style="position: relative; width: 40px; height: 52px;">
        <!-- Pin shape -->
        <svg width="40" height="52" viewBox="0 0 40 52" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
          <!-- Pin body -->
          <path d="M20 51C20 51 38 33.5 38 20C38 10.059 29.941 2 20 2C10.059 2 2 10.059 2 20C2 33.5 20 51 20 51Z" fill="${color}" stroke="${darkColor}" stroke-width="2"/>
          <!-- Inner circle for score -->
          <circle cx="20" cy="20" r="14" fill="white" fill-opacity="0.95"/>
        </svg>
        <!-- Score text -->
        <div style="
          position: absolute;
          top: 8px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 11px;
          font-weight: 700;
          color: ${darkColor};
          line-height: 1;
        ">
          ${scoreText}
        </div>
        <!-- Rank badge -->
        <div style="
          position: absolute;
          top: -6px;
          right: -4px;
          width: 18px;
          height: 18px;
          background: #1e293b;
          border: 2px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 700;
          color: white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        ">
          ${rank}
        </div>
      </div>
    `,
    iconSize: [40, 52],
    iconAnchor: [20, 52],
    popupAnchor: [0, -52],
  });
}

// Component to fit map bounds to results
function FitBoundsToResults({ results }: { results: QuickFeasibility[] }) {
  const map = useMap();

  useEffect(() => {
    if (results.length === 0) return;

    const lats = results.map(r => r.coordinates.lat);
    const lngs = results.map(r => r.coordinates.lng);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latPadding = (maxLat - minLat) * 0.15 || 0.01;
    const lngPadding = (maxLng - minLng) * 0.15 || 0.01;

    const bounds: [[number, number], [number, number]] = [
      [minLat - latPadding, minLng - lngPadding],
      [maxLat + latPadding, maxLng + lngPadding],
    ];

    map.fitBounds(bounds, {
      padding: [40, 40],
      maxZoom: 15,
      animate: true,
    });
  }, [results, map]);

  return null;
}

export default function TopResultsMap({ results, maxResults = 10 }: TopResultsMapProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Get top results sorted by score
  const topResults = [...results]
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  if (!isClient) {
    return (
      <div className="w-full h-[350px] bg-[var(--bg-tertiary)] rounded-lg flex items-center justify-center">
        <div className="animate-pulse text-[var(--text-muted)]">Loading map...</div>
      </div>
    );
  }

  if (topResults.length === 0) {
    return (
      <div className="w-full h-[350px] bg-[var(--bg-tertiary)] rounded-lg flex items-center justify-center">
        <div className="text-[var(--text-muted)]">No results to display</div>
      </div>
    );
  }

  const centerLat = topResults.reduce((sum, r) => sum + r.coordinates.lat, 0) / topResults.length;
  const centerLng = topResults.reduce((sum, r) => sum + r.coordinates.lng, 0) / topResults.length;

  return (
    <div className="relative">
      <style jsx global>{`
        .custom-score-pin {
          background: transparent !important;
          border: none !important;
        }
        .score-pin-container {
          animation: dropIn 0.4s ease-out;
        }
        @keyframes dropIn {
          0% {
            transform: translateY(-20px);
            opacity: 0;
          }
          60% {
            transform: translateY(5px);
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .leaflet-marker-icon {
          transition: transform 0.2s ease;
        }
        .leaflet-marker-icon:hover {
          transform: scale(1.1);
          z-index: 1000 !important;
        }
      `}</style>

      <MapContainer
        center={[centerLat, centerLng]}
        zoom={13}
        style={{ height: '350px', width: '100%' }}
        className="rounded-lg"
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="&copy; Esri"
        />

        <FitBoundsToResults results={topResults} />

        {topResults.map((property, index) => (
          <Marker
            key={property.parcelId}
            position={[property.coordinates.lat, property.coordinates.lng]}
            icon={createScoreIcon(property.score, index + 1)}
          >
            <Popup>
              <div className="min-w-[220px] text-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 text-white text-xs font-bold">
                    #{index + 1}
                  </span>
                  <p className="font-semibold text-gray-900 text-sm leading-tight flex-1">
                    {property.address}
                  </p>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="px-3 py-1 rounded-full text-white text-sm font-bold"
                    style={{ backgroundColor: getScoreColor(property.score) }}
                  >
                    {property.score.toFixed(1)} Score
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-3 bg-gray-50 p-2 rounded">
                  <div>
                    <span className="text-gray-500">VPD:</span>
                    <span className="ml-1 font-medium text-gray-900">{property.estimatedVPD?.toLocaleString() || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Acres:</span>
                    <span className="ml-1 font-medium text-gray-900">{property.lotSizeAcres?.toFixed(2) || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Zoning:</span>
                    <span className="ml-1 font-medium text-gray-900">{property.zoning || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Businesses:</span>
                    <span className="ml-1 font-medium text-gray-900">{property.nearbyBusinesses ?? 'N/A'}</span>
                  </div>
                </div>

                <Link
                  href={`/?lat=${property.coordinates.lat}&lng=${property.coordinates.lng}`}
                  className="block w-full text-center px-3 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium"
                >
                  View Full Analysis
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Top 10 Legend */}
      <div className="absolute top-4 left-4 bg-[var(--bg-secondary)] rounded-lg p-3 shadow-lg border border-[var(--border-color)] z-[1000]">
        <h4 className="text-sm font-bold text-[var(--accent-cyan)] mb-1">Top {topResults.length} Properties</h4>
        <p className="text-xs text-[var(--text-muted)]">Ranked by feasibility score</p>
      </div>

      {/* Score Legend */}
      <div className="absolute bottom-4 right-4 bg-[var(--bg-secondary)] rounded-lg p-3 shadow-lg border border-[var(--border-color)] z-[1000]">
        <h4 className="text-xs font-medium text-[var(--text-primary)] mb-2">Score</h4>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#22C55E' }} />
            <span className="text-xs text-[var(--text-secondary)]">8+ Excellent</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#EAB308' }} />
            <span className="text-xs text-[var(--text-secondary)]">5-8 Good</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#EF4444' }} />
            <span className="text-xs text-[var(--text-secondary)]">&lt;5 Fair</span>
          </div>
        </div>
      </div>
    </div>
  );
}
