'use client';

import { useState } from 'react';
import { PropertyData } from '@/types';

interface ShareButtonProps {
  propertyData: PropertyData;
  address: string;
}

export default function ShareButton({ propertyData, address }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  const generateShareUrl = async () => {
    if (!propertyData.coordinates) {
      alert('No location data to share');
      return;
    }

    setSharing(true);

    try {
      // Create a minimal shareable data object
      const shareData = {
        address,
        coordinates: propertyData.coordinates,
        score: propertyData.analysis?.viabilityScore || propertyData.analysis?.feasibilityScore?.overall,
        timestamp: new Date().toISOString(),
      };

      // Encode the data as base64 for URL sharing
      const encoded = btoa(JSON.stringify(shareData));

      // Store full data in localStorage with the encoded ID as key
      const shareKey = `drone-sense-share-${encoded.slice(0, 20)}`;
      localStorage.setItem(shareKey, JSON.stringify({
        ...shareData,
        fullData: propertyData,
      }));

      // Generate the shareable URL
      const shareUrl = `${window.location.origin}/shared/${encodeURIComponent(encoded)}`;

      // Copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      console.error('Failed to share:', error);
      alert('Failed to generate share link');
    } finally {
      setSharing(false);
    }
  };

  return (
    <button
      onClick={generateShareUrl}
      disabled={sharing || !propertyData.analysis}
      className="btn-secondary flex items-center gap-2 disabled:opacity-50"
      title={copied ? 'Link copied!' : 'Share this analysis'}
    >
      {sharing ? (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : copied ? (
        <svg className="w-4 h-4 text-[var(--accent-green)]" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
      )}
      {copied ? 'Copied!' : 'Share'}
    </button>
  );
}
