'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { ExtendedDemographics } from '@/types';
import DataSourceTooltip, { DATA_SOURCES } from '@/components/ui/DataSourceTooltip';

interface DemographicsChartsProps {
  demographics: ExtendedDemographics;
}

const COLORS = ['#06b6d4', '#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ef4444'];

export default function DemographicsCharts({ demographics }: DemographicsChartsProps) {
  // Population by radius data
  const radiusData = demographics.multiRadius ? [
    { radius: '1 Mile', population: demographics.multiRadius.oneMile.population, households: demographics.multiRadius.oneMile.households },
    { radius: '3 Miles', population: demographics.multiRadius.threeMile.population, households: demographics.multiRadius.threeMile.households },
    { radius: '5 Miles', population: demographics.multiRadius.fiveMile.population, households: demographics.multiRadius.fiveMile.households },
  ] : [];

  // Age distribution data
  const ageData = demographics.ageDistribution || [
    { age: 'Under 18', percent: 22 },
    { age: '18-24', percent: 12 },
    { age: '25-34', percent: 15 },
    { age: '35-44', percent: 14 },
    { age: '45-54', percent: 13 },
    { age: '55-64', percent: 12 },
    { age: '65+', percent: 12 },
  ];

  // Education data
  const educationData = demographics.educationLevels || [
    { level: 'High School', percent: 28 },
    { level: 'Some College', percent: 21 },
    { level: "Associate's", percent: 8 },
    { level: "Bachelor's", percent: 22 },
    { level: 'Graduate+', percent: 12 },
  ];

  // Income distribution from Census ACS data
  const incomeData = demographics.incomeDistribution || [
    { range: '<$25K', percent: 15 },
    { range: '$25K-$50K', percent: 22 },
    { range: '$50K-$75K', percent: 23 },
    { range: '$75K-$100K', percent: 18 },
    { range: '$100K-$150K', percent: 14 },
    { range: '$150K+', percent: 8 },
  ];

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-3 shadow-lg">
          <p className="text-[var(--text-primary)] font-medium">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-[var(--text-secondary)] text-sm">
              {entry.name}: {typeof entry.value === 'number' && entry.value > 1000
                ? entry.value.toLocaleString()
                : `${entry.value}%`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="metric-card">
          <p className="metric-card-label">
            <DataSourceTooltip source={DATA_SOURCES.census}>Population (3mi)</DataSourceTooltip>
          </p>
          <p className="metric-card-value">
            {demographics.multiRadius?.threeMile?.population?.toLocaleString() || demographics.population?.toLocaleString() || 'N/A'}
          </p>
        </div>
        <div className="metric-card">
          <p className="metric-card-label">
            <DataSourceTooltip source={DATA_SOURCES.census}>Households (3mi)</DataSourceTooltip>
          </p>
          <p className="metric-card-value">
            {demographics.multiRadius?.threeMile?.households?.toLocaleString() || 'N/A'}
          </p>
        </div>
        <div className="metric-card">
          <p className="metric-card-label">
            <DataSourceTooltip source={DATA_SOURCES.census}>Median Income</DataSourceTooltip>
          </p>
          <p className="metric-card-value">
            ${(demographics.medianHouseholdIncome || 0).toLocaleString()}
          </p>
        </div>
        <div className="metric-card">
          <p className="metric-card-label">
            <DataSourceTooltip source={{
              name: 'Population Growth Model',
              description: 'Calculated from Census ACS 5-year estimates comparing recent vs historical data',
              type: 'calculation'
            }}>Growth Trend</DataSourceTooltip>
          </p>
          <p className="metric-card-value">
            {demographics.growthTrend ? `+${demographics.growthTrend}%` : 'N/A'}
          </p>
        </div>
      </div>

      {/* Discretionary Income Section */}
      {demographics.discretionaryIncome && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-lg border border-pink-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-pink-500/20 rounded-lg">
              <svg className="w-6 h-6 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">
                <DataSourceTooltip source={{
                  name: 'Discretionary Income Model',
                  description: 'Calculated from median income minus estimated necessities (housing, food, utilities, healthcare) based on BLS Consumer Expenditure Survey data',
                  type: 'calculation'
                }}>Discretionary Income</DataSourceTooltip>
              </p>
              <p className="text-xl font-bold text-pink-400">
                ${demographics.discretionaryIncome.toLocaleString()}
              </p>
              <p className="text-xs text-[var(--text-muted)]">per household/year</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Per Capita</p>
              <p className="text-xl font-bold text-purple-400">
                ${(demographics.discretionaryIncomePerCapita || Math.round(demographics.discretionaryIncome / (demographics.householdSize || 2.5))).toLocaleString()}
              </p>
              <p className="text-xs text-[var(--text-muted)]">per person/year</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Spending Rate</p>
              <p className="text-xl font-bold text-cyan-400">
                {demographics.discretionaryPercent || Math.round((demographics.discretionaryIncome / demographics.medianHouseholdIncome) * 100)}%
              </p>
              <p className="text-xs text-[var(--text-muted)]">of income is discretionary</p>
            </div>
          </div>
        </div>
      )}

      {/* Population by Radius */}
      {radiusData.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--accent-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            Population by Radius
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={radiusData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="radius" stroke="var(--text-secondary)" />
                <YAxis stroke="var(--text-secondary)" />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="population" name="Population" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                <Bar dataKey="households" name="Households" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Age Distribution */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--accent-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Age Distribution
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ageData} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis type="number" stroke="var(--text-secondary)" unit="%" />
                <YAxis dataKey="age" type="category" stroke="var(--text-secondary)" width={70} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="percent" name="Percent" fill="#22c55e" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Income Distribution Pie Chart */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--accent-blue)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <DataSourceTooltip source={DATA_SOURCES.census}>Income Distribution</DataSourceTooltip>
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={incomeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="percent"
                  nameKey="range"
                  label={({ name, value }) => `${name}: ${value}%`}
                  labelLine={false}
                >
                  {incomeData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Education Levels */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-[var(--accent-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
          </svg>
          Education Levels
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={educationData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="level" stroke="var(--text-secondary)" />
              <YAxis stroke="var(--text-secondary)" unit="%" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="percent" name="Percent" fill="#a855f7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Consumer Spending Power */}
      {demographics.consumerSpending && (
        <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
          <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--accent-orange)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <DataSourceTooltip source={{
              name: 'Census + BLS Consumer Expenditure',
              description: 'Calculated from Census ACS household income distribution combined with BLS Consumer Expenditure Survey average spending rates per income bracket',
              type: 'calculation'
            }}>Consumer Spending Power</DataSourceTooltip>
          </h3>
          <p className="text-3xl font-bold bg-gradient-to-r from-[var(--accent-orange)] to-[var(--accent-red)] bg-clip-text text-transparent">
            ${(demographics.consumerSpending / 1000000).toFixed(1)}M
          </p>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Annual consumer spending within 3-mile radius
          </p>
        </div>
      )}
    </div>
  );
}
