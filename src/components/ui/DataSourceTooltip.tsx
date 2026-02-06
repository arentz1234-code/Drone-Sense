'use client';

import { useState, ReactNode, useRef, useCallback } from 'react';

export interface DataSource {
  name: string;
  url?: string;
  description?: string;
  type: 'api' | 'estimate' | 'calculation' | 'user-input';
}

interface DataSourceTooltipProps {
  children: ReactNode;
  source: DataSource;
  className?: string;
}

export default function DataSourceTooltip({ children, source, className = '' }: DataSourceTooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = useCallback(() => {
    // Clear any pending hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setShowTooltip(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    // Delay hiding to allow cursor to move to tooltip
    hideTimeoutRef.current = setTimeout(() => {
      setShowTooltip(false);
    }, 150);
  }, []);

  const getTypeIcon = () => {
    switch (source.type) {
      case 'api':
        return (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
          </svg>
        );
      case 'estimate':
        return (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
      case 'calculation':
        return (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
        );
      case 'user-input':
        return (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
    }
  };

  const getTypeLabel = () => {
    switch (source.type) {
      case 'api': return 'API Data';
      case 'estimate': return 'Estimated';
      case 'calculation': return 'Calculated';
      case 'user-input': return 'User Input';
    }
  };

  const getTypeColor = () => {
    switch (source.type) {
      case 'api': return 'text-[var(--accent-green)]';
      case 'estimate': return 'text-[var(--accent-orange)]';
      case 'calculation': return 'text-[var(--accent-cyan)]';
      case 'user-input': return 'text-[var(--accent-purple)]';
    }
  };

  return (
    <span
      className={`relative inline-flex items-center cursor-help ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      <span className="ml-1 opacity-40 hover:opacity-100 transition-opacity">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </span>

      {showTooltip && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Invisible bridge to prevent gap between trigger and tooltip */}
          <div className="absolute top-full left-0 right-0 h-3" />

          <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg shadow-xl p-3 min-w-[200px] max-w-[280px]">
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
              <div className="border-8 border-transparent border-t-[var(--border-color)]"></div>
              <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 border-[7px] border-transparent border-t-[var(--bg-primary)]"></div>
            </div>

            {/* Content */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={getTypeColor()}>{getTypeIcon()}</span>
                <span className={`text-xs font-medium ${getTypeColor()}`}>{getTypeLabel()}</span>
              </div>

              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{source.name}</p>
                {source.description && (
                  <p className="text-xs text-[var(--text-muted)] mt-1">{source.description}</p>
                )}
              </div>

              {source.url && (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--accent-cyan)] hover:underline flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View Source
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </span>
  );
}

// Pre-defined data sources for easy reuse
export const DATA_SOURCES = {
  census: {
    name: 'U.S. Census Bureau',
    url: 'https://www.census.gov/data/developers/data-sets.html',
    description: 'American Community Survey (ACS) demographic data',
    type: 'api' as const,
  },
  nominatim: {
    name: 'OpenStreetMap Nominatim',
    url: 'https://nominatim.openstreetmap.org/',
    description: 'Geocoding and reverse geocoding service',
    type: 'api' as const,
  },
  overpass: {
    name: 'OpenStreetMap Overpass',
    url: 'https://overpass-api.de/',
    description: 'Points of interest and road network data',
    type: 'api' as const,
  },
  fema: {
    name: 'FEMA Flood Map Service',
    url: 'https://msc.fema.gov/portal/home',
    description: 'National Flood Hazard Layer (NFHL) data',
    type: 'api' as const,
  },
  epa: {
    name: 'EPA Envirofacts',
    url: 'https://enviro.epa.gov/',
    description: 'Environmental site and contamination data',
    type: 'api' as const,
  },
  fws: {
    name: 'U.S. Fish & Wildlife Service',
    url: 'https://www.fws.gov/program/national-wetlands-inventory',
    description: 'National Wetlands Inventory data',
    type: 'api' as const,
  },
  marketEstimate: {
    name: 'Market Analysis Model',
    description: 'Estimated based on regional commercial real estate data and comparable sales',
    type: 'estimate' as const,
  },
  trafficEstimate: {
    name: 'Traffic Estimation Model',
    description: 'VPD estimated from road classification and regional traffic patterns',
    type: 'estimate' as const,
  },
  feasibilityCalc: {
    name: 'Feasibility Calculator',
    description: 'Weighted score combining traffic, demographics, competition, access, environmental, and market factors',
    type: 'calculation' as const,
  },
  rentEstimate: {
    name: 'Rent Estimation Model',
    description: 'Calculated from property values using standard commercial cap rates (6-8%)',
    type: 'estimate' as const,
  },
  aiAnalysis: {
    name: 'Google Gemini AI',
    url: 'https://ai.google.dev/',
    description: 'AI-powered site analysis and business recommendations',
    type: 'api' as const,
  },
  userInput: {
    name: 'User Provided',
    description: 'Data entered by the user',
    type: 'user-input' as const,
  },
};
