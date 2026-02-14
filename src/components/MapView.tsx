'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { EnvironmentalRisk, SelectedParcel } from '@/types';
import { NearbyParcel, AccessPoint } from './LeafletMap';
import { getZoningColor, CATEGORY_COLORS } from '@/constants/zoning';
import { PropertyPhotos } from './PropertyPhotos';

// Re-export for backward compatibility
export type { SelectedParcel };

interface MapViewProps {
  coordinates: { lat: number; lng: number } | null;
  address: string;
  environmentalRisk?: EnvironmentalRisk | null;
  selectedParcel?: SelectedParcel | null;
  onParcelSelect?: (parcel: SelectedParcel | null) => void;
  onCoordinatesChange?: (coords: { lat: number; lng: number }) => void;
  onAddressChange?: (address: string) => void;
  onAccessPointsChange?: (accessPoints: AccessPoint[]) => void;
  onParcelDataChange?: (parcelData: ParcelData | null) => void;
  interactiveMode?: boolean;
}

export interface ParcelData {
  boundaries: Array<[number, number][]>;
  parcelInfo: {
    apn?: string;
    owner?: string;
    address?: string;
    acres?: number;
    sqft?: number;
    zoning?: string;
    landUse?: string;
    yearBuilt?: number;
  } | null;
  zoning: {
    code?: string;
    description?: string;
    allowedUses?: string[];
  } | null;
  source?: string;
  message?: string;
}

interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

// Dynamic import for the entire map component to avoid SSR issues
const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[300px] bg-[var(--bg-tertiary)]">
      <div className="text-center text-[var(--text-muted)]">
        <svg className="animate-spin w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
        <p className="text-sm">Loading map...</p>
      </div>
    </div>
  )
});

type MapType = 'satellite' | 'street' | 'hybrid';

// Debounce utility
function debounce<T extends unknown[], R>(fn: (...args: T) => R, delay: number): (...args: T) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: T) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// Point-in-polygon check using ray casting algorithm
function isPointInPolygon(point: { lat: number; lng: number }, polygon: [number, number][]): boolean {
  const x = point.lat;
  const y = point.lng;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
}

