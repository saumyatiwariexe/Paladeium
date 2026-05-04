"use client";

import React from 'react';
import { useApp } from '@/lib/store';
import { CategoryPills } from './CategoryPills';
import { DishBottomSheet } from './DishBottomSheet';
import { ModelCarousel } from '@/components/ar/ModelCarousel';
import { ShoppingCart } from 'lucide-react';

export function PreARScreen() {
  const { restaurant, cart, viewMode } = useApp();
  const cartCount = cart.reduce((acc, item) => acc + item.qty, 0);

  if (viewMode === 'ar') return null;

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#F8F9FA]">
      {/* 1. Background Layer (z-0) */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-[#F8F9FA] to-[#E9ECEF]" />


      {/* 3. UI Layer (z-20) */}
      <div className="relative z-20 h-full w-full pointer-events-none flex flex-col">
        {/* Header */}
        <header className="px-8 py-10 flex justify-between items-center pointer-events-auto">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-gray-900">
              {restaurant?.name || 'Paladeium'}<span className="text-red-500">.</span>
            </h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
              Interactive Menu
            </p>
          </div>
          <button className="w-14 h-14 bg-white rounded-2xl shadow-xl shadow-gray-200/50 flex items-center justify-center relative active:scale-90 transition-transform">
            <ShoppingCart size={24} className="text-gray-900" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-4 border-[#F8F9FA]">
                {cartCount}
              </span>
            )}
          </button>
        </header>

        {/* Categories (Moved Up) */}
        <div className="px-2 pointer-events-auto">
          <CategoryPills />
        </div>

        {/* Spacer for 3D Focus */}
        <div className="flex-1" />

        {/* Bottom Sheet */}
        <div className="pointer-events-auto">
          <DishBottomSheet />
        </div>
      </div>

      {/* Carousel Navigation Indicators (Minimal) */}
      <div className="absolute bottom-[420px] left-0 right-0 flex justify-center gap-2 z-30 pointer-events-none">
        {/* These can be dots generated via Store */}
      </div>
    </div>
  );
}
