'use client';

import { MapContainer, TileLayer, Polygon, Popup } from 'react-leaflet';
import { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface LeafletMapProps {
  coordinates: { lat: number; lng: number };
  mapType: 'satellite' | 'street' | 'hybrid';
  parcelData: {
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
  } | null;
}

export default function LeafletMap({ coordinates, mapType, parcelData }: LeafletMapProps) {
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

  const center: LatLngExpression = [coordinates.lat, coordinates.lng];

  return (
    <MapContainer
      center={center}
      zoom={18}
      style={{ height: '300px', width: '100%' }}
      key={`${coordinates.lat}-${coordinates.lng}-${mapType}`}
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

      {/* Parcel Boundary */}
      {parcelData?.boundaries && parcelData.boundaries.length > 0 && (
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
