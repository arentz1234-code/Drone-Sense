import { useState, useEffect, useCallback } from 'react';
import { PropertyData } from '@/types';

interface SavedProperty {
  id: string;
  name: string;
  address: string;
  savedAt: string;
  data: PropertyData;
  thumbnail?: string;
}

const STORAGE_KEY = 'drone-sense-saved-properties';

export function useSavedProperties() {
  const [savedProperties, setSavedProperties] = useState<SavedProperty[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved properties from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSavedProperties(JSON.parse(stored));
      }
    } catch (err) {
      console.error('Failed to load saved properties:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save to localStorage whenever properties change
  const saveToStorage = useCallback((properties: SavedProperty[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(properties));
      setSavedProperties(properties);
    } catch (err) {
      console.error('Failed to save properties:', err);
      throw new Error('Failed to save property');
    }
  }, []);

  // Save a new property
  const saveProperty = useCallback((
    propertyData: PropertyData,
    name?: string
  ): SavedProperty => {
    if (!propertyData.address) {
      throw new Error('Property must have an address');
    }

    const newProperty: SavedProperty = {
      id: Date.now().toString(),
      name: name || propertyData.address,
      address: propertyData.address,
      savedAt: new Date().toISOString(),
      data: propertyData,
      thumbnail: propertyData.images[0],
    };

    saveToStorage([...savedProperties, newProperty]);
    return newProperty;
  }, [savedProperties, saveToStorage]);

  // Update an existing property
  const updateProperty = useCallback((
    id: string,
    updates: Partial<Omit<SavedProperty, 'id' | 'savedAt'>>
  ) => {
    const updatedProperties = savedProperties.map(p =>
      p.id === id ? { ...p, ...updates } : p
    );
    saveToStorage(updatedProperties);
  }, [savedProperties, saveToStorage]);

  // Delete a property
  const deleteProperty = useCallback((id: string) => {
    saveToStorage(savedProperties.filter(p => p.id !== id));
  }, [savedProperties, saveToStorage]);

  // Get a property by ID
  const getProperty = useCallback((id: string): SavedProperty | undefined => {
    return savedProperties.find(p => p.id === id);
  }, [savedProperties]);

  // Clear all saved properties
  const clearAll = useCallback(() => {
    saveToStorage([]);
  }, [saveToStorage]);

  // Export properties as JSON
  const exportProperties = useCallback((): string => {
    return JSON.stringify(savedProperties, null, 2);
  }, [savedProperties]);

  // Import properties from JSON
  const importProperties = useCallback((json: string) => {
    try {
      const imported = JSON.parse(json) as SavedProperty[];
      if (!Array.isArray(imported)) {
        throw new Error('Invalid format');
      }
      // Merge with existing, avoiding duplicates by address
      const existingAddresses = new Set(savedProperties.map(p => p.address));
      const newProperties = imported.filter(p => !existingAddresses.has(p.address));
      saveToStorage([...savedProperties, ...newProperties]);
    } catch (err) {
      console.error('Failed to import properties:', err);
      throw new Error('Failed to import properties. Please check the file format.');
    }
  }, [savedProperties, saveToStorage]);

  return {
    savedProperties,
    isLoading,
    saveProperty,
    updateProperty,
    deleteProperty,
    getProperty,
    clearAll,
    exportProperties,
    importProperties,
  };
}
