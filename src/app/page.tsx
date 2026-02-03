'use client';

import { useState } from 'react';
import PhotoUpload from '@/components/PhotoUpload';
import AddressInput from '@/components/AddressInput';
import NearbyBusinesses from '@/components/NearbyBusinesses';
import AnalysisReport from '@/components/AnalysisReport';

export interface Business {
  name: string;
  type: string;
  distance: string;
  address: string;
}

export interface AnalysisResult {
  viabilityScore: number;
  terrain: string;
  accessibility: string;
  existingStructures: string;
  vegetation: string;
  lotSizeEstimate: string;
  businessRecommendation: string;
  constructionPotential: string;
  keyFindings: string[];
  recommendations: string[];
}

export default function HomePage() {
  const [images, setImages] = useState<string[]>([]);
  const [address, setAddress] = useState('');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allBusinesses = businesses;

  const handleAnalyze = async () => {
    if (images.length === 0) {
      setError('Please upload at least one image');
      return;
    }
    if (!address) {
      setError('Please enter an address');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images,
          address,
          coordinates,
          nearbyBusinesses: allBusinesses,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Analysis failed');
      }

      const result = await response.json();
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2">Site Analysis Dashboard</h2>
        <p className="text-[var(--text-secondary)]">
          Upload drone imagery and property details for AI-powered site analysis
        </p>
      </div>

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
          {/* Nearby Businesses Section */}
          <div className="terminal-card">
            <div className="terminal-header">
              <div className="terminal-dot red"></div>
              <div className="terminal-dot yellow"></div>
              <div className="terminal-dot green"></div>
              <span className="terminal-title">nearby_scan.module</span>
            </div>
            <div className="terminal-body">
              <NearbyBusinesses
                coordinates={coordinates}
                businesses={businesses}
                setBusinesses={setBusinesses}
              />
            </div>
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
          disabled={loading || images.length === 0 || !address}
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
            <AnalysisReport analysis={analysis} address={address} />
          </div>
        </div>
      )}
    </div>
  );
}
