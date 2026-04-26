import { readDb, purgeExpiredDeletions } from '@/lib/db'
import Link from 'next/link'
import { Store, ExternalLink, AlertTriangle, Plus } from 'lucide-react'
import DeleteRestaurantButton from './DeleteRestaurantButton'
import CancelDeletionButton from './CancelDeletionButton'

const LENS_URL = process.env.LENS_URL ?? 'http://localhost:3001'

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:          'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    pending:         'bg-amber-500/10   text-amber-400   border-amber-500/20',
    inactive:        'bg-red-500/10     text-red-400     border-red-500/20',
    pendingDeletion: 'bg-red-500/20     text-red-300     border-red-500/30',
  }
  const labels: Record<string, string> = { pendingDeletion: 'deleting soon' }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${map[status] ?? map.inactive}`}>
      {labels[status] ?? status}
    </span>
  )
}

function daysLeft(deleteAt: string): number {
  return Math.max(0, Math.ceil((new Date(deleteAt).getTime() - Date.now()) / 86_400_000))
}

export default async function RestaurantsPage() {
  await purgeExpiredDeletions()
  const db = await readDb()
  const restaurants = db.restaurants.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return (
    <div className="p-8 max-w-6xl">
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
          <Plus className="size-4" /> Add Restaurant
        </Link>
      </div>

      {restaurants.length === 0 && (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <Store className="size-12 text-white/15 mb-5" />
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

      {restaurants.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {restaurants.map(r => {
            const items   = db.items.filter(i => i.restaurantId === r.id)
            const arItems = items.filter(i => i.hasAr).length
            const cats    = db.categories.filter(c => c.restaurantId === r.id)
            const arLink  = `${LENS_URL}?r=${r.slug}`
            const isPendingDeletion = r.status === 'pendingDeletion'
            const days = isPendingDeletion && r.deleteAt ? daysLeft(r.deleteAt) : null

            return (
              <div
                key={r.id}
                className={`group rounded-xl p-5 border transition-all ${
                  isPendingDeletion
                    ? 'bg-red-500/[0.04] border-red-500/25 hover:border-red-500/40'
                    : 'bg-white/[0.025] border-white/[0.07] hover:border-[#D4A853]/30 hover:bg-white/[0.04]'
                }`}
              >
                {isPendingDeletion && days !== null && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">
                    <AlertTriangle className="size-3.5 text-red-400 shrink-0" />
                    <p className="text-red-400 text-xs flex-1">
                      Scheduled for deletion in <strong>{days} day{days !== 1 ? 's' : ''}</strong>
                    </p>
                  </div>
                )}

                <div className="flex items-start justify-between mb-1">
                  <h3 className={`font-semibold transition-colors ${isPendingDeletion ? 'text-white/50' : 'text-white group-hover:text-[#F0EDE8]'}`}>
                    {r.name}
                  </h3>
                  <StatusBadge status={r.status} />
                </div>

                <p className="text-[#D4A853]/60 text-xs font-mono mb-2">/{r.slug}</p>

                {r.description && (
                  <p className="text-white/40 text-xs mb-3 line-clamp-1">{r.description}</p>
                )}

                <div className="flex gap-3 text-xs text-white/35 mb-4 py-3 border-y border-white/[0.06]">
                  <span>{cats.length} categor{cats.length !== 1 ? 'ies' : 'y'}</span>
                  <span className="text-white/15">·</span>
                  <span>{items.length} item{items.length !== 1 ? 's' : ''}</span>
                  {arItems > 0 && (
                    <>
                      <span className="text-white/15">·</span>
                      <span className="text-[#D4A853]/70">{arItems} AR</span>
                    </>
                  )}
                </div>

                {isPendingDeletion ? (
                  <div className="flex gap-2">
                    <CancelDeletionButton id={r.id} />
                  </div>
                ) : (
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
                      AR Preview <ExternalLink className="size-3" />
                    </a>
                    <DeleteRestaurantButton id={r.id} name={r.name} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
