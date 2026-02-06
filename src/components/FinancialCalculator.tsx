'use client';

import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { MarketComp, ExtendedDemographics } from '@/app/page';

interface FinancialCalculatorProps {
  marketComps?: MarketComp[] | null;
  demographicsData?: ExtendedDemographics | null;
}

interface FinancialInputs {
  purchasePrice: number;
  downPaymentPercent: number;
  interestRate: number;
  loanTermYears: number;
  grossRentalIncome: number;
  vacancyRate: number;
  operatingExpensePercent: number;
  appreciationRate: number;
}

interface FinancialOutputs {
  downPayment: number;
  loanAmount: number;
  monthlyMortgage: number;
  annualMortgage: number;
  effectiveGrossIncome: number;
  operatingExpenses: number;
  noi: number;
  capRate: number;
  cashFlow: number;
  cashOnCashReturn: number;
  dscr: number;
  breakEvenOccupancy: number;
  projections: { year: number; equity: number; cashFlow: number; totalReturn: number }[];
}

export default function FinancialCalculator({ marketComps, demographicsData }: FinancialCalculatorProps) {
  // Initialize with market-based estimates
  const estimatedPrice = useMemo(() => {
    if (marketComps && marketComps.length > 0) {
      const avgPrice = marketComps.reduce((sum, c) => sum + c.salePrice, 0) / marketComps.length;
      return Math.round(avgPrice / 10000) * 10000;
    }
    return 500000;
  }, [marketComps]);

  const [inputs, setInputs] = useState<FinancialInputs>({
    purchasePrice: estimatedPrice,
    downPaymentPercent: 25,
    interestRate: 7.5,
    loanTermYears: 25,
    grossRentalIncome: Math.round(estimatedPrice * 0.08), // 8% gross yield estimate
    vacancyRate: 5,
    operatingExpensePercent: 35,
    appreciationRate: 3,
  });

  // Update purchase price when market comps change
  useEffect(() => {
    setInputs(prev => ({
      ...prev,
      purchasePrice: estimatedPrice,
      grossRentalIncome: Math.round(estimatedPrice * 0.08),
    }));
  }, [estimatedPrice]);

  const outputs = useMemo((): FinancialOutputs => {
    const {
      purchasePrice,
      downPaymentPercent,
      interestRate,
      loanTermYears,
      grossRentalIncome,
      vacancyRate,
      operatingExpensePercent,
      appreciationRate,
    } = inputs;

    // Basic calculations
    const downPayment = purchasePrice * (downPaymentPercent / 100);
    const loanAmount = purchasePrice - downPayment;
    const monthlyRate = interestRate / 100 / 12;
    const numPayments = loanTermYears * 12;

    // Monthly mortgage payment (P&I)
    const monthlyMortgage = loanAmount > 0
      ? loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
      : 0;
    const annualMortgage = monthlyMortgage * 12;

    // Income calculations
    const effectiveGrossIncome = grossRentalIncome * (1 - vacancyRate / 100);
    const operatingExpenses = effectiveGrossIncome * (operatingExpensePercent / 100);
    const noi = effectiveGrossIncome - operatingExpenses;

    // Returns
    const capRate = purchasePrice > 0 ? (noi / purchasePrice) * 100 : 0;
    const cashFlow = noi - annualMortgage;
    const cashOnCashReturn = downPayment > 0 ? (cashFlow / downPayment) * 100 : 0;

    // Debt Service Coverage Ratio
    const dscr = annualMortgage > 0 ? noi / annualMortgage : 0;

    // Break-even occupancy
    const breakEvenOccupancy = grossRentalIncome > 0
      ? ((operatingExpenses + annualMortgage) / grossRentalIncome) * 100
      : 0;

    // 10-year projections
    const projections = [];
    let runningEquity = downPayment;
    let runningCashFlow = 0;
    let propertyValue = purchasePrice;
    let remainingLoan = loanAmount;

    for (let year = 1; year <= 10; year++) {
      // Property appreciation
      propertyValue *= (1 + appreciationRate / 100);

      // Principal paydown (simplified)
      const principalPayment = annualMortgage * 0.3 * (year / 10); // Rough estimate
      remainingLoan = Math.max(0, remainingLoan - principalPayment);

      // Update equity
      runningEquity = propertyValue - remainingLoan;

      // Cumulative cash flow (assume slight growth)
      runningCashFlow += cashFlow * Math.pow(1.02, year - 1);

      projections.push({
        year,
        equity: Math.round(runningEquity),
        cashFlow: Math.round(runningCashFlow),
        totalReturn: Math.round(runningEquity + runningCashFlow - downPayment),
      });
    }

    return {
      downPayment,
      loanAmount,
      monthlyMortgage,
      annualMortgage,
      effectiveGrossIncome,
      operatingExpenses,
      noi,
      capRate,
      cashFlow,
      cashOnCashReturn,
      dscr,
      breakEvenOccupancy,
      projections,
    };
  }, [inputs]);

  const handleInputChange = (field: keyof FinancialInputs, value: string) => {
    const numValue = parseFloat(value) || 0;
    setInputs(prev => ({ ...prev, [field]: numValue }));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getMetricColor = (metric: string, value: number) => {
    switch (metric) {
      case 'capRate':
        return value >= 8 ? 'text-green-400' : value >= 6 ? 'text-cyan-400' : value >= 4 ? 'text-yellow-400' : 'text-red-400';
      case 'cashOnCash':
        return value >= 12 ? 'text-green-400' : value >= 8 ? 'text-cyan-400' : value >= 4 ? 'text-yellow-400' : 'text-red-400';
      case 'dscr':
        return value >= 1.5 ? 'text-green-400' : value >= 1.25 ? 'text-cyan-400' : value >= 1 ? 'text-yellow-400' : 'text-red-400';
      case 'cashFlow':
        return value >= 0 ? 'text-green-400' : 'text-red-400';
      default:
        return 'text-[var(--text-primary)]';
    }
  };

  return (
    <div className="space-y-8">
      {/* Input Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-[var(--accent-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          Investment Parameters
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Purchase Price</label>
            <input
              type="number"
              value={inputs.purchasePrice}
              onChange={(e) => handleInputChange('purchasePrice', e.target.value)}
              className="financial-input"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Down Payment %</label>
            <input
              type="number"
              value={inputs.downPaymentPercent}
              onChange={(e) => handleInputChange('downPaymentPercent', e.target.value)}
              className="financial-input"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Interest Rate %</label>
            <input
              type="number"
              step="0.1"
              value={inputs.interestRate}
              onChange={(e) => handleInputChange('interestRate', e.target.value)}
              className="financial-input"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Loan Term (Years)</label>
            <input
              type="number"
              value={inputs.loanTermYears}
              onChange={(e) => handleInputChange('loanTermYears', e.target.value)}
              className="financial-input"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Annual Gross Income</label>
            <input
              type="number"
              value={inputs.grossRentalIncome}
              onChange={(e) => handleInputChange('grossRentalIncome', e.target.value)}
              className="financial-input"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Vacancy Rate %</label>
            <input
              type="number"
              value={inputs.vacancyRate}
              onChange={(e) => handleInputChange('vacancyRate', e.target.value)}
              className="financial-input"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Operating Expenses %</label>
            <input
              type="number"
              value={inputs.operatingExpensePercent}
              onChange={(e) => handleInputChange('operatingExpensePercent', e.target.value)}
              className="financial-input"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Appreciation Rate %</label>
            <input
              type="number"
              step="0.5"
              value={inputs.appreciationRate}
              onChange={(e) => handleInputChange('appreciationRate', e.target.value)}
              className="financial-input"
            />
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-[var(--accent-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Key Investment Metrics
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="metric-card">
            <p className="metric-card-label">Cap Rate</p>
            <p className={`text-2xl font-bold ${getMetricColor('capRate', outputs.capRate)}`}>
              {outputs.capRate.toFixed(2)}%
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {outputs.capRate >= 8 ? 'Excellent' : outputs.capRate >= 6 ? 'Good' : outputs.capRate >= 4 ? 'Fair' : 'Low'}
            </p>
          </div>
          <div className="metric-card">
            <p className="metric-card-label">Cash-on-Cash</p>
            <p className={`text-2xl font-bold ${getMetricColor('cashOnCash', outputs.cashOnCashReturn)}`}>
              {outputs.cashOnCashReturn.toFixed(2)}%
            </p>
            <p className="text-xs text-[var(--text-muted)]">Annual return on equity</p>
          </div>
          <div className="metric-card">
            <p className="metric-card-label">DSCR</p>
            <p className={`text-2xl font-bold ${getMetricColor('dscr', outputs.dscr)}`}>
              {outputs.dscr.toFixed(2)}x
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {outputs.dscr >= 1.25 ? 'Bankable' : 'Below threshold'}
            </p>
          </div>
          <div className="metric-card">
            <p className="metric-card-label">Annual Cash Flow</p>
            <p className={`text-2xl font-bold ${getMetricColor('cashFlow', outputs.cashFlow)}`}>
              {formatCurrency(outputs.cashFlow)}
            </p>
            <p className="text-xs text-[var(--text-muted)]">{formatCurrency(outputs.cashFlow / 12)}/month</p>
          </div>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
          <h4 className="font-semibold mb-3 text-[var(--accent-cyan)]">Loan Details</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Down Payment:</span>
              <span>{formatCurrency(outputs.downPayment)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Loan Amount:</span>
              <span>{formatCurrency(outputs.loanAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Monthly Payment:</span>
              <span>{formatCurrency(outputs.monthlyMortgage)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Annual Debt Service:</span>
              <span>{formatCurrency(outputs.annualMortgage)}</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
          <h4 className="font-semibold mb-3 text-[var(--accent-green)]">Income Analysis</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Gross Income:</span>
              <span>{formatCurrency(inputs.grossRentalIncome)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Less Vacancy ({inputs.vacancyRate}%):</span>
              <span className="text-red-400">-{formatCurrency(inputs.grossRentalIncome * inputs.vacancyRate / 100)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Effective Gross Income:</span>
              <span>{formatCurrency(outputs.effectiveGrossIncome)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Less Operating Expenses:</span>
              <span className="text-red-400">-{formatCurrency(outputs.operatingExpenses)}</span>
            </div>
            <div className="flex justify-between font-semibold border-t border-[var(--border-color)] pt-2">
              <span>Net Operating Income:</span>
              <span className="text-[var(--accent-green)]">{formatCurrency(outputs.noi)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Break-even Analysis */}
      <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
        <h4 className="font-semibold mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-[var(--accent-orange)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
          </svg>
          Break-Even Analysis
        </h4>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-[var(--text-muted)]">Break-Even Occupancy</span>
              <span className={outputs.breakEvenOccupancy <= 85 ? 'text-green-400' : 'text-yellow-400'}>
                {outputs.breakEvenOccupancy.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-[var(--bg-primary)] rounded-full h-3">
              <div
                className={`h-full rounded-full ${outputs.breakEvenOccupancy <= 85 ? 'bg-green-500' : 'bg-yellow-500'}`}
                style={{ width: `${Math.min(100, outputs.breakEvenOccupancy)}%` }}
              />
            </div>
          </div>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-2">
          Property needs {outputs.breakEvenOccupancy.toFixed(1)}% occupancy to cover all expenses
        </p>
      </div>

      {/* Investment Projections Chart */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-[var(--accent-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          10-Year Investment Projection
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={outputs.projections} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="year" stroke="var(--text-secondary)" />
              <YAxis stroke="var(--text-secondary)" tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                labelStyle={{ color: 'var(--text-primary)' }}
                formatter={(value) => [formatCurrency(value as number), '']}
              />
              <Legend />
              <Line type="monotone" dataKey="equity" name="Equity" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="cashFlow" name="Cumulative Cash Flow" stroke="#06b6d4" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="totalReturn" name="Total Return" stroke="#a855f7" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
