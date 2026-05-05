"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';
import { AppState, Dish, Restaurant } from './types';

interface AppContextType extends AppState {
  setDishes: (dishes: Dish[]) => void;
  setCategories: (cats: string[]) => void;
  setActiveDish: (id: string | null) => void;
  setActiveCategory: (cat: string) => void;
  setViewMode: (mode: 'preview' | 'ar') => void;
  addToCart: (dish: Dish) => void;
  updateQty: (id: string, delta: number) => void;
  setRestaurant: (res: Restaurant) => void;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [dishes, _setDishes]         = useState<Dish[]>([]);
  const [categories, _setCategories] = useState<string[]>(['all']);
  const [activeDishId, setActiveDish] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [viewMode, setViewMode]      = useState<'preview' | 'ar'>('preview');
  const [cart, setCart]              = useState<{ dish: Dish; qty: number }[]>([]);
  const [restaurant, _setRestaurant] = useState<Restaurant | null>(null);
  const [cartOpen, setCartOpen]      = useState(false);

  // Stable references — useCallback with [] ensures these never change identity,
  // so useEffect deps in page.tsx don't re-fire on every render.
  const setDishes = useCallback((newDishes: Dish[]) => {
    _setDishes(newDishes);
    if (newDishes.length > 0) setActiveDish(newDishes[0].id);
  }, []);

  const setCategories = useCallback((cats: string[]) => {
    _setCategories(cats);
  }, []);

  const setRestaurant = useCallback((res: Restaurant) => {
    _setRestaurant(res);
  }, []);

  const addToCart = useCallback((dish: Dish) => {
    setCart(prev => {
      const existing = prev.find(item => item.dish.id === dish.id);
      if (existing) {
        return prev.map(item => item.dish.id === dish.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { dish, qty: 1 }];
    });
  }, []);

  const updateQty = useCallback((id: string, delta: number) => {
    setCart(prev =>
      prev
        .map(item => item.dish.id === id ? { ...item, qty: Math.max(0, item.qty + delta) } : item)
        .filter(item => item.qty > 0)
    );
  }, []);

  return (
    <AppContext.Provider value={{
      dishes, categories, activeDishId, activeCategory, viewMode, cart, restaurant,
      cartOpen, setCartOpen,
      setDishes, setCategories, setActiveDish, setActiveCategory, setViewMode,
      addToCart, updateQty, setRestaurant,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
}
