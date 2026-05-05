'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Copy, CheckCircle2 } from 'lucide-react'

function slugify(text: string) {
  return text.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-')
}

export default function NewRestaurantPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '', slug: '', description: '', status: 'active', ownerEmail: '',
  })
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [inviteUrl, setInviteUrl] = useState('')
  const [copied,    setCopied]    = useState(false)

  function handleName(name: string) {
    setForm(f => ({ ...f, name, slug: slugify(name) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.slug.trim()) { setError('Name and slug are required'); return }
    setLoading(true); setError('')
    try {
      const res  = await fetch('/api/restaurants', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({})) as { id?: string; inviteUrl?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed to create restaurant')
      if (data.inviteUrl) {
        setInviteUrl(data.inviteUrl)
      } else {
        router.push(`/restaurants/${data.id}/menu`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true); setTimeout(() => setCopied(false), 2500)
  }

  // ── Invite sent confirmation ─────────────────────────────────
  if (inviteUrl) return (
    <div className="p-8 max-w-xl">
      <div className="bg-[#13151E] border border-white/[0.07] rounded-2xl p-8 text-center">
        <CheckCircle2 size={44} className="text-[#22C55E] mx-auto mb-4" />
        <h2 className="text-[#E8EAFF] font-black text-xl mb-2">Restaurant created!</h2>
        <p className="text-[#8B90B0] text-sm mb-6">
          An invite was sent to <strong className="text-[#E8EAFF]">{form.ownerEmail}</strong>.
          Share this link if the email doesn't arrive.
        </p>
        <div className="bg-[#1A1D2A] border border-white/[0.07] rounded-xl px-4 py-3 flex items-center gap-3 mb-6 text-left">
          <p className="flex-1 text-[#8B90B0] text-xs font-mono truncate">{inviteUrl}</p>
          <button onClick={copyInvite}
            className="shrink-0 text-[#7C5CFC] hover:text-[#A78BFA] transition-colors">
            {copied ? <CheckCircle2 size={16} className="text-[#22C55E]" /> : <Copy size={16} />}
          </button>
        </div>
        <Link href="/restaurants"
          className="inline-flex items-center justify-center h-11 px-6 bg-[#7C5CFC] hover:bg-[#8D6FFD] text-white font-bold text-sm rounded-xl transition-all">
          Back to restaurants
        </Link>
      </div>
    </div>
  )

  // ── Form ─────────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-xl">
      <div className="flex items-center gap-2 text-sm mb-8">
        <Link href="/restaurants" className="text-[#4B4F65] hover:text-[#8B90B0] transition-colors">Restaurants</Link>
        <span className="text-[#4B4F65]">/</span>
        <span className="text-[#8B90B0]">New Restaurant</span>
      </div>

      <h1 className="text-[#E8EAFF] font-black text-2xl mb-1">Add Restaurant</h1>
      <p className="text-[#8B90B0] text-sm mb-8">Create a restaurant and optionally invite an owner.</p>

      <form onSubmit={handleSubmit} className="space-y-5">

        <div>
          <label className="block text-[#8B90B0] text-xs font-semibold uppercase tracking-wider mb-1.5">Restaurant Name *</label>
          <input type="text" value={form.name} onChange={e => handleName(e.target.value)}
            placeholder="The Grand Spice" autoFocus
            className="w-full px-4 py-3 text-sm rounded-xl bg-[#13151E] border border-white/[0.07] text-[#E8EAFF] placeholder-[#4B4F65] focus:outline-none focus:border-[#7C5CFC]/50 transition-all" />
        </div>

        <div>
          <label className="block text-[#8B90B0] text-xs font-semibold uppercase tracking-wider mb-1.5">URL Slug *</label>
          <div className="flex items-center gap-2 bg-[#13151E] border border-white/[0.07] rounded-xl px-4 focus-within:border-[#7C5CFC]/50 transition-all">
            <span className="text-[#4B4F65] text-sm font-mono shrink-0">…/r/</span>
            <input type="text" value={form.slug}
              onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
              placeholder="the-grand-spice"
              className="flex-1 py-3 text-sm bg-transparent text-[#E8EAFF] placeholder-[#4B4F65] focus:outline-none font-mono" />
          </div>
        </div>

        <div>
          <label className="block text-[#8B90B0] text-xs font-semibold uppercase tracking-wider mb-1.5">Description</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="One line about the restaurant…" rows={2}
            className="w-full px-4 py-3 text-sm rounded-xl bg-[#13151E] border border-white/[0.07] text-[#E8EAFF] placeholder-[#4B4F65] focus:outline-none focus:border-[#7C5CFC]/50 resize-none transition-all" />
        </div>

        <div>
          <label className="block text-[#8B90B0] text-xs font-semibold uppercase tracking-wider mb-1.5">Status</label>
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
            className="w-full px-4 py-3 text-sm rounded-xl bg-[#13151E] border border-white/[0.07] text-[#E8EAFF] focus:outline-none focus:border-[#7C5CFC]/50 transition-all">
            <option value="active">Active — AR link is live</option>
            <option value="pending">Pending — setting up</option>
            <option value="inactive">Inactive — hidden</option>
          </select>
        </div>

        {/* Owner invite */}
        <div className="bg-[#13151E] border border-white/[0.07] rounded-xl p-4">
          <label className="block text-[#8B90B0] text-xs font-semibold uppercase tracking-wider mb-1">
            Owner Email <span className="normal-case font-normal text-[#4B4F65]">(optional)</span>
          </label>
          <p className="text-[#4B4F65] text-xs mb-2.5">
            An invitation link will be emailed so they can set their password and manage this restaurant.
          </p>
          <input type="email" value={form.ownerEmail}
            onChange={e => setForm(f => ({ ...f, ownerEmail: e.target.value }))}
            placeholder="owner@restaurant.com"
            className="w-full px-4 py-3 text-sm rounded-xl bg-[#1A1D2A] border border-white/[0.07] text-[#E8EAFF] placeholder-[#4B4F65] focus:outline-none focus:border-[#7C5CFC]/50 transition-all" />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>
        )}

        <div className="flex gap-3 pt-1">
          <Link href="/restaurants"
            className="px-5 py-3 text-sm rounded-xl bg-[#13151E] border border-white/[0.07] text-[#8B90B0] hover:text-[#E8EAFF] transition-all">
            Cancel
          </Link>
          <button type="submit" disabled={loading || !form.name || !form.slug}
            className="flex-1 py-3 text-sm font-bold rounded-xl bg-[#7C5CFC] hover:bg-[#8D6FFD] disabled:opacity-40 disabled:cursor-not-allowed text-white active:scale-[0.98] transition-all">
            {loading ? 'Creating…' : form.ownerEmail ? 'Create & Send Invite →' : 'Create Restaurant →'}
          </button>
        </div>
      </form>
    </div>
  )
}
