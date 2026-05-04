"use client";

import React from 'react';
import { useApp } from '@/lib/store';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function CategoryPills() {
  const { categories, activeCategory, setActiveCategory } = useApp();

  return (
    <div className="flex gap-3 overflow-x-auto px-6 py-4 no-scrollbar">
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => setActiveCategory(cat)}
          className={cn(
            "px-6 py-2.5 rounded-full text-sm font-bold transition-all whitespace-nowrap shadow-sm border",
            activeCategory === cat
              ? "bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/30"
              : "bg-white text-gray-500 border-gray-100"
          )}
        >
          {cat.charAt(0).toUpperCase() + cat.slice(1)}
        </button>
      ))}
    </div>
  );
}
