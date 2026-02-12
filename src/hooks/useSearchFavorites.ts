import { useState, useEffect, useCallback } from 'react';

// QuickFeasibility type matching the batch-analyze API response
export interface QuickFeasibility {
  parcelId: string;
  address: string;
  coordinates: { lat: number; lng: number };
  lotSize?: number;
  lotSizeAcres?: number;
  score: number;
  factors: {
    trafficScore: number;
    businessDensity: number;
    zoningScore: number;
    accessScore: number;
  };
  zoning?: string;
  nearbyBusinesses?: number;
  estimatedVPD?: number;
}

const STORAGE_KEY = 'drone-sense-search-favorites';

export function useSearchFavorites() {
  const [favorites, setFavorites] = useState<QuickFeasibility[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load favorites from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } catch (err) {
      console.error('Failed to load search favorites:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save to localStorage whenever favorites change
  const saveToStorage = useCallback((items: QuickFeasibility[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      setFavorites(items);
    } catch (err) {
      console.error('Failed to save search favorites:', err);
      throw new Error('Failed to save favorite');
    }
  }, []);

  // Add a property to favorites
  const addFavorite = useCallback((property: QuickFeasibility): void => {
    // Check if already exists
    if (favorites.some(f => f.parcelId === property.parcelId)) {
      return; // Already favorited
    }
    saveToStorage([...favorites, property]);
  }, [favorites, saveToStorage]);

  // Remove a property from favorites
  const removeFavorite = useCallback((parcelId: string): void => {
    saveToStorage(favorites.filter(f => f.parcelId !== parcelId));
  }, [favorites, saveToStorage]);

  // Toggle favorite status
  const toggleFavorite = useCallback((property: QuickFeasibility): void => {
    if (favorites.some(f => f.parcelId === property.parcelId)) {
      removeFavorite(property.parcelId);
    } else {
      addFavorite(property);
    }
  }, [favorites, addFavorite, removeFavorite]);

  // Check if a property is favorited
  const isFavorite = useCallback((parcelId: string): boolean => {
    return favorites.some(f => f.parcelId === parcelId);
  }, [favorites]);

  // Clear all favorites
  const clearFavorites = useCallback((): void => {
    saveToStorage([]);
  }, [saveToStorage]);

  // Get a favorite by parcel ID
  const getFavorite = useCallback((parcelId: string): QuickFeasibility | undefined => {
    return favorites.find(f => f.parcelId === parcelId);
  }, [favorites]);

  // Export favorites as JSON
  const exportFavorites = useCallback((): string => {
    return JSON.stringify(favorites, null, 2);
  }, [favorites]);

  // Export favorites as CSV
  const exportFavoritesCSV = useCallback((): string => {
    const headers = [
      'Address',
      'Parcel ID',
      'Lot Size (sqft)',
      'Lot Size (acres)',
      'Feasibility Score',
      'Traffic Score',
      'Business Density',
      'Zoning Score',
      'Access Score',
      'Estimated VPD',
      'Zoning',
      'Nearby Businesses',
      'Latitude',
      'Longitude',
    ];

    const rows = favorites.map(f => [
      `"${f.address}"`,
      f.parcelId,
      f.lotSize || '',
      f.lotSizeAcres?.toFixed(2) || '',
      f.score.toFixed(1),
      f.factors.trafficScore.toFixed(1),
      f.factors.businessDensity.toFixed(1),
      f.factors.zoningScore.toFixed(1),
      f.factors.accessScore.toFixed(1),
      f.estimatedVPD || '',
      f.zoning || '',
      f.nearbyBusinesses ?? '',
      f.coordinates.lat,
      f.coordinates.lng,
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }, [favorites]);

  // Import favorites from JSON
  const importFavorites = useCallback((json: string): void => {
    try {
      const imported = JSON.parse(json) as QuickFeasibility[];
      if (!Array.isArray(imported)) {
        throw new Error('Invalid format');
      }
      // Merge with existing, avoiding duplicates by parcelId
      const existingIds = new Set(favorites.map(f => f.parcelId));
      const newFavorites = imported.filter(f => !existingIds.has(f.parcelId));
      saveToStorage([...favorites, ...newFavorites]);
    } catch (err) {
      console.error('Failed to import favorites:', err);
      throw new Error('Failed to import favorites. Please check the file format.');
    }
  }, [favorites, saveToStorage]);

  return {
    favorites,
    isLoading,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    isFavorite,
    clearFavorites,
    getFavorite,
    exportFavorites,
    exportFavoritesCSV,
    importFavorites,
  };
}
