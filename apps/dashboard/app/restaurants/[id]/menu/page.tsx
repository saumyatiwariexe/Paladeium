import { readDb } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import CopyButton from './CopyButton'
import DeleteItemButton from './DeleteItemButton'
import ToggleAvailableButton from './ToggleAvailableButton'

const LENS_URL = process.env.LENS_URL ?? 'http://localhost:3001'

function DietaryTag({ tag }: { tag: string }) {
  const map: Record<string, string> = {
    veg:      'bg-green-500/10 text-green-400',
    vegan:    'bg-teal-500/10  text-teal-400',
    'non-veg':'bg-red-500/10   text-red-400',
    jain:     'bg-purple-500/10 text-purple-400',
  }
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${map[tag] ?? 'bg-white/10 text-white/40'}`}>
      {tag}
    </span>
  )
}

export default async function MenuPage({ params }: { params: { id: string } }) {
  const db = await readDb()
  const restaurant = db.restaurants.find(r => r.id === params.id)
  if (!restaurant) notFound()

  const categories = db.categories
    .filter(c => c.restaurantId === params.id)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const items = db.items.filter(i => i.restaurantId === params.id)
  const arCount = items.filter(i => i.hasAr).length

  return (
    <div className="p-8 max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-6">
        <Link href="/restaurants" className="text-white/30 hover:text-white/60 transition-colors">
          Restaurants
        </Link>
        <span className="text-white/20">/</span>
        <span className="text-white/60">{restaurant.name}</span>
        <span className="text-white/20">/</span>
        <span className="text-[#D4A853]">Menu</span>
      </div>

      {/* Header row */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">{restaurant.name}</h1>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-white/40 text-sm">{items.length} items</span>
            {arCount > 0 && (
              <span className="text-[#D4A853]/70 text-xs font-medium px-2 py-0.5 rounded-full bg-[#D4A853]/10 border border-[#D4A853]/15">
                {arCount} AR enabled
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`${LENS_URL}?r=${restaurant.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-[#D4A853]/10 text-[#D4A853] hover:bg-[#D4A853]/20 transition-colors border border-[#D4A853]/15"
          >
            ↗ View AR Lens
          </a>
          <Link
            href={`/restaurants/${params.id}/menu/new`}
            className="flex items-center gap-1.5 bg-[#D4A853] text-black text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#E8C06D] active:scale-95 transition-all"
          >
            + Add Item
          </Link>
        </div>
      </div>

      {/* AR Link copy box */}
      <div className="bg-[#D4A853]/5 border border-[#D4A853]/15 rounded-xl p-4 mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-[#D4A853] text-xs font-semibold mb-0.5 uppercase tracking-wider">AR Menu Link</p>
          <code className="text-white/60 text-xs">{LENS_URL}?r={restaurant.slug}</code>
        </div>
        <CopyButton text={`${LENS_URL}?r=${restaurant.slug}`} />
      </div>

      {/* Empty state */}

      {items.length === 0 && (
        <div className="flex flex-col items-center py-24 text-center">
          <div className="text-4xl mb-4">🍽</div>
          <p className="text-white/50 font-medium">No menu items yet</p>
          <p className="text-white/30 text-sm mt-1 mb-5">Add dishes so customers can browse and order via AR</p>
          <Link
            href={`/restaurants/${params.id}/menu/new`}
            className="bg-[#D4A853] text-black text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-[#E8C06D] transition-colors"
          >
            + Add First Item
          </Link>
        </div>
      )}

      {/* Items grouped by category */}
      {categories.map(cat => {
        const catItems = items.filter(i => i.categoryId === cat.id)
        if (catItems.length === 0) return null
        return (
          <div key={cat.id} className="mb-8">
            <h2 className="text-white/70 text-sm font-semibold uppercase tracking-widest mb-3 flex items-center gap-2">
              <span>{cat.emoji}</span> {cat.name}
              <span className="text-white/25 font-normal normal-case tracking-normal text-xs">({catItems.length})</span>
            </h2>
            <div className="space-y-2">
              {catItems.map(item => (
                <div
                  key={item.id}
                  className={`group flex items-center gap-4 p-4 rounded-xl border transition-all ${
                    item.available
                      ? 'bg-white/[0.025] border-white/[0.07] hover:border-white/[0.12]'
                      : 'bg-white/[0.01] border-white/[0.04] opacity-50'
                  }`}
                >
                  {/* Emoji */}
                  <div className="text-2xl w-10 text-center shrink-0">{item.emoji || '🍽'}</div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-white text-sm">{item.name}</span>
                      {item.hasAr && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#D4A853]/20 text-[#D4A853] border border-[#D4A853]/25">
                          AR
                        </span>
                      )}
                      {item.dietaryTags.map(t => <DietaryTag key={t} tag={t} />)}
                    </div>
                    <p className="text-white/35 text-xs mt-0.5 truncate">{item.description}</p>
                  </div>

                  {/* Price */}
                  <div className="text-white/80 font-semibold text-sm shrink-0">₹{item.price}</div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <ToggleAvailableButton
                      restaurantSlug={restaurant.slug}
                      itemId={item.id}
                      available={item.available}
                    />
                    <Link
                      href={`/restaurants/${params.id}/menu/new?edit=${item.id}`}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-white/[0.05] text-white/50 hover:text-white hover:bg-white/[0.1] transition-all"
                    >
                      Edit
                    </Link>
                    <DeleteItemButton
                      restaurantSlug={restaurant.slug}
                      itemId={item.id}
                      itemName={item.name}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Items without a category */}
      {(() => {
        const catIds = new Set(categories.map(c => c.id))
        const uncategorised = items.filter(i => !catIds.has(i.categoryId))
        if (uncategorised.length === 0) return null
        return (
          <div className="mb-8">
            <h2 className="text-white/40 text-sm font-semibold uppercase tracking-widest mb-3">Uncategorised</h2>
            <div className="space-y-2">
              {uncategorised.map(item => (
                <div key={item.id} className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.025] border border-white/[0.07]">
                  <div className="text-2xl w-10 text-center">{item.emoji || '🍽'}</div>
                  <div className="flex-1">
                    <span className="font-medium text-white text-sm">{item.name}</span>
                    <p className="text-white/35 text-xs mt-0.5">{item.description}</p>
                  </div>
                  <div className="text-white/80 font-semibold text-sm">₹{item.price}</div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

