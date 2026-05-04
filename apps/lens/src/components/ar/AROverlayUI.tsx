"use client";

import React from 'react';
import { useApp } from '@/lib/store';
import { Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function AROverlayUI() {
  const { dishes, activeDishId, setViewMode, addToCart } = useApp();
  const activeDish = dishes.find(d => d.id === activeDishId);

  if (!activeDish) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex flex-col justify-between p-6">
      {/* Top Header */}
      <div className="flex justify-between items-center pointer-events-auto">
        <button 
          onClick={() => setViewMode('preview')}
          className="w-12 h-12 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl flex items-center justify-center text-white active:scale-95 transition-transform"
        >
          <X size={24} />
        </button>
        <div className="px-5 py-2.5 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full text-white text-xs font-bold tracking-widest uppercase">
          AR Mode
        </div>
        <div className="w-12 h-12" />
      </div>

      {/* Floating Info Card */}
      <AnimatePresence mode="wait">
        <motion.div 
          key={activeDish.id}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="pointer-events-auto bg-white/90 backdrop-blur-2xl p-6 rounded-[32px] shadow-2xl border border-white/20 mb-4"
        >
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-2xl font-black text-gray-900 tracking-tight leading-tight">
              {activeDish.name}
            </h3>
            <span className="text-xl font-black text-red-500">
              {activeDish.price}
            </span>
          </div>
          <p className="text-sm text-gray-500 font-medium leading-relaxed line-clamp-2 mb-6">
            {activeDish.desc}
          </p>
          
          <div className="flex gap-3">
            <button 
              onClick={() => addToCart(activeDish)}
              className="flex-1 h-14 bg-red-500 text-white rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg shadow-red-500/30 active:scale-[0.98] transition-transform"
            >
              <Plus size={20} strokeWidth={3} />
              Add to Cart
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
