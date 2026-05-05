"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '@/lib/store';
import { X, Plus, Minus, ShoppingBag, CheckCircle, XCircle, Clock, ChevronRight } from 'lucide-react';

const DASHBOARD_API = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'https://paladeium-lens.vercel.app';
const WAIT_SECS     = 5 * 60; // 5-minute window
const POLL_MS       = 4_000;  // poll every 4 s

type Step = 'cart' | 'checkout' | 'waiting' | 'confirmed' | 'rejected' | 'timeout';

// ── 5-min clock ──────────────────────────────────────────────────────────────

function WaitClock({
  orderId,
  slug,
  total,
  onConfirmed,
  onRejected,
  onTimeout,
}: {
  orderId: string;
  slug: string;
  total: number;
  onConfirmed: () => void;
  onRejected:  () => void;
  onTimeout:   () => void;
}) {
  const [remaining, setRemaining] = useState(WAIT_SECS);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const pollRef     = useRef<ReturnType<typeof setInterval>>();

  const poll = useCallback(async () => {
    try {
      const res  = await fetch(`${DASHBOARD_API}/api/restaurants/${slug}/orders/${orderId}`);
      if (!res.ok) return;
      const data = await res.json() as { status: string };
      if (data.status === 'confirmed') { onConfirmed(); }
      if (data.status === 'rejected')  { onRejected();  }
    } catch { /* network hiccup — keep polling */ }
  }, [slug, orderId, onConfirmed, onRejected]);

  useEffect(() => {
    // Countdown tick
    intervalRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) { onTimeout(); return 0; }
        return r - 1;
      });
    }, 1000);

    // Poll order status
    poll(); // immediate first check
    pollRef.current = setInterval(poll, POLL_MS);

    return () => {
      clearInterval(intervalRef.current);
      clearInterval(pollRef.current);
    };
  }, [poll, onTimeout]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const progress = remaining / WAIT_SECS; // 1→0

  // SVG ring
  const R = 54;
  const C = 2 * Math.PI * R;
  const dash = C * progress;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center px-8 text-center">
      {/* Clock ring */}
      <div className="relative mb-8">
        <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
          <circle cx="70" cy="70" r={R} fill="none" stroke="#F0F0F5" strokeWidth="8" />
          <circle
            cx="70" cy="70" r={R}
            fill="none"
            stroke="#E23744"
            strokeWidth="8"
            strokeDasharray={`${dash} ${C}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.9s linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[28px] font-black text-[#1C1C1C] tabular-nums">
            {mins}:{secs.toString().padStart(2, '0')}
          </span>
          <span className="text-[11px] text-[#686B78] font-medium mt-0.5">remaining</span>
        </div>
      </div>

      <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mb-5">
        <Clock size={28} className="text-amber-500" />
      </div>

      <h2 className="text-[22px] font-black text-[#1C1C1C] mb-2">Waiting for confirmation</h2>
      <p className="text-[14px] text-[#686B78] leading-relaxed mb-1">
        Your order of <strong className="text-[#1C1C1C]">₹{total.toFixed(0)}</strong> has been sent
        to the restaurant.
      </p>
      <p className="text-[13px] text-[#686B78]">You'll be notified as soon as it's confirmed.</p>

      <div className="flex items-center gap-2 mt-6">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <p className="text-[12px] text-[#686B78]">Checking for updates…</p>
      </div>
    </div>
  );
}

// ── CartPanel ─────────────────────────────────────────────────────────────────

export function CartPanel() {
  const { cart, updateQty, setCartOpen, restaurant } = useApp();

  const [step, setStep]         = useState<Step>('cart');
  const [placing, setPlacing]   = useState(false);
  const [error, setError]       = useState('');
  const [orderId, setOrderId]   = useState('');
  const [name, setName]         = useState('');
  const [phone, setPhone]       = useState('');

  const subtotal    = cart.reduce((a, i) => {
    const p = parseFloat(i.dish.price.replace(/[^\d.]/g, ''));
    return a + (isNaN(p) ? 0 : p * i.qty);
  }, 0);
  const taxes       = Math.round(subtotal * 0.05);
  const deliveryFee = subtotal > 0 ? 30 : 0;
  const total       = subtotal + taxes + deliveryFee;
  const itemCount   = cart.reduce((a, i) => a + i.qty, 0);

  async function placeOrder() {
    if (!name.trim() || !phone.trim()) { setError('Name and phone are required'); return; }
    if (!restaurant?.slug) { setError('Restaurant not found'); return; }
    setPlacing(true); setError('');
    try {
      const res  = await fetch(`${DASHBOARD_API}/api/restaurants/${restaurant.slug}/orders`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: { name: name.trim(), phone: phone.trim() },
          items: cart.map(({ dish, qty }) => ({
            id:    dish.id,
            name:  dish.name,
            price: dish.price,
            qty,
          })),
          total,
        }),
      });
      const data = await res.json().catch(() => ({})) as { orderId?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to place order');
      setOrderId(data.orderId!);
      setStep('waiting');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setPlacing(false);
    }
  }

  // ── Confirmed ──────────────────────────────────────────────────────────
  if (step === 'confirmed') {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center px-8 text-center">
        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6">
          <CheckCircle size={40} className="text-green-500" />
        </div>
        <h2 className="text-[26px] font-black text-[#1C1C1C] mb-2">Order Confirmed!</h2>
        <p className="text-[14px] text-[#686B78] leading-relaxed mb-1">
          <strong>{restaurant?.name}</strong> has accepted your order.
        </p>
        <p className="text-[13px] text-[#686B78] mb-8">Estimated time: 20–35 mins</p>

        <div className="w-full p-5 bg-[#F7F7F7] rounded-2xl text-left space-y-2 mb-8">
          {cart.map(({ dish, qty }) => (
            <div key={dish.id} className="flex justify-between text-[13px]">
              <span className="text-[#1C1C1C] font-medium">{dish.name} × {qty}</span>
              <span className="text-[#686B78] font-medium">
                ₹{(parseFloat(dish.price.replace(/[^\d.]/g, '')) * qty).toFixed(0)}
              </span>
            </div>
          ))}
          <div className="border-t border-[#E8E8E8] pt-2 flex justify-between font-black text-[14px]">
            <span className="text-[#1C1C1C]">Total</span>
            <span className="text-[#E23744]">₹{total.toFixed(0)}</span>
          </div>
        </div>

        <button
          onClick={() => setCartOpen(false)}
          className="w-full h-14 bg-[#E23744] text-white rounded-xl font-black text-[15px] active:scale-[0.98] transition-transform">
          Back to Menu
        </button>
      </div>
    );
  }

  // ── Rejected ───────────────────────────────────────────────────────────
  if (step === 'rejected') {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center px-8 text-center">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
          <XCircle size={40} className="text-[#E23744]" />
        </div>
        <h2 className="text-[24px] font-black text-[#1C1C1C] mb-2">Order Declined</h2>
        <p className="text-[14px] text-[#686B78] mb-8">
          The restaurant couldn't accept your order right now. Please try again or speak to staff.
        </p>
        <button
          onClick={() => setStep('cart')}
          className="w-full h-14 bg-[#E23744] text-white rounded-xl font-black text-[15px] active:scale-[0.98] transition-transform">
          Try Again
        </button>
      </div>
    );
  }

  // ── Timeout ────────────────────────────────────────────────────────────
  if (step === 'timeout') {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center px-8 text-center">
        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mb-6">
          <Clock size={40} className="text-amber-500" />
        </div>
        <h2 className="text-[24px] font-black text-[#1C1C1C] mb-2">Taking longer than usual</h2>
        <p className="text-[14px] text-[#686B78] mb-2">
          Your order has been received but hasn't been confirmed yet. Please ask the staff to check.
        </p>
        <p className="text-[12px] text-[#686B78] font-mono mb-8">Order #{orderId.slice(0, 8).toUpperCase()}</p>
        <button
          onClick={() => setCartOpen(false)}
          className="w-full h-14 bg-[#1C1C1C] text-white rounded-xl font-black text-[15px] active:scale-[0.98] transition-transform">
          Back to Menu
        </button>
      </div>
    );
  }

  // ── Waiting clock ──────────────────────────────────────────────────────
  if (step === 'waiting' && orderId && restaurant?.slug) {
    return (
      <WaitClock
        orderId={orderId}
        slug={restaurant.slug}
        total={total}
        onConfirmed={() => setStep('confirmed')}
        onRejected={() => setStep('rejected')}
        onTimeout={() => setStep('timeout')}
      />
    );
  }

  // ── Checkout form ──────────────────────────────────────────────────────
  if (step === 'checkout') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col justify-end">
        <div className="absolute inset-0 bg-black/40" onClick={() => setStep('cart')} />
        <div className="relative bg-white rounded-t-3xl max-h-[88vh] flex flex-col shadow-2xl">
          <div className="w-10 h-1 bg-[#E0E0E0] rounded-full mx-auto mt-3 mb-1 shrink-0" />

          <div className="px-5 py-4 flex items-center justify-between border-b border-[#F0F0F5] shrink-0">
            <div>
              <h2 className="text-[20px] font-black text-[#1C1C1C]">Your Details</h2>
              <p className="text-[12px] text-[#686B78] mt-0.5">{itemCount} item{itemCount !== 1 ? 's' : ''} · ₹{total.toFixed(0)}</p>
            </div>
            <button onClick={() => setStep('cart')}
              className="w-9 h-9 bg-[#F0F0F5] rounded-full flex items-center justify-center active:scale-90 transition-transform">
              <X size={16} className="text-[#1C1C1C]" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-[#686B78] mb-2">
                Your Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                autoFocus
                className="w-full h-12 border-2 border-[#E8E8E8] rounded-xl px-4 text-[14px] text-[#1C1C1C] placeholder-[#C0C0C0] focus:border-[#E23744] outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-[#686B78] mb-2">
                Phone Number *
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full h-12 border-2 border-[#E8E8E8] rounded-xl px-4 text-[14px] text-[#1C1C1C] placeholder-[#C0C0C0] focus:border-[#E23744] outline-none transition-colors"
              />
            </div>

            {/* Order summary */}
            <div className="bg-[#F7F7F7] rounded-2xl p-4 space-y-2">
              <p className="text-[11px] font-black uppercase tracking-wider text-[#1C1C1C] mb-3">Order Summary</p>
              {cart.map(({ dish, qty }) => (
                <div key={dish.id} className="flex justify-between text-[13px]">
                  <span className="text-[#686B78]">{dish.name} × {qty}</span>
                  <span className="font-medium text-[#1C1C1C]">
                    ₹{(parseFloat(dish.price.replace(/[^\d.]/g, '')) * qty).toFixed(0)}
                  </span>
                </div>
              ))}
              <div className="border-t border-[#E8E8E8] pt-2 flex justify-between font-black text-[13px]">
                <span className="text-[#1C1C1C]">Total</span>
                <span className="text-[#E23744]">₹{total.toFixed(0)}</span>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-[13px]">
                {error}
              </div>
            )}
          </div>

          <div className="px-5 pb-8 pt-4 border-t border-[#F0F0F5] shrink-0">
            <button
              onClick={placeOrder}
              disabled={placing || !name.trim() || !phone.trim()}
              className="w-full h-14 bg-[#E23744] text-white rounded-xl font-black text-[15px] flex items-center justify-between px-5 shadow-md shadow-red-500/20 disabled:opacity-60 active:scale-[0.98] transition-transform">
              <span className="text-[13px] opacity-80">{placing ? '' : `₹${total.toFixed(0)}`}</span>
              <span>{placing ? 'Placing order…' : 'Confirm Order'}</span>
              <ChevronRight size={18} className="opacity-80" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Cart view ──────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={() => setCartOpen(false)} />

      <div className="relative bg-white rounded-t-3xl max-h-[88vh] flex flex-col shadow-2xl">
        <div className="w-10 h-1 bg-[#E0E0E0] rounded-full mx-auto mt-3 mb-1 shrink-0" />

        <div className="px-5 py-4 flex items-center justify-between border-b border-[#F0F0F5] shrink-0">
          <div>
            <h2 className="text-[20px] font-black text-[#1C1C1C]">Your Cart</h2>
            <p className="text-[12px] text-[#686B78] font-medium mt-0.5">{restaurant?.name}</p>
          </div>
          <button onClick={() => setCartOpen(false)}
            className="w-9 h-9 bg-[#F0F0F5] rounded-full flex items-center justify-center active:scale-90 transition-transform">
            <X size={16} className="text-[#1C1C1C]" />
          </button>
        </div>

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
                  <div className="w-14 h-14 bg-[#F7F7F7] rounded-2xl flex items-center justify-center text-2xl shrink-0">
                    {dish.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[13px] text-[#1C1C1C] truncate">{dish.name}</p>
                    <p className="text-[#E23744] font-black text-[13px] mt-0.5">
                      ₹{(isNaN(price) ? 0 : price * qty).toFixed(0)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <button onClick={() => updateQty(dish.id, -1)}
                      className="w-8 h-8 border-2 border-[#E23744] rounded-lg flex items-center justify-center active:scale-90 transition-transform">
                      <Minus size={13} className="text-[#E23744]" strokeWidth={3} />
                    </button>
                    <span className="text-[14px] font-black text-[#1C1C1C] w-4 text-center">{qty}</span>
                    <button onClick={() => updateQty(dish.id, 1)}
                      className="w-8 h-8 bg-[#E23744] rounded-lg flex items-center justify-center active:scale-90 transition-transform">
                      <Plus size={13} className="text-white" strokeWidth={3} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {cart.length > 0 && (
          <div className="px-5 pt-4 pb-6 border-t border-[#F0F0F5] shrink-0 space-y-3">
            <div className="bg-[#F7F7F7] rounded-2xl p-4 space-y-2">
              <p className="text-[12px] font-black text-[#1C1C1C] uppercase tracking-wider mb-3">Bill Details</p>
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
              onClick={() => setStep('checkout')}
              className="w-full h-14 bg-[#E23744] text-white rounded-xl font-black text-[15px] flex items-center justify-between px-5 shadow-md shadow-red-500/20 active:scale-[0.98] transition-transform">
              <span className="text-[13px] opacity-80">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
              <span>Place Order</span>
              <span className="text-[13px] opacity-80">₹{total.toFixed(0)}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
