import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

const WISHLIST_STORAGE_KEY = "viterra_wishlist_properties";

interface WishlistContextType {
  favoriteIds: string[];
  count: number;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  addFavorite: (id: string) => void;
  removeFavorite: (id: string) => void;
  clearFavorites: () => void;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

function readStoredFavoriteIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WISHLIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
    return [];
  } catch (err) {
    console.error("Error reading wishlist from localStorage:", err);
    return [];
  }
}

function writeStoredFavoriteIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(ids));
  } catch (err) {
    console.error("Error saving wishlist to localStorage:", err);
  }
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => readStoredFavoriteIds());

  useEffect(() => {
    writeStoredFavoriteIds(favoriteIds);
  }, [favoriteIds]);

  // Sync across tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === WISHLIST_STORAGE_KEY) {
        setFavoriteIds(readStoredFavoriteIds());
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const isFavorite = useCallback(
    (id: string) => {
      if (!id) return false;
      return favoriteIds.includes(id);
    },
    [favoriteIds]
  );

  const addFavorite = useCallback((id: string) => {
    if (!id) return;
    setFavoriteIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const removeFavorite = useCallback((id: string) => {
    if (!id) return;
    setFavoriteIds((prev) => prev.filter((favId) => favId !== id));
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    if (!id) return;
    setFavoriteIds((prev) =>
      prev.includes(id) ? prev.filter((favId) => favId !== id) : [...prev, id]
    );
  }, []);

  const clearFavorites = useCallback(() => {
    setFavoriteIds([]);
  }, []);

  const value: WishlistContextType = {
    favoriteIds,
    count: favoriteIds.length,
    isFavorite,
    toggleFavorite,
    addFavorite,
    removeFavorite,
    clearFavorites,
  };

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

const defaultWishlistContext: WishlistContextType = {
  favoriteIds: [],
  count: 0,
  isFavorite: () => false,
  toggleFavorite: () => {},
  addFavorite: () => {},
  removeFavorite: () => {},
  clearFavorites: () => {},
};

export function useWishlist(): WishlistContextType {
  const context = useContext(WishlistContext);
  return context ?? defaultWishlistContext;
}
