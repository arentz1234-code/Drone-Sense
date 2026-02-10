'use client';

import { useState, useEffect } from 'react';

export interface ProgressStep {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
}

interface ProgressIndicatorProps {
  steps: ProgressStep[];
  currentStep?: string;
  onCancel?: () => void;
  showPercentage?: boolean;
}

export default function ProgressIndicator({
  steps,
  currentStep,
  onCancel,
  showPercentage = true,
}: ProgressIndicatorProps) {
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const progress = Math.round((completedSteps / steps.length) * 100);

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--text-secondary)]">
            {currentStep ? `Processing: ${currentStep}` : 'Initializing...'}
          </span>
          {showPercentage && (
            <span className="text-[var(--accent-cyan)] font-medium">{progress}%</span>
          )}
        </div>
        <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-blue)] transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step list */}
      <div className="space-y-2">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
              step.status === 'loading'
                ? 'bg-[var(--accent-cyan)]/10 border border-[var(--accent-cyan)]/30'
                : step.status === 'completed'
                ? 'bg-[var(--accent-green)]/5'
                : step.status === 'error'
                ? 'bg-[var(--accent-red)]/10'
                : 'bg-[var(--bg-tertiary)]/50'
            }`}
          >
            {/* Status icon */}
            <div className="flex-shrink-0">
              {step.status === 'pending' && (
                <div className="w-5 h-5 rounded-full border-2 border-[var(--border-color)]" />
              )}
              {step.status === 'loading' && (
                <svg className="w-5 h-5 animate-spin text-[var(--accent-cyan)]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {step.status === 'completed' && (
                <svg className="w-5 h-5 text-[var(--accent-green)]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
              {step.status === 'error' && (
                <svg className="w-5 h-5 text-[var(--accent-red)]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              )}
            </div>

            {/* Label */}
            <span
              className={`text-sm ${
                step.status === 'loading'
                  ? 'text-[var(--accent-cyan)] font-medium'
                  : step.status === 'completed'
                  ? 'text-[var(--text-secondary)]'
                  : step.status === 'error'
                  ? 'text-[var(--accent-red)]'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              {step.label}
            </span>

            {/* Loading dots for active step */}
            {step.status === 'loading' && (
              <div className="ml-auto flex gap-1">
                <span className="w-1.5 h-1.5 bg-[var(--accent-cyan)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-[var(--accent-cyan)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-[var(--accent-cyan)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Cancel button */}
      {onCancel && (
        <div className="flex justify-center pt-2">
          <button
            onClick={onCancel}
            className="text-sm text-[var(--text-muted)] hover:text-[var(--accent-red)] transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cancel Analysis
          </button>
        </div>
      )}
    </div>
  );
}

// Helper hook to manage progress steps
export function useProgressSteps(initialSteps: Omit<ProgressStep, 'status'>[]) {
  const [steps, setSteps] = useState<ProgressStep[]>(
    initialSteps.map(s => ({ ...s, status: 'pending' as const }))
  );

  const startStep = (stepId: string) => {
    setSteps(prev =>
      prev.map(s => (s.id === stepId ? { ...s, status: 'loading' as const } : s))
    );
  };

  const completeStep = (stepId: string) => {
    setSteps(prev =>
      prev.map(s => (s.id === stepId ? { ...s, status: 'completed' as const } : s))
    );
  };

  const failStep = (stepId: string) => {
    setSteps(prev =>
      prev.map(s => (s.id === stepId ? { ...s, status: 'error' as const } : s))
    );
  };

  const resetSteps = () => {
    setSteps(initialSteps.map(s => ({ ...s, status: 'pending' as const })));
  };

  const getCurrentStep = (): string | undefined => {
    const loading = steps.find(s => s.status === 'loading');
    return loading?.label;
  };

  return {
    steps,
    startStep,
    completeStep,
    failStep,
    resetSteps,
    getCurrentStep,
  };
}
