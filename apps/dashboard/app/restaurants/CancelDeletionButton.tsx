'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CancelDeletionButton({ id }: { id: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleRestore() {
    setLoading(true)
    try {
      await fetch(`/api/restaurants/${id}/restore`, { method: 'POST' })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleRestore}
      disabled={loading}
      className="flex-1 text-center text-xs font-medium py-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 disabled:opacity-50 transition-all"
    >
      {loading ? 'Restoring…' : 'Cancel Deletion'}
    </button>
  )
}
