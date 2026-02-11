'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar } from 'recharts';
import { TrafficInfo, AccessPoint } from '@/types';
import DataSourceTooltip, { DATA_SOURCES } from '@/components/ui/DataSourceTooltip';

interface TrafficChartsProps {
  trafficData: TrafficInfo;
  accessPoints?: AccessPoint[];  // Provided by MapView via page.tsx - single source of truth
}

// VPD estimates based on OSM highway classification
const ROAD_TYPE_VPD: Record<string, { min: number; max: number; avg: number; label: string }> = {
  motorway: { min: 40000, max: 150000, avg: 75000, label: 'Highway/Interstate' },
  motorway_link: { min: 20000, max: 80000, avg: 40000, label: 'Highway Ramp' },
  trunk: { min: 20000, max: 60000, avg: 35000, label: 'Major Highway' },
  trunk_link: { min: 10000, max: 40000, avg: 20000, label: 'Major Highway Ramp' },
  primary: { min: 10000, max: 35000, avg: 20000, label: 'Primary Road' },
  primary_link: { min: 8000, max: 25000, avg: 15000, label: 'Primary Road Ramp' },
  secondary: { min: 5000, max: 20000, avg: 12000, label: 'Secondary Road' },
  secondary_link: { min: 4000, max: 15000, avg: 8000, label: 'Secondary Road Ramp' },
  tertiary: { min: 2000, max: 10000, avg: 5000, label: 'Tertiary Road' },
  tertiary_link: { min: 1500, max: 8000, avg: 4000, label: 'Tertiary Road Ramp' },
  residential: { min: 500, max: 3000, avg: 1500, label: 'Residential Street' },
  unclassified: { min: 200, max: 2000, avg: 800, label: 'Local Road' },
  living_street: { min: 100, max: 500, avg: 250, label: 'Living Street' },
  service: { min: 50, max: 500, avg: 200, label: 'Service Road' },
};

// Calculate VPD from access points (now uses actual FDOT data when available)
function calculateAccessPointVPD(accessPoints: AccessPoint[]): {
  totalVPD: number;
  primaryRoadVPD: number;
  primaryRoadType: string;
  primaryRoadName: string;
  primaryVpdSource: 'fdot' | 'estimated' | undefined;
  roadBreakdown: Array<{ name: string; type: string; vpd: number; label: string; source: 'fdot' | 'estimated'; year?: number }>;
} {
  if (!accessPoints || accessPoints.length === 0) {
    return {
      totalVPD: 0,
      primaryRoadVPD: 0,
      primaryRoadType: 'unknown',
      primaryRoadName: 'No roads found',
      primaryVpdSource: undefined,
      roadBreakdown: [],
    };
  }

  // Group access points by road name, keeping best VPD data for each
  const roadMap = new Map<string, {
    type: string;
    vpd: number;
    source: 'fdot' | 'estimated';
    year?: number;
  }>();

  for (const ap of accessPoints) {
    const existing = roadMap.get(ap.roadName);
    // Use actual FDOT VPD if available, otherwise use estimated
    const vpd = ap.vpd || ap.estimatedVpd || ROAD_TYPE_VPD[ap.roadType || 'unclassified']?.avg || 800;
    const source = ap.vpdSource || 'estimated';
    const year = ap.vpdYear;

    if (!existing) {
      roadMap.set(ap.roadName, { type: ap.roadType || 'unclassified', vpd, source, year });
    } else {
      // Prefer FDOT data over estimated, or higher VPD if both same source
      if ((source === 'fdot' && existing.source !== 'fdot') ||
          (source === existing.source && vpd > existing.vpd)) {
        roadMap.set(ap.roadName, { type: ap.roadType || 'unclassified', vpd, source, year });
      }
    }
  }

  // Build road breakdown
  const roadBreakdown: Array<{ name: string; type: string; vpd: number; label: string; source: 'fdot' | 'estimated'; year?: number }> = [];
  let maxVPD = 0;
  let primaryRoad: { name: string; type: string; vpd: number; source: 'fdot' | 'estimated'; year?: number } = {
    name: '', type: '', vpd: 0, source: 'estimated', year: undefined
  };

  for (const [roadName, info] of roadMap) {
    const label = ROAD_TYPE_VPD[info.type]?.label || 'Road';

    roadBreakdown.push({
      name: roadName,
      type: info.type,
      vpd: info.vpd,
      label,
      source: info.source,
      year: info.year,
    });

    if (info.vpd > maxVPD) {
      maxVPD = info.vpd;
      primaryRoad = { name: roadName, type: info.type, vpd: info.vpd, source: info.source, year: info.year };
    }
  }

  // Sort by VPD descending
  roadBreakdown.sort((a, b) => b.vpd - a.vpd);

  // Total VPD is sum of all unique roads
  const totalVPD = roadBreakdown.reduce((sum, r) => sum + r.vpd, 0);

  return {
    totalVPD,
    primaryRoadVPD: primaryRoad.vpd,
    primaryRoadType: primaryRoad.type,
    primaryRoadName: primaryRoad.name,
    primaryVpdSource: primaryRoad.source,
    roadBreakdown,
  };
}

