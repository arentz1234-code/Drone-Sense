'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

interface MapViewProps {
  coordinates: { lat: number; lng: number } | null;
  address: string;
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

export default function MapView({ coordinates, address }: MapViewProps) {
  const [mapType, setMapType] = useState<MapType>('satellite');
  const [parcelData, setParcelData] = useState<ParcelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch parcel data when coordinates change
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
        setError(data.message || 'Failed to fetch parcel data');
        setParcelData(null);
      } else {
        setParcelData(data);
      }
    } catch (err) {
      setError('Failed to fetch parcel data');
      setParcelData(null);
    } finally {
      setLoading(false);
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

  if (!coordinates) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[var(--text-primary)]">Property Map</h3>
        </div>
        <div className="text-center py-8 border border-dashed border-[var(--border-color)] rounded-lg">
          <svg className="w-10 h-10 mx-auto mb-2 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <p className="text-[var(--text-muted)] text-sm">
            Enter an address to view property map
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[var(--text-primary)]">Property Map</h3>
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

      {/* Map Container */}
      <div className="relative rounded-lg overflow-hidden border border-[var(--border-color)]">
        <LeafletMap
          coordinates={coordinates}
          mapType={mapType}
          parcelData={parcelData}
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
      </div>

      {/* Parcel Info */}
      {parcelData && (
        <div className="mt-4 space-y-3">
          {/* Zoning Info */}
          {(parcelData.zoning || parcelData.parcelInfo?.zoning) && (
            <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: getZoningColor(parcelData.zoning?.code || parcelData.parcelInfo?.zoning) }}
                />
                <span className="text-xs text-[var(--text-muted)] uppercase">Zoning</span>
              </div>
              <p className="font-semibold">
                {parcelData.zoning?.code || parcelData.parcelInfo?.zoning || 'Unknown'}
              </p>
              {parcelData.zoning?.description && (
                <p className="text-sm text-[var(--text-secondary)]">{parcelData.zoning.description}</p>
              )}
            </div>
          )}

          {/* Parcel Details Grid */}
          {parcelData.parcelInfo && (
            <div className="grid grid-cols-2 gap-2">
              {parcelData.parcelInfo.acres && (
                <div className="p-2 bg-[var(--bg-tertiary)] rounded border border-[var(--border-color)]">
                  <span className="text-xs text-[var(--text-muted)]">Lot Size</span>
                  <p className="font-medium">{parcelData.parcelInfo.acres.toFixed(2)} acres</p>
                </div>
              )}
              {parcelData.parcelInfo.sqft && (
                <div className="p-2 bg-[var(--bg-tertiary)] rounded border border-[var(--border-color)]">
                  <span className="text-xs text-[var(--text-muted)]">Square Feet</span>
                  <p className="font-medium">{parcelData.parcelInfo.sqft.toLocaleString()}</p>
                </div>
              )}
              {parcelData.parcelInfo.landUse && (
                <div className="p-2 bg-[var(--bg-tertiary)] rounded border border-[var(--border-color)]">
                  <span className="text-xs text-[var(--text-muted)]">Land Use</span>
                  <p className="font-medium text-sm">{parcelData.parcelInfo.landUse}</p>
                </div>
              )}
              {parcelData.parcelInfo.apn && (
                <div className="p-2 bg-[var(--bg-tertiary)] rounded border border-[var(--border-color)]">
                  <span className="text-xs text-[var(--text-muted)]">Parcel #</span>
                  <p className="font-medium text-sm">{parcelData.parcelInfo.apn}</p>
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
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{backgroundColor: '#ff6b6b'}}></span>Commercial</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{backgroundColor: '#4ecdc4'}}></span>Residential</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{backgroundColor: '#9b59b6'}}></span>Industrial</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{backgroundColor: '#27ae60'}}></span>Agricultural</span>
          </div>
        </div>
      )}
    </div>
  );
}
