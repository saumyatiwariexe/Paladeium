"use client";

import React from 'react';
import { CategoryPills } from './CategoryPills';
import { DishGrid } from './DishGrid';
import { ShoppingCart } from 'lucide-react';
import { useApp } from '@/lib/store';

export function PreARScreen() {
  const { restaurant, cart } = useApp();
  const cartCount = cart.reduce((acc, item) => acc + item.qty, 0);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1C1C1E] safe-top">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#F8F9FA]/80 backdrop-blur-md px-6 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-black tracking-tight text-gray-900">
          {restaurant?.name || 'Paladeium'}<span className="text-red-500">.</span>
        </h1>
        <button className="relative w-12 h-12 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center active:scale-95 transition-transform">
          <ShoppingCart size={22} strokeWidth={2.5} />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#F8F9FA]">
              {cartCount}
            </span>
          )}
        </button>
      </header>

      {/* Discovery Section */}
      <main className="pb-12">
        <div className="px-6 pt-2 pb-1">
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Discover Menu</p>
          <h2 className="text-3xl font-black mt-1 text-gray-900">Choose Your Delight</h2>
        </div>

        {/* Featured Carousel */}
        <div className="mt-6">
          <div className="px-6 flex justify-between items-end mb-4">
            <h3 className="text-lg font-black text-gray-900">Featured Today</h3>
            <span className="text-sm font-bold text-red-500">See All</span>
          </div>
          <div className="flex gap-4 overflow-x-auto px-6 pb-6 no-scrollbar">
            {dishes.slice(0, 3).map(dish => (
              <div 
                key={dish.id} 
                className="flex-shrink-0 w-72 bg-white rounded-[32px] p-5 shadow-xl shadow-gray-200/50 border border-gray-50 flex flex-col gap-4 active:scale-95 transition-transform cursor-pointer"
                onClick={() => {
                  const el = document.getElementById('dynamic-dish-info'); // simple scroll/select
                }}
              >
                <div className="aspect-[4/3] bg-gray-50 rounded-2xl flex items-center justify-center text-6xl">
                  {dish.emoji}
                </div>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-black text-lg text-gray-900">{dish.name}</h4>
                    <p className="text-gray-400 text-sm font-bold mt-0.5">{dish.cat}</p>
                  </div>
                  <span className="text-xl font-black text-red-500">{dish.price}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="px-6 mt-4">
          <h3 className="text-lg font-black text-gray-900 mb-4">Explore Categories</h3>
          <CategoryPills />
        </div>
        <DishGrid />
      </main>
    </div>
  );
}