export default function TrafficCharts({ trafficData, accessPoints: propAccessPoints }: TrafficChartsProps) {
  // Use access points directly from props - MapView is the single source of truth
  const accessPoints = propAccessPoints || [];

  // Calculate VPD from access points
  const accessPointVPD = calculateAccessPointVPD(accessPoints || []);

  // Build VPD comparison data - include individual roads if available
  const vpdComparison = [
    { category: 'Low Traffic', vpd: 5000, fill: '#22c55e' },
    { category: 'Moderate', vpd: 15000, fill: '#eab308' },
  ];

  // Add individual roads or average
  if (trafficData.roads && trafficData.roads.length > 1) {
    // Multiple roads - show each one
    trafficData.roads.forEach((road, index) => {
      const colors = ['#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b'];
      vpdComparison.push({
        category: road.roadName,
        vpd: road.vpd,
        fill: colors[index % colors.length],
      });
    });
  } else {
    // Single road
    vpdComparison.push({
      category: 'This Location',
      vpd: trafficData.estimatedVPD,
      fill: '#06b6d4',
    });
  }

  vpdComparison.push(
    { category: 'High Traffic', vpd: 30000, fill: '#f97316' },
    { category: 'Very High', vpd: 50000, fill: '#ef4444' },
  );

  // Traffic level gauge
  const getTrafficScore = () => {
    const vpd = trafficData.estimatedVPD;
    if (vpd >= 40000) return 100;
    if (vpd >= 25000) return 80;
    if (vpd >= 15000) return 60;
    if (vpd >= 8000) return 40;
    return 20;
  };

  const gaugeData = [
    {
      name: 'Traffic Score',
      value: getTrafficScore(),
      fill: trafficData.estimatedVPD >= 25000 ? '#22c55e' : trafficData.estimatedVPD >= 15000 ? '#06b6d4' : trafficData.estimatedVPD >= 8000 ? '#eab308' : '#ef4444',
    },
  ];

  // Road classification data
  const roadClassData = [
    { type: 'Local Road', typical: '< 5,000 VPD', suitability: 'Neighborhood retail, services' },
    { type: 'Collector', typical: '5,000 - 15,000 VPD', suitability: 'Small retail, food service' },
    { type: 'Minor Arterial', typical: '15,000 - 25,000 VPD', suitability: 'Retail centers, QSR' },
    { type: 'Major Arterial', typical: '25,000 - 50,000 VPD', suitability: 'Major retail, big box' },
    { type: 'Highway', typical: '> 50,000 VPD', suitability: 'Regional destinations' },
  ];

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; payload: { fill: string } }[]; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-3 shadow-lg">
          <p className="text-[var(--text-primary)] font-medium">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.payload.fill }} className="text-sm">
              VPD: {entry.value?.toLocaleString() || 'N/A'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const getTrafficLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'high': return 'text-green-400';
      case 'moderate': return 'text-cyan-400';
      case 'low': return 'text-yellow-400';
      default: return 'text-[var(--text-secondary)]';
    }
  };

  return (
    <div className="space-y-8">
      {/* Access Points VPD Section */}
      {accessPoints && accessPoints.length > 0 && (
        <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--accent-green)]/30">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--accent-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <DataSourceTooltip source={{
              name: 'Access Point Traffic',
              description: 'VPD from Florida DOT AADT at exact access point locations, with estimates for roads without official data',
              type: 'api',
              url: 'https://tdaappsprod.dot.state.fl.us/fto/'
            }}>Property Access Points ({accessPoints.length})</DataSourceTooltip>
          </h3>

          {/* Primary Road Highlight */}
          <div className="mb-4 p-4 bg-[var(--accent-green)]/10 rounded-lg border border-[var(--accent-green)]/20">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-[var(--text-muted)]">Primary Access Road</p>
                <p className="font-semibold text-[var(--text-primary)]">{accessPointVPD.primaryRoadName}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {accessPointVPD.primaryVpdSource === 'fdot' ? (
                    <span className="text-green-400">Florida DOT Official</span>
                  ) : (
                    <span>{ROAD_TYPE_VPD[accessPointVPD.primaryRoadType]?.label || 'Road'} (Estimated)</span>
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-[var(--accent-green)]">
                  {accessPointVPD.primaryRoadVPD.toLocaleString()}
                </p>
                <p className="text-xs text-[var(--text-muted)]">VPD</p>
              </div>
            </div>
          </div>

          {/* Road Breakdown */}
          {accessPointVPD.roadBreakdown.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">
                All Access Roads ({accessPointVPD.roadBreakdown.length})
              </p>
              {accessPointVPD.roadBreakdown.map((road, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center p-3 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-color)]"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      road.source === 'fdot' ? 'bg-green-500/20 text-green-400' :
                      road.vpd >= 10000 ? 'bg-cyan-500/20 text-cyan-400' :
                      road.vpd >= 5000 ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {road.source === 'fdot' ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">{road.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {road.source === 'fdot' ? (
                          <span className="text-green-400">FDOT AADT {road.year}</span>
                        ) : (
                          <span>{road.label} (Est.)</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${road.source === 'fdot' ? 'text-[var(--accent-green)]' : 'text-[var(--accent-cyan)]'}`}>
                      {road.vpd.toLocaleString()}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">VPD</p>
                  </div>
                </div>
              ))}

              {/* Combined VPD */}
              {accessPointVPD.roadBreakdown.length > 1 && (
                <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium text-[var(--text-secondary)]">Combined Traffic Exposure</p>
                    <p className="text-lg font-bold text-[var(--accent-cyan)]">
                      {accessPointVPD.totalVPD.toLocaleString()} VPD
                    </p>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Total daily traffic from all adjacent roads
                  </p>
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-[var(--text-muted)] mt-4 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            VPD from Florida DOT AADT at access point locations. Roads without official counts show estimates.
          </p>
        </div>
      )}

      {/* Traffic Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="metric-card">
          <p className="metric-card-label">
            <DataSourceTooltip source={{
              name: trafficData.vpdSource?.includes('Florida DOT') ? 'Florida DOT AADT' : 'Traffic Estimation',
              description: `Traffic count for ${trafficData.roadType !== 'N/A' ? trafficData.roadType : 'nearby roads'}. ${trafficData.vpdSource || 'Estimated from road classification.'}`,
              url: trafficData.vpdSource?.includes('Florida DOT') ? 'https://tdaappsprod.dot.state.fl.us/fto/' : undefined,
              type: trafficData.vpdSource?.includes('Florida DOT') ? 'api' : 'estimate'
            }}>Vehicles Per Day</DataSourceTooltip>
          </p>
          <p className="metric-card-value">{trafficData.estimatedVPD?.toLocaleString() || 'N/A'}</p>
        </div>
        <div className="metric-card">
          <p className="metric-card-label">
            <DataSourceTooltip source={{
              name: trafficData.vpdSource?.includes('Florida DOT') ? 'Florida DOT AADT' : 'Traffic Estimation',
              description: `VPD range for ${trafficData.roadType !== 'N/A' ? trafficData.roadType : 'nearby roads'}. ${trafficData.vpdSource || 'Estimated from road classification.'}`,
              url: trafficData.vpdSource?.includes('Florida DOT') ? 'https://tdaappsprod.dot.state.fl.us/fto/' : undefined,
              type: trafficData.vpdSource?.includes('Florida DOT') ? 'api' : 'estimate'
            }}>VPD Range</DataSourceTooltip>
          </p>
          <p className="text-lg font-semibold text-[var(--text-primary)]">{trafficData.vpdRange}</p>
        </div>
        <div className="metric-card">
          <p className="metric-card-label">
            <DataSourceTooltip source={DATA_SOURCES.overpass}>Road Type</DataSourceTooltip>
          </p>
          <p className="text-lg font-semibold text-[var(--text-primary)]">{trafficData.roadType}</p>
        </div>
        <div className="metric-card">
          <p className="metric-card-label">
            <DataSourceTooltip source={{
              name: 'Traffic Classification',
              description: 'Categorized based on VPD thresholds: Low (<8K), Moderate (8-15K), High (>15K)',
              type: 'calculation'
            }}>Traffic Level</DataSourceTooltip>
          </p>
          <p className={`text-lg font-semibold ${getTrafficLevelColor(trafficData.trafficLevel)}`}>
            {trafficData.trafficLevel}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Traffic Score Gauge */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--accent-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Traffic Score
          </h3>
          <div className="h-64 flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="100%"
                barSize={20}
                data={gaugeData}
                startAngle={180}
                endAngle={0}
              >
                <RadialBar
                  background={{ fill: 'var(--bg-tertiary)' }}
                  dataKey="value"
                  cornerRadius={10}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="text-center -mt-20">
              <p className="text-4xl font-bold text-[var(--accent-cyan)]">{getTrafficScore()}</p>
              <p className="text-sm text-[var(--text-muted)]">Traffic Score</p>
            </div>
          </div>
        </div>

        {/* VPD Comparison */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--accent-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            VPD Comparison
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vpdComparison} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis type="number" stroke="var(--text-secondary)" />
                <YAxis dataKey="category" type="category" stroke="var(--text-secondary)" width={90} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="vpd" radius={[0, 4, 4, 0]}>
                  {vpdComparison.map((entry, index) => (
                    <Bar key={`bar-${index}`} dataKey="vpd" fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Road Classification Reference */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-[var(--accent-orange)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          Road Classification Reference
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                <th className="text-left py-3 px-4 text-[var(--text-muted)]">Road Type</th>
                <th className="text-left py-3 px-4 text-[var(--text-muted)]">Typical VPD</th>
                <th className="text-left py-3 px-4 text-[var(--text-muted)]">Best For</th>
              </tr>
            </thead>
            <tbody>
              {roadClassData.map((row, index) => {
                const isCurrentType = trafficData.roadType.toLowerCase().includes(row.type.toLowerCase().split(' ')[0]);
                return (
                  <tr
                    key={index}
                    className={`border-b border-[var(--border-color)] ${isCurrentType ? 'bg-[var(--accent-cyan)]/10' : ''}`}
                  >
                    <td className={`py-3 px-4 font-medium ${isCurrentType ? 'text-[var(--accent-cyan)]' : ''}`}>
                      {row.type}
                      {isCurrentType && <span className="ml-2 text-xs">(Current)</span>}
                    </td>
                    <td className="py-3 px-4 text-[var(--text-secondary)]">{row.typical}</td>
                    <td className="py-3 px-4 text-[var(--text-secondary)]">{row.suitability}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Road Information */}
      <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-[var(--accent-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <DataSourceTooltip source={{
            name: 'Traffic Data Sources',
            description: 'VPD from Florida DOT official counts when available, otherwise estimated from TomTom road classification',
            type: 'api'
          }}>Road Information</DataSourceTooltip>
        </h3>

        <div className="space-y-4">
          {/* Primary Road */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--accent-cyan)]/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-[var(--accent-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-[var(--text-primary)]">{trafficData.roadType}</p>
              <p className="text-sm text-[var(--text-muted)]">Primary road for VPD calculation</p>
            </div>
          </div>

          {/* VPD Source */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--accent-green)]/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-[var(--accent-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-[var(--text-primary)]">
                {trafficData.vpdSource?.includes('Florida DOT') ? 'Official AADT Count' : 'Estimated VPD'}
              </p>
              <p className="text-sm text-[var(--text-muted)]">{trafficData.vpdSource || 'Estimated from road classification'}</p>
            </div>
          </div>

          {/* Speed Data */}
          {(trafficData.currentSpeed !== undefined && trafficData.freeFlowSpeed !== undefined) && (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--accent-orange)]/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[var(--accent-orange)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-[var(--text-primary)]">Speed Data</p>
                <p className="text-sm text-[var(--text-muted)]">
                  Current: {trafficData.currentSpeed} mph | Free Flow: {trafficData.freeFlowSpeed} mph
                </p>
              </div>
            </div>
          )}

          {/* VPD Range */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--accent-blue)]/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-[var(--accent-blue)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-[var(--text-primary)]">VPD Range</p>
              <p className="text-sm text-[var(--text-muted)]">{trafficData.vpdRange}</p>
            </div>
          </div>
        </div>

        {/* Data Quality Note */}
        <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
          <p className="text-xs text-[var(--text-muted)] flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {trafficData.vpdSource?.includes('Florida DOT')
              ? 'Official traffic count from Florida Department of Transportation. Data is updated annually.'
              : 'VPD estimated based on road functional classification (FRC) from TomTom. For official counts, check your state DOT website.'}
          </p>
        </div>
      </div>

      {/* Congestion Info */}
      <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <svg className="w-5 h-5 text-[var(--accent-red)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Congestion Level
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-[var(--bg-primary)] rounded-full h-4 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                trafficData.congestionPercent > 70 ? 'bg-red-500' :
                trafficData.congestionPercent > 40 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${trafficData.congestionPercent}%` }}
            />
          </div>
          <span className="text-lg font-bold">{trafficData.congestionPercent}%</span>
        </div>
        <p className="text-sm text-[var(--text-muted)] mt-2">
          {trafficData.congestionPercent > 70
            ? 'High congestion may affect accessibility during peak hours'
            : trafficData.congestionPercent > 40
            ? 'Moderate congestion - good balance of traffic and accessibility'
            : 'Low congestion - excellent drive-by visibility and easy access'}
        </p>
      </div>
    </div>
  );
}
