'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteItemButton({
  restaurantSlug,
  itemId,
  itemName,
}: {
  restaurantSlug: string
  itemId: string
  itemName: string
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)

  async function handleDelete() {
    await fetch(`/api/restaurants/${restaurantSlug}/menu/${itemId}`, { method: 'DELETE' })
    router.refresh()
    setConfirming(false)
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-white/40 max-w-[80px] truncate">Delete &ldquo;{itemName}&rdquo;?</span>
        <button
          onClick={handleDelete}
          className="text-xs px-2 py-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
        >
          Yes
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs px-2 py-1.5 rounded-lg bg-white/[0.05] text-white/40 hover:bg-white/[0.1] transition-colors"
        >
          No
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400/70 hover:text-red-400 hover:bg-red-500/20 transition-all"
    >
      Delete
    </button>
  )
}
