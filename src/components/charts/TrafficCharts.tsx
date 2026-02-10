'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar } from 'recharts';
import { TrafficInfo } from '@/types';
import DataSourceTooltip, { DATA_SOURCES } from '@/components/ui/DataSourceTooltip';

interface TrafficChartsProps {
  trafficData: TrafficInfo;
}

export default function TrafficCharts({ trafficData }: TrafficChartsProps) {
  // DEBUG: Log received traffic data
  console.log('[TrafficCharts] Received trafficData:', JSON.stringify(trafficData, null, 2));

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
