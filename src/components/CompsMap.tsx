'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import { DivIcon, LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MarketComp } from '@/types';

interface CompsMapProps {
  coordinates: { lat: number; lng: number };
  comps: MarketComp[];
}

// Get color based on asset class
function getAssetClassColor(assetClass?: string): string {
  switch (assetClass) {
    case 'Retail': return '#06b6d4'; // cyan
    case 'Office': return '#3b82f6'; // blue
    case 'Industrial': return '#f97316'; // orange
    case 'Mixed-Use': return '#a855f7'; // purple
    default: return '#22c55e'; // green
  }
}

// Component to fit map to show all markers
function FitBounds({ coordinates, comps }: { coordinates: { lat: number; lng: number }; comps: MarketComp[] }) {
  const map = useMap();

  useEffect(() => {
    if (comps.length === 0) {
      map.setView([coordinates.lat, coordinates.lng], 15);
      return;
    }

    // Calculate bounds to fit all comps + center
    const allPoints: [number, number][] = [[coordinates.lat, coordinates.lng]];
    comps.forEach(comp => {
      if (comp.coordinates) {
        allPoints.push([comp.coordinates.lat, comp.coordinates.lng]);
      }
    });

    if (allPoints.length > 1) {
      const lats = allPoints.map(p => p[0]);
      const lngs = allPoints.map(p => p[1]);
      const bounds: [[number, number], [number, number]] = [
        [Math.min(...lats) - 0.005, Math.min(...lngs) - 0.005],
        [Math.max(...lats) + 0.005, Math.max(...lngs) + 0.005],
      ];
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [map, coordinates, comps]);

  return null;
}

export default function CompsMap({ coordinates, comps }: CompsMapProps) {
  const [subjectIcon, setSubjectIcon] = useState<DivIcon | null>(null);
  const [compIcons, setCompIcons] = useState<Map<string, DivIcon>>(new Map());

  // Create subject property icon (red pin)
  useEffect(() => {
    const icon = new DivIcon({
      className: 'subject-marker',
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
    setSubjectIcon(icon);
  }, []);

  // Create comp icons with different colors based on asset class
  useEffect(() => {
    const icons = new Map<string, DivIcon>();
    const assetClasses = ['Retail', 'Office', 'Industrial', 'Mixed-Use', 'default'];

    assetClasses.forEach(assetClass => {
      const color = getAssetClassColor(assetClass === 'default' ? undefined : assetClass);
      const icon = new DivIcon({
        className: 'comp-marker',
        html: `
          <div style="
            width: 28px;
            height: 28px;
            position: relative;
            transform: translate(-50%, -50%);
          ">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.4));">
              <circle cx="12" cy="12" r="10" fill="${color}" stroke="white" stroke-width="2"/>
              <text x="12" y="16" text-anchor="middle" fill="white" font-size="10" font-weight="bold">$</text>
            </svg>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      icons.set(assetClass, icon);
    });

    setCompIcons(icons);
  }, []);

  const center: LatLngExpression = [coordinates.lat, coordinates.lng];

  // Format currency
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    return `$${(value / 1000).toFixed(0)}K`;
  };

  return (
    <MapContainer
      center={center}
      zoom={15}
      style={{ height: '300px', width: '100%' }}
      scrollWheelZoom={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />

      <FitBounds coordinates={coordinates} comps={comps} />

      {/* 1-mile radius circle */}
      <Circle
        center={center}
        radius={1609} // 1 mile in meters
        pathOptions={{
          color: '#06b6d4',
          fillColor: '#06b6d4',
          fillOpacity: 0.05,
          weight: 1,
          dashArray: '5, 5',
        }}
      />

      {/* Subject property marker */}
      {subjectIcon && (
        <Marker position={center} icon={subjectIcon}>
          <Popup>
            <div className="text-sm">
              <strong className="text-red-500">Subject Property</strong>
              <p className="text-xs mt-1">
                {coordinates.lat.toFixed(5)}, {coordinates.lng.toFixed(5)}
              </p>
            </div>
          </Popup>
        </Marker>
      )}

      {/* Comp markers */}
      {compIcons.size > 0 && comps.map((comp, index) => {
        if (!comp.coordinates) return null;

        const iconKey = comp.assetClass || 'default';
        const icon = compIcons.get(iconKey) || compIcons.get('default');
        if (!icon) return null;

        return (
          <Marker
            key={`comp-${index}`}
            position={[comp.coordinates.lat, comp.coordinates.lng]}
            icon={icon}
          >
            <Popup>
              <div className="text-sm min-w-[180px]">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-medium text-white"
                    style={{ backgroundColor: getAssetClassColor(comp.assetClass) }}
                  >
                    {comp.assetClass || 'Commercial'}
                  </span>
                </div>
                <p className="font-medium text-gray-800">{comp.address}</p>
                <div className="mt-2 space-y-1 text-xs text-gray-600">
                  <p><span className="font-medium">Sale Price:</span> {formatCurrency(comp.salePrice)}</p>
                  <p><span className="font-medium">Size:</span> {comp.sqft?.toLocaleString()} sqft</p>
                  <p><span className="font-medium">$/SqFt:</span> ${comp.pricePerSqft}</p>
                  <p><span className="font-medium">Distance:</span> {comp.distance}</p>
                  <p><span className="font-medium">Sold:</span> {comp.saleDate}</p>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
