import { readDb } from '@/lib/db'
import Link from 'next/link'

const LENS_URL = process.env.LENS_URL ?? 'http://localhost:3001'

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    pending:  'bg-amber-500/10   text-amber-400   border-amber-500/20',
    inactive: 'bg-red-500/10    text-red-400      border-red-500/20',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${map[status] ?? map.inactive}`}>
      {status}
    </span>
  )
}

export default async function RestaurantsPage() {
  const db = await readDb()
  const restaurants = db.restaurants.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Restaurants</h1>
          <p className="text-white/40 text-sm mt-1">
            {restaurants.length} restaurant{restaurants.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <Link
          href="/restaurants/new"
          className="flex items-center gap-2 bg-[#D4A853] text-black text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-[#E8C06D] active:scale-95 transition-all"
        >
          <span>+</span> Add Restaurant
        </Link>
      </div>

      {/* Empty state */}
      {restaurants.length === 0 && (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="text-5xl mb-4">🏪</div>
          <p className="text-white/50 text-lg font-medium">No restaurants yet</p>
          <p className="text-white/30 text-sm mt-1 mb-6">Add your first restaurant to start building AR menus</p>
          <Link
            href="/restaurants/new"
            className="bg-[#D4A853] text-black text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-[#E8C06D] transition-colors"
          >
            Add Restaurant
          </Link>
        </div>
      )}

      {/* Restaurant grid */}
      {restaurants.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {restaurants.map(r => {
            const items    = db.items.filter(i => i.restaurantId === r.id)
            const arItems  = items.filter(i => i.hasAr).length
            const cats     = db.categories.filter(c => c.restaurantId === r.id)
            const arLink   = `${LENS_URL}?r=${r.slug}`

            return (
              <div
                key={r.id}
                className="group bg-white/[0.025] border border-white/[0.07] rounded-xl p-5 hover:border-[#D4A853]/30 hover:bg-white/[0.04] transition-all"
              >
                {/* Title row */}
                <div className="flex items-start justify-between mb-1">
                  <h3 className="font-semibold text-white group-hover:text-[#F0EDE8] transition-colors">
                    {r.name}
                  </h3>
                  <StatusBadge status={r.status} />
                </div>

                {/* Slug */}
                <p className="text-[#D4A853]/60 text-xs font-mono mb-2">/{r.slug}</p>

                {/* Description */}
                {r.description && (
                  <p className="text-white/40 text-xs mb-3 line-clamp-1">{r.description}</p>
                )}

                {/* Stats */}
                <div className="flex gap-3 text-xs text-white/35 mb-4 py-3 border-y border-white/[0.06]">
                  <span>{cats.length} categor{cats.length !== 1 ? 'ies' : 'y'}</span>
                  <span>·</span>
                  <span>{items.length} item{items.length !== 1 ? 's' : ''}</span>
                  {arItems > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-[#D4A853]/70">{arItems} AR</span>
                    </>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Link
                    href={`/restaurants/${r.id}/menu`}
                    className="flex-1 text-center text-xs font-medium py-2 rounded-lg bg-white/[0.05] text-white/60 hover:bg-white/[0.09] hover:text-white transition-all"
                  >
                    Manage Menu
                  </Link>
                  <a
                    href={arLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-[#D4A853]/10 text-[#D4A853] hover:bg-[#D4A853]/20 transition-colors border border-[#D4A853]/15"
                  >
                    <span>↗</span> AR Preview
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
