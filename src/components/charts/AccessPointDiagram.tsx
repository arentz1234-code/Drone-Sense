'use client';

import { useState, useMemo } from 'react';
import { AccessPoint } from '@/types';

interface AccessPointDiagramProps {
  accessPoints: AccessPoint[];
  propertyAddress?: string;
}

// Access type determination based on road characteristics
type AccessType = 'full' | 'riro' | 'signal' | 'proposed';

interface ProcessedAccessPoint {
  id: number;
  roadName: string;
  vpd: number;
  vpdSource: 'fdot' | 'estimated';
  accessType: AccessType;
  accessLabel: string;
  features: string[];
  direction: 'north' | 'south' | 'east' | 'west';
  roadType: string;
}

// Determine access type based on road characteristics
function determineAccessType(ap: AccessPoint, index: number): { type: AccessType; features: string[] } {
  const roadType = ap.roadType || 'unclassified';
  const vpd = ap.vpd || ap.estimatedVpd || 0;

  // Major highways typically have signalized intersections or limited access
  if (roadType === 'motorway' || roadType === 'trunk') {
    return { type: 'riro', features: ['Limited Access', 'Decel Lane'] };
  }

  // Primary roads with high VPD often have signals
  if (roadType === 'primary' && vpd > 15000) {
    return { type: 'signal', features: ['Traffic Signal', 'Turn Arrow'] };
  }

  // Primary roads may have turn lanes
  if (roadType === 'primary') {
    return { type: 'full', features: ['Left Turn Lane', 'Right Turn Lane'] };
  }

  // Secondary roads
  if (roadType === 'secondary') {
    if (vpd > 10000) {
      return { type: 'signal', features: ['Traffic Signal'] };
    }
    return { type: 'full', features: ['Full Movement'] };
  }

  // Tertiary and residential
  if (roadType === 'tertiary' || roadType === 'residential') {
    return { type: 'full', features: ['Full Movement'] };
  }

  // Service roads or unclassified
  return { type: 'full', features: ['Driveway Access'] };
}

// Determine cardinal direction based on coordinates relative to center
function determineDirection(ap: AccessPoint, allPoints: AccessPoint[]): 'north' | 'south' | 'east' | 'west' {
  if (allPoints.length < 2) return 'south';

  // Calculate center of all points
  const centerLat = allPoints.reduce((sum, p) => sum + p.coordinates[0], 0) / allPoints.length;
  const centerLng = allPoints.reduce((sum, p) => sum + p.coordinates[1], 0) / allPoints.length;

  const latDiff = ap.coordinates[0] - centerLat;
  const lngDiff = ap.coordinates[1] - centerLng;

  // Determine primary direction
  if (Math.abs(latDiff) > Math.abs(lngDiff)) {
    return latDiff > 0 ? 'north' : 'south';
  } else {
    return lngDiff > 0 ? 'east' : 'west';
  }
}

const ACCESS_TYPE_CONFIG = {
  full: {
    color: '#22c55e', // green
    bgColor: 'bg-green-500',
    label: 'Full Access',
    description: 'Full movement access point',
  },
  riro: {
    color: '#f59e0b', // amber/orange
    bgColor: 'bg-amber-500',
    label: 'Right-In / Right-Out',
    description: 'Limited turn movements',
  },
  signal: {
    color: '#3b82f6', // blue
    bgColor: 'bg-blue-500',
    label: 'Signalized Intersection',
    description: 'Traffic signal controlled',
  },
  proposed: {
    color: '#a855f7', // purple
    bgColor: 'bg-purple-500',
    label: 'Proposed Access',
    description: 'Future development access',
  },
};

