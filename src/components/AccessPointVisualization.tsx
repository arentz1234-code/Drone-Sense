'use client';

import React, { useState, useEffect, useMemo } from 'react';

interface AccessPoint {
  coordinates: [number, number];
  roadName: string;
  type: string;
  roadType?: string;
  distance?: number;
  vpd?: number;
  vpdYear?: number;
  vpdSource?: 'fdot' | 'estimated';
}

interface RoadSummary {
  name: string;
  type: string;
  vpd?: number;
  vpdSource?: string;
}

interface AccessPointVisualizationProps {
  coordinates: { lat: number; lng: number } | null;
  parcelBoundary?: Array<[number, number]>;
}

// Color mapping for access point types
const getAccessColor = (index: number, roadType?: string) => {
  // Primary roads get green (full access)
  if (roadType === 'primary' || roadType === 'trunk' || roadType === 'motorway') {
    return {
      bg: 'bg-green-500',
      border: 'border-green-500',
      text: 'text-green-400',
      shadow: 'shadow-green-500/40',
      bgLight: 'bg-green-500/20',
      label: 'Full Access'
    };
  }
  // Secondary roads get yellow (right-in/right-out)
  if (roadType === 'secondary' || roadType === 'tertiary') {
    return {
      bg: 'bg-yellow-500',
      border: 'border-yellow-500',
      text: 'text-yellow-400',
      shadow: 'shadow-yellow-500/40',
      bgLight: 'bg-yellow-500/20',
      label: 'Right-In / Right-Out'
    };
  }
  // Signalized intersections (based on position/index)
  if (index === 2) {
    return {
      bg: 'bg-blue-500',
      border: 'border-blue-500',
      text: 'text-blue-400',
      shadow: 'shadow-blue-500/40',
      bgLight: 'bg-blue-500/20',
      label: 'Signalized Intersection'
    };
  }
  // Default/other
  return {
    bg: 'bg-purple-500/60',
    border: 'border-purple-400',
    text: 'text-purple-400',
    shadow: 'shadow-purple-500/40',
    bgLight: 'bg-purple-500/20',
    label: 'Proposed Access'
  };
};

// Position access points around the diagram
const getAccessPosition = (index: number, total: number): React.CSSProperties => {
  const positions: React.CSSProperties[] = [
    { left: '32%', bottom: '38%' }, // South (below property)
    { right: '42%', top: '32%' },   // East
    { left: '46%', top: '44%' },    // Center/intersection
    { left: '32%', top: '8%' },     // North
  ];
  return positions[index % positions.length];
};

