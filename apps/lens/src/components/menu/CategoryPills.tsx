"use client";

import React from 'react';
import { useApp } from '@/lib/store';

export function CategoryPills() {
  const { categories, activeCategory, setActiveCategory } = useApp();

  return (
    <div className="flex gap-2 overflow-x-auto px-5 py-3 no-scrollbar">
      {categories.map((cat) => {
        const label = typeof cat === 'string'
          ? cat.charAt(0).toUpperCase() + cat.slice(1)
          : 'Unknown';
        const isActive = activeCategory === cat;

        return (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-5 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition-all active:scale-95 ${
              isActive
                ? 'bg-[#E23744] text-white shadow-sm'
                : 'bg-[#F0F0F5] text-[#686B78]'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
