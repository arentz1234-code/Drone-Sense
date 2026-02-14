'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
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

interface MapResultsProps {
  results: QuickFeasibility[];
  onPropertySelect?: (property: QuickFeasibility) => void;
  selectedParcelId?: string | null;
  compareList?: string[]; // List of parcel IDs in compare list
  onAddToCompare?: (property: QuickFeasibility) => void;
  favoriteIds?: string[]; // List of favorited parcel IDs
  onToggleFavorite?: (property: QuickFeasibility) => void;
}

// Get color based on score
function getScoreColor(score: number): string {
  if (score >= 8) return '#22C55E'; // green-500
  if (score >= 5) return '#EAB308'; // yellow-500
  return '#EF4444'; // red-500
}

// Get border color (darker version)
function getScoreBorderColor(score: number): string {
  if (score >= 8) return '#16A34A'; // green-600
  if (score >= 6) return '#0891b2'; // cyan-600
  if (score >= 4) return '#CA8A04'; // yellow-600
  return '#DC2626'; // red-600
}

// Get score label for accessibility
function getScoreLabel(score: number): { label: string; icon: string } {
  if (score >= 8) return { label: 'Excellent', icon: '✓' };
  if (score >= 6) return { label: 'Good', icon: '○' };
  if (score >= 4) return { label: 'Fair', icon: '△' };
  return { label: 'Poor', icon: '✕' };
}

// Component to fit map bounds to results
function FitBoundsToResults({ results }: { results: QuickFeasibility[] }) {
  const map = useMap();

  useEffect(() => {
    if (results.length === 0) return;

    // Calculate bounds from all results
    const lats = results.map(r => r.coordinates.lat);
    const lngs = results.map(r => r.coordinates.lng);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    // Add padding
    const latPadding = (maxLat - minLat) * 0.1 || 0.01;
    const lngPadding = (maxLng - minLng) * 0.1 || 0.01;

    const bounds: [[number, number], [number, number]] = [
      [minLat - latPadding, minLng - lngPadding],
      [maxLat + latPadding, maxLng + lngPadding],
    ];

    map.fitBounds(bounds, {
      padding: [20, 20],
      maxZoom: 16,
      animate: true,
    });
  }, [results, map]);

  return null;
}

