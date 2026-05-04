"use client";

import React from 'react';
import { useApp } from '@/lib/store';
import { DishCard } from './DishCard';

export function DishGrid() {
  const { dishes, activeCategory } = useApp();

  const filteredDishes = activeCategory === 'all' 
    ? dishes 
    : dishes.filter(d => d.cat === activeCategory);

  return (
    <div className="px-6 grid grid-cols-2 gap-4 pb-32">
      {filteredDishes.map(dish => (
        <DishCard key={dish.id} dish={dish} />
      ))}
    </div>
  );
}
