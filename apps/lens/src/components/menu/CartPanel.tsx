"use client";

import React, { useState } from 'react';
import { useApp } from '@/lib/store';
import { X, Plus, Minus, ShoppingBag, CheckCircle } from 'lucide-react';

export function CartPanel() {
  const { cart, updateQty, setCartOpen, restaurant } = useApp();
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [placing, setPlacing] = useState(false);

  const subtotal = cart.reduce((a, i) => {
    const p = parseFloat(i.dish.price.replace(/[^\d.]/g, ''));
    return a + (isNaN(p) ? 0 : p * i.qty);
  }, 0);
  const taxes = Math.round(subtotal * 0.05);
  const deliveryFee = subtotal > 0 ? 30 : 0;
  const total = subtotal + taxes + deliveryFee;

  const handlePlaceOrder = async () => {
    if (placing || cart.length === 0) return;
    setPlacing(true);
    // Simulate order API call
    await new Promise(r => setTimeout(r, 900));
    setPlacing(false);
    setOrderPlaced(true);
  };

  // Order success screen
  if (orderPlaced) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center px-8 text-center">
        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6">
          <CheckCircle size={40} className="text-green-500" />
        </div>
        <h2 className="text-[26px] font-black text-[#1C1C1C] mb-2">Order Placed!</h2>
        <p className="text-[14px] text-[#686B78] leading-relaxed mb-2">
          Your order at <strong>{restaurant?.name}</strong> is confirmed.
        </p>
        <p className="text-[13px] text-[#686B78]">Estimated time: 30–40 mins</p>

        <div className="w-full mt-10 p-5 bg-[#F7F7F7] rounded-2xl text-left space-y-2">
          {cart.map(({ dish, qty }) => (
            <div key={dish.id} className="flex justify-between text-[13px]">
              <span className="text-[#1C1C1C] font-medium">{dish.name} × {qty}</span>
              <span className="text-[#686B78] font-medium">
                ₹{(parseFloat(dish.price.replace(/[^\d.]/g, '')) * qty).toFixed(0)}
              </span>
            </div>
          ))}
          <div className="border-t border-[#E8E8E8] pt-2 flex justify-between font-black text-[14px]">
            <span className="text-[#1C1C1C]">Total Paid</span>
            <span className="text-[#E23744]">₹{total.toFixed(0)}</span>
          </div>
        </div>

        <button
          onClick={() => setCartOpen(false)}
          className="mt-8 w-full h-14 bg-[#E23744] text-white rounded-xl font-black text-[15px] active:scale-[0.98] transition-transform"
        >
          Back to Menu
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => setCartOpen(false)}
      />

      {/* Panel */}
      <div className="relative bg-white rounded-t-3xl max-h-[88vh] flex flex-col shadow-2xl">
        {/* Handle */}
        <div className="w-10 h-1 bg-[#E0E0E0] rounded-full mx-auto mt-3 mb-1 shrink-0" />

        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-[#F0F0F5] shrink-0">
          <div>
            <h2 className="text-[20px] font-black text-[#1C1C1C]">Your Cart</h2>
            <p className="text-[12px] text-[#686B78] font-medium mt-0.5">{restaurant?.name}</p>
          </div>
          <button
            onClick={() => setCartOpen(false)}
            className="w-9 h-9 bg-[#F0F0F5] rounded-full flex items-center justify-center active:scale-90 transition-transform"
          >
            <X size={16} className="text-[#1C1C1C]" />
          </button>
        </div>

        {/* Items list */}
        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 px-8 text-center">
            <div className="w-16 h-16 bg-[#F7F7F7] rounded-full flex items-center justify-center mb-4">
              <ShoppingBag size={28} className="text-[#D0D0D0]" />
            </div>
            <p className="text-[15px] font-bold text-[#1C1C1C] mb-1">Your cart is empty</p>
            <p className="text-[13px] text-[#686B78]">Add items from the menu to get started</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {cart.map(({ dish, qty }) => {
              const price = parseFloat(dish.price.replace(/[^\d.]/g, ''));
              return (
                <div key={dish.id} className="flex items-center gap-4">
                  {/* Emoji thumbnail */}
                  <div className="w-14 h-14 bg-[#F7F7F7] rounded-2xl flex items-center justify-center text-2xl shrink-0">
                    {dish.emoji}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[13px] text-[#1C1C1C] truncate">{dish.name}</p>
                    <p className="text-[#E23744] font-black text-[13px] mt-0.5">
                      ₹{(isNaN(price) ? 0 : price * qty).toFixed(0)}
                    </p>
                  </div>

                  {/* Qty controls */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      onClick={() => updateQty(dish.id, -1)}
                      className="w-8 h-8 border-2 border-[#E23744] rounded-lg flex items-center justify-center active:scale-90 transition-transform"
                    >
                      <Minus size={13} className="text-[#E23744]" strokeWidth={3} />
                    </button>
                    <span className="text-[14px] font-black text-[#1C1C1C] w-4 text-center">{qty}</span>
                    <button
                      onClick={() => updateQty(dish.id, 1)}
                      className="w-8 h-8 bg-[#E23744] rounded-lg flex items-center justify-center active:scale-90 transition-transform"
                    >
                      <Plus size={13} className="text-white" strokeWidth={3} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bill summary + CTA */}
        {cart.length > 0 && (
          <div className="px-5 pt-4 pb-6 border-t border-[#F0F0F5] shrink-0 space-y-3">
            {/* Bill breakdown */}
            <div className="bg-[#F7F7F7] rounded-2xl p-4 space-y-2">
              <p className="text-[12px] font-black text-[#1C1C1C] uppercase tracking-wider mb-3">
                Bill Details
              </p>
              <div className="flex justify-between text-[13px]">
                <span className="text-[#686B78]">Item total</span>
                <span className="font-medium text-[#1C1C1C]">₹{subtotal.toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[#686B78]">Delivery fee</span>
                <span className="font-medium text-[#1C1C1C]">₹{deliveryFee}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[#686B78]">GST & charges</span>
                <span className="font-medium text-[#1C1C1C]">₹{taxes}</span>
              </div>
              <div className="border-t border-[#E8E8E8] pt-2 flex justify-between">
                <span className="font-black text-[14px] text-[#1C1C1C]">To Pay</span>
                <span className="font-black text-[14px] text-[#1C1C1C]">₹{total.toFixed(0)}</span>
              </div>
            </div>

            <button
              onClick={handlePlaceOrder}
              disabled={placing}
              className="w-full h-14 bg-[#E23744] text-white rounded-xl font-black text-[15px] flex items-center justify-between px-5 shadow-md shadow-red-500/20 disabled:opacity-70 active:scale-[0.98] transition-transform"
            >
              <span className="text-[13px] opacity-80">{placing ? 'Placing order…' : `${cart.reduce((a, i) => a + i.qty, 0)} items`}</span>
              <span>Place Order</span>
              <span className="text-[13px] opacity-80">₹{total.toFixed(0)}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
