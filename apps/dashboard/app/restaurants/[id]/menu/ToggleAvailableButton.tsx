'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ToggleAvailableButton({
  restaurantSlug,
  itemId,
  available,
}: {
  restaurantSlug: string
  itemId: string
  available: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    await fetch(`/api/restaurants/${restaurantSlug}/menu/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ available: !available }),
    })
    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`text-xs px-2.5 py-1.5 rounded-lg transition-all ${
        available
          ? 'bg-emerald-500/10 text-emerald-400/70 hover:bg-emerald-500/20 hover:text-emerald-400'
          : 'bg-white/[0.05] text-white/30 hover:text-white/50 hover:bg-white/[0.1]'
      }`}
      title={available ? 'Disable item' : 'Enable item'}
    >
      {loading ? '…' : available ? '● On' : '○ Off'}
    </button>
  )
}
