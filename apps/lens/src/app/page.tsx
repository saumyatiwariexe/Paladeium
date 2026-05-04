"use client";

import React, { useEffect, Suspense } from 'react';
import { useApp } from '@/lib/store';
import { fetchRestaurantData } from '@/lib/api';
import { PreARScreen } from '@/components/menu/PreARScreen';
import { ARSessionContainer } from '@/components/ar/ARSessionContainer';
import { ModelCarousel } from '@/components/ar/ModelCarousel';

function MainContent() {
  const { setDishes, setCategories, setRestaurant, dishes, viewMode } = useApp();

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get('r') || 'the-grand-spice';
    fetchRestaurantData(slug)
      .then(data => {
        setDishes(data.menu);
        setCategories(data.categories);
        setRestaurant(data.restaurant);
        if (data.menu.length > 0) {
          // No need to manually set active dish here if store handles it, 
          // but good for safety
        }
      })
      .catch(err => console.error(err));
  }, [setDishes, setCategories, setRestaurant]);

  if (dishes.length === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-12 text-center">
        <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-6" />
        <h1 className="text-2xl font-black text-gray-900">Paladeium<span className="text-red-500">.</span></h1>
        <p className="text-gray-400 text-sm mt-2 font-medium">Downloading 3D menu...</p>
      </div>
    );
  }

  return (
    <main className="relative h-screen w-full overflow-hidden">
      {/* 1. Background Layer */}
      <div className={`absolute inset-0 transition-colors duration-1000 ${viewMode === 'ar' ? 'bg-black/80' : 'bg-[#F8F9FA]'}`}>
        {viewMode === 'ar' && (
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
        )}
      </div>

      {/* 2. Persistent 3D Layer */}
      <ModelCarousel />

      {/* 3. UI Layer (Conditional based on mode) */}
      {viewMode === 'preview' ? (
        <PreARScreen />
      ) : (
        <ARSessionContainer />
      )}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <MainContent />
    </Suspense>
  );
}
