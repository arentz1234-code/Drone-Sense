'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import PhotoUpload from '@/components/PhotoUpload';
import AddressInput from '@/components/AddressInput';
import MapView, { ParcelData } from '@/components/MapView';
import AnalysisReport from '@/components/AnalysisReport';
import TabNavigation, { TabPanel } from '@/components/ui/TabNavigation';
import { SkeletonCard } from '@/components/ui/Skeleton';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useSearchHistory } from '@/hooks/useSearchHistory';

// Import types from shared types file
import {
  Business,
  TrafficInfo,
  RetailerMatchResult,
  AnalysisResult,
  ExtendedDemographics,
  EnvironmentalRisk,
  MarketComp,
  PropertyData,
  SelectedParcel,
  AccessPoint,
} from '@/types';


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

const RecommendationsPanel = dynamic(() => import('@/components/RecommendationsPanel'), {
  loading: () => <SkeletonCard />,
  ssr: false
});

// Inline retry error banner component
function RetryBanner({
  message,
  onRetry,
  isRetrying = false,
}: {
  message: string;
  onRetry: () => void;
  isRetrying?: boolean;
}) {
  return (
    <div
      className="p-4 rounded-lg border flex items-center justify-between gap-4"
      style={{
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        borderColor: 'rgba(249, 115, 22, 0.3)',
      }}
    >
      <div className="flex items-center gap-3">
        <svg
          className="w-5 h-5 flex-shrink-0"
          style={{ color: 'var(--accent-orange)' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span className="text-sm" style={{ color: 'var(--accent-orange)' }}>
          {message}
        </span>
      </div>
      <button
        onClick={onRetry}
        disabled={isRetrying}
        className="btn-secondary flex items-center gap-2 text-sm"
        style={{ minWidth: '80px' }}
      >
        {isRetrying ? (
          <>
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            Retrying...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Retry
          </>
        )}
      </button>
    </div>
  );
}

const TABS = [
  { id: 'overview', label: 'Overview', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg> },
  { id: 'recommendations', label: 'AI Analysis', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg> },
  { id: 'site-data', label: 'Site Data', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
  { id: 'market', label: 'Market', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg> },
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
  const [parcelData, setParcelData] = useState<ParcelData | null>(null);
  const [retailerMatches, setRetailerMatches] = useState<RetailerMatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Error tracking for individual data sources with retry capability
  const [dataErrors, setDataErrors] = useState<{
    demographics: string | null;
    environmental: string | null;
    marketComps: string | null;
    businesses: string | null;
    traffic: string | null;
    retailerMatches: string | null;
  }>({
    demographics: null,
    environmental: null,
    marketComps: null,
    businesses: null,
    traffic: null,
    retailerMatches: null,
  });

  const { addToHistory, updateHistoryItem } = useSearchHistory();
  const currentHistoryIdRef = useRef<string | null>(null);

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
  const fetchExtendedDemographics = useCallback(async () => {
    if (!coordinates) return;

    setDataErrors(prev => ({ ...prev, demographics: null }));

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
      } else {
        setDataErrors(prev => ({ ...prev, demographics: 'Failed to load demographics data. Check your connection and try again.' }));
      }
    } catch (err) {
      console.error('Failed to fetch extended demographics:', err);
      setDataErrors(prev => ({ ...prev, demographics: 'Failed to load demographics data. Check your connection and try again.' }));
    }
  }, [coordinates]);

  useEffect(() => {
    fetchExtendedDemographics();
  }, [fetchExtendedDemographics]);

  // Fetch environmental risk when coordinates change
  const fetchEnvironmentalRisk = useCallback(async () => {
    if (!coordinates) return;

    setDataErrors(prev => ({ ...prev, environmental: null }));

    try {
      const response = await fetch('/api/environmental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: coordinates.lat, lng: coordinates.lng }),
      });

      if (response.ok) {
        const data = await response.json();
        setEnvironmentalRisk(data);
      } else {
        setDataErrors(prev => ({ ...prev, environmental: 'Failed to load environmental risk data. Check your connection and try again.' }));
      }
    } catch (err) {
      console.error('Failed to fetch environmental risk:', err);
      setDataErrors(prev => ({ ...prev, environmental: 'Failed to load environmental risk data. Check your connection and try again.' }));
    }
  }, [coordinates]);

  useEffect(() => {
    fetchEnvironmentalRisk();
  }, [fetchEnvironmentalRisk]);

  // Fetch market comps when coordinates change
  const fetchMarketComps = useCallback(async () => {
    if (!coordinates) return;

    setDataErrors(prev => ({ ...prev, marketComps: null }));

    try {
      const response = await fetch('/api/market-comps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: coordinates.lat, lng: coordinates.lng }),
      });

      if (response.ok) {
        const data = await response.json();
        setMarketComps(data.comps || []);
      } else {
        setDataErrors(prev => ({ ...prev, marketComps: 'Failed to load market comparables. Check your connection and try again.' }));
      }
    } catch (err) {
      console.error('Failed to fetch market comps:', err);
      setDataErrors(prev => ({ ...prev, marketComps: 'Failed to load market comparables. Check your connection and try again.' }));
    }
  }, [coordinates]);

  useEffect(() => {
    fetchMarketComps();
  }, [fetchMarketComps]);

  // Fetch nearby businesses when coordinates change
  const fetchNearbyBusinesses = useCallback(async () => {
    if (!coordinates) return;

    setDataErrors(prev => ({ ...prev, businesses: null }));

    // Default to 1.5 mile radius (2414 meters) for good market coverage
    const radiusMeters = 2414;

    try {
      const response = await fetch('/api/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinates, radius: radiusMeters }),
      });

      if (response.ok) {
        const data = await response.json();
        setBusinesses(data.businesses || []);
      } else {
        setDataErrors(prev => ({ ...prev, businesses: 'Failed to load nearby businesses. Check your connection and try again.' }));
      }
    } catch (err) {
      console.error('Failed to fetch nearby businesses:', err);
      setDataErrors(prev => ({ ...prev, businesses: 'Failed to load nearby businesses. Check your connection and try again.' }));
    }
  }, [coordinates]);

  useEffect(() => {
    fetchNearbyBusinesses();
  }, [fetchNearbyBusinesses]);

  // Fetch traffic data when coordinates change
  const fetchTrafficData = useCallback(async () => {
    if (!coordinates) return;

    setDataErrors(prev => ({ ...prev, traffic: null }));

    try {
      const response = await fetch('/api/traffic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinates, address }),
      });

      if (response.ok) {
        const data = await response.json();
        setTrafficData(data);
      } else {
        setDataErrors(prev => ({ ...prev, traffic: 'Failed to load traffic data. Check your connection and try again.' }));
      }
    } catch (err) {
      console.error('Failed to fetch traffic data:', err);
      setDataErrors(prev => ({ ...prev, traffic: 'Failed to load traffic data. Check your connection and try again.' }));
    }
  }, [coordinates, address]);

  useEffect(() => {
    fetchTrafficData();
  }, [fetchTrafficData]);

  // Fetch retailer matches when we have sufficient data
  useEffect(() => {
    const fetchRetailerMatches = async () => {
      // Need at least some data to match
      const lotSize = selectedParcel?.parcelInfo?.acres || parcelData?.parcelInfo?.acres || null;
      const primaryVpd = accessPoints.length > 0
        ? Math.max(...accessPoints.map(ap => ap.vpd || ap.estimatedVpd || 0))
        : trafficData?.estimatedVPD || null;
      const medianIncome = demographicsData?.medianHouseholdIncome || null;
      const population = demographicsData?.population || null;

      // Need at least 2 data points to make meaningful matches
      const dataPoints = [lotSize, primaryVpd, medianIncome, population].filter(v => v !== null).length;
      if (dataPoints < 2) {
        return;
      }

      // Derive income level from median income
      let incomeLevel: 'low' | 'moderate' | 'middle' | 'upper-middle' | 'high' | null = null;
      if (medianIncome) {
        if (medianIncome < 35000) incomeLevel = 'low';
        else if (medianIncome < 50000) incomeLevel = 'moderate';
        else if (medianIncome < 75000) incomeLevel = 'middle';
        else if (medianIncome < 100000) incomeLevel = 'upper-middle';
        else incomeLevel = 'high';
      }

      // Extract state code from address
      let stateCode: string | null = null;
      if (address) {
        const stateMatch = address.match(/,\s*([A-Z]{2})\s*\d{5}/);
        if (stateMatch) {
          stateCode = stateMatch[1];
        } else {
          // Try alternate patterns
          const stateNames: Record<string, string> = {
            'florida': 'FL', 'georgia': 'GA', 'alabama': 'AL', 'texas': 'TX',
            'california': 'CA', 'new york': 'NY', 'tennessee': 'TN', 'north carolina': 'NC',
            'south carolina': 'SC', 'virginia': 'VA', 'ohio': 'OH', 'michigan': 'MI',
          };
          const lowerAddress = address.toLowerCase();
          for (const [name, code] of Object.entries(stateNames)) {
            if (lowerAddress.includes(name)) {
              stateCode = code;
              break;
            }
          }
        }
      }

      try {
        const response = await fetch('/api/retailer-match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lotSizeAcres: lotSize,
            vpd: primaryVpd,
            medianIncome,
            incomeLevel,
            population,
            stateCode,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setRetailerMatches(data);
        }
      } catch (err) {
        console.error('Failed to fetch retailer matches:', err);
      }
    };

    fetchRetailerMatches();
  }, [
    selectedParcel?.parcelInfo?.acres,
    parcelData?.parcelInfo?.acres,
    accessPoints,
    trafficData?.estimatedVPD,
    demographicsData?.medianHouseholdIncome,
    demographicsData?.population,
    address,
  ]);

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
          nearbyBusinesses: businesses,
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
        const reason = data.error || 'Unknown error';
        throw new Error(`Analysis failed: ${reason}. Check your connection and try again.`);
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
                onParcelDataChange={setParcelData}
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

        {/* Analysis complete message */}
        {analysis && (
          <div className="text-center py-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Analysis complete - View results in Report tab
            </div>
          </div>
        )}
      </TabPanel>

      {/* Recommendations Tab */}
      <TabPanel id="recommendations" activeTab={activeTab}>
        <div className="terminal-card">
          <div className="terminal-header">
            <div className="terminal-dot red"></div>
            <div className="terminal-dot yellow"></div>
            <div className="terminal-dot green"></div>
            <span className="terminal-title">ai_recommendations.module</span>
          </div>
          <div className="terminal-body">
            {coordinates ? (
              <RecommendationsPanel
                coordinates={coordinates}
                address={address}
                trafficData={trafficData}
                demographicsData={demographicsData}
                businesses={businesses}
                environmentalRisk={environmentalRisk}
                accessPoints={accessPoints}
                parcelInfo={selectedParcel?.parcelInfo || parcelData?.parcelInfo}
              />
            ) : (
              <div className="text-center py-12 text-[var(--text-muted)]">
                <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <p>Enter an address to view AI recommendations</p>
              </div>
            )}
          </div>
        </div>
      </TabPanel>

      {/* Site Data Tab - Combined Demographics, Traffic, Risk */}
      <TabPanel id="site-data" activeTab={activeTab}>
        {coordinates ? (
          <div className="space-y-6">
            {/* Demographics Section */}
            <div className="terminal-card">
              <div className="terminal-header">
                <div className="terminal-dot red"></div>
                <div className="terminal-dot yellow"></div>
                <div className="terminal-dot green"></div>
                <span className="terminal-title">demographics.module</span>
              </div>
              <div className="terminal-body">
                {dataErrors.demographics ? (
                  <RetryBanner
                    message={dataErrors.demographics}
                    onRetry={fetchExtendedDemographics}
                  />
                ) : demographicsData ? (
                  <DemographicsCharts demographics={demographicsData} />
                ) : (
                  <div className="text-center py-8 text-[var(--text-muted)]">Loading demographics...</div>
                )}
              </div>
            </div>

            {/* Traffic Section */}
            <div className="terminal-card">
              <div className="terminal-header">
                <div className="terminal-dot red"></div>
                <div className="terminal-dot yellow"></div>
                <div className="terminal-dot green"></div>
                <span className="terminal-title">traffic.module</span>
              </div>
              <div className="terminal-body">
                {dataErrors.traffic ? (
                  <RetryBanner
                    message={dataErrors.traffic}
                    onRetry={fetchTrafficData}
                  />
                ) : trafficData ? (
                  <TrafficCharts trafficData={trafficData} accessPoints={accessPoints} />
                ) : (
                  <div className="text-center py-8 text-[var(--text-muted)]">Loading traffic data...</div>
                )}
              </div>
            </div>

            {/* Risk Section */}
            <div className="terminal-card">
              <div className="terminal-header">
                <div className="terminal-dot red"></div>
                <div className="terminal-dot yellow"></div>
                <div className="terminal-dot green"></div>
                <span className="terminal-title">risk.module</span>
              </div>
              <div className="terminal-body">
                {dataErrors.environmental ? (
                  <RetryBanner
                    message={dataErrors.environmental}
                    onRetry={fetchEnvironmentalRisk}
                  />
                ) : (
                  <RiskAssessment coordinates={coordinates} environmentalRisk={environmentalRisk} />
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="terminal-card">
            <div className="terminal-body">
              <div className="text-center py-12 text-[var(--text-muted)]">
                <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p>Enter an address to view site data</p>
              </div>
            </div>
          </div>
        )}
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
              dataErrors.marketComps ? (
                <RetryBanner
                  message={dataErrors.marketComps}
                  onRetry={fetchMarketComps}
                />
              ) : (
                <MarketComps
                  coordinates={coordinates}
                  comps={marketComps}
                />
              )
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
                  accessPoints={accessPoints}
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
