'use client';

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import { DivIcon, LatLngExpression, Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MiniMapProps {
  coordinates: { lat: number; lng: number } | null;
  onPinChange: (coords: { lat: number; lng: number }) => void;
}

// Component to handle map events
function MapEventHandler({
  onMapClick,
}: {
  onMapClick: (coords: { lat: number; lng: number }) => void;
}) {
  useMapEvents({
    click: (e) => {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });

  return null;
}

// Component to recenter map when coordinates change
function MapRecenter({ coordinates }: { coordinates: { lat: number; lng: number } | null }) {
  const map = useMap();

  useEffect(() => {
    if (coordinates) {
      map.setView([coordinates.lat, coordinates.lng], 15);
    }
  }, [coordinates?.lat, coordinates?.lng, map]);

  return null;
}

export default function MiniMap({ coordinates, onPinChange }: MiniMapProps) {
  const [pinIcon, setPinIcon] = useState<Icon | DivIcon | null>(null);

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

  // Default center (US center) if no coordinates
  const defaultCenter: LatLngExpression = [39.8283, -98.5795];
  const center: LatLngExpression = coordinates ? [coordinates.lat, coordinates.lng] : defaultCenter;
  const defaultZoom = coordinates ? 15 : 4;

  return (
    <MapContainer
      center={center}
      zoom={defaultZoom}
      style={{ height: '200px', width: '100%' }}
      scrollWheelZoom={true}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />

      <MapEventHandler onMapClick={onPinChange} />
      <MapRecenter coordinates={coordinates} />

      {/* Draggable Pin Marker */}
      {coordinates && pinIcon && (
        <Marker
          position={[coordinates.lat, coordinates.lng]}
          icon={pinIcon}
          draggable={true}
          eventHandlers={{
            dragend: (e) => {
              const marker = e.target;
              const position = marker.getLatLng();
              onPinChange({ lat: position.lat, lng: position.lng });
            },
          }}
        />
      )}
    </MapContainer>
  );
}
