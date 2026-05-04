"use client";

import React from 'react';
import { useApp } from '@/lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Box, Plus } from 'lucide-react';

export function DishBottomSheet() {
  const { dishes, activeDishId, setViewMode, addToCart } = useApp();
  const activeDish = dishes.find(d => d.id === activeDishId);

  if (!activeDish) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] flex flex-col justify-end">
      {/* Bottom Sheet Card */}
      <AnimatePresence mode="wait">
        <motion.div 
          key={activeDish.id}
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="pointer-events-auto bg-white rounded-t-[48px] p-8 pb-12 shadow-[0_-20px_60px_rgba(0,0,0,0.08)] border-t border-gray-100"
        >
          {/* Handle */}
          <div className="w-12 h-1.5 bg-gray-100 rounded-full mx-auto mb-8" />

          {/* Info Row */}
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-red-500 mb-1 block">
                {activeDish.cat}
              </span>
              <h2 className="text-3xl font-black text-gray-900 tracking-tight leading-tight">
                {activeDish.name}
              </h2>
            </div>
            <div className="text-2xl font-black text-gray-900 mt-1">
              {activeDish.price}
            </div>
          </div>

          <p className="text-sm text-gray-400 font-medium leading-relaxed mb-8 max-w-[85%]">
            {activeDish.desc || "Experience the perfect blend of fresh ingredients and signature spices, crafted to delight your senses."}
          </p>

          {/* Actions */}
          <div className="flex gap-4">
            <button 
              onClick={() => setViewMode('ar')}
              className="flex-[1.5] h-16 bg-gray-900 text-white rounded-3xl font-black flex items-center justify-center gap-3 active:scale-95 transition-transform"
            >
              <Box size={20} />
              View in AR
            </button>
            <button 
              onClick={() => addToCart(activeDish)}
              className="flex-1 h-16 bg-red-500 text-white rounded-3xl font-black flex items-center justify-center gap-2 shadow-lg shadow-red-500/30 active:scale-95 transition-transform"
            >
              <Plus size={20} strokeWidth={3} />
              Add
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
