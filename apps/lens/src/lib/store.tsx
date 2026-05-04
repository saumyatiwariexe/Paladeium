"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [categories, setCategories] = useState<string[]>(['all']);
  const [activeDishId, setActiveDish] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'preview' | 'ar'>('preview');
  const [cart, setCart] = useState<{ dish: Dish; qty: number }[]>([]);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);

  const addToCart = (dish: Dish) => {
    setCart(prev => {
      const existing = prev.find(item => item.dish.id === dish.id);
      if (existing) {
        return prev.map(item => item.dish.id === dish.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { dish, qty: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.dish.id === id) {
          const newQty = Math.max(0, item.qty + delta);
          return { ...item, qty: newQty };
        }
        return item;
      }).filter(item => item.qty > 0);
    });
  };

  return (
    <AppContext.Provider value={{
      dishes, categories, activeDishId, activeCategory, viewMode, cart, restaurant,
      setDishes, setCategories, setActiveDish, setActiveCategory, setViewMode, addToCart, updateQty, setRestaurant
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
