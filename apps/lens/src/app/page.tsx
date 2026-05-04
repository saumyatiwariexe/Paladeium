"use client";

import React, { useEffect, Suspense } from 'react';
import { useApp } from '@/lib/store';
import { fetchRestaurantData } from '@/lib/api';
import { PreARScreen } from '@/components/menu/PreARScreen';

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-12 text-center">
      <div className="w-14 h-14 border-4 border-[#E23744] border-t-transparent rounded-full animate-spin mb-6" />
      <h1 className="text-[22px] font-black text-[#1C1C1C]">
        Paladeium<span className="text-[#E23744]">.</span>
      </h1>
      <p className="text-[#686B78] text-[13px] mt-2 font-medium">Loading 3D menu…</p>
    </div>
  );
}

function MainContent() {
  const { setDishes, setCategories, setRestaurant, dishes } = useApp();

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get('r') || 'the-grand-spice';
    fetchRestaurantData(slug)
      .then(data => {
        setDishes(data.menu);       // setDishes also calls setActiveDish(data.menu[0].id)
        setCategories(data.categories);
        setRestaurant(data.restaurant);
      })
      .catch(err => console.error('[Lens] Failed to load menu:', err));
  }, [setDishes, setCategories, setRestaurant]);

  if (dishes.length === 0) return <LoadingScreen />;

  return <PreARScreen />;
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <MainContent />
    </Suspense>
  );
}
