'use client';

import { useState, useEffect } from 'react';
import { PropertyData } from '@/types';

interface SavedPropertiesProps {
  currentProperty: PropertyData;
  onLoadProperty: (property: PropertyData) => void;
}

interface SavedProperty {
  id: string;
  name: string;
  address: string;
  savedAt: string;
  data: PropertyData;
  thumbnail?: string;
}

const STORAGE_KEY = 'drone-sense-saved-properties';

export default function SavedProperties({ currentProperty, onLoadProperty }: SavedPropertiesProps) {
  const [savedProperties, setSavedProperties] = useState<SavedProperty[]>([]);
  const [saveName, setSaveName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);

  // Load saved properties from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate each property has required fields
        const validProperties = parsed.filter((p: SavedProperty) =>
          p && p.id && p.data && typeof p.data === 'object'
        );
        setSavedProperties(validProperties);
      }
    } catch (err) {
      console.error('Failed to load saved properties:', err);
      // Clear corrupted data
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Save to localStorage
  const saveToStorage = (properties: SavedProperty[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(properties));
      setSavedProperties(properties);
    } catch (err) {
      console.error('Failed to save properties:', err);
    }
  };

  const handleSave = () => {
    if (!currentProperty.address) {
      alert('Please enter an address before saving');
      return;
    }

    const newProperty: SavedProperty = {
      id: Date.now().toString(),
      name: saveName || currentProperty.address,
      address: currentProperty.address,
      savedAt: new Date().toISOString(),
      data: currentProperty,
      thumbnail: currentProperty.images[0],
    };

    saveToStorage([...savedProperties, newProperty]);
    setSaveName('');
    setShowSaveDialog(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this saved property?')) {
      saveToStorage(savedProperties.filter(p => p.id !== id));
      setSelectedForCompare(selectedForCompare.filter(s => s !== id));
    }
  };

  const handleLoad = (property: SavedProperty) => {
    onLoadProperty(property.data);
  };

  const toggleCompare = (id: string) => {
    if (selectedForCompare.includes(id)) {
      setSelectedForCompare(selectedForCompare.filter(s => s !== id));
    } else if (selectedForCompare.length < 3) {
      setSelectedForCompare([...selectedForCompare, id]);
    }
  };

  const getPropertiesForComparison = () => {
    return savedProperties.filter(p => selectedForCompare.includes(p.id));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-4">
      {/* Save Current Property */}
      <div className="flex items-center gap-2">
        {showSaveDialog ? (
          <>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Property name (optional)"
              className="flex-1 terminal-input text-sm"
            />
            <button
              onClick={handleSave}
              className="px-3 py-2 bg-[var(--accent-green)] text-white rounded text-sm font-medium hover:opacity-90"
            >
              Save
            </button>
            <button
              onClick={() => setShowSaveDialog(false)}
              className="px-3 py-2 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded text-sm hover:bg-[var(--border-color)]"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setShowSaveDialog(true)}
              disabled={!currentProperty.address}
              className="flex-1 px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-color)] text-[var(--text-primary)] rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Save Current Property
            </button>
            {selectedForCompare.length >= 2 && (
              <button
                onClick={() => setShowComparison(true)}
                className="px-4 py-2 bg-[var(--accent-cyan)] text-white rounded text-sm font-medium"
              >
                Compare ({selectedForCompare.length})
              </button>
            )}
          </>
        )}
      </div>

      {/* Saved Properties List */}
      {savedProperties.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-[var(--text-muted)]">
            {savedProperties.length} saved propert{savedProperties.length === 1 ? 'y' : 'ies'}
          </p>
          {savedProperties.map((property) => (
            <div
              key={property.id}
              className={`p-3 bg-[var(--bg-tertiary)] rounded-lg border ${
                selectedForCompare.includes(property.id)
                  ? 'border-[var(--accent-cyan)]'
                  : 'border-[var(--border-color)]'
              }`}
            >
              <div className="flex items-start gap-3">
                {property.thumbnail && (
                  <img
                    src={property.thumbnail}
                    alt={property.name}
                    className="w-12 h-12 rounded object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{property.name}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate">{property.address}</p>
                  <p className="text-xs text-[var(--text-muted)]">Saved {formatDate(property.savedAt)}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => toggleCompare(property.id)}
                    className={`p-1.5 rounded ${
                      selectedForCompare.includes(property.id)
                        ? 'bg-[var(--accent-cyan)] text-white'
                        : 'bg-[var(--bg-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                    title="Select for comparison"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleLoad(property)}
                    className="p-1.5 bg-[var(--bg-primary)] text-[var(--text-muted)] hover:text-[var(--accent-green)] rounded"
                    title="Load property"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(property.id)}
                    className="p-1.5 bg-[var(--bg-primary)] text-[var(--text-muted)] hover:text-[var(--accent-red)] rounded"
                    title="Delete property"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-[var(--text-muted)]">
          <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          <p className="text-sm">No saved properties</p>
          <p className="text-xs mt-1">Save properties to compare them later</p>
        </div>
      )}

      {/* Comparison Modal */}
      {showComparison && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-[var(--bg-secondary)] p-4 border-b border-[var(--border-color)] flex items-center justify-between">
              <h3 className="text-lg font-semibold">Property Comparison</h3>
              <button
                onClick={() => setShowComparison(false)}
                className="p-1 hover:bg-[var(--bg-tertiary)] rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-3 gap-4">
                {getPropertiesForComparison().map((property) => (
                  <div key={property.id} className="space-y-3">
                    <div className="text-center">
                      {property.thumbnail && (
                        <img
                          src={property.thumbnail}
                          alt={property.name}
                          className="w-full h-32 rounded object-cover mb-2"
                        />
                      )}
                      <p className="font-medium text-sm">{property.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">{property.address}</p>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Traffic VPD:</span>
                        <span>{property.data.trafficData?.estimatedVPD?.toLocaleString() || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Population:</span>
                        <span>{property.data.demographicsData?.population?.toLocaleString() || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Median Income:</span>
                        <span>${property.data.demographicsData?.medianHouseholdIncome?.toLocaleString() || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Nearby Businesses:</span>
                        <span>{property.data.businesses?.length || 0}</span>
                      </div>
                      {property.data.analysis && (
                        <div className="flex justify-between">
                          <span className="text-[var(--text-muted)]">Viability Score:</span>
                          <span className="font-bold text-[var(--accent-cyan)]">
                            {property.data.analysis.viabilityScore}/10
                          </span>
                        </div>
                      )}
                      {property.data.environmentalRisk && (
                        <div className="flex justify-between">
                          <span className="text-[var(--text-muted)]">Risk Score:</span>
                          <span className={property.data.environmentalRisk.overallRiskScore >= 70 ? 'text-green-400' : 'text-yellow-400'}>
                            {property.data.environmentalRisk.overallRiskScore}/100
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
