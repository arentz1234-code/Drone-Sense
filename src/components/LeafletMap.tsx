'use client';

import { useEffect, useRef, useState, MutableRefObject } from 'react';
import { MapContainer, TileLayer, Polygon, Popup, Tooltip, Marker, useMap, useMapEvents } from 'react-leaflet';
import { LatLngExpression, Icon, DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface NearbyParcel {
  boundaries: Array<[number, number][]>;
  owner?: string;
  apn?: string;
  acres?: number;
  address?: string;
  zoning?: string;
  landUse?: string;
}

interface Business {
  name: string;
  type: string;
  distance: string;
  address?: string;
  lat?: number;
  lng?: number;
}

export interface AccessPoint {
  coordinates: [number, number]; // [lat, lng]
  roadName: string;
  type: 'entrance' | 'exit' | 'access';
  roadType?: string; // OSM highway type (primary, secondary, residential, etc.)
  distance?: number; // Distance from parcel boundary in meters
  vpd?: number; // Official VPD from FDOT if available
  vpdYear?: number; // Year of VPD count
  vpdSource?: 'fdot' | 'estimated'; // Source of VPD data
  estimatedVpd?: number; // Estimated VPD based on road classification
}

interface ParcelData {
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
}

interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface LeafletMapProps {
  coordinates: { lat: number; lng: number } | null;
  mapType: 'satellite' | 'street' | 'hybrid';
  parcelData: ParcelData | null;
  nearbyParcels?: NearbyParcel[];
  businesses?: Business[];
  accessPoints?: AccessPoint[];
  selectedParcelAPN?: string | null;
  selectedParcelBoundaries?: Array<[number, number][]> | null;
  suggestedParcelAPN?: string | null;
  onParcelClick?: (parcel: NearbyParcel) => void;
  onBoundsChange?: (bounds: MapBounds) => void;
  onMapClick?: (coords: { lat: number; lng: number }) => void;
  onMarkerDrag?: (coords: { lat: number; lng: number }) => void;
  pinLocation?: { lat: number; lng: number } | null;
  interactiveMode?: boolean;
  showHeatmap?: boolean;
}

// Heatmap layer component
function HeatmapLayer({
  coordinates,
  businesses
}: {
  coordinates: { lat: number; lng: number } | null;
  businesses?: Business[];
}) {
  const map = useMap();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const heatLayerRef = useRef<any>(null);

  useEffect(() => {
    // Dynamically import leaflet.heat
    import('leaflet.heat').then(() => {
      if (!coordinates || !businesses || businesses.length === 0) {
        if (heatLayerRef.current) {
          map.removeLayer(heatLayerRef.current);
          heatLayerRef.current = null;
        }
        return;
      }

      // Generate heat points from businesses
      const heatPoints: [number, number, number][] = [];

      businesses.forEach((business) => {
        // If business has coordinates, use them
        if (business.lat && business.lng) {
          heatPoints.push([business.lat, business.lng, 0.8]);
        } else {
          // Otherwise, estimate position based on distance from center
          const distanceMatch = business.distance.match(/([\d.]+)\s*(mi|km|m|ft)/i);
          if (distanceMatch && coordinates) {
            const distance = parseFloat(distanceMatch[1]);
            const unit = distanceMatch[2].toLowerCase();

            // Convert to kilometers
            let distanceKm = distance;
            if (unit === 'mi') distanceKm = distance * 1.60934;
            if (unit === 'm') distanceKm = distance / 1000;
            if (unit === 'ft') distanceKm = distance * 0.0003048;

            // Create points in a circle around the center
            const angle = Math.random() * 2 * Math.PI;
            const latOffset = (distanceKm / 111) * Math.cos(angle);
            const lngOffset = (distanceKm / (111 * Math.cos(coordinates.lat * Math.PI / 180))) * Math.sin(angle);

            heatPoints.push([
              coordinates.lat + latOffset,
              coordinates.lng + lngOffset,
              0.6 + Math.random() * 0.4 // Intensity varies
            ]);
          }
        }
      });

      // Remove existing layer
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
      }

      // Create new heat layer
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const windowL = (window as any).L;
      if (heatPoints.length > 0 && windowL?.heatLayer) {
        heatLayerRef.current = windowL.heatLayer(heatPoints, {
          radius: 35,
          blur: 25,
          maxZoom: 17,
          max: 1.0,
          gradient: {
            0.0: 'blue',
            0.25: 'cyan',
            0.5: 'lime',
            0.75: 'yellow',
            1.0: 'red'
          }
        }).addTo(map);
      }
    }).catch(console.error);

    return () => {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
    };
  }, [map, coordinates, businesses]);

  return null;
}

