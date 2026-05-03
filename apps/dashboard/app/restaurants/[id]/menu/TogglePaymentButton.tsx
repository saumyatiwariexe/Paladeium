'use client'

import { useState } from 'react'
import { CreditCard } from 'lucide-react'

interface Props {
  restaurantSlug: string
  enabled: boolean
}

export default function TogglePaymentButton({ restaurantSlug, enabled }: Props) {
  const [isEnabled, setIsEnabled] = useState(enabled)
  const [loading, setLoading]     = useState(false)

  async function toggle() {
    setLoading(true)
    try {
      const res = await fetch(`/api/restaurants/${restaurantSlug}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ paymentEnabled: !isEnabled }),
      })
      if (res.ok) setIsEnabled(v => !v)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={
        isEnabled
          ? 'Payment enabled — customers can add items to cart and place orders. Click to disable.'
          : 'Payment disabled — menu is browse-only, no ordering. Click to enable.'
      }
      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border transition-all ${
        loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${
        isEnabled
          ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20'
          : 'bg-white/5 text-white/35 border-white/10 hover:bg-white/[0.08] hover:text-white/50'
      }`}
    >
      <CreditCard className="size-3.5" />
      {isEnabled ? 'Payment On' : 'Payment Off'}
    </button>
  )
}