export default function AccessPointVisualization({ coordinates, parcelBoundary }: AccessPointVisualizationProps) {
  const [loading, setLoading] = useState(false);
  const [accessPoints, setAccessPoints] = useState<AccessPoint[]>([]);
  const [roads, setRoads] = useState<RoadSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  const fetchAccessPoints = async () => {
    if (!coordinates || !parcelBoundary || parcelBoundary.length < 3) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/access-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinates, parcelBoundary }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to fetch access points');
        return;
      }

      setAccessPoints(data.accessPoints || []);
      setRoads(data.roads || []);
    } catch (err) {
      setError('Failed to fetch access point data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (coordinates && parcelBoundary) {
      fetchAccessPoints();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinates?.lat, coordinates?.lng]);

  // Get primary and secondary roads for the visual
  const primaryRoad = roads[0];
  const secondaryRoad = roads[1];

  // Limit display to 4 access points max
  const displayPoints = useMemo(() => accessPoints.slice(0, 4), [accessPoints]);

  if (!coordinates || !parcelBoundary) {
    return null;
  }

  if (loading) {
    return (
      <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-[var(--accent-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <h3 className="font-semibold text-[var(--text-primary)]">Access Point Identification</h3>
        </div>
        <div className="flex items-center justify-center h-48">
          <svg className="animate-spin w-6 h-6 text-[var(--accent-cyan)]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          <span className="ml-2 text-[var(--text-muted)]">Analyzing access points...</span>
        </div>
      </div>
    );
  }

  if (error || accessPoints.length === 0) {
    return null;
  }

  return (
    <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-[var(--accent-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <h3 className="font-semibold text-[var(--text-primary)]">Access Point Identification</h3>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        {/* Visual Map */}
        <div className="lg:col-span-3 relative h-64 sm:h-72 bg-[var(--bg-primary)] rounded-lg overflow-hidden">
          {/* Road Grid Background */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px'
            }}
          />

          {/* Primary Road - Horizontal */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-12 bg-[#374151]">
            <div className="absolute inset-x-0 top-1/2 border-t-2 border-dashed border-yellow-500/60" />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 bg-[#374151] px-1">
              {primaryRoad?.name?.slice(0, 12) || 'Primary Rd'}
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <span className="text-[10px] text-[var(--accent-cyan)] bg-[#374151] px-1">
                {primaryRoad?.vpd?.toLocaleString() || '—'} VPD
              </span>
              <span className="text-gray-500">→</span>
            </div>
          </div>

          {/* Secondary Road - Vertical */}
          {secondaryRoad && (
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-10 bg-[#374151]">
              <div className="absolute inset-y-0 left-1/2 border-l-2 border-dashed border-yellow-500/60" />
              <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 bg-[#374151] px-1 whitespace-nowrap -rotate-90 origin-center">
                {secondaryRoad.name?.slice(0, 12) || 'Secondary'}
              </div>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-[var(--accent-cyan)] bg-[#374151] px-1">
                {secondaryRoad.vpd?.toLocaleString() || '—'} VPD
              </div>
            </div>
          )}

          {/* Subject Property */}
          <div className="absolute top-[20%] left-[20%] w-[25%] h-[25%] bg-[var(--accent-cyan)]/20 border-2 border-[var(--accent-cyan)] rounded">
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] sm:text-xs text-[var(--accent-cyan)] font-medium text-center px-1">
                Subject<br/>Property
              </span>
            </div>
          </div>

          {/* Access Points */}
          {displayPoints.map((ap, index) => {
            const color = getAccessColor(index, ap.roadType);
            const position = getAccessPosition(index, displayPoints.length);
            const isHovered = hoveredPoint === index;

            return (
              <div
                key={index}
                className="absolute z-10 cursor-pointer"
                style={position}
                onMouseEnter={() => setHoveredPoint(index)}
                onMouseLeave={() => setHoveredPoint(null)}
              >
                <div className="relative">
                  {/* Access point circle */}
                  <div className={`w-6 h-6 sm:w-8 sm:h-8 ${color.bg} rounded-full flex items-center justify-center border-2 border-white shadow-lg ${color.shadow} ${index === 2 ? 'animate-pulse' : ''}`}>
                    <span className="text-white text-[10px] sm:text-xs font-bold">{index + 1}</span>
                  </div>

                  {/* Turn lane indicators for full access */}
                  {color.label === 'Full Access' && (
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-0.5">
                      <div className="w-1 h-3 bg-green-400 rounded-full" />
                      <div className="w-1 h-3 bg-green-400 rounded-full" />
                    </div>
                  )}

                  {/* Traffic signal for signalized intersection */}
                  {color.label === 'Signalized Intersection' && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                      <div className="w-2 h-4 bg-[#111827] rounded-sm flex flex-col gap-0.5 p-0.5">
                        <div className="w-1 h-1 bg-red-500 rounded-full" />
                        <div className="w-1 h-1 bg-yellow-500 rounded-full" />
                        <div className="w-1 h-1 bg-green-500 rounded-full" />
                      </div>
                    </div>
                  )}

                  {/* Tooltip on hover */}
                  {isHovered && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-36 p-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg shadow-xl z-20">
                      <p className={`text-[10px] font-bold ${color.text}`}>{color.label}</p>
                      <p className="text-[10px] text-[var(--text-secondary)]">{ap.roadName}</p>
                      {ap.vpd && (
                        <p className="text-[10px] text-[var(--text-muted)] mt-1">
                          {ap.vpd.toLocaleString()} VPD
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Legend */}
          <div className="absolute bottom-2 left-2 flex flex-wrap gap-1 sm:gap-2">
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-[var(--bg-primary)]/80 rounded text-[8px] sm:text-[10px]">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-gray-400">Full Access</span>
            </div>
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-[var(--bg-primary)]/80 rounded text-[8px] sm:text-[10px]">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-gray-400">RIRO</span>
            </div>
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-[var(--bg-primary)]/80 rounded text-[8px] sm:text-[10px]">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-gray-400">Signal</span>
            </div>
          </div>

          {/* Compass */}
          <div className="absolute top-2 right-2 w-8 h-8 bg-[var(--bg-primary)]/80 rounded-full flex items-center justify-center">
            <span className="text-[10px] text-gray-400 font-bold">N</span>
            <div className="absolute top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[3px] border-r-[3px] border-b-[5px] border-l-transparent border-r-transparent border-b-[var(--accent-cyan)]" />
          </div>
        </div>

        {/* Access Points List */}
        <div className="lg:col-span-2 space-y-2">
          {displayPoints.map((ap, index) => {
            const color = getAccessColor(index, ap.roadType);
            return (
              <div
                key={index}
                className={`p-2 sm:p-3 bg-[var(--bg-primary)] rounded-lg border ${color.border}/30`}
                onMouseEnter={() => setHoveredPoint(index)}
                onMouseLeave={() => setHoveredPoint(null)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-5 h-5 ${color.bg} rounded-full flex items-center justify-center text-[10px] font-bold text-white`}>
                    {index + 1}
                  </div>
                  <span className={`text-sm font-medium ${color.text}`}>{color.label}</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] ml-7">{ap.roadName}</p>
                {ap.vpd && (
                  <div className="flex flex-wrap gap-1 mt-2 ml-7">
                    <span className={`px-1.5 py-0.5 ${color.bgLight} ${color.text} text-[10px] rounded`}>
                      {ap.vpd.toLocaleString()} VPD
                    </span>
                    {ap.vpdSource === 'fdot' && (
                      <span className={`px-1.5 py-0.5 ${color.bgLight} ${color.text} text-[10px] rounded`}>
                        DOT {ap.vpdYear}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[10px] text-[var(--text-muted)] mt-3 text-center">
        Hover over access points for details. AI-identified based on aerial imagery and DOT records.
      </p>
    </div>
  );
}