export default function MapView({
  coordinates,
  address,
  environmentalRisk,
  selectedParcel,
  onParcelSelect,
  onCoordinatesChange,
  onAddressChange,
  onAccessPointsChange,
  onParcelDataChange,
  interactiveMode = true,
}: MapViewProps) {
  const [mapType, setMapType] = useState<MapType>('satellite');
  const [parcelData, setParcelData] = useState<ParcelData | null>(null);
  const [nearbyParcels, setNearbyParcels] = useState<NearbyParcel[]>([]);
  const [accessPoints, setAccessPoints] = useState<AccessPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingParcels, setLoadingParcels] = useState(false);
  const [loadingAccessPoints, setLoadingAccessPoints] = useState(false);
  const [reverseGeocoding, setReverseGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestedParcelAPN, setSuggestedParcelAPN] = useState<string | null>(null);
  const [parcelSource, setParcelSource] = useState<string | null>(null);
  const [pinLocation, setPinLocation] = useState<{ lat: number; lng: number } | null>(null);
  const lastBoundsRef = useRef<MapBounds | null>(null);

  // Sync pin location with coordinates
  useEffect(() => {
    if (coordinates) {
      setPinLocation(coordinates);
    }
  }, [coordinates?.lat, coordinates?.lng]);

  // Reverse geocode coordinates to get address
  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string | null> => {
    setReverseGeocoding(true);
    try {
      // Using Nominatim for reverse geocoding
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

  // Handle map click - drop pin and reverse geocode
  const handleMapClick = useCallback(async (coords: { lat: number; lng: number }) => {
    setPinLocation(coords);
    onCoordinatesChange?.(coords);

    // Clear selected parcel when clicking new location
    onParcelSelect?.(null);

    // Reverse geocode to get address
    const newAddress = await reverseGeocode(coords.lat, coords.lng);
    if (newAddress) {
      onAddressChange?.(newAddress);
    }
  }, [onCoordinatesChange, onAddressChange, onParcelSelect, reverseGeocode]);

  // Handle marker drag
  const handleMarkerDrag = useCallback(async (coords: { lat: number; lng: number }) => {
    setPinLocation(coords);
    onCoordinatesChange?.(coords);

    // Clear selected parcel when moving pin
    onParcelSelect?.(null);

    // Reverse geocode to get address
    const newAddress = await reverseGeocode(coords.lat, coords.lng);
    if (newAddress) {
      onAddressChange?.(newAddress);
    }
  }, [onCoordinatesChange, onAddressChange, onParcelSelect, reverseGeocode]);

  // Fetch parcel data when coordinates change (for suggested parcel)
  useEffect(() => {
    if (coordinates) {
      fetchParcelData();
    }
  }, [coordinates?.lat, coordinates?.lng]);

  const fetchParcelData = async () => {
    if (!coordinates) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/parcel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinates, address }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError("Couldn't load parcel boundaries for this location. You can click the map to manually select your site area.");
        setParcelData(null);
        onParcelDataChange?.(null);
        onParcelSelect?.(null);
      } else {
        setParcelData(data);
        onParcelDataChange?.(data);
        // Set the suggested parcel APN from the geocoded location
        if (data.parcelInfo?.apn) {
          setSuggestedParcelAPN(data.parcelInfo.apn);
        }

        // Auto-select the parcel containing the pin
        if (data.boundaries && data.boundaries.length > 0 && onParcelSelect) {
          const selected: SelectedParcel = {
            boundaries: data.boundaries,
            parcelInfo: data.parcelInfo ? {
              apn: data.parcelInfo.apn,
              owner: data.parcelInfo.owner,
              address: data.parcelInfo.address,
              acres: data.parcelInfo.acres,
              sqft: data.parcelInfo.sqft,
              zoning: data.parcelInfo.zoning,
              landUse: data.parcelInfo.landUse,
            } : null,
            coordinates,
            isConfirmed: true,
          };
          onParcelSelect(selected);
        }
      }
    } catch (err) {
      console.error('Parcel fetch error:', err);
      setError("Couldn't load parcel boundaries for this location. You can click the map to manually select your site area.");
      setParcelData(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch access points when parcel data is available
  useEffect(() => {
    const fetchAccessPoints = async () => {
      // Use selected parcel boundaries if available, otherwise use parcel data
      const boundaries = selectedParcel?.boundaries?.[0] || parcelData?.boundaries?.[0];

      if (!coordinates || !boundaries || boundaries.length < 3) {
        setAccessPoints([]);
        onAccessPointsChange?.([]);
        return;
      }

      setLoadingAccessPoints(true);
      try {
        const response = await fetch('/api/access-points', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parcelBoundary: boundaries,
            coordinates,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const points = data.accessPoints || [];
          setAccessPoints(points);
          onAccessPointsChange?.(points);
          console.log(`[MapView] Found ${points.length} access points`);
        } else {
          console.error('[MapView] Failed to fetch access points');
          setAccessPoints([]);
          onAccessPointsChange?.([]);
        }
      } catch (err) {
        console.error('[MapView] Error fetching access points:', err);
        setAccessPoints([]);
        onAccessPointsChange?.([]);
      } finally {
        setLoadingAccessPoints(false);
      }
    };

    fetchAccessPoints();
  }, [coordinates?.lat, coordinates?.lng, parcelData?.boundaries, selectedParcel?.boundaries, onAccessPointsChange]);

  // Fetch nearby parcels when bounds change
  const fetchNearbyParcels = useCallback(async (bounds: MapBounds) => {
    if (!coordinates) return;

    setLoadingParcels(true);
    try {
      const response = await fetch('/api/parcels-nearby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bounds,
          centerLat: coordinates.lat,
          centerLng: coordinates.lng,
        }),
      });

      const data = await response.json();

      if (response.ok && data.parcels) {
        setNearbyParcels(data.parcels);
        setParcelSource(data.source || null);

        // Auto-select the parcel containing the pin using point-in-polygon
        if (data.parcels.length > 0 && !selectedParcel?.isConfirmed) {
          const containingParcel = data.parcels.find((p: NearbyParcel) => {
            if (!p.boundaries || p.boundaries.length === 0) return false;
            return p.boundaries.some((boundary: [number, number][]) =>
              isPointInPolygon(coordinates, boundary)
            );
          });

          if (containingParcel && onParcelSelect) {
            // Calculate centroid for coordinates
            const firstBoundary = containingParcel.boundaries[0];
            const centroidLat = firstBoundary.reduce((sum: number, c: [number, number]) => sum + c[0], 0) / firstBoundary.length;
            const centroidLng = firstBoundary.reduce((sum: number, c: [number, number]) => sum + c[1], 0) / firstBoundary.length;
            const sqft = containingParcel.acres ? Math.round(containingParcel.acres * 43560) : undefined;

            const selected: SelectedParcel = {
              boundaries: containingParcel.boundaries,
              parcelInfo: {
                apn: containingParcel.apn,
                owner: containingParcel.owner,
                address: containingParcel.address,
                acres: containingParcel.acres,
                sqft,
                zoning: containingParcel.zoning,
                landUse: containingParcel.landUse,
              },
              coordinates: { lat: centroidLat, lng: centroidLng },
              isConfirmed: true,
            };
            onParcelSelect(selected);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch nearby parcels:', err);
    } finally {
      setLoadingParcels(false);
    }
  }, [coordinates, suggestedParcelAPN, parcelData]);

  // Debounced fetch
  const debouncedFetchParcels = useMemo(
    () => debounce((bounds: MapBounds) => fetchNearbyParcels(bounds), 500),
    [fetchNearbyParcels]
  );

  // Handle bounds change from map
  const handleBoundsChange = useCallback((bounds: MapBounds) => {
    // Check if bounds actually changed significantly
    if (lastBoundsRef.current) {
      const diff = Math.abs(bounds.north - lastBoundsRef.current.north) +
                   Math.abs(bounds.south - lastBoundsRef.current.south) +
                   Math.abs(bounds.east - lastBoundsRef.current.east) +
                   Math.abs(bounds.west - lastBoundsRef.current.west);
      if (diff < 0.0001) return; // Ignore tiny changes
    }
    lastBoundsRef.current = bounds;
    debouncedFetchParcels(bounds);
  }, [debouncedFetchParcels]);

  // Handle parcel click
  const handleParcelClick = useCallback((parcel: NearbyParcel) => {
    if (!coordinates || !onParcelSelect) return;

    // Calculate centroid of parcel for coordinates
    const firstBoundary = parcel.boundaries[0];
    const centroidLat = firstBoundary.reduce((sum, c) => sum + c[0], 0) / firstBoundary.length;
    const centroidLng = firstBoundary.reduce((sum, c) => sum + c[1], 0) / firstBoundary.length;

    // Calculate sqft from acres if not provided
    const sqft = parcel.acres ? Math.round(parcel.acres * 43560) : undefined;

    const selected: SelectedParcel = {
      boundaries: parcel.boundaries,
      parcelInfo: {
        apn: parcel.apn,
        owner: parcel.owner,
        address: parcel.address,
        acres: parcel.acres,
        sqft,
        zoning: parcel.zoning,
        landUse: parcel.landUse,
      },
      coordinates: { lat: centroidLat, lng: centroidLng },
      isConfirmed: true,
    };

    onParcelSelect(selected);
  }, [coordinates, onParcelSelect]);

  // Handle confirm suggested parcel
  const handleConfirmSuggested = useCallback(() => {
    if (!parcelData || !coordinates || !onParcelSelect) return;

    const selected: SelectedParcel = {
      boundaries: parcelData.boundaries,
      parcelInfo: parcelData.parcelInfo ? {
        apn: parcelData.parcelInfo.apn,
        owner: parcelData.parcelInfo.owner,
        address: parcelData.parcelInfo.address,
        acres: parcelData.parcelInfo.acres,
        sqft: parcelData.parcelInfo.sqft,
        zoning: parcelData.parcelInfo.zoning,
        landUse: parcelData.parcelInfo.landUse,
      } : null,
      coordinates,
      isConfirmed: true,
    };

    onParcelSelect(selected);
  }, [parcelData, coordinates, onParcelSelect]);

  // Handle change selection
  const handleChangeSelection = useCallback(() => {
    if (onParcelSelect) {
      onParcelSelect(null);
    }
  }, [onParcelSelect]);


  // Show interactive map even without coordinates
  const showInteractiveEmptyState = !coordinates && interactiveMode;

  // Determine what to show in the selection panel
  const showSuggestedPanel = !selectedParcel?.isConfirmed && parcelData;
  const showSelectedPanel = selectedParcel?.isConfirmed;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[var(--text-primary)]">Property Map</h3>
        <div className="flex items-center gap-3">
          {reverseGeocoding && (
            <span className="text-xs text-[var(--accent-cyan)] flex items-center gap-1">
              <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              Getting address...
            </span>
          )}
          {loadingParcels && !reverseGeocoding && (
            <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
              <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              Loading parcels...
            </span>
          )}
          {loadingAccessPoints && !loadingParcels && !reverseGeocoding && (
            <span className="text-xs text-[var(--accent-green)] flex items-center gap-1">
              <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              Finding access points...
            </span>
          )}
          <div className="flex gap-1">
            <button
              onClick={() => setMapType('satellite')}
              className={`text-xs py-1 px-2 rounded ${mapType === 'satellite' ? 'bg-[var(--accent-cyan)] text-white' : 'bg-[var(--bg-tertiary)]'}`}
            >
              Satellite
            </button>
            <button
              onClick={() => setMapType('street')}
              className={`text-xs py-1 px-2 rounded ${mapType === 'street' ? 'bg-[var(--accent-cyan)] text-white' : 'bg-[var(--bg-tertiary)]'}`}
            >
              Street
            </button>
            <button
              onClick={() => setMapType('hybrid')}
              className={`text-xs py-1 px-2 rounded ${mapType === 'hybrid' ? 'bg-[var(--accent-cyan)] text-white' : 'bg-[var(--bg-tertiary)]'}`}
            >
              Hybrid
            </button>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative rounded-lg overflow-hidden border border-[var(--border-color)]">
        <LeafletMap
          coordinates={coordinates}
          mapType={mapType}
          parcelData={parcelData}
          nearbyParcels={nearbyParcels}
          accessPoints={accessPoints}
          selectedParcelAPN={selectedParcel?.parcelInfo?.apn || null}
          selectedParcelBoundaries={selectedParcel?.boundaries || null}
          suggestedParcelAPN={suggestedParcelAPN}
          onParcelClick={handleParcelClick}
          onBoundsChange={handleBoundsChange}
          onMapClick={handleMapClick}
          onMarkerDrag={handleMarkerDrag}
          pinLocation={pinLocation}
          interactiveMode={interactiveMode}
        />

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="text-center text-white">
              <svg className="animate-spin w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              <p className="text-sm">Loading parcel data...</p>
            </div>
          </div>
        )}

        {/* Interactive Mode Instructions */}
        {showInteractiveEmptyState && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-[1000]">
            <div className="bg-[var(--bg-primary)]/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-[var(--border-color)] shadow-lg">
              <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <svg className="w-5 h-5 text-[var(--accent-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Click anywhere on the map to drop a pin</span>
              </div>
            </div>
          </div>
        )}

        {/* Pin Location Info */}
        {interactiveMode && pinLocation && !coordinates && (
          <div className="absolute top-4 left-4 z-[1000]">
            <div className="bg-[var(--bg-primary)]/90 backdrop-blur-sm px-3 py-2 rounded-lg border border-[var(--accent-cyan)]/50 shadow-lg">
              <div className="text-xs text-[var(--text-muted)]">Pin Location</div>
              <div className="text-sm font-mono text-[var(--accent-cyan)]">
                {pinLocation.lat.toFixed(6)}, {pinLocation.lng.toFixed(6)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Mode Hint */}
      {interactiveMode && (
        <div className="mt-2 flex items-center justify-center gap-4 text-xs text-[var(--text-muted)]">
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
            Click to drop pin
          </span>
          {coordinates && (
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
              </svg>
              Drag pin to adjust
            </span>
          )}
        </div>
      )}

      {/* Parcel Selection Panel */}
      {showSuggestedPanel && (
        <div className="mt-4 p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--accent-orange)]/30">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-[var(--accent-orange)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-[var(--text-primary)] mb-1">Suggested Parcel</h4>
              <div className="text-sm text-[var(--text-secondary)] space-y-1">
                {parcelData.parcelInfo?.owner && (
                  <p>Owner: <span className="text-[var(--text-primary)]">{parcelData.parcelInfo.owner}</span></p>
                )}
                <p className="flex flex-wrap gap-2">
                  {parcelData.parcelInfo?.acres && (
                    <span className="tag tag-cyan">{parcelData.parcelInfo.acres.toFixed(2)} acres</span>
                  )}
                  {(parcelData.zoning?.code || parcelData.parcelInfo?.zoning) && (
                    <span className="tag tag-blue">{parcelData.zoning?.code || parcelData.parcelInfo?.zoning}</span>
                  )}
                  {parcelData.parcelInfo?.apn && (
                    <span className="tag tag-orange">APN: {parcelData.parcelInfo.apn}</span>
                  )}
                </p>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={handleConfirmSuggested}
                  className="btn-primary text-sm py-2 px-4"
                >
                  Use This Parcel
                </button>
                <span className="text-xs text-[var(--text-muted)]">
                  or click a different parcel on the map
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSelectedPanel && selectedParcel && (
        <div className="mt-4 p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--accent-green)]/30">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-[var(--accent-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-[var(--text-primary)] mb-1">Selected Parcel</h4>
              <div className="text-sm text-[var(--text-secondary)] space-y-1">
                {selectedParcel.parcelInfo?.owner && (
                  <p>Owner: <span className="text-[var(--text-primary)]">{selectedParcel.parcelInfo.owner}</span></p>
                )}
                {selectedParcel.parcelInfo?.address && (
                  <p className="text-[var(--text-muted)]">{selectedParcel.parcelInfo.address}</p>
                )}
                <p className="flex flex-wrap gap-2">
                  {selectedParcel.parcelInfo?.acres && (
                    <span className="tag tag-cyan">{selectedParcel.parcelInfo.acres.toFixed(2)} acres</span>
                  )}
                  {selectedParcel.parcelInfo?.zoning && (
                    <span className="tag tag-blue">{selectedParcel.parcelInfo.zoning}</span>
                  )}
                  {selectedParcel.parcelInfo?.apn && (
                    <span className="tag tag-orange">APN: {selectedParcel.parcelInfo.apn}</span>
                  )}
                </p>
              </div>
              <div className="mt-3">
                <button
                  onClick={handleChangeSelection}
                  className="btn-secondary text-sm py-2 px-4"
                >
                  Change Selection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Property Photos */}
      {(selectedParcel?.coordinates || coordinates) && (
        <PropertyPhotos
          coordinates={selectedParcel?.coordinates || coordinates}
          address={selectedParcel?.parcelInfo?.address || address}
          apn={selectedParcel?.parcelInfo?.apn}
        />
      )}

      {/* Parcel Info */}
      {(parcelData || selectedParcel) && (
        <div className="mt-4 space-y-3">
          {/* Zoning Info */}
          {(parcelData?.zoning || parcelData?.parcelInfo?.zoning || selectedParcel?.parcelInfo?.zoning) && (
            <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: getZoningColor(selectedParcel?.parcelInfo?.zoning || parcelData?.zoning?.code || parcelData?.parcelInfo?.zoning) }}
                />
                <span className="text-xs text-[var(--text-muted)] uppercase">Zoning</span>
              </div>
              <p className="font-semibold">
                {selectedParcel?.parcelInfo?.zoning || parcelData?.zoning?.code || parcelData?.parcelInfo?.zoning || 'Unknown'}
              </p>
              {parcelData?.zoning?.description && (
                <p className="text-sm text-[var(--text-secondary)]">{parcelData.zoning.description}</p>
              )}
            </div>
          )}

          {/* Parcel Details Grid */}
          {(parcelData?.parcelInfo || selectedParcel?.parcelInfo) && (
            <div className="grid grid-cols-2 gap-2">
              {(selectedParcel?.parcelInfo?.acres || parcelData?.parcelInfo?.acres) && (
                <div className="p-2 bg-[var(--bg-tertiary)] rounded border border-[var(--border-color)]">
                  <span className="text-xs text-[var(--text-muted)]">Lot Size</span>
                  <p className="font-medium">{(selectedParcel?.parcelInfo?.acres || parcelData?.parcelInfo?.acres || 0).toFixed(2)} acres</p>
                </div>
              )}
              {(selectedParcel?.parcelInfo?.sqft || parcelData?.parcelInfo?.sqft) && (
                <div className="p-2 bg-[var(--bg-tertiary)] rounded border border-[var(--border-color)]">
                  <span className="text-xs text-[var(--text-muted)]">Square Feet</span>
                  <p className="font-medium">{(selectedParcel?.parcelInfo?.sqft || parcelData?.parcelInfo?.sqft || 0).toLocaleString()}</p>
                </div>
              )}
              {(selectedParcel?.parcelInfo?.landUse || parcelData?.parcelInfo?.landUse) && (
                <div className="p-2 bg-[var(--bg-tertiary)] rounded border border-[var(--border-color)]">
                  <span className="text-xs text-[var(--text-muted)]">Land Use</span>
                  <p className="font-medium text-sm">{selectedParcel?.parcelInfo?.landUse || parcelData?.parcelInfo?.landUse}</p>
                </div>
              )}
              {(selectedParcel?.parcelInfo?.apn || parcelData?.parcelInfo?.apn) && (
                <div className="p-2 bg-[var(--bg-tertiary)] rounded border border-[var(--border-color)]">
                  <span className="text-xs text-[var(--text-muted)]">Parcel #</span>
                  <p className="font-medium text-sm">{selectedParcel?.parcelInfo?.apn || parcelData?.parcelInfo?.apn}</p>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <p className="text-xs text-[var(--text-muted)] text-center">
              {error}
            </p>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-[var(--text-muted)]">Zoning:</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{backgroundColor: CATEGORY_COLORS['Commercial']}}></span>Commercial</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{backgroundColor: CATEGORY_COLORS['Residential']}}></span>Residential</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{backgroundColor: CATEGORY_COLORS['Industrial']}}></span>Industrial</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{backgroundColor: CATEGORY_COLORS['Agricultural']}}></span>Agricultural</span>
          </div>

          {/* Parcel Selection Legend */}
          {nearbyParcels.length > 0 && (
            <div className="flex flex-wrap gap-3 text-xs pt-2 border-t border-[var(--border-color)]">
              <span className="text-[var(--text-muted)]">Selection:</span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded border-2 border-[#ef4444] bg-[#ef4444]/30"></span>
                Selected
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded border-2 border-dashed border-[#f97316] bg-[#f97316]/15"></span>
                Suggested
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded border border-white/50"></span>
                Other Parcels
              </span>
            </div>
          )}

          {/* Access Points Info */}
          {accessPoints.length > 0 && (() => {
            // Get unique roads with their best VPD
            const roadVPDs = new Map<string, { vpd?: number; source?: string }>();
            for (const ap of accessPoints) {
              const existing = roadVPDs.get(ap.roadName);
              if (!existing || (ap.vpd && (!existing.vpd || ap.vpd > existing.vpd))) {
                roadVPDs.set(ap.roadName, { vpd: ap.vpd, source: ap.vpdSource });
              }
            }
            const sortedRoads = Array.from(roadVPDs.entries())
              .sort((a, b) => (b[1].vpd || 0) - (a[1].vpd || 0));
            const primaryRoad = sortedRoads[0];
            const totalVPD = sortedRoads.reduce((sum, [, data]) => sum + (data.vpd || 0), 0);

            return (
              <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--accent-green)]/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[var(--accent-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      Access Points ({sortedRoads.length} roads)
                    </span>
                  </div>
                  {totalVPD > 0 && (
                    <span className="text-sm font-bold text-[var(--accent-green)]">
                      {totalVPD.toLocaleString()} VPD
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  {sortedRoads.slice(0, 3).map(([roadName, data], i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-[var(--text-secondary)]">{roadName}</span>
                      {data.vpd ? (
                        <span className={data.source === 'fdot' ? 'text-[var(--accent-green)] font-medium' : 'text-[var(--text-muted)]'}>
                          {data.vpd.toLocaleString()} {data.source === 'fdot' ? '(FDOT)' : '(Est.)'}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">--</span>
                      )}
                    </div>
                  ))}
                  {sortedRoads.length > 3 && (
                    <p className="text-xs text-[var(--text-muted)]">
                      +{sortedRoads.length - 3} more roads
                    </p>
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-2">
                  VPD from Florida DOT at access point locations
                </p>
              </div>
            );
          })()}

          {/* Environmental Risk Indicator */}
          {environmentalRisk && (
            <div className={`p-3 rounded-lg border ${
              environmentalRisk.floodZone.risk === 'high'
                ? 'bg-red-500/10 border-red-500/30'
                : environmentalRisk.floodZone.risk === 'medium'
                ? 'bg-yellow-500/10 border-yellow-500/30'
                : 'bg-green-500/10 border-green-500/30'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                  <span className="text-sm font-medium">Flood Zone: {environmentalRisk.floodZone.zone}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  environmentalRisk.floodZone.risk === 'high'
                    ? 'bg-red-500/20 text-red-400'
                    : environmentalRisk.floodZone.risk === 'medium'
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-green-500/20 text-green-400'
                }`}>
                  {environmentalRisk.floodZone.risk.toUpperCase()} RISK
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1">{environmentalRisk.floodZone.description}</p>
            </div>
          )}

          {/* Data Source */}
          <div className="text-xs text-[var(--text-muted)] text-center pt-2 border-t border-[var(--border-color)]">
            {parcelSource && nearbyParcels.length > 0 && (
              <span>Parcels: {parcelSource} ({nearbyParcels.length} parcels)</span>
            )}
            {parcelData?.source && !parcelSource && <span>Data source: {parcelData.source}</span>}
            {parcelData?.message && <p className="text-[var(--accent-yellow)] mt-1">{parcelData.message}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
