'use client'

import { useState } from 'react'
import { Crosshair, Layers } from 'lucide-react'

interface Props {
  restaurantSlug: string
  enabled: boolean
}

export default function ToggleMarkerDetectionButton({ restaurantSlug, enabled }: Props) {
  const [isEnabled, setIsEnabled] = useState(enabled)
  const [loading, setLoading]     = useState(false)

  async function toggle() {
    setLoading(true)
    try {
      const res = await fetch(`/api/restaurants/${restaurantSlug}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ markerDetectionEnabled: !isEnabled }),
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
          ? 'Marker detection ON — AR triggered by scanning the menu card. Click to switch to surface mode.'
          : 'Surface detection ON — AR placed on real-world surfaces via WebXR. Click to switch back to marker mode.'
      }
      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border transition-all ${
        loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${
        isEnabled
          ? 'bg-[#D4A853]/10 text-[#D4A853] border-[#D4A853]/20 hover:bg-[#D4A853]/20'
          : 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20'
      }`}
    >
      {isEnabled
        ? <><Crosshair className="size-3.5" /> Marker Mode</>
        : <><Layers     className="size-3.5" /> Surface Mode</>
      }
    </button>
  )
}
