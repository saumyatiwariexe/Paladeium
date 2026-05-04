"use client";

import React, { useEffect, Suspense } from 'react';
import { useApp } from '@/lib/store';
import { fetchRestaurantData } from '@/lib/api';
import { PreARScreen } from '@/components/menu/PreARScreen';
import { ARSessionContainer } from '@/components/ar/ARSessionContainer';

function MainContent() {
  const { setDishes, setCategories, setRestaurant, dishes } = useApp();

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get('r') || 'the-grand-spice';
    
    fetchRestaurantData(slug)
      .then(data => {
        setDishes(data.menu);
        setCategories(data.categories);
        setRestaurant(data.restaurant);
      })
      .catch(err => console.error(err));
  }, [setDishes, setCategories, setRestaurant]);

  if (dishes.length === 0) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-12 text-center">
        <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-6" />
        <h2 className="text-xl font-black text-gray-900">Preparing the Kitchen</h2>
        <p className="text-gray-400 text-sm mt-2 font-medium">Downloading our latest delights...</p>
      </div>
    );
  }

  return (
    <>
      <PreARScreen />
      <ARSessionContainer />
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <MainContent />
    </Suspense>
  );
}