export default function AccessPointDiagram({ accessPoints, propertyAddress }: AccessPointDiagramProps) {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  const processedPoints = useMemo((): ProcessedAccessPoint[] => {
    if (!accessPoints || accessPoints.length === 0) return [];

    return accessPoints.map((ap, index) => {
      const { type, features } = determineAccessType(ap, index);
      const direction = determineDirection(ap, accessPoints);

      return {
        id: index + 1,
        roadName: ap.roadName || `Access Point ${index + 1}`,
        vpd: ap.vpd || ap.estimatedVpd || 0,
        vpdSource: ap.vpdSource || 'estimated',
        accessType: type,
        accessLabel: ACCESS_TYPE_CONFIG[type].label,
        features,
        direction,
        roadType: ap.roadType || 'unclassified',
      };
    });
  }, [accessPoints]);

  // Group roads by direction for layout
  const roadsByDirection = useMemo(() => {
    const groups: Record<string, ProcessedAccessPoint[]> = {
      north: [],
      south: [],
      east: [],
      west: [],
    };

    processedPoints.forEach(point => {
      groups[point.direction].push(point);
    });

    return groups;
  }, [processedPoints]);

  // Get primary roads (highest VPD in each direction)
  const primaryRoads = useMemo(() => {
    const roads: { horizontal?: ProcessedAccessPoint; vertical?: ProcessedAccessPoint } = {};

    // Find highest VPD horizontal road (east or west)
    const horizontalPoints = [...roadsByDirection.east, ...roadsByDirection.west];
    if (horizontalPoints.length > 0) {
      roads.horizontal = horizontalPoints.reduce((a, b) => a.vpd > b.vpd ? a : b);
    }

    // Find highest VPD vertical road (north or south)
    const verticalPoints = [...roadsByDirection.north, ...roadsByDirection.south];
    if (verticalPoints.length > 0) {
      roads.vertical = verticalPoints.reduce((a, b) => a.vpd > b.vpd ? a : b);
    }

    return roads;
  }, [roadsByDirection]);

  if (processedPoints.length === 0) {
    return (
      <div className="p-6 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)] text-center">
        <p className="text-[var(--text-muted)]">No access points detected for this property.</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
      {/* Header */}
      <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
        <svg className="w-5 h-5 text-[var(--accent-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Access Point Identification
      </h3>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Diagram */}
        <div className="flex-1 relative min-h-[400px] bg-[var(--bg-primary)] rounded-lg p-4">
          <svg viewBox="0 0 400 350" className="w-full h-full" style={{ minHeight: '350px' }}>
            {/* Grid background */}
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)"/>

            {/* Horizontal Road (Primary) */}
            {primaryRoads.horizontal && (
              <g>
                {/* Road surface */}
                <rect x="20" y="155" width="360" height="40" fill="#1a1a2e" stroke="#333" strokeWidth="1"/>
                {/* Center line */}
                <line x1="20" y1="175" x2="380" y2="175" stroke="#f59e0b" strokeWidth="2" strokeDasharray="15,10"/>
                {/* Road name */}
                <text x="40" y="148" fill="#888" fontSize="10" fontFamily="monospace">
                  {primaryRoads.horizontal.roadName}
                </text>
                {/* VPD label - right side */}
                <text x="340" y="185" fill="#f59e0b" fontSize="11" fontFamily="monospace" textAnchor="end">
                  {primaryRoads.horizontal.vpd.toLocaleString()} VPD
                </text>
                <text x="370" y="185" fill="#f59e0b" fontSize="10">→</text>
              </g>
            )}

            {/* Vertical Road (Secondary) */}
            {primaryRoads.vertical && (
              <g>
                {/* Road surface */}
                <rect x="225" y="20" width="35" height="310" fill="#1a1a2e" stroke="#333" strokeWidth="1"/>
                {/* Center line */}
                <line x1="242.5" y1="20" x2="242.5" y2="330" stroke="#a855f7" strokeWidth="2" strokeDasharray="15,10"/>
                {/* Road name - rotated */}
                <text x="268" y="80" fill="#888" fontSize="10" fontFamily="monospace"
                      transform="rotate(90, 268, 80)">
                  {primaryRoads.vertical.roadName}
                </text>
                {/* VPD label - bottom */}
                <text x="242.5" y="320" fill="#a855f7" fontSize="11" fontFamily="monospace" textAnchor="middle">
                  {primaryRoads.vertical.vpd.toLocaleString()}
                </text>
                <text x="242.5" y="332" fill="#a855f7" fontSize="9" textAnchor="middle">VPD</text>
              </g>
            )}

            {/* Subject Property */}
            <g>
              <rect
                x="80" y="85"
                width="140" height="65"
                fill="rgba(34, 211, 238, 0.15)"
                stroke="#22d3ee"
                strokeWidth="2"
                rx="4"
              />
              <text x="150" y="113" fill="#22d3ee" fontSize="12" textAnchor="middle" fontWeight="500">
                Subject
              </text>
              <text x="150" y="130" fill="#22d3ee" fontSize="12" textAnchor="middle" fontWeight="500">
                Property
              </text>
            </g>

            {/* Access Points */}
            {processedPoints.map((point, index) => {
              const config = ACCESS_TYPE_CONFIG[point.accessType];
              let cx = 150, cy = 175; // Default position

              // Position based on direction
              switch (point.direction) {
                case 'south':
                  cx = 150 + (index * 20);
                  cy = 175;
                  break;
                case 'north':
                  cx = 150 + (index * 20);
                  cy = 85;
                  break;
                case 'east':
                  cx = 242;
                  cy = 130 + (index * 30);
                  break;
                case 'west':
                  cx = 80;
                  cy = 130 + (index * 30);
                  break;
              }

              // Adjust positions to avoid overlaps and fit the schematic
              if (point.direction === 'south' && primaryRoads.vertical) {
                cx = 242;
                cy = 175;
              }

              return (
                <g
                  key={point.id}
                  onMouseEnter={() => setHoveredPoint(point.id)}
                  onMouseLeave={() => setHoveredPoint(null)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Access point circle */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={hoveredPoint === point.id ? 18 : 15}
                    fill={config.color}
                    stroke="#fff"
                    strokeWidth="2"
                    style={{ transition: 'r 0.2s' }}
                  />
                  {/* Number */}
                  <text
                    x={cx}
                    y={cy + 4}
                    fill="#fff"
                    fontSize="12"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {point.id}
                  </text>

                  {/* Connector line for RIRO/Signal */}
                  {point.accessType === 'riro' && (
                    <line
                      x1={cx + 15} y1={cy}
                      x2={cx + 30} y2={cy}
                      stroke={config.color}
                      strokeWidth="3"
                    />
                  )}
                </g>
              );
            })}

            {/* North Arrow */}
            <g transform="translate(365, 40)">
              <circle cx="0" cy="0" r="15" fill="#1a1a2e" stroke="#444" strokeWidth="1"/>
              <polygon points="0,-10 -5,5 0,0 5,5" fill="#fff"/>
              <text x="0" y="-18" fill="#888" fontSize="10" textAnchor="middle">N</text>
            </g>
          </svg>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-4 justify-center text-xs">
            {Object.entries(ACCESS_TYPE_CONFIG).map(([key, config]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: config.color }}
                />
                <span className="text-[var(--text-muted)]">{config.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Access Point Details Sidebar */}
        <div className="lg:w-72 space-y-3">
          {processedPoints.map((point) => {
            const config = ACCESS_TYPE_CONFIG[point.accessType];
            const isHovered = hoveredPoint === point.id;

            return (
              <div
                key={point.id}
                className={`p-4 rounded-lg border transition-all ${
                  isHovered
                    ? 'bg-[var(--bg-primary)] border-[var(--accent-cyan)] shadow-lg'
                    : 'bg-[var(--bg-secondary)] border-[var(--border-color)]'
                }`}
                onMouseEnter={() => setHoveredPoint(point.id)}
                onMouseLeave={() => setHoveredPoint(null)}
              >
                <div className="flex items-start gap-3">
                  {/* Number badge */}
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ backgroundColor: config.color }}
                  >
                    {point.id}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Access type */}
                    <p className="font-semibold text-sm" style={{ color: config.color }}>
                      {config.label}
                    </p>

                    {/* Road name */}
                    <p className="text-[var(--text-secondary)] text-sm truncate">
                      {point.roadName}
                    </p>

                    {/* VPD badge */}
                    {point.vpd > 0 && (
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        {point.vpd.toLocaleString()} VPD
                        {point.vpdSource === 'fdot' && (
                          <span className="text-green-400 ml-1">(Official)</span>
                        )}
                      </p>
                    )}

                    {/* Features */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {point.features.map((feature, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 text-[10px] rounded border"
                          style={{
                            borderColor: config.color,
                            color: config.color,
                            backgroundColor: `${config.color}15`
                          }}
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer note */}
      <p className="text-xs text-[var(--text-muted)] text-center mt-6">
        Hover over access points for details. AI-identified based on aerial imagery and DOT records.
      </p>
    </div>
  );
}
