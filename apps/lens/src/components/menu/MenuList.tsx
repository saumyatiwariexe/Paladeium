"use client";

import React from 'react';
import { useApp } from '@/lib/store';
import { Plus, Minus } from 'lucide-react';

function VegDot({ cat }: { cat: string }) {
  const isVeg = cat === 'veg' || cat === 'salads' || cat === 'desserts';
  return (
    <span
      className={`inline-flex w-3.5 h-3.5 rounded-sm border-2 items-center justify-center shrink-0 ${
        isVeg ? 'border-[#3E9C35]' : 'border-[#E23744]'
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${isVeg ? 'bg-[#3E9C35]' : 'bg-[#E23744]'}`} />
    </span>
  );
}

export function MenuList() {
  const { dishes, activeCategory, addToCart, cart, updateQty, setActiveDish } = useApp();

  const filtered = activeCategory === 'all'
    ? dishes
    : dishes.filter(d => d.cat === activeCategory);

  if (filtered.length === 0) {
    return (
      <div className="px-5 py-12 text-center">
        <p className="text-[14px] text-[#686B78]">No items in this category.</p>
      </div>
    );
  }

  return (
    <div>
      {filtered.map((dish, idx) => {
        const cartItem = cart.find(c => c.dish.id === dish.id);
        const qty = cartItem?.qty ?? 0;
        const price = parseFloat(dish.price.replace(/[^\d.]/g, ''));

        return (
          <React.Fragment key={dish.id}>
            <div
              className="flex items-start gap-4 px-5 py-4"
              onClick={() => setActiveDish(dish.id)}
            >
              {/* Left: info */}
              <div className="flex-1 min-w-0">
                {/* Veg indicator */}
                <div className="mb-1.5">
                  <VegDot cat={dish.cat} />
                </div>

                <h4 className="font-bold text-[14px] text-[#1C1C1C] leading-snug mb-1">
                  {dish.name}
                </h4>

                <p className="text-[12px] text-[#686B78] leading-relaxed line-clamp-2 mb-2">
                  {dish.desc || 'Fresh ingredients, signature flavours.'}
                </p>

                <span className="font-black text-[14px] text-[#1C1C1C]">
                  {isNaN(price) ? dish.price : `₹${price.toFixed(0)}`}
                </span>
              </div>

              {/* Right: image + add button */}
              <div className="shrink-0 flex flex-col items-center gap-3">
                {/* Emoji / dish thumbnail */}
                <div className="w-24 h-24 bg-[#F7F7F7] rounded-2xl flex items-center justify-center text-4xl overflow-hidden relative">
                  {dish.emoji}
                  {dish.hasAR && (
                    <span className="absolute bottom-1 right-1 text-[8px] font-black text-white bg-[#1C1C1C]/70 rounded px-1 py-0.5">
                      3D
                    </span>
                  )}
                </div>

                {/* Add / Qty control */}
                {qty === 0 ? (
                  <button
                    onClick={e => { e.stopPropagation(); addToCart(dish); }}
                    className="w-24 h-9 border-2 border-[#E23744] text-[#E23744] rounded-xl font-black text-[13px] flex items-center justify-center gap-1 active:scale-90 transition-transform"
                  >
                    <Plus size={14} strokeWidth={3} />
                    ADD
                  </button>
                ) : (
                  <div
                    className="flex items-center h-9 rounded-xl overflow-hidden border-2 border-[#E23744]"
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      onClick={() => updateQty(dish.id, -1)}
                      className="w-8 h-full flex items-center justify-center bg-white active:bg-red-50 transition-colors"
                    >
                      <Minus size={13} className="text-[#E23744]" strokeWidth={3} />
                    </button>
                    <span className="text-[13px] font-black text-[#E23744] w-6 text-center bg-white">
                      {qty}
                    </span>
                    <button
                      onClick={() => updateQty(dish.id, 1)}
                      className="w-8 h-full bg-[#E23744] flex items-center justify-center active:bg-red-600 transition-colors"
                    >
                      <Plus size={13} className="text-white" strokeWidth={3} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Divider (not after last item) */}
            {idx < filtered.length - 1 && (
              <div className="h-px bg-[#F0F0F5] mx-5" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
