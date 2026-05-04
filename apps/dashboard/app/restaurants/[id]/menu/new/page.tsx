'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const DIETARY = ['veg', 'vegan', 'non-veg', 'jain', 'gluten-free', 'dairy-free']

interface Category { id: string; name: string; emoji: string }
interface ItemData {
  name: string; description: string; price: string; emoji: string
  categoryId: string; newCategoryName: string; newCategoryEmoji: string
  modelUrl: string; modelScale: string; hasAr: boolean; dietaryTags: string[]; available: boolean
}

async function safeJson(res: Response) {
  const text = await res.text().catch(() => '')
  if (!text.trim()) return {}
  try { return JSON.parse(text) } catch { return {} }
}

export default function NewMenuItemPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')

  const [categories, setCategories] = useState<Category[]>([])
  const [restaurantSlug, setRestaurantSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<ItemData>({
    name: '', description: '', price: '', emoji: '',
    categoryId: '', newCategoryName: '', newCategoryEmoji: '',
    modelUrl: '', modelScale: '', hasAr: false, dietaryTags: [], available: true,
  })

  useEffect(() => {
    fetch(`/api/restaurants/${id}`)
      .then(r => safeJson(r))
      .then((data: unknown) => {
        const d = data as { categories?: Category[]; restaurant?: { slug: string } }
        setCategories(d.categories ?? [])
        setRestaurantSlug(d.restaurant?.slug ?? '')
        setForm(f => ({
          ...f,
          categoryId: d.categories?.length ? d.categories![0].id : '__new__',
        }))
      })
    if (editId) {
      fetch(`/api/restaurants/${id}/menu/${editId}`)
        .then(r => safeJson(r))
        .then((item: unknown) => {
          const i = item as { name?: string; description?: string; price?: number; emoji?: string; categoryId?: string; modelUrl?: string; modelScale?: number; hasAr?: boolean; dietaryTags?: string[]; available?: boolean }
          if (i?.name) {
            setForm(f => ({
              ...f,
              name: i.name!, description: i.description ?? '', price: String(i.price ?? ''),
              emoji: i.emoji ?? '', categoryId: i.categoryId ?? '', modelUrl: i.modelUrl ?? '',
              modelScale: i.modelScale !== undefined && i.modelScale !== null ? String(i.modelScale) : '',
              hasAr: i.hasAr ?? false, dietaryTags: i.dietaryTags ?? [], available: i.available ?? true,
            }))
          }
        })
    }
  }, [id, editId])

  function toggleDiet(tag: string) {
    setForm(f => ({
      ...f,
      dietaryTags: f.dietaryTags.includes(tag)
        ? f.dietaryTags.filter(t => t !== tag)
        : [...f.dietaryTags, tag],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    if (!form.price || isNaN(Number(form.price))) { setError('Valid price is required'); return }
    setLoading(true)
    setError('')

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      emoji: form.emoji.trim(),
      categoryId: form.categoryId,
      newCategoryName: form.newCategoryName.trim(),
      newCategoryEmoji: form.newCategoryEmoji.trim(),
      modelUrl: form.modelUrl.trim(),
      modelScale: form.modelScale ? Number(form.modelScale) : undefined,
      hasAr: form.hasAr,
      dietaryTags: form.dietaryTags,
      available: form.available,
    }

    try {
      const url = editId
        ? `/api/restaurants/${id}/menu/${editId}`
        : `/api/restaurants/${id}/menu`
      const res = await fetch(url, {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await safeJson(res) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed to save item')
      router.push(`/restaurants/${id}/menu`)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full px-4 py-3 text-sm rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-[#D4A853]/50 transition-all'

  return (
    <div className="p-4 sm:p-8 max-w-xl">
      <div className="flex items-center gap-2 text-sm mb-8 flex-wrap">
        <Link href="/restaurants" className="text-white/30 hover:text-white/60 transition-colors">Restaurants</Link>
        <span className="text-white/20">/</span>
        <Link href={`/restaurants/${id}/menu`} className="text-white/30 hover:text-white/60 transition-colors">Menu</Link>
        <span className="text-white/20">/</span>
        <span className="text-[#D4A853]">{editId ? 'Edit Item' : 'New Item'}</span>
      </div>

      <h1 className="text-2xl font-semibold text-white mb-1">{editId ? 'Edit Menu Item' : 'Add Menu Item'}</h1>
      <p className="text-white/40 text-sm mb-8">
        {editId ? 'Update this dish.' : 'Add a new dish. Enable AR to show a 3D model.'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Category */}
        <div>
          <label className="block text-sm text-white/60 font-medium mb-1.5">Category</label>
          <select
            value={form.categoryId}
            onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
            className={inputCls}
          >
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
            ))}
            <option value="__new__">+ Create new category…</option>
          </select>
        </div>

        {form.categoryId === '__new__' && (
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 space-y-3">
            <p className="text-white/50 text-xs font-medium uppercase tracking-wider">New Category</p>
            <div className="flex gap-3">
              <input
                type="text"
                value={form.newCategoryEmoji}
                onChange={e => setForm(f => ({ ...f, newCategoryEmoji: e.target.value }))}
                placeholder="Icon"
                className="w-14 px-3 py-2.5 text-center text-lg rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-white/30 placeholder:text-sm"
              />
              <input
                type="text"
                value={form.newCategoryName}
                onChange={e => setForm(f => ({ ...f, newCategoryName: e.target.value }))}
                placeholder="e.g. Grills"
                className="flex-1 px-4 py-2.5 text-sm rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-white/20"
              />
            </div>
          </div>
        )}

        {/* Emoji + Name */}
        <div className="flex gap-3">
          <div>
            <label className="block text-sm text-white/60 font-medium mb-1.5">Icon</label>
            <input
              type="text"
              value={form.emoji}
              onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))}
              placeholder=""
              className="w-16 px-3 py-3 text-center text-xl rounded-lg bg-white/[0.04] border border-white/10 text-white"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm text-white/60 font-medium mb-1.5">Dish Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Wagyu Smash Burger"
              className={inputCls}
              autoFocus={!editId}
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm text-white/60 font-medium mb-1.5">Description</label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Short description…"
            rows={2}
            className="w-full px-4 py-3 text-sm rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-[#D4A853]/50 resize-none transition-all"
          />
        </div>

        {/* Price */}
        <div>
          <label className="block text-sm text-white/60 font-medium mb-1.5">Price (₹)</label>
          <div className="flex items-center gap-2">
            <span className="text-white/30 font-medium">₹</span>
            <input
              type="number"
              value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
              placeholder="649"
              min={0}
              className="w-36 px-4 py-3 text-sm rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-[#D4A853]/50 transition-all"
            />
          </div>
        </div>

        {/* Dietary */}
        <div>
          <label className="block text-sm text-white/60 font-medium mb-2">Dietary Tags</label>
          <div className="flex flex-wrap gap-2">
            {DIETARY.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleDiet(tag)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                  form.dietaryTags.includes(tag)
                    ? 'bg-[#D4A853]/15 text-[#D4A853] border-[#D4A853]/30'
                    : 'bg-white/[0.04] text-white/40 border-white/[0.08] hover:border-white/20'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* AR toggle */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-white/80 text-sm font-medium">Enable AR (3D Model)</p>
              <p className="text-white/35 text-xs mt-0.5">Customer views a 3D model in AR</p>
            </div>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, hasAr: !f.hasAr }))}
              className={`w-11 h-6 rounded-full transition-all relative shrink-0 ${form.hasAr ? 'bg-[#D4A853]' : 'bg-white/10'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${form.hasAr ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
          {form.hasAr && (
            <div>
              <label className="block text-xs text-white/40 font-medium mb-1.5">3D Model (GLB filename or URL)</label>
              <input
                type="text"
                value={form.modelUrl}
                onChange={e => setForm(f => ({ ...f, modelUrl: e.target.value }))}
                placeholder="burger.glb or https://cdn.example.com/model.glb"
                className="w-full px-4 py-2.5 text-xs rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-white/20 font-mono mb-3"
              />
              <p className="text-white/25 text-[10px] mt-1 mb-4">
                Drop the GLB into <code className="font-mono">restaurants/{restaurantSlug || id}/models/</code> and enter the filename here, or paste a full https:// URL.
              </p>

              <label className="block text-xs text-white/40 font-medium mb-1.5">Model Scale</label>
              <input
                type="number"
                step="0.001"
                value={form.modelScale}
                onChange={e => setForm(f => ({ ...f, modelScale: e.target.value }))}
                placeholder="e.g. 1.0"
                className="w-32 px-4 py-2.5 text-xs rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-white/20 font-mono"
              />
              <p className="text-white/25 text-[10px] mt-1">Scale multiplier for the AR dish. Default is auto-scaled.</p>
            </div>
          )}
        </div>

        {/* Availability */}
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-white/60 text-sm font-medium">Available</p>
            <p className="text-white/30 text-xs">Hide if temporarily unavailable</p>
          </div>
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, available: !f.available }))}
            className={`w-11 h-6 rounded-full transition-all relative shrink-0 ${form.available ? 'bg-emerald-500' : 'bg-white/10'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${form.available ? 'left-5' : 'left-0.5'}`} />
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Link
            href={`/restaurants/${id}/menu`}
            className="px-5 py-2.5 text-sm rounded-lg bg-white/[0.04] text-white/50 hover:text-white/70 hover:bg-white/[0.07] transition-all"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || !form.name || !form.price}
            className="flex-1 py-2.5 text-sm font-semibold rounded-lg bg-[#D4A853] text-black hover:bg-[#E8C06D] disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
          >
            {loading ? 'Saving…' : editId ? 'Save Changes' : 'Add to Menu'}
          </button>
        </div>
      </form>
    </div>
  )
}
