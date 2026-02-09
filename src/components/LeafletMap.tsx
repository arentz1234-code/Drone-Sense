'use client';

import { useEffect, useRef } from 'react';
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
  selectedParcelAPN?: string | null;
  suggestedParcelAPN?: string | null;
  onParcelClick?: (parcel: NearbyParcel) => void;
  onBoundsChange?: (bounds: MapBounds) => void;
  onMapClick?: (coords: { lat: number; lng: number }) => void;
  onMarkerDrag?: (coords: { lat: number; lng: number }) => void;
  pinLocation?: { lat: number; lng: number } | null;
  interactiveMode?: boolean;
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

// Create custom pin icon
const createPinIcon = () => {
  return new DivIcon({
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
};

export default function LeafletMap({
  coordinates,
  mapType,
  parcelData,
  nearbyParcels,
  selectedParcelAPN,
  suggestedParcelAPN,
  onParcelClick,
  onBoundsChange,
  onMapClick,
  onMarkerDrag,
  pinLocation,
  interactiveMode = false,
}: LeafletMapProps) {
  const pinIcon = useRef(createPinIcon());
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

      {/* Map event handler for bounds changes and clicks */}
      <MapEventHandler
        onBoundsChange={onBoundsChange}
        onMapClick={onMapClick}
        interactiveMode={interactiveMode}
      />
      <MapRecenter coordinates={coordinates} />

      {/* Draggable Pin Marker */}
      {interactiveMode && markerPosition && (
        <Marker
          position={[markerPosition.lat, markerPosition.lng]}
          icon={pinIcon.current}
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
    </MapContainer>
  );
}