// Component to watch for map bounds changes and handle clicks
function MapEventHandler({
  onBoundsChange,
  onMapClick,
  interactiveMode,
}: {
  onBoundsChange?: (bounds: MapBounds) => void;
  onMapClick?: (coords: { lat: number; lng: number }) => void;
  interactiveMode?: boolean;
}) {
  const map = useMap();

  useMapEvents({
    moveend: () => {
      if (!onBoundsChange) return;
      const bounds = map.getBounds();
      onBoundsChange({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      });
    },
    zoomend: () => {
      if (!onBoundsChange) return;
      const bounds = map.getBounds();
      onBoundsChange({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      });
    },
    click: (e) => {
      if (interactiveMode && onMapClick) {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });

  // Initial bounds fetch
  useEffect(() => {
    if (!onBoundsChange) return;
    const bounds = map.getBounds();
    onBoundsChange({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    });
  }, [map, onBoundsChange]);

  return null;
}

// Component to recenter map when coordinates change
function MapRecenter({ coordinates }: { coordinates: { lat: number; lng: number } | null }) {
  const map = useMap();

  useEffect(() => {
    if (coordinates) {
      map.setView([coordinates.lat, coordinates.lng], map.getZoom());
    }
  }, [coordinates?.lat, coordinates?.lng, map]);

  return null;
}

// Component to fit map to parcel bounds
function FitToParcel({
  parcelBoundaries,
  coordinates
}: {
  parcelBoundaries?: Array<[number, number][]> | null;
  coordinates: { lat: number; lng: number } | null;
}) {
  const map = useMap();
  const hasFittedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!parcelBoundaries || parcelBoundaries.length === 0) return;

    const firstBoundary = parcelBoundaries[0];
    if (!firstBoundary || firstBoundary.length < 3) return;

    // Create a unique key for this boundary to avoid re-fitting the same parcel
    const boundaryKey = firstBoundary.slice(0, 3).map(c => `${c[0].toFixed(5)},${c[1].toFixed(5)}`).join('|');

    // Skip if we've already fitted to this exact boundary
    if (hasFittedRef.current === boundaryKey) return;
    hasFittedRef.current = boundaryKey;

    // Calculate bounds from parcel boundary
    const lats = firstBoundary.map(c => c[0]);
    const lngs = firstBoundary.map(c => c[1]);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    // Add padding around the parcel (10% of the span)
    const latPadding = (maxLat - minLat) * 0.15;
    const lngPadding = (maxLng - minLng) * 0.15;

    const bounds: [[number, number], [number, number]] = [
      [minLat - latPadding, minLng - lngPadding],
      [maxLat + latPadding, maxLng + lngPadding]
    ];

    // Fit map to bounds with animation
    map.fitBounds(bounds, {
      padding: [20, 20],
      maxZoom: 20,
      animate: true,
      duration: 0.5
    });
  }, [parcelBoundaries, map]);

  // Reset the fitted ref when coordinates change significantly (new location search)
  useEffect(() => {
    if (coordinates) {
      // Only reset if this is a new location (not just small adjustments)
      hasFittedRef.current = null;
    }
  }, [coordinates?.lat, coordinates?.lng]);

  return null;
}

