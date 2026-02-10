'use client';

import { useState, useEffect } from 'react';
import { TrafficInfo } from '@/types';

interface TrafficDataProps {
  coordinates: { lat: number; lng: number } | null;
  address?: string;
  parcelBoundary?: Array<[number, number]>;
  onDataLoad?: (data: {
    estimatedVPD: number;
    vpdRange: string;
    vpdSource?: string;
    roadType: string;
    trafficLevel: string;
    congestionPercent: number;
    currentSpeed?: number;
    freeFlowSpeed?: number;
    roads?: Array<{ roadName: string; vpd: number; year: number }>;
    hasMultipleRoads?: boolean;
    averageVPD?: number;
  } | null) => void;
}

export default function TrafficData({ coordinates, address, parcelBoundary, onDataLoad }: TrafficDataProps) {
  const [loading, setLoading] = useState(false);
  const [traffic, setTraffic] = useState<TrafficInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTrafficData = async () => {
    if (!coordinates) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/traffic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinates, address, parcelBoundary }),
      });

      const data = await response.json();

      console.log('[TrafficData] API Response:', JSON.stringify(data, null, 2));

      if (!response.ok) {
        setError(data.message || data.error || 'Failed to fetch traffic data');
        setTraffic(null);
        onDataLoad?.(null);
      } else {
        setTraffic(data);
        onDataLoad?.({
          estimatedVPD: data.estimatedVPD,
          vpdRange: data.vpdRange,
          vpdSource: data.vpdSource,
          roadType: data.roadType,
          trafficLevel: data.trafficLevel,
          congestionPercent: data.congestionPercent,
          currentSpeed: data.currentSpeed,
          freeFlowSpeed: data.freeFlowSpeed,
          roads: data.roads,
          hasMultipleRoads: data.hasMultipleRoads,
          averageVPD: data.averageVPD,
        });
      }
    } catch (err) {
      setError('Failed to fetch traffic data');
      setTraffic(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (coordinates) {
      fetchTrafficData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinates?.lat, coordinates?.lng, address]);

  const getTrafficColor = (level: string) => {
    switch (level) {
      case 'Free Flow': return 'text-[var(--accent-green)]';
      case 'Light': return 'text-[var(--accent-cyan)]';
      case 'Moderate': return 'text-[var(--accent-yellow)]';
      case 'Heavy': return 'text-[var(--accent-red)]';
      default: return 'text-[var(--text-primary)]';
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[var(--text-primary)]">Traffic Data</h3>
        <button
          onClick={fetchTrafficData}
          disabled={loading || !coordinates}
          className="btn-secondary text-xs py-1 px-3 flex items-center gap-1"
        >
          {loading ? (
            <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
          ) : (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          Refresh
        </button>
      </div>

      {!coordinates && (
        <div className="text-center py-8 border border-dashed border-[var(--border-color)] rounded-lg">
          <svg className="w-10 h-10 mx-auto mb-2 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <p className="text-[var(--text-muted)] text-sm">Enter an address to get traffic data</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-[var(--accent-red)]/10 border border-[var(--accent-red)]/30 rounded-lg">
          <p className="text-[var(--accent-red)] text-sm">{error}</p>
        </div>
      )}

      {loading && coordinates && (
        <div className="text-center py-6 text-[var(--text-muted)] text-sm">
          <svg className="animate-spin w-6 h-6 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          Loading traffic data...
        </div>
      )}

      {traffic && !loading && (
        <div className="space-y-4">
          {/* Multiple Roads Display */}
          {traffic.roads && traffic.roads.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                Adjacent Roads ({traffic.roads.length})
              </p>
              {traffic.roads.map((road, index) => (
                <div key={index} className="p-3 rounded-lg border bg-[var(--bg-tertiary)] border-[var(--border-color)]">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-[var(--text-primary)]">{road.roadName}</p>
                      <p className="text-xs text-[var(--text-muted)]">Florida DOT {road.year}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-[var(--accent-cyan)]">
                        {road.vpd?.toLocaleString() ?? 'N/A'}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">VPD</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Average VPD (only if multiple roads) */}
          {traffic.hasMultipleRoads && traffic.averageVPD && (
            <div className="p-4 rounded-lg border bg-[var(--accent-green)]/10 border-[var(--accent-green)]/30">
              <div className="text-center">
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Average VPD</span>
                <p className="text-3xl font-bold text-[var(--accent-green)]">
                  {traffic.averageVPD?.toLocaleString() ?? 'N/A'}
                </p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  Combined traffic from {traffic.roads?.length} roads
                </p>
              </div>
            </div>
          )}

          {/* Primary VPD (single road or summary) */}
          {!traffic.hasMultipleRoads && (
            <div className="p-4 rounded-lg border bg-[var(--accent-cyan)]/10 border-[var(--accent-cyan)]/30">
              <div className="text-center">
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Traffic Volume</span>
                <p className="text-3xl font-bold text-[var(--accent-cyan)]">
                  {traffic.estimatedVPD?.toLocaleString() ?? 'N/A'} <span className="text-lg font-normal">VPD</span>
                </p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">Vehicles Per Day</p>
              </div>
              <div className="mt-3 pt-3 border-t border-[var(--border-color)] grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-xs text-[var(--text-muted)]">Range</span>
                  <p className="font-medium">{traffic.vpdRange}</p>
                </div>
                <div>
                  <span className="text-xs text-[var(--text-muted)]">Source</span>
                  <p className="font-medium text-xs">{traffic.vpdSource}</p>
                </div>
              </div>
            </div>
          )}

          {/* Speed, Road Type, Traffic */}
          <div className="grid grid-cols-3 gap-2 p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
            <div className="text-center">
              <span className="text-xs text-[var(--text-muted)]">Speed Limit</span>
              <p className="font-semibold">{traffic.freeFlowSpeed} mph</p>
            </div>
            <div className="text-center border-x border-[var(--border-color)]">
              <span className="text-xs text-[var(--text-muted)]">Primary Road</span>
              <p className="font-semibold text-sm">{traffic.roadType}</p>
            </div>
            <div className="text-center">
              <span className="text-xs text-[var(--text-muted)]">Traffic</span>
              <p className={`font-semibold ${getTrafficColor(traffic.trafficLevel)}`}>{traffic.trafficLevel}</p>
            </div>
          </div>

          <p className="text-xs text-[var(--text-muted)] text-center">
            Real-time: TomTom | VPD: Florida DOT AADT
          </p>
        </div>
      )}
    </div>
  );
}
