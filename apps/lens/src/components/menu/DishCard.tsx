"use client";

import React from 'react';
import { Dish } from '@/lib/types';
import { useApp } from '@/lib/store';

export function DishCard({ dish }: { dish: Dish }) {
  const { setViewMode, setActiveDish } = useApp();

  return (
    <div 
      className="bg-white rounded-[28px] p-4 shadow-sm border border-gray-50 flex flex-col gap-3 transition-transform active:scale-95 cursor-pointer"
      onClick={() => {
        setActiveDish(dish.id);
      }}
    >
      <div className="aspect-square bg-gray-50 rounded-2xl flex items-center justify-center text-4xl">
        {dish.emoji || '🍽️'}
      </div>
      <div>
        <h3 className="font-bold text-[15px] leading-tight text-gray-900">{dish.name}</h3>
        <p className="text-red-500 font-extrabold text-sm mt-1">{dish.price}</p>
      </div>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          setActiveDish(dish.id);
          setViewMode('ar');
        }}
        className="mt-2 w-full py-2.5 bg-gray-900 text-white text-xs font-bold rounded-xl active:bg-gray-800 transition-colors"
      >
        View in AR
      </button>
    </div>
  );
}
