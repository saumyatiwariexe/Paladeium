'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteRestaurantButton({
  id,
  name,
}: {
  id: string
  name: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [inputName, setInputName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function close() {
    if (loading) return
    setOpen(false)
    setInputName('')
    setError('')
  }

  async function handleDelete() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/restaurants/${id}`, { method: 'DELETE' })
      const data = await res.text().then(t => { try { return JSON.parse(t) } catch { return {} } })
      if (!res.ok) throw new Error(data.error ?? 'Failed to schedule deletion')
      close()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const confirmed = inputName.trim().toLowerCase() === name.trim().toLowerCase()

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-3 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/15 transition-all"
      >
        Delete
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={close}
        >
          <div
            className="bg-[#0f0f0f] border border-red-500/25 rounded-2xl p-6 max-w-md w-full shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-3xl text-center mb-4">🗑️</div>
            <h2 className="text-white text-lg font-semibold text-center mb-2">Delete Restaurant?</h2>
            <p className="text-white/50 text-sm text-center mb-2 leading-relaxed">
              <span className="text-white/80 font-medium">{name}</span> will be permanently deleted
              in <span className="text-red-400 font-medium">15 days</span>.
              All menu items and categories will be removed.
            </p>
            <p className="text-white/35 text-xs text-center mb-6">
              You can cancel this during the 15-day window from the Restaurants page.
            </p>

            <div className="mb-5">
              <label className="block text-sm text-white/50 mb-1.5">
                Type <span className="text-white/80 font-mono bg-white/5 px-1.5 py-0.5 rounded">{name}</span> to confirm
              </label>
              <input
                type="text"
                value={inputName}
                onChange={e => setInputName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && confirmed && !loading && handleDelete()}
                placeholder={name}
                className="w-full px-4 py-3 text-sm rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-red-500/50 transition-all"
                autoFocus
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={close}
                disabled={loading}
                className="flex-1 py-2.5 text-sm rounded-lg bg-white/[0.04] text-white/50 hover:text-white/70 hover:bg-white/[0.07] disabled:opacity-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={!confirmed || loading}
                className="flex-1 py-2.5 text-sm font-semibold rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                {loading ? 'Scheduling…' : 'Schedule Deletion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
