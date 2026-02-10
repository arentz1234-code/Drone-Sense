import { useState, useEffect, useCallback } from 'react';

export interface SearchHistoryItem {
  id: string;
  address: string;
  coordinates: { lat: number; lng: number };
  timestamp: string;
  feasibilityScore: number | null;
  thumbnail?: string;
}

const STORAGE_KEY = 'drone-sense-search-history';
const MAX_HISTORY_ITEMS = 50;

export function useSearchHistory() {
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load search history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSearchHistory(JSON.parse(stored));
      }
    } catch (err) {
      console.error('Failed to load search history:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save to localStorage
  const saveToStorage = useCallback((history: SearchHistoryItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
      setSearchHistory(history);
    } catch (err) {
      console.error('Failed to save search history:', err);
    }
  }, []);

  // Add a new search to history
  const addToHistory = useCallback((
    address: string,
    coordinates: { lat: number; lng: number },
    feasibilityScore: number | null = null,
    thumbnail?: string
  ): SearchHistoryItem => {
    const newItem: SearchHistoryItem = {
      id: Date.now().toString(),
      address,
      coordinates,
      timestamp: new Date().toISOString(),
      feasibilityScore,
      thumbnail,
    };

    // Remove any existing entry with the same address to avoid duplicates
    const filteredHistory = searchHistory.filter(
      item => item.address.toLowerCase() !== address.toLowerCase()
    );

    // Add new item at the beginning and limit total items
    const updatedHistory = [newItem, ...filteredHistory].slice(0, MAX_HISTORY_ITEMS);
    saveToStorage(updatedHistory);

    return newItem;
  }, [searchHistory, saveToStorage]);

  // Update an existing history item (e.g., add score after analysis completes)
  const updateHistoryItem = useCallback((
    id: string,
    updates: Partial<Omit<SearchHistoryItem, 'id'>>
  ) => {
    const updatedHistory = searchHistory.map(item =>
      item.id === id ? { ...item, ...updates } : item
    );
    saveToStorage(updatedHistory);
  }, [searchHistory, saveToStorage]);

  // Delete a history item
  const deleteHistoryItem = useCallback((id: string) => {
    saveToStorage(searchHistory.filter(item => item.id !== id));
  }, [searchHistory, saveToStorage]);

  // Get a history item by ID
  const getHistoryItem = useCallback((id: string): SearchHistoryItem | undefined => {
    return searchHistory.find(item => item.id === id);
  }, [searchHistory]);

  // Clear all history
  const clearHistory = useCallback(() => {
    saveToStorage([]);
  }, [saveToStorage]);

  // Get recent searches (for dropdown)
  const getRecentSearches = useCallback((limit: number = 5): SearchHistoryItem[] => {
    return searchHistory.slice(0, limit);
  }, [searchHistory]);

  return {
    searchHistory,
    isLoading,
    addToHistory,
    updateHistoryItem,
    deleteHistoryItem,
    getHistoryItem,
    clearHistory,
    getRecentSearches,
  };
}
