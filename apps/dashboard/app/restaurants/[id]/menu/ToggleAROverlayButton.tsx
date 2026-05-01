'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface Props {
  restaurantSlug: string
  enabled: boolean
}

export default function ToggleAROverlayButton({ restaurantSlug, enabled }: Props) {
  const [isEnabled, setIsEnabled] = useState(enabled)
  const [loading, setLoading]     = useState(false)

  async function toggle() {
    setLoading(true)
    try {
      const res = await fetch(`/api/restaurants/${restaurantSlug}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ arOverlayEnabled: !isEnabled }),
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
          ? 'AR overlay ON — status bar and scanning hint visible in lens. Click to hide.'
          : 'AR overlay OFF — status bar and scanning hint hidden in lens. Click to show.'
      }
      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border transition-all ${
        loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${
        isEnabled
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
          : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/[0.08] hover:text-white/60'
      }`}
    >
      {isEnabled
        ? <><Eye    className="size-3.5" /> AR Overlay</>
        : <><EyeOff className="size-3.5" /> AR Overlay</>
      }
    </button>
  )
}
