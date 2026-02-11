'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import PhotoUpload from '@/components/PhotoUpload';
import AddressInput from '@/components/AddressInput';
import NearbyBusinesses from '@/components/NearbyBusinesses';
import TrafficData from '@/components/TrafficData';
import DemographicsData from '@/components/DemographicsData';
import MapView from '@/components/MapView';
import AnalysisReport from '@/components/AnalysisReport';
import TabNavigation, { TabPanel } from '@/components/ui/TabNavigation';
import { SkeletonCard } from '@/components/ui/Skeleton';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useSearchHistory } from '@/hooks/useSearchHistory';

// Import all types from shared types file
import {
  Business,
  TrafficInfo,
  BusinessSuitability,
  RetailerMatch,
  RetailerMatchResult,
  FeasibilityScore,
  AnalysisResult,
  ExtendedDemographics,
  EnvironmentalRisk,
  MarketComp,
  PropertyData,
  SelectedParcel,
  AccessPoint,
} from '@/types';

// Re-export types for backward compatibility
export type {
  Business,
  TrafficInfo,
  BusinessSuitability,
  RetailerMatch,
  RetailerMatchResult,
  FeasibilityScore,
  AnalysisResult,
  ExtendedDemographics,
  EnvironmentalRisk,
  MarketComp,
  PropertyData,
};

// Lazy load new components
import dynamic from 'next/dynamic';

const DemographicsCharts = dynamic(() => import('@/components/charts/DemographicsCharts'), {
  loading: () => <SkeletonCard />,
  ssr: false
});

const TrafficCharts = dynamic(() => import('@/components/charts/TrafficCharts'), {
  loading: () => <SkeletonCard />,
  ssr: false
});

const FinancialCalculator = dynamic(() => import('@/components/FinancialCalculator'), {
  loading: () => <SkeletonCard />,
  ssr: false
});

const RiskAssessment = dynamic(() => import('@/components/RiskAssessment'), {
  loading: () => <SkeletonCard />,
  ssr: false
});

const MarketComps = dynamic(() => import('@/components/MarketComps'), {
  loading: () => <SkeletonCard />,
  ssr: false
});

const PDFReportGenerator = dynamic(() => import('@/components/PDFReportGenerator'), {
  loading: () => <SkeletonCard />,
  ssr: false
});

const SavedProperties = dynamic(() => import('@/components/SavedProperties'), {
  loading: () => <SkeletonCard />,
  ssr: false
});


