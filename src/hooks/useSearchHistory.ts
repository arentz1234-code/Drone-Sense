import { useState, useEffect, useCallback, useRef } from 'react';

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

// Helper to get history from localStorage directly
function getStoredHistory(): SearchHistoryItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Helper to save history to localStorage
function saveStoredHistory(history: SearchHistoryItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (err) {
    console.error('Failed to save search history:', err);
  }
}

export function useSearchHistory() {
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const historyRef = useRef<SearchHistoryItem[]>([]);

  // Keep ref in sync with state
  useEffect(() => {
    historyRef.current = searchHistory;
  }, [searchHistory]);

  // Load search history from localStorage on mount
  useEffect(() => {
    try {
      const stored = getStoredHistory();
      setSearchHistory(stored);
      historyRef.current = stored;
    } catch (err) {
      console.error('Failed to load search history:', err);
    } finally {
      setIsLoading(false);
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

    // Read directly from localStorage to avoid stale closure
    const currentHistory = getStoredHistory();

    // Remove any existing entry with the same address to avoid duplicates
    const filteredHistory = currentHistory.filter(
      item => item.address.toLowerCase() !== address.toLowerCase()
    );

    // Add new item at the beginning and limit total items
    const updatedHistory = [newItem, ...filteredHistory].slice(0, MAX_HISTORY_ITEMS);
    saveStoredHistory(updatedHistory);
    setSearchHistory(updatedHistory);

    return newItem;
  }, []);

  // Update an existing history item (e.g., add score after analysis completes)
  const updateHistoryItem = useCallback((
    id: string,
    updates: Partial<Omit<SearchHistoryItem, 'id'>>
  ) => {
    // Read directly from localStorage to avoid stale closure
    const currentHistory = getStoredHistory();
    const updatedHistory = currentHistory.map(item =>
      item.id === id ? { ...item, ...updates } : item
    );
    saveStoredHistory(updatedHistory);
    setSearchHistory(updatedHistory);
  }, []);

  // Delete a history item
  const deleteHistoryItem = useCallback((id: string) => {
    // Read directly from localStorage to avoid stale closure
    const currentHistory = getStoredHistory();
    const updatedHistory = currentHistory.filter(item => item.id !== id);
    saveStoredHistory(updatedHistory);
    setSearchHistory(updatedHistory);
  }, []);

  // Get a history item by ID
  const getHistoryItem = useCallback((id: string): SearchHistoryItem | undefined => {
    // Read directly from localStorage to get latest data
    const currentHistory = getStoredHistory();
    return currentHistory.find(item => item.id === id);
  }, []);

  // Clear all history
  const clearHistory = useCallback(() => {
    saveStoredHistory([]);
    setSearchHistory([]);
  }, []);

  // Get recent searches (for dropdown)
  const getRecentSearches = useCallback((limit: number = 5): SearchHistoryItem[] => {
    // Read directly from localStorage to get latest data
    const currentHistory = getStoredHistory();
    return currentHistory.slice(0, limit);
  }, []);

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