export default function LeafletMap({
  coordinates,
  mapType,
  parcelData,
  nearbyParcels,
  businesses,
  accessPoints,
  selectedParcelAPN,
  selectedParcelBoundaries,
  suggestedParcelAPN,
  onParcelClick,
  onBoundsChange,
  onMapClick,
  onMarkerDrag,
  pinLocation,
  interactiveMode = false,
  showHeatmap = false,
}: LeafletMapProps) {
  const [pinIcon, setPinIcon] = useState<Icon | DivIcon | null>(null);
  const [accessPointIcon, setAccessPointIcon] = useState<DivIcon | null>(null);

  // Create pin icon on client side only
  useEffect(() => {
    const icon = new DivIcon({
      className: 'custom-pin-marker',
      html: `
        <div style="
          width: 32px;
          height: 32px;
          position: relative;
          transform: translate(-50%, -100%);
        ">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#ef4444"/>
            <circle cx="12" cy="9" r="2.5" fill="white"/>
          </svg>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });
    setPinIcon(icon);
  }, []);

  // Create access point icon (door/entry icon)
  useEffect(() => {
    const icon = new DivIcon({
      className: 'access-point-marker',
      html: `
        <div style="
          width: 28px;
          height: 28px;
          position: relative;
          transform: translate(-50%, -50%);
        ">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">
            <circle cx="12" cy="12" r="11" fill="#10b981" stroke="white" stroke-width="2"/>
            <path d="M8 6h8v12H8V6z" fill="white" stroke="#10b981" stroke-width="1"/>
            <circle cx="14" cy="12" r="1" fill="#10b981"/>
            <path d="M12 8l3 4-3 4" stroke="#10b981" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    setAccessPointIcon(icon);
  }, []);
  const getTileUrl = () => {
    switch (mapType) {
      case 'satellite':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case 'street':
        return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      case 'hybrid':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      default:
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    }
  };

  const getZoningColor = (zoning?: string) => {
    if (!zoning) return '#3388ff';
    const code = zoning.toUpperCase();
    if (code.includes('COMMERCIAL') || code.startsWith('C')) return '#ff6b6b';
    if (code.includes('RESIDENTIAL') || code.startsWith('R')) return '#4ecdc4';
    if (code.includes('INDUSTRIAL') || code.startsWith('I') || code.startsWith('M')) return '#9b59b6';
    if (code.includes('AGRICULTURAL') || code.startsWith('A')) return '#27ae60';
    if (code.includes('MIXED')) return '#f39c12';
    return '#3388ff';
  };

  // Format owner name for display (truncate if too long)
  const formatOwnerName = (owner?: string): string => {
    if (!owner) return '';
    // Truncate long names
    if (owner.length > 20) {
      return owner.substring(0, 18) + '...';
    }
    return owner;
  };

  // Default center (US center) if no coordinates
  const defaultCenter: LatLngExpression = [39.8283, -98.5795];
  const center: LatLngExpression = coordinates ? [coordinates.lat, coordinates.lng] : defaultCenter;
  const defaultZoom = coordinates ? 18 : 4;

  // Determine if we should show nearby parcels or just the single parcel
  const showNearbyParcels = nearbyParcels && nearbyParcels.length > 0;

  // Use pin location or coordinates for the marker
  const markerPosition = pinLocation || coordinates;

  return (
    <MapContainer
      center={center}
      zoom={defaultZoom}
      style={{ height: '400px', width: '100%' }}
      key={`${mapType}`}
    >
      <TileLayer
        url={getTileUrl()}
        attribution={mapType === 'street' ? '&copy; OpenStreetMap contributors' : '&copy; Esri'}
      />
      {mapType === 'hybrid' && (
        <TileLayer
          url="https://stamen-tiles.a.ssl.fastly.net/toner-labels/{z}/{x}/{y}.png"
          attribution="&copy; Stamen Design"
        />
      )}

      {/* Heatmap Layer */}
      {showHeatmap && (
        <HeatmapLayer coordinates={coordinates} businesses={businesses} />
      )}

      {/* Map event handler for bounds changes and clicks */}
      <MapEventHandler
        onBoundsChange={onBoundsChange}
        onMapClick={onMapClick}
        interactiveMode={interactiveMode}
      />
      <MapRecenter coordinates={coordinates} />
      <FitToParcel
        parcelBoundaries={selectedParcelBoundaries || parcelData?.boundaries}
        coordinates={coordinates}
      />

      {/* Draggable Pin Marker */}
      {interactiveMode && markerPosition && pinIcon && (
        <Marker
          position={[markerPosition.lat, markerPosition.lng]}
          icon={pinIcon}
          draggable={true}
          eventHandlers={{
            dragend: (e) => {
              const marker = e.target;
              const position = marker.getLatLng();
              onMarkerDrag?.({ lat: position.lat, lng: position.lng });
            },
          }}
        >
          <Popup>
            <div className="text-sm">
              <strong>Selected Location</strong>
              <p className="text-xs mt-1">
                {markerPosition.lat.toFixed(6)}, {markerPosition.lng.toFixed(6)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Drag to adjust position
              </p>
            </div>
          </Popup>
        </Marker>
      )}

      {/* Render nearby parcels with owner labels */}
      {showNearbyParcels && nearbyParcels.map((parcel, i) => {
        const isSelected = parcel.apn === selectedParcelAPN;
        const isSuggested = parcel.apn === suggestedParcelAPN && !selectedParcelAPN;
        const ownerLabel = formatOwnerName(parcel.owner);

        return parcel.boundaries.map((boundary, boundaryIndex) => (
          <Polygon
            key={`${parcel.apn || i}-${boundaryIndex}`}
            positions={boundary}
            pathOptions={{
              color: isSelected ? '#ef4444' : isSuggested ? '#f97316' : '#ffffff',
              weight: isSelected ? 3 : isSuggested ? 2 : 1,
              fillColor: isSelected ? '#ef4444' : isSuggested ? '#f97316' : 'transparent',
              fillOpacity: isSelected ? 0.3 : isSuggested ? 0.15 : 0,
              dashArray: isSuggested && !isSelected ? '8, 4' : undefined,
              className: isSelected ? 'selected-parcel' : '',
            }}
            eventHandlers={{
              click: (e) => {
                // Prevent map click from propagating
                e.originalEvent.stopPropagation();
                onParcelClick?.(parcel);
              },
            }}
          >
            {/* Owner name label - always visible */}
            {ownerLabel && (
              <Tooltip
                permanent
                direction="center"
                className="parcel-label"
              >
                {ownerLabel}
              </Tooltip>
            )}

            {/* Popup on click with more details */}
            <Popup>
              <div className="text-sm parcel-popup">
                <strong className="text-base">{parcel.owner || 'Unknown Owner'}</strong>
                {parcel.address && <p className="mt-1">Address: {parcel.address}</p>}
                {parcel.acres && <p>Size: {parcel.acres.toFixed(2)} acres</p>}
                {parcel.apn && <p>Parcel #: {parcel.apn}</p>}
                {parcel.zoning && <p>Zoning: {parcel.zoning}</p>}
                {parcel.landUse && <p>Land Use: {parcel.landUse}</p>}
                <button
                  className="mt-2 px-3 py-1 bg-cyan-600 text-white rounded text-xs hover:bg-cyan-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    onParcelClick?.(parcel);
                  }}
                >
                  Select This Parcel
                </button>
              </div>
            </Popup>
          </Polygon>
        ));
      })}

      {/* Fallback: Show single parcel boundary when no nearby parcels (original behavior) */}
      {!showNearbyParcels && parcelData?.boundaries && parcelData.boundaries.length > 0 && (
        parcelData.boundaries.map((boundary, index) => {
          const isEstimated = parcelData.source?.toLowerCase().includes('estimated');
          const isBuilding = parcelData.source?.toLowerCase().includes('building');

          return (
            <Polygon
              key={index}
              positions={boundary}
              pathOptions={{
                color: isEstimated ? '#f39c12' : isBuilding ? '#00bcd4' : getZoningColor(parcelData.zoning?.code || parcelData.parcelInfo?.zoning),
                weight: isEstimated ? 2 : 3,
                fillOpacity: isEstimated ? 0.1 : 0.2,
                dashArray: isEstimated ? '10, 10' : undefined,
              }}
            >
              <Popup>
                <div className="text-sm">
                  <strong>{isEstimated ? 'Estimated Area' : isBuilding ? 'Building Footprint' : 'Parcel Info'}</strong>
                  {parcelData.parcelInfo?.address && <p>Address: {parcelData.parcelInfo.address}</p>}
                  {parcelData.parcelInfo?.acres && <p>Size: {parcelData.parcelInfo.acres.toFixed(2)} acres</p>}
                  {parcelData.parcelInfo?.sqft && <p>Sq Ft: {parcelData.parcelInfo.sqft.toLocaleString()}</p>}
                  {parcelData.parcelInfo?.zoning && <p>Zoning: {parcelData.parcelInfo.zoning}</p>}
                  {parcelData.parcelInfo?.landUse && <p>Land Use: {parcelData.parcelInfo.landUse}</p>}
                  {isEstimated && <p style={{color: '#f39c12', marginTop: '8px', fontSize: '11px'}}>* Boundary is estimated</p>}
                  {isBuilding && <p style={{color: '#00bcd4', marginTop: '8px', fontSize: '11px'}}>* Building footprint from OSM</p>}
                </div>
              </Popup>
            </Polygon>
          );
        })
      )}

      {/* Access Point Markers */}
      {accessPoints && accessPoints.length > 0 && accessPointIcon && accessPoints.map((point, index) => (
        <Marker
          key={`access-point-${index}`}
          position={[point.coordinates[0], point.coordinates[1]]}
          icon={accessPointIcon}
        >
          <Tooltip direction="top" offset={[0, -10]}>
            <div className="text-sm">
              <strong>{point.roadName}</strong>
              {point.roadType && <span className="text-xs block text-gray-500">{point.roadType}</span>}
            </div>
          </Tooltip>
          <Popup>
            <div className="text-sm">
              <strong>Access Point</strong>
              <p className="mt-1">Road: {point.roadName}</p>
              {point.roadType && <p>Type: {point.roadType}</p>}
              <p className="text-xs text-gray-500 mt-1">
                {point.coordinates[0].toFixed(6)}, {point.coordinates[1].toFixed(6)}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

// Zoning Legend Component
export function ZoningLegend() {
  const legendItems = [
    { color: '#ff6b6b', label: 'Commercial' },
    { color: '#4ecdc4', label: 'Residential' },
    { color: '#9b59b6', label: 'Industrial' },
    { color: '#27ae60', label: 'Agricultural' },
    { color: '#f39c12', label: 'Mixed Use' },
  ];

  return (
    <div className="absolute bottom-4 left-4 bg-[var(--bg-secondary)] rounded-lg p-3 shadow-lg border border-[var(--border-color)] z-[1000]">
      <h4 className="text-xs font-medium text-[var(--text-primary)] mb-2">Zoning</h4>
      <div className="space-y-1.5">
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs text-[var(--text-secondary)]">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Heatmap Legend Component
export function HeatmapLegend() {
  return (
    <div className="absolute bottom-4 right-4 bg-[var(--bg-secondary)] rounded-lg p-3 shadow-lg border border-[var(--border-color)] z-[1000]">
      <h4 className="text-xs font-medium text-[var(--text-primary)] mb-2">Competition Density</h4>
      <div className="flex items-center gap-1">
        <span className="text-xs text-[var(--text-muted)]">Low</span>
        <div
          className="w-24 h-3 rounded"
          style={{
            background: 'linear-gradient(to right, blue, cyan, lime, yellow, red)'
          }}
        />
        <span className="text-xs text-[var(--text-muted)]">High</span>
      </div>
    </div>
  );
}
