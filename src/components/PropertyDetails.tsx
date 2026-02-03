'use client';

import { useState } from 'react';
import { PropertyData } from '@/app/api/property/route';

interface PropertyDetailsProps {
  address: string;
}

export default function PropertyDetails({ address }: PropertyDetailsProps) {
  const [loading, setLoading] = useState(false);
  const [property, setProperty] = useState<PropertyData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPropertyData = async () => {
    if (!address) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || data.error || 'Failed to fetch property data');
        setProperty(null);
      } else {
        setProperty(data);
      }
    } catch (err) {
      setError('Failed to fetch property data');
      setProperty(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[var(--text-primary)]">Property Details</h3>
        <button
          onClick={fetchPropertyData}
          disabled={loading || !address}
          className="btn-secondary text-xs py-1 px-3 flex items-center gap-1"
        >
          {loading ? (
            <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
          ) : (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
          Get Details
        </button>
      </div>

      {/* No Address Warning */}
      {!address && (
        <div className="text-center py-8 border border-dashed border-[var(--border-color)] rounded-lg">
          <svg className="w-10 h-10 mx-auto mb-2 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-[var(--text-muted)] text-sm">
            Enter an address to get property details
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-[var(--accent-red)]/10 border border-[var(--accent-red)]/30 rounded-lg">
          <p className="text-[var(--accent-red)] text-sm">{error}</p>
        </div>
      )}

      {/* Property Data */}
      {property && (
        <div className="space-y-4">
          {/* Sale History */}
          <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
            <h4 className="text-xs font-semibold text-[var(--accent-cyan)] mb-3 uppercase tracking-wider">
              Sale History
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-[var(--text-muted)]">Last Sale Price</span>
                <p className="text-lg font-bold text-[var(--accent-green)]">{property.lastSalePrice}</p>
              </div>
              <div>
                <span className="text-xs text-[var(--text-muted)]">Last Sale Date</span>
                <p className="text-lg font-semibold">{property.lastSaleDate}</p>
              </div>
            </div>
          </div>

          {/* Lot Information */}
          <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
            <h4 className="text-xs font-semibold text-[var(--accent-cyan)] mb-3 uppercase tracking-wider">
              Lot Information
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-[var(--text-muted)]">Lot Size:</span>
                <span className="ml-2">{property.lotSize}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Acres:</span>
                <span className="ml-2">{property.lotSizeAcres}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Zoning:</span>
                <span className="ml-2">{property.zoning}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Land Use:</span>
                <span className="ml-2">{property.landUse}</span>
              </div>
            </div>
          </div>

          {/* Tax & Assessment */}
          <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
            <h4 className="text-xs font-semibold text-[var(--accent-cyan)] mb-3 uppercase tracking-wider">
              Tax & Assessment
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-[var(--text-muted)]">Assessed Value:</span>
                <span className="ml-2 text-[var(--accent-yellow)]">{property.assessedValue}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Annual Tax:</span>
                <span className="ml-2">{property.taxAmount}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">County:</span>
                <span className="ml-2">{property.county}</span>
              </div>
            </div>
          </div>

          {/* Building Info (if available) */}
          {(property.yearBuilt !== 'N/A' || property.squareFootage !== 'N/A') && (
            <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
              <h4 className="text-xs font-semibold text-[var(--accent-cyan)] mb-3 uppercase tracking-wider">
                Building Information
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-[var(--text-muted)]">Year Built:</span>
                  <span className="ml-2">{property.yearBuilt}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Square Footage:</span>
                  <span className="ml-2">{property.squareFootage}</span>
                </div>
                {property.bedrooms !== 'N/A' && (
                  <div>
                    <span className="text-[var(--text-muted)]">Bedrooms:</span>
                    <span className="ml-2">{property.bedrooms}</span>
                  </div>
                )}
                {property.bathrooms !== 'N/A' && (
                  <div>
                    <span className="text-[var(--text-muted)]">Bathrooms:</span>
                    <span className="ml-2">{property.bathrooms}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Owner Information */}
          <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
            <h4 className="text-xs font-semibold text-[var(--accent-cyan)] mb-3 uppercase tracking-wider">
              Owner Information
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-[var(--text-muted)]">Owner:</span>
                <span className="ml-2">{property.ownerName}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Type:</span>
                <span className="ml-2">{property.ownerType}</span>
              </div>
            </div>
          </div>

          {/* Note about limited requests */}
          <p className="text-xs text-[var(--text-muted)] text-center">
            Property data provided by RealtyMole API (50 free requests/month)
          </p>
        </div>
      )}

      {/* Prompt to fetch */}
      {address && !property && !error && !loading && (
        <div className="text-center py-6 text-[var(--text-muted)] text-sm">
          Click &quot;Get Details&quot; to fetch property information
        </div>
      )}
    </div>
  );
}
