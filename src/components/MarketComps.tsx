'use client';

import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MarketComp } from '@/types';
import DataSourceTooltip, { DATA_SOURCES } from '@/components/ui/DataSourceTooltip';

interface MarketCompsProps {
  coordinates: { lat: number; lng: number };
  comps: MarketComp[] | null;
}

export default function MarketComps({ coordinates, comps }: MarketCompsProps) {
  const [sortBy, setSortBy] = useState<'distance' | 'price' | 'date'>('distance');

  if (!comps) {
    return (
      <div className="text-center py-12 text-[var(--text-muted)]">
        <svg className="w-12 h-12 mx-auto mb-4 opacity-50 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <p>Loading market comparables...</p>
      </div>
    );
  }

  if (comps.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--text-muted)]">
        <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <p>No comparable sales found in this area</p>
      </div>
    );
  }

  // Calculate market statistics
  const avgPricePerSqft = Math.round(comps.reduce((sum, c) => sum + c.pricePerSqft, 0) / comps.length);
  const medianPrice = comps.map(c => c.salePrice).sort((a, b) => a - b)[Math.floor(comps.length / 2)];
  const totalVolume = comps.reduce((sum, c) => sum + c.salePrice, 0);

  // Sort comps
  const sortedComps = [...comps].sort((a, b) => {
    switch (sortBy) {
      case 'distance': return parseFloat(a.distance) - parseFloat(b.distance);
      case 'price': return b.salePrice - a.salePrice;
      case 'date': return new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime();
      default: return 0;
    }
  });

  // Price per sqft chart data
  const priceChartData = comps.map(c => ({
    address: c.address.split(' ').slice(0, 2).join(' '),
    pricePerSqft: c.pricePerSqft,
  }));

  // Asset class distribution (group by asset class for cleaner display)
  const assetClassDistribution = comps.reduce((acc, c) => {
    const assetClass = c.assetClass || 'Commercial';
    acc[assetClass] = (acc[assetClass] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-3 shadow-lg">
          <p className="text-[var(--text-primary)] font-medium">{label}</p>
          <p className="text-[var(--accent-cyan)]">${payload[0].value}/sqft</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8">
      {/* Market Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="metric-card">
          <p className="metric-card-label">
            <DataSourceTooltip source={DATA_SOURCES.marketEstimate}>Avg. Price/SqFt</DataSourceTooltip>
          </p>
          <p className="metric-card-value">${avgPricePerSqft}</p>
        </div>
        <div className="metric-card">
          <p className="metric-card-label">
            <DataSourceTooltip source={DATA_SOURCES.marketEstimate}>Median Sale Price</DataSourceTooltip>
          </p>
          <p className="metric-card-value">{formatCurrency(medianPrice)}</p>
        </div>
        <div className="metric-card">
          <p className="metric-card-label">
            <DataSourceTooltip source={{
              name: 'Sales Volume Calculation',
              description: 'Sum of all comparable sale prices within the search radius',
              type: 'calculation'
            }}>Total Volume</DataSourceTooltip>
          </p>
          <p className="metric-card-value">{formatCurrency(totalVolume)}</p>
        </div>
        <div className="metric-card">
          <p className="metric-card-label">
            <DataSourceTooltip source={DATA_SOURCES.marketEstimate}>Comparables Found</DataSourceTooltip>
          </p>
          <p className="metric-card-value">{comps.length}</p>
        </div>
      </div>

      {/* Price per SqFt Chart */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-[var(--accent-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Price per Square Foot Comparison
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={priceChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis
                dataKey="address"
                stroke="var(--text-secondary)"
                angle={-45}
                textAnchor="end"
                height={60}
                interval={0}
              />
              <YAxis stroke="var(--text-secondary)" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="pricePerSqft" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Asset Class Distribution */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-[var(--accent-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          Commercial Asset Classes
        </h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(assetClassDistribution).map(([assetClass, count]) => (
            <div key={assetClass} className={`px-4 py-2 rounded-lg border ${
              assetClass === 'Retail' ? 'bg-cyan-500/10 border-cyan-500/30' :
              assetClass === 'Office' ? 'bg-blue-500/10 border-blue-500/30' :
              assetClass === 'Industrial' ? 'bg-orange-500/10 border-orange-500/30' :
              'bg-purple-500/10 border-purple-500/30'
            }`}>
              <span className={`font-semibold ${
                assetClass === 'Retail' ? 'text-cyan-400' :
                assetClass === 'Office' ? 'text-blue-400' :
                assetClass === 'Industrial' ? 'text-orange-400' :
                'text-purple-400'
              }`}>{assetClass}</span>
              <span className="text-[var(--text-muted)] ml-2">({count} sales)</span>
            </div>
          ))}
        </div>
      </div>

      {/* Comparable Sales Table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--accent-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Comparable Sales
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setSortBy('distance')}
              className={`px-3 py-1 text-sm rounded ${sortBy === 'distance' ? 'bg-[var(--accent-cyan)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'}`}
            >
              Distance
            </button>
            <button
              onClick={() => setSortBy('price')}
              className={`px-3 py-1 text-sm rounded ${sortBy === 'price' ? 'bg-[var(--accent-cyan)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'}`}
            >
              Price
            </button>
            <button
              onClick={() => setSortBy('date')}
              className={`px-3 py-1 text-sm rounded ${sortBy === 'date' ? 'bg-[var(--accent-cyan)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'}`}
            >
              Date
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]">
                <th className="text-left py-3 px-4 text-[var(--text-muted)]">Address</th>
                <th className="text-center py-3 px-4 text-[var(--text-muted)]">Asset Class</th>
                <th className="text-right py-3 px-4 text-[var(--text-muted)]">Sale Price</th>
                <th className="text-right py-3 px-4 text-[var(--text-muted)]">Sq Ft</th>
                <th className="text-right py-3 px-4 text-[var(--text-muted)]">$/SqFt</th>
                <th className="text-right py-3 px-4 text-[var(--text-muted)]">Distance</th>
                <th className="text-right py-3 px-4 text-[var(--text-muted)]">Sale Date</th>
              </tr>
            </thead>
            <tbody>
              {sortedComps.map((comp, index) => (
                <tr key={index} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]/50">
                  <td className="py-3 px-4">
                    <div className="font-medium">{comp.address}</div>
                    <div className="text-xs text-[var(--text-muted)]">{comp.propertyType}</div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      comp.assetClass === 'Retail' ? 'bg-cyan-500/20 text-cyan-300' :
                      comp.assetClass === 'Office' ? 'bg-blue-500/20 text-blue-300' :
                      comp.assetClass === 'Industrial' ? 'bg-orange-500/20 text-orange-300' :
                      'bg-purple-500/20 text-purple-300'
                    }`}>{comp.assetClass || 'Commercial'}</span>
                  </td>
                  <td className="py-3 px-4 text-right text-[var(--accent-green)]">{formatCurrency(comp.salePrice)}</td>
                  <td className="py-3 px-4 text-right">{comp.sqft?.toLocaleString() || 'N/A'}</td>
                  <td className="py-3 px-4 text-right text-[var(--accent-cyan)]">${comp.pricePerSqft}</td>
                  <td className="py-3 px-4 text-right">{comp.distance}</td>
                  <td className="py-3 px-4 text-right text-[var(--text-muted)]">{comp.saleDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rent Estimates */}
      <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
        <h4 className="font-semibold mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-[var(--accent-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <DataSourceTooltip source={DATA_SOURCES.rentEstimate}>Estimated Rental Rates (per sq ft/year)</DataSourceTooltip>
        </h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-[var(--text-muted)] text-sm mb-1">Retail</p>
            <p className="text-xl font-bold text-[var(--accent-cyan)]">$18-$28</p>
          </div>
          <div className="text-center">
            <p className="text-[var(--text-muted)] text-sm mb-1">Office</p>
            <p className="text-xl font-bold text-[var(--accent-green)]">$14-$22</p>
          </div>
          <div className="text-center">
            <p className="text-[var(--text-muted)] text-sm mb-1">Industrial</p>
            <p className="text-xl font-bold text-[var(--accent-orange)]">$8-$14</p>
          </div>
        </div>
      </div>

      <div className="text-center text-sm text-[var(--text-muted)]">
        <p className="font-medium text-[var(--text-secondary)]">Commercial Real Estate Comparables Only</p>
        <p className="mt-1">Sales data within 1 mile radius • No residential properties included</p>
        <p className="mt-1">Comparable sales are estimates based on regional commercial market data</p>
      </div>
    </div>
  );
}