const TABS = [
  { id: 'overview', label: 'Overview', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg> },
  { id: 'demographics', label: 'Demographics', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
  { id: 'traffic', label: 'Traffic', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg> },
  { id: 'market', label: 'Market', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg> },
  { id: 'financials', label: 'Financials', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  { id: 'risk', label: 'Risk', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> },
  { id: 'report', label: 'Report', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [images, setImages] = useState<string[]>([]);
  const [address, setAddress] = useState('');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [trafficData, setTrafficData] = useState<TrafficInfo | null>(null);
  const [demographicsData, setDemographicsData] = useState<ExtendedDemographics | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [environmentalRisk, setEnvironmentalRisk] = useState<EnvironmentalRisk | null>(null);
  const [marketComps, setMarketComps] = useState<MarketComp[] | null>(null);
  const [selectedParcel, setSelectedParcel] = useState<SelectedParcel | null>(null);
  const [accessPoints, setAccessPoints] = useState<AccessPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { addToHistory, updateHistoryItem } = useSearchHistory();
  const currentHistoryIdRef = useRef<string | null>(null);

  const allBusinesses = businesses;
  const hasInput = address.trim().length > 0 || images.length > 0 || coordinates !== null;

  // Storage key for persisting current search
  const CURRENT_SEARCH_KEY = 'drone-sense-current-search';

  // Load coordinates and address from URL parameters (from search page or history)
  // or from localStorage for persistence across navigation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const lat = params.get('lat');
      const lng = params.get('lng');
      const urlAddress = params.get('address');

      if (lat && lng) {
        // Load from URL params (e.g., from history page click)
        const parsedLat = parseFloat(lat);
        const parsedLng = parseFloat(lng);
        if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
          setCoordinates({ lat: parsedLat, lng: parsedLng });
          if (urlAddress) {
            setAddress(decodeURIComponent(urlAddress));
          }
          // Clear URL params after loading
          window.history.replaceState({}, '', '/');
        }
      } else {
        // No URL params - try to restore from localStorage
        try {
          const stored = localStorage.getItem(CURRENT_SEARCH_KEY);
          if (stored) {
            const { address: storedAddress, coordinates: storedCoords } = JSON.parse(stored);
            if (storedAddress) setAddress(storedAddress);
            if (storedCoords) setCoordinates(storedCoords);
          }
        } catch (err) {
          console.error('Failed to restore search state:', err);
        }
      }
    }
  }, []);

  // Persist current search state to localStorage whenever address or coordinates change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        if (address || coordinates) {
          localStorage.setItem(CURRENT_SEARCH_KEY, JSON.stringify({
            address,
            coordinates,
          }));
        }
      } catch (err) {
        console.error('Failed to persist search state:', err);
      }
    }
  }, [address, coordinates]);

  // Clear selected parcel when address changes
  useEffect(() => {
    setSelectedParcel(null);
  }, [address]);

  // Fetch extended demographics when coordinates change
  useEffect(() => {
    const fetchExtendedDemographics = async () => {
      if (!coordinates) return;

      try {
        const response = await fetch('/api/demographics-extended', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: coordinates.lat,
            lng: coordinates.lng,
            radii: [1, 3, 5]
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setDemographicsData(prev => prev ? { ...prev, ...data } : data);
        }
      } catch (err) {
        console.error('Failed to fetch extended demographics:', err);
      }
    };

    fetchExtendedDemographics();
  }, [coordinates?.lat, coordinates?.lng]);

  // Fetch environmental risk when coordinates change
  useEffect(() => {
    const fetchEnvironmentalRisk = async () => {
      if (!coordinates) return;

      try {
        const response = await fetch('/api/environmental', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: coordinates.lat, lng: coordinates.lng }),
        });

        if (response.ok) {
          const data = await response.json();
          setEnvironmentalRisk(data);
        }
      } catch (err) {
        console.error('Failed to fetch environmental risk:', err);
      }
    };

    fetchEnvironmentalRisk();
  }, [coordinates?.lat, coordinates?.lng]);

  // Fetch market comps when coordinates change
  useEffect(() => {
    const fetchMarketComps = async () => {
      if (!coordinates) return;

      try {
        const response = await fetch('/api/market-comps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: coordinates.lat, lng: coordinates.lng }),
        });

        if (response.ok) {
          const data = await response.json();
          setMarketComps(data.comps || []);
        }
      } catch (err) {
        console.error('Failed to fetch market comps:', err);
      }
    };

    fetchMarketComps();
  }, [coordinates?.lat, coordinates?.lng]);

  const handleAnalyze = async () => {
    if (!address && !coordinates) {
      setError('Please enter an address or drop a pin on the map');
      return;
    }

    setError(null);
    setLoading(true);

    // Add to search history when starting analysis
    if (coordinates && address) {
      const historyItem = addToHistory(address, coordinates, null, images[0]);
      currentHistoryIdRef.current = historyItem.id;
    }

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images,
          address,
          coordinates: selectedParcel?.isConfirmed ? selectedParcel.coordinates : coordinates,
          nearbyBusinesses: allBusinesses,
          trafficData,
          demographicsData,
          environmentalRisk,
          marketComps,
          selectedParcel: selectedParcel?.isConfirmed ? {
            boundaries: selectedParcel.boundaries,
            parcelInfo: selectedParcel.parcelInfo,
          } : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Analysis failed');
      }

      const result = await response.json();
      setAnalysis(result);

      // Update history with feasibility score after analysis completes
      if (currentHistoryIdRef.current && result.feasibilityScore?.overall != null) {
        updateHistoryItem(currentHistoryIdRef.current, {
          feasibilityScore: result.feasibilityScore.overall,
        });
      } else if (currentHistoryIdRef.current && result.viabilityScore != null) {
        updateHistoryItem(currentHistoryIdRef.current, {
          feasibilityScore: result.viabilityScore,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadProperty = useCallback((property: PropertyData) => {
    try {
      setImages(property.images || []);
      setAddress(property.address || '');
      setCoordinates(property.coordinates || null);
      setBusinesses(property.businesses || []);
      setTrafficData(property.trafficData || null);
      setDemographicsData(property.demographicsData || null);
      setAnalysis(property.analysis || null);
      setEnvironmentalRisk(property.environmentalRisk || null);
      setMarketComps(property.marketComps || null);
      setSelectedParcel(property.selectedParcel || null);
    } catch (err) {
      console.error('Failed to load property:', err);
      alert('Failed to load saved property. The data may be corrupted.');
    }
  }, []);

  const getCurrentPropertyData = useCallback((): PropertyData => ({
    images,
    address,
    coordinates,
    businesses,
    trafficData,
    demographicsData,
    analysis,
    environmentalRisk,
    marketComps,
    selectedParcel,
  }), [images, address, coordinates, businesses, trafficData, demographicsData, analysis, environmentalRisk, marketComps, selectedParcel]);

  return (
    <ErrorBoundary>
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Site Analysis Dashboard</h2>
          <p className="text-[var(--text-secondary)]">
            Upload drone imagery and property details for AI-powered site analysis
          </p>
        </div>
        <a
          href="/search"
          className="btn-secondary flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Property Search
        </a>
      </div>

      {/* Tab Navigation */}
      <TabNavigation
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Hidden data fetching components - ALWAYS render these outside tabs so data loads regardless of active tab */}
      <div className="hidden">
        <DemographicsData coordinates={coordinates} onDataLoad={(data) => setDemographicsData(prev => prev ? { ...prev, ...data } : data)} />
        <NearbyBusinesses
          coordinates={coordinates}
          businesses={businesses}
          setBusinesses={setBusinesses}
          marketContext={{
            population: demographicsData?.population,
            medianIncome: demographicsData?.medianHouseholdIncome,
            isCollegeTown: demographicsData?.isCollegeTown,
            vpd: trafficData?.estimatedVPD,
          }}
        />
        <TrafficData coordinates={coordinates} address={address} onDataLoad={setTrafficData} />
      </div>

      {/* Overview Tab */}
      <TabPanel id="overview" activeTab={activeTab}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Photo Upload Section */}
            <div className="terminal-card">
              <div className="terminal-header">
                <div className="terminal-dot red"></div>
                <div className="terminal-dot yellow"></div>
                <div className="terminal-dot green"></div>
                <span className="terminal-title">image_upload.module</span>
              </div>
              <div className="terminal-body">
                <PhotoUpload images={images} setImages={setImages} />
              </div>
            </div>

            {/* Address Input Section */}
            <div className="terminal-card">
              <div className="terminal-header">
                <div className="terminal-dot red"></div>
                <div className="terminal-dot yellow"></div>
                <div className="terminal-dot green"></div>
                <span className="terminal-title">location_input.module</span>
              </div>
              <div className="terminal-body">
                <AddressInput
                  address={address}
                  setAddress={setAddress}
                  coordinates={coordinates}
                  setCoordinates={setCoordinates}
                />
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Saved Properties */}
            <div className="terminal-card">
              <div className="terminal-header">
                <div className="terminal-dot red"></div>
                <div className="terminal-dot yellow"></div>
                <div className="terminal-dot green"></div>
                <span className="terminal-title">saved_properties.module</span>
              </div>
              <div className="terminal-body">
                <SavedProperties
                  currentProperty={getCurrentPropertyData()}
                  onLoadProperty={handleLoadProperty}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Property Map Section - Full Width */}
        <div className="mb-8">
          <div className="terminal-card relative">
            <div className="terminal-header">
              <div className="terminal-dot red"></div>
              <div className="terminal-dot yellow"></div>
              <div className="terminal-dot green"></div>
              <span className="terminal-title">property_map.module</span>
            </div>
            <div className="terminal-body">
              <MapView
                coordinates={coordinates}
                address={address}
                environmentalRisk={environmentalRisk}
                selectedParcel={selectedParcel}
                onParcelSelect={setSelectedParcel}
                onCoordinatesChange={setCoordinates}
                onAddressChange={setAddress}
                onAccessPointsChange={setAccessPoints}
                interactiveMode={true}
              />
            </div>
          </div>
        </div>

        {/* Analyze Button */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {error && (
            <div className="text-[var(--accent-red)] text-sm">{error}</div>
          )}
          <button
            onClick={handleAnalyze}
            disabled={loading || (!address && !coordinates)}
            className="btn-primary flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing Analysis...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Run AI Analysis
              </>
            )}
          </button>
        </div>

        {/* Loading Bar */}
        {loading && (
          <div className="mb-8">
            <div className="loading-bar">
              <div className="loading-bar-fill"></div>
            </div>
            <p className="text-center text-[var(--text-muted)] text-sm mt-2">
              Analyzing site imagery and generating recommendations...
            </p>
          </div>
        )}

        {/* Analysis Report */}
        {analysis && (
          <div className="terminal-card glow-cyan">
            <div className="terminal-header">
              <div className="terminal-dot red"></div>
              <div className="terminal-dot yellow"></div>
              <div className="terminal-dot green"></div>
              <span className="terminal-title">analysis_report.output</span>
            </div>
            <div className="terminal-body">
              <AnalysisReport
                  analysis={analysis}
                  address={address}
                  trafficData={trafficData}
                  demographicsData={demographicsData}
                  businesses={businesses}
                  environmentalRisk={environmentalRisk}
                  marketComps={marketComps}
                />
            </div>
          </div>
        )}
      </TabPanel>

      {/* Demographics Tab */}
      <TabPanel id="demographics" activeTab={activeTab}>
        <div className="terminal-card">
          <div className="terminal-header">
            <div className="terminal-dot red"></div>
            <div className="terminal-dot yellow"></div>
            <div className="terminal-dot green"></div>
            <span className="terminal-title">demographics_analysis.module</span>
          </div>
          <div className="terminal-body">
            {coordinates && demographicsData ? (
              <DemographicsCharts demographics={demographicsData} />
            ) : (
              <div className="text-center py-12 text-[var(--text-muted)]">
                <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p>Enter an address to view demographic analysis</p>
              </div>
            )}
          </div>
        </div>
      </TabPanel>

      {/* Traffic Tab */}
      <TabPanel id="traffic" activeTab={activeTab}>
        <div className="terminal-card">
          <div className="terminal-header">
            <div className="terminal-dot red"></div>
            <div className="terminal-dot yellow"></div>
            <div className="terminal-dot green"></div>
            <span className="terminal-title">traffic_analysis.module</span>
          </div>
          <div className="terminal-body">
            {coordinates && trafficData ? (
              <TrafficCharts
                trafficData={trafficData}
                accessPoints={accessPoints}
                coordinates={coordinates}
                parcelBoundary={selectedParcel?.boundaries?.[0]}
              />
            ) : (
              <div className="text-center py-12 text-[var(--text-muted)]">
                <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <p>Enter an address to view traffic analysis</p>
              </div>
            )}
          </div>
        </div>
      </TabPanel>

      {/* Market Tab */}
      <TabPanel id="market" activeTab={activeTab}>
        <div className="terminal-card">
          <div className="terminal-header">
            <div className="terminal-dot red"></div>
            <div className="terminal-dot yellow"></div>
            <div className="terminal-dot green"></div>
            <span className="terminal-title">market_comps.module</span>
          </div>
          <div className="terminal-body">
            {coordinates ? (
              <MarketComps
                coordinates={coordinates}
                comps={marketComps}
              />
            ) : (
              <div className="text-center py-12 text-[var(--text-muted)]">
                <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <p>Enter an address to view market comparables</p>
              </div>
            )}
          </div>
        </div>
      </TabPanel>

      {/* Financials Tab */}
      <TabPanel id="financials" activeTab={activeTab}>
        <div className="terminal-card">
          <div className="terminal-header">
            <div className="terminal-dot red"></div>
            <div className="terminal-dot yellow"></div>
            <div className="terminal-dot green"></div>
            <span className="terminal-title">financial_calculator.module</span>
          </div>
          <div className="terminal-body">
            <FinancialCalculator
              marketComps={marketComps}
              demographicsData={demographicsData}
            />
          </div>
        </div>
      </TabPanel>

      {/* Risk Tab */}
      <TabPanel id="risk" activeTab={activeTab}>
        <div className="terminal-card">
          <div className="terminal-header">
            <div className="terminal-dot red"></div>
            <div className="terminal-dot yellow"></div>
            <div className="terminal-dot green"></div>
            <span className="terminal-title">risk_assessment.module</span>
          </div>
          <div className="terminal-body">
            {coordinates ? (
              <RiskAssessment
                coordinates={coordinates}
                environmentalRisk={environmentalRisk}
              />
            ) : (
              <div className="text-center py-12 text-[var(--text-muted)]">
                <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p>Enter an address to view risk assessment</p>
              </div>
            )}
          </div>
        </div>
      </TabPanel>

      {/* Report Tab */}
      <TabPanel id="report" activeTab={activeTab}>
        {analysis ? (
          <div className="space-y-6">
            <div className="terminal-card glow-cyan">
              <div className="terminal-header">
                <div className="terminal-dot red"></div>
                <div className="terminal-dot yellow"></div>
                <div className="terminal-dot green"></div>
                <span className="terminal-title">analysis_report.output</span>
              </div>
              <div className="terminal-body">
                <AnalysisReport
                  analysis={analysis}
                  address={address}
                  trafficData={trafficData}
                  demographicsData={demographicsData}
                  businesses={businesses}
                  environmentalRisk={environmentalRisk}
                  marketComps={marketComps}
                />
              </div>
            </div>

            {/* PDF Report Generator */}
            <div className="terminal-card">
              <div className="terminal-header">
                <div className="terminal-dot red"></div>
                <div className="terminal-dot yellow"></div>
                <div className="terminal-dot green"></div>
                <span className="terminal-title">pdf_generator.module</span>
              </div>
              <div className="terminal-body">
                <PDFReportGenerator
                  propertyData={getCurrentPropertyData()}
                  address={address}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="terminal-card">
            <div className="terminal-header">
              <div className="terminal-dot red"></div>
              <div className="terminal-dot yellow"></div>
              <div className="terminal-dot green"></div>
              <span className="terminal-title">analysis_report.output</span>
            </div>
            <div className="terminal-body">
              <div className="text-center py-12 text-[var(--text-muted)]">
                <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="mb-4">No analysis report available yet</p>
                <button
                  onClick={() => setActiveTab('overview')}
                  className="btn-secondary"
                >
                  Go to Overview to Run Analysis
                </button>
              </div>
            </div>
          </div>
        )}
      </TabPanel>
    </div>
    </ErrorBoundary>
  );
}
