"use client";

import React from 'react';
import { useApp } from '@/lib/store';
import { Plus, X, Box } from 'lucide-react';

export function AROverlayUI() {
  const { dishes, activeDishId, setViewMode, addToCart } = useApp();
  const activeDish = dishes.find(d => d.id === activeDishId);

  if (!activeDish) return null;

  return (
    <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-5">
      {/* Top bar */}
      <div className="flex items-center justify-between pointer-events-auto">
        <button
          onClick={() => setViewMode('preview')}
          className="w-11 h-11 bg-[#1C1C1C] rounded-2xl flex items-center justify-center active:scale-90 transition-transform"
        >
          <X size={20} className="text-white" />
        </button>

        <div className="px-5 py-2.5 bg-[#1C1C1C] rounded-full flex items-center gap-2">
          <Box size={13} className="text-[#E23744]" />
          <span className="text-white text-[12px] font-black tracking-widest uppercase">AR Mode</span>
        </div>

        <div className="w-11" />
      </div>

      {/* Bottom dish card */}
      <div className="pointer-events-auto bg-white rounded-3xl p-5 shadow-2xl mb-2">
        <div className="flex items-start justify-between mb-1.5">
          <div className="flex-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#E23744]">
              {activeDish.cat}
            </span>
            <h3 className="text-[20px] font-black text-[#1C1C1C] leading-tight">
              {activeDish.name}
            </h3>
          </div>
          <span className="text-[18px] font-black text-[#1C1C1C] mt-1 ml-3">
            {activeDish.price}
          </span>
        </div>

        {activeDish.desc && (
          <p className="text-[13px] text-[#686B78] leading-relaxed line-clamp-2 mb-4">
            {activeDish.desc}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => setViewMode('preview')}
            className="flex-1 h-12 border-2 border-[#1C1C1C] text-[#1C1C1C] rounded-xl font-black text-[13px] flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <X size={14} />
            Exit AR
          </button>
          <button
            onClick={() => { addToCart(activeDish); setViewMode('preview'); }}
            className="flex-1 h-12 bg-[#E23744] text-white rounded-xl font-black text-[13px] flex items-center justify-center gap-2 shadow-md shadow-red-500/20 active:scale-95 transition-transform"
          >
            <Plus size={16} strokeWidth={3} />
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