export default function MapResults({
  results,
  onPropertySelect,
  selectedParcelId,
  compareList = [],
  onAddToCompare,
  favoriteIds = [],
  onToggleFavorite,
}: MapResultsProps) {
  const [isClient, setIsClient] = useState(false);

  // Ensure client-side rendering for Leaflet
  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="w-full h-[400px] bg-[var(--bg-tertiary)] rounded-lg flex items-center justify-center">
        <div className="animate-pulse text-[var(--text-muted)]">Loading map...</div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="w-full h-[400px] bg-[var(--bg-tertiary)] rounded-lg flex items-center justify-center">
        <div className="text-[var(--text-muted)]">No results to display on map</div>
      </div>
    );
  }

  // Calculate center from results
  const centerLat = results.reduce((sum, r) => sum + r.coordinates.lat, 0) / results.length;
  const centerLng = results.reduce((sum, r) => sum + r.coordinates.lng, 0) / results.length;

  return (
    <div className="relative">
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={14}
        style={{ height: '400px', width: '100%' }}
        className="rounded-lg"
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="&copy; Esri"
        />

        <FitBoundsToResults results={results} />

        {results.map((property) => {
          const isSelected = property.parcelId === selectedParcelId;
          const isInCompare = compareList.includes(property.parcelId);
          const isFavorite = favoriteIds.includes(property.parcelId);

          return (
            <CircleMarker
              key={property.parcelId}
              center={[property.coordinates.lat, property.coordinates.lng]}
              radius={isSelected ? 14 : 10}
              pathOptions={{
                fillColor: getScoreColor(property.score),
                fillOpacity: 0.8,
                color: isSelected ? '#ffffff' : getScoreBorderColor(property.score),
                weight: isSelected ? 3 : 2,
              }}
              eventHandlers={{
                click: () => onPropertySelect?.(property),
              }}
            >
              <Popup>
                <div className="min-w-[200px] text-sm">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-semibold text-gray-900 text-sm leading-tight">
                      {property.address}
                    </p>
                    <span
                      className="px-2 py-0.5 rounded text-white text-xs font-bold whitespace-nowrap flex items-center gap-1"
                      style={{ backgroundColor: getScoreColor(property.score) }}
                    >
                      <span aria-hidden="true">{getScoreLabel(property.score).icon}</span>
                      {property.score.toFixed(1)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-3">
                    <div>
                      <span className="text-gray-500">VPD:</span>
                      <span className="ml-1 font-medium">{property.estimatedVPD?.toLocaleString() || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Acres:</span>
                      <span className="ml-1 font-medium">{property.lotSizeAcres?.toFixed(2) || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Zoning:</span>
                      <span className="ml-1 font-medium">{property.zoning || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Businesses:</span>
                      <span className="ml-1 font-medium">{property.nearbyBusinesses ?? 'N/A'}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link
                      href={`/?lat=${property.coordinates.lat}&lng=${property.coordinates.lng}`}
                      className="flex-1 text-center px-2 py-1.5 text-xs bg-cyan-600 text-white rounded hover:bg-cyan-700 transition-colors"
                    >
                      View Details
                    </Link>

                    {onAddToCompare && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddToCompare(property);
                        }}
                        disabled={isInCompare || compareList.length >= 4}
                        className={`px-2 py-1.5 text-xs rounded transition-colors ${
                          isInCompare
                            ? 'bg-green-100 text-green-700 cursor-default'
                            : compareList.length >= 4
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        }`}
                        title={isInCompare ? 'In compare list' : compareList.length >= 4 ? 'Max 4 properties' : 'Add to compare'}
                      >
                        {isInCompare ? 'Added' : '+Compare'}
                      </button>
                    )}

                    {onToggleFavorite && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(property);
                        }}
                        className={`px-2 py-1.5 text-xs rounded transition-colors ${
                          isFavorite
                            ? 'bg-red-100 text-red-600'
                            : 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-500'
                        }`}
                        title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        {isFavorite ? '♥' : '♡'}
                      </button>
                    )}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-[var(--bg-secondary)] rounded-lg p-3 shadow-lg border border-[var(--border-color)] z-[1000]">
        <h4 className="text-xs font-medium text-[var(--text-primary)] mb-2">Feasibility Score</h4>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#22C55E' }} />
            <span className="text-xs text-[var(--text-secondary)]" aria-hidden="true">✓</span>
            <span className="text-xs text-[var(--text-secondary)]">Excellent (8+)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#06b6d4' }} />
            <span className="text-xs text-[var(--text-secondary)]" aria-hidden="true">○</span>
            <span className="text-xs text-[var(--text-secondary)]">Good (6-8)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#EAB308' }} />
            <span className="text-xs text-[var(--text-secondary)]" aria-hidden="true">△</span>
            <span className="text-xs text-[var(--text-secondary)]">Fair (4-6)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#EF4444' }} />
            <span className="text-xs text-[var(--text-secondary)]" aria-hidden="true">✕</span>
            <span className="text-xs text-[var(--text-secondary)]">Poor (&lt;4)</span>
          </div>
        </div>
      </div>

      {/* Result count */}
      <div className="absolute top-4 right-4 bg-[var(--bg-secondary)] rounded-lg px-3 py-2 shadow-lg border border-[var(--border-color)] z-[1000]">
        <span className="text-xs text-[var(--text-muted)]">Showing </span>
        <span className="text-sm font-medium text-[var(--accent-cyan)]">{results.length}</span>
        <span className="text-xs text-[var(--text-muted)]"> properties</span>
      </div>
    </div>
  );
}
