'use client'

import { useState } from 'react'
import { Glasses, Sparkles } from 'lucide-react'

interface Props {
  restaurantSlug: string
  uiType: 'ar' | 'dynamic'
}

export default function ToggleUITypeButton({ restaurantSlug, uiType: initial }: Props) {
  const [uiType, setUiType] = useState(initial)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    const next = uiType === 'ar' ? 'dynamic' : 'ar'
    try {
      const res = await fetch(`/api/restaurants/${restaurantSlug}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ uiType: next }),
      })
      if (res.ok) setUiType(next)
    } finally {
      setLoading(false)
    }
  }

  const isAR = uiType === 'ar'

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={
        isAR
          ? 'AR UI — customers scan a marker to launch full AR. Click to switch to Dynamic UI.'
          : 'Dynamic UI — 3D dish viewer with rotating models, no camera required. Click to switch to AR UI.'
      }
      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border transition-all ${
        loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${
        isAR
          ? 'bg-violet-500/10 text-violet-400 border-violet-500/20 hover:bg-violet-500/20'
          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
      }`}
    >
      {isAR
        ? <><Glasses className="size-3.5" /> AR UI</>
        : <><Sparkles className="size-3.5" /> Dynamic UI</>
      }
    </button>
  )
}
