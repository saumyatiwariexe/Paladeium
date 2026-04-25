'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

async function safeJson(res: Response) {
  const text = await res.text().catch(() => '')
  if (!text.trim()) return {}
  try { return JSON.parse(text) } catch { return {} }
}

export default function NewRestaurantPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', slug: '', description: '', status: 'active' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleName(name: string) {
    setForm(f => ({ ...f, name, slug: slugify(name) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.slug.trim()) {
      setError('Name and slug are required')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await safeJson(res)
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Failed to create restaurant')
      router.push(`/restaurants/${(data as { id: string }).id}/menu`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 sm:p-8 max-w-xl">
      <div className="flex items-center gap-3 mb-8 flex-wrap">
        <Link href="/restaurants" className="text-white/30 hover:text-white/60 transition-colors text-sm">
          ← Restaurants
        </Link>
        <span className="text-white/20">/</span>
        <span className="text-white/60 text-sm">New Restaurant</span>
      </div>

      <h1 className="text-2xl font-semibold text-white mb-1">Add Restaurant</h1>
      <p className="text-white/40 text-sm mb-8">Create a new restaurant profile. You&apos;ll add menu items next.</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm text-white/60 font-medium mb-1.5">Restaurant Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => handleName(e.target.value)}
            placeholder="e.g. The Grand Spice"
            className="w-full px-4 py-3 text-sm rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-[#D4A853]/50 transition-all"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm text-white/60 font-medium mb-1.5">URL Slug *</label>
          <div className="flex items-center gap-2">
            <span className="text-white/25 text-sm font-mono shrink-0">…/r/</span>
            <input
              type="text"
              value={form.slug}
              onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
              placeholder="the-grand-spice"
              className="flex-1 px-4 py-3 text-sm rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-[#D4A853]/50 font-mono transition-all"
            />
          </div>
          <p className="text-white/25 text-xs mt-1.5">Auto-generated. Lowercase letters, numbers, hyphens only.</p>
        </div>

        <div>
          <label className="block text-sm text-white/60 font-medium mb-1.5">Description</label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="One line about the restaurant…"
            rows={2}
            className="w-full px-4 py-3 text-sm rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-[#D4A853]/50 resize-none transition-all"
          />
        </div>

        <div>
          <label className="block text-sm text-white/60 font-medium mb-1.5">Status</label>
          <select
            value={form.status}
            onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
            className="w-full px-4 py-3 text-sm rounded-lg bg-white/[0.04] border border-white/10 text-white focus:outline-none focus:border-[#D4A853]/50 transition-all"
          >
            <option value="active">Active — AR link is live</option>
            <option value="pending">Pending — setting up</option>
            <option value="inactive">Inactive — hidden</option>
          </select>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Link
            href="/restaurants"
            className="px-5 py-2.5 text-sm rounded-lg bg-white/[0.04] text-white/50 hover:text-white/70 hover:bg-white/[0.07] transition-all"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || !form.name || !form.slug}
            className="flex-1 py-2.5 text-sm font-semibold rounded-lg bg-[#D4A853] text-black hover:bg-[#E8C06D] disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
          >
            {loading ? 'Creating…' : 'Create & Add Menu Items →'}
          </button>
        </div>
      </form>
    </div>
  )
}
