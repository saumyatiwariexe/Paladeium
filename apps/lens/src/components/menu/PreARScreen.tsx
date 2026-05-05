"use client";

import React, { useState } from 'react';
import { useApp } from '@/lib/store';
import { ModelCarousel } from '@/components/ar/ModelCarousel';
import { CategoryPills } from './CategoryPills';
import { MenuList } from './MenuList';
import { CartPanel } from './CartPanel';
import {
  ShoppingCart, ChevronLeft, ChevronRight, Box, Plus, Star, MapPin, Clock,
} from 'lucide-react';

export function PreARScreen() {
  const {
    restaurant, dishes, activeDishId, setActiveDish,
    cart, cartOpen, setCartOpen, addToCart, setViewMode,
  } = useApp();

  const activeDish = dishes.find(d => d.id === activeDishId);
  const activeDishIndex = dishes.findIndex(d => d.id === activeDishId);
  const cartCount = cart.reduce((a, i) => a + i.qty, 0);
  const cartTotal = cart.reduce((a, i) => {
    const p = parseFloat(i.dish.price.replace(/[^\d.]/g, ''));
    return a + (isNaN(p) ? 0 : p * i.qty);
  }, 0);

  const goToPrev = () => {
    if (activeDishIndex > 0) setActiveDish(dishes[activeDishIndex - 1].id);
  };
  const goToNext = () => {
    if (activeDishIndex < dishes.length - 1) setActiveDish(dishes[activeDishIndex + 1].id);
  };

  return (
    <div className="h-screen w-full overflow-y-auto overflow-x-hidden bg-white" style={{ WebkitOverflowScrolling: 'touch' }}>

      {/* ── STICKY HEADER ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E8E8E8] px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-[17px] font-black text-[#1C1C1C] truncate">
            {restaurant?.name || 'Paladeium'}
          </h1>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="flex items-center gap-1 text-[11px] text-[#686B78] font-medium">
              <Star size={10} className="text-[#F0A500] fill-[#F0A500]" />
              4.2 (200+)
            </span>
            <span className="w-1 h-1 rounded-full bg-[#D9D9D9]" />
            <span className="flex items-center gap-1 text-[11px] text-[#686B78] font-medium">
              <Clock size={10} />
              30–40 min
            </span>
            <span className="w-1 h-1 rounded-full bg-[#D9D9D9]" />
            <span className="flex items-center gap-1 text-[11px] text-[#686B78] font-medium">
              <MapPin size={10} />
              3.2 km
            </span>
          </div>
        </div>
        <button
          onClick={() => setCartOpen(true)}
          className="relative w-10 h-10 flex items-center justify-center rounded-full bg-[#F5F5F5]"
        >
          <ShoppingCart size={19} className="text-[#1C1C1C]" />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-[#E23744] text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
              {cartCount}
            </span>
          )}
        </button>
      </header>

      {/* ── 3D HERO SECTION ── */}
      <div className="relative bg-[#F7F7F7] overflow-hidden" style={{ height: '52vmax', minHeight: 260, maxHeight: 420 }}>
        {/* Canvas fills this box */}
        <div className="absolute inset-0">
          <ModelCarousel />
        </div>

        {/* Left arrow */}
        <button
          onClick={goToPrev}
          disabled={activeDishIndex <= 0}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white rounded-full shadow-md flex items-center justify-center disabled:opacity-20 active:scale-90 transition-transform"
        >
          <ChevronLeft size={18} className="text-[#1C1C1C]" />
        </button>

        {/* Right arrow */}
        <button
          onClick={goToNext}
          disabled={activeDishIndex >= dishes.length - 1}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white rounded-full shadow-md flex items-center justify-center disabled:opacity-20 active:scale-90 transition-transform"
        >
          <ChevronRight size={18} className="text-[#1C1C1C]" />
        </button>

        {/* Dots */}
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10 pointer-events-none">
          {dishes.slice(0, 10).map((d, i) => (
            <button
              key={d.id}
              onClick={() => setActiveDish(d.id)}
              className={`rounded-full transition-all pointer-events-auto ${
                i === activeDishIndex
                  ? 'w-5 h-2 bg-[#E23744]'
                  : 'w-2 h-2 bg-[#1C1C1C]/20'
              }`}
            />
          ))}
        </div>
      </div>

      {/* ── DISH INFO CARD ── */}
      {activeDish && (
        <div className="bg-white px-5 pt-5 pb-6 border-b border-[#E8E8E8]">
          {/* Category + name + price */}
          <div className="mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#E23744]">
              {activeDish.cat}
            </span>
          </div>
          <div className="flex items-start justify-between gap-3 mb-2">
            <h2 className="flex-1 text-[22px] font-black text-[#1C1C1C] leading-tight">
              {activeDish.name}
            </h2>
            <span className="text-[20px] font-black text-[#1C1C1C] mt-0.5 shrink-0">
              {activeDish.price}
            </span>
          </div>
          {activeDish.desc ? (
            <p className="text-[13px] text-[#686B78] leading-relaxed mb-5">
              {activeDish.desc}
            </p>
          ) : (
            <p className="text-[13px] text-[#686B78] leading-relaxed mb-5">
              Fresh, made-to-order — crafted with signature spices and premium ingredients.
            </p>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            {activeDish.hasAR && (
              <button
                onClick={() => setViewMode('ar')}
                className="flex items-center justify-center gap-2 px-5 h-12 border-2 border-[#E23744] text-[#E23744] rounded-xl font-black text-[13px] active:scale-95 transition-transform"
              >
                <Box size={15} />
                View in AR
              </button>
            )}
            <button
              onClick={() => addToCart(activeDish)}
              className="flex-1 h-12 bg-[#E23744] text-white rounded-xl font-black text-[14px] flex items-center justify-center gap-2 shadow-md shadow-red-500/20 active:scale-95 transition-transform"
            >
              <Plus size={17} strokeWidth={3} />
              Add to Cart
            </button>
          </div>
        </div>
      )}

      {/* ── FULL MENU SECTION ── */}
      <div className="bg-white">
        {/* Section header */}
        <div className="px-5 pt-6 pb-1 flex items-center justify-between">
          <h3 className="text-[18px] font-black text-[#1C1C1C]">Menu</h3>
          <span className="text-[12px] text-[#686B78] font-medium">{dishes.length} items</span>
        </div>

        {/* Category filter pills */}
        <CategoryPills />

        {/* Divider */}
        <div className="h-1.5 bg-[#F0F0F5] mx-0 my-2" />

        {/* Menu items */}
        <MenuList />
      </div>

      {/* Bottom safe area padding */}
      <div className="h-28" />

      {/* ── CART FOOTER BAR ── */}
      {cartCount > 0 && !cartOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4 pt-2 bg-white border-t border-[#E8E8E8]">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full h-14 bg-[#E23744] text-white rounded-xl font-black flex items-center justify-between px-5 shadow-lg shadow-red-500/20 active:scale-[0.98] transition-transform"
          >
            <span className="bg-red-700 text-white text-[12px] font-black min-w-[28px] h-7 rounded-lg flex items-center justify-center px-2">
              {cartCount}
            </span>
            <span className="text-[15px]">View Cart</span>
            <span className="text-[15px]">₹{cartTotal.toFixed(0)}</span>
          </button>
        </div>
      )}

      {/* ── CART PANEL ── */}
      {cartOpen && <CartPanel />}
    </div>
  );
}
