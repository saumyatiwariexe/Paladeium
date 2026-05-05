'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  UtensilsCrossed, BarChart2, Target, Settings2, Users,
  ShoppingBag, LogOut, Plus, Home, ChevronRight,
} from 'lucide-react'
import type { Restaurant } from '@/lib/types'
import type { SessionData } from '@/lib/session'

interface Props {
  restaurants: Restaurant[]
  session: Pick<SessionData, 'userId' | 'role' | 'restaurantIds' | 'email'>
  children: React.ReactNode
}

const NAV = [
  { label: 'Menu',        href: (id: string) => `/restaurants/${id}/menu`,      icon: UtensilsCrossed },
  { label: 'Analytics',   href: (id: string) => `/restaurants/${id}/analytics`, icon: BarChart2 },
  { label: 'Orders',      href: (id: string) => `/restaurants/${id}/orders`,    icon: ShoppingBag },
  { label: 'AR Marker',   href: (id: string) => `/restaurants/${id}/marker`,    icon: Target },
  { label: 'Team',        href: (id: string) => `/restaurants/${id}/team`,      icon: Users },
  { label: 'Settings',    href: (id: string) => `/restaurants/${id}/settings`,  icon: Settings2 },
]

// Staff can only see Menu & Orders
const STAFF_ONLY = new Set(['Menu', 'Orders'])
// Manager cannot see Settings
const MANAGER_HIDDEN = new Set(['Settings'])

function RestaurantIcon({ name, active }: { name: string; active: boolean }) {
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  return (
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-[13px] font-black transition-all
      ${active
        ? 'bg-[#7C5CFC] text-white rounded-[14px]'
        : 'bg-[#1A1D2A] text-[#8B90B0] hover:bg-[#252840] hover:text-[#E8EAFF] hover:rounded-[14px]'
      }`}>
      {initials || '?'}
    </div>
  )
}

export default function AppShell({ restaurants, session, children }: Props) {
  const pathname = usePathname()
  const router   = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  // Determine active restaurant from URL
  const activeId  = pathname.match(/^\/restaurants\/([^/]+)/)?.[1]
  const activeRest = restaurants.find(r => r.id === activeId)

  // Visible restaurants: superadmin sees all, others see only theirs
  const visibleRests = session.role === 'superadmin'
    ? restaurants
    : restaurants.filter(r => session.restaurantIds?.includes(r.id))

  // Filter nav items by role
  function visibleNav(role: string | undefined) {
    return NAV.filter(item => {
      if (role === 'staff')   return STAFF_ONLY.has(item.label)
      if (role === 'manager') return !MANAGER_HIDDEN.has(item.label)
      return true
    })
  }

  async function handleLogout() {
    setLoggingOut(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex h-screen bg-[#0B0C10] text-[#E8EAFF] overflow-hidden">

      {/* ── Icon Rail (68px) ───────────────────────────────────── */}
      <div className="w-[68px] shrink-0 bg-[#0F1117] border-r border-white/[0.05] flex flex-col items-center py-3 gap-1 overflow-y-auto">

        {/* Home / Company (superadmin only) */}
        {session.role === 'superadmin' && (
          <Link href="/company" className="mb-2">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all
              ${pathname.startsWith('/company')
                ? 'bg-[#7C5CFC] rounded-[14px]'
                : 'bg-[#1A1D2A] hover:bg-[#252840] hover:rounded-[14px]'
              }`}>
              <Home size={18} className={pathname.startsWith('/company') ? 'text-white' : 'text-[#8B90B0]'} />
            </div>
          </Link>
        )}

        {/* Divider */}
        {session.role === 'superadmin' && <div className="w-8 h-px bg-white/[0.06] my-1" />}

        {/* Restaurant icons */}
        {visibleRests.map(r => (
          <Link key={r.id} href={`/restaurants/${r.id}/menu`} title={r.name}>
            <RestaurantIcon name={r.name} active={r.id === activeId} />
          </Link>
        ))}

        {/* Add restaurant (superadmin only) */}
        {session.role === 'superadmin' && (
          <>
            <div className="w-8 h-px bg-white/[0.06] my-1" />
            <Link href="/restaurants/new" title="Add restaurant">
              <div className="w-12 h-12 rounded-2xl bg-[#1A1D2A] hover:bg-[#252840] hover:rounded-[14px] flex items-center justify-center transition-all">
                <Plus size={18} className="text-[#8B90B0]" />
              </div>
            </Link>
          </>
        )}

        {/* Spacer + logout */}
        <div className="flex-1" />
        <button onClick={handleLogout} disabled={loggingOut} title="Sign out"
          className="w-12 h-12 rounded-2xl hover:bg-red-500/10 flex items-center justify-center transition-all mb-1">
          <LogOut size={16} className="text-[#4B4F65] hover:text-red-400" />
        </button>
      </div>

      {/* ── Left Panel (220px) ────────────────────────────────────── */}
      <div className="w-[220px] shrink-0 bg-[#0F1117] border-r border-white/[0.05] flex flex-col overflow-hidden">

        {/* Workspace header */}
        <div className="px-4 pt-5 pb-4 border-b border-white/[0.05]">
          {activeRest ? (
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  activeRest.status === 'active'  ? 'bg-[#22C55E]' :
                  activeRest.status === 'pending' ? 'bg-[#F59E0B]' : 'bg-[#4B4F65]'
                }`} />
                <p className="text-[#E8EAFF] font-black text-[13px] truncate">{activeRest.name}</p>
              </div>
              <p className="text-[#4B4F65] text-[10px] font-mono pl-4">/{activeRest.slug}</p>
            </div>
          ) : (
            <div>
              <p className="text-[#E8EAFF] font-black text-[13px]">
                {session.role === 'superadmin' ? 'Paladeium' : 'Dashboard'}
              </p>
              <p className="text-[#4B4F65] text-[10px] mt-0.5 capitalize">{session.role}</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {activeRest ? (
            <>
              <p className="text-[#4B4F65] text-[9px] font-black uppercase tracking-[0.15em] px-3 pb-1 pt-1">
                Restaurant
              </p>
              {visibleNav(session.role).map(item => {
                const href   = item.href(activeRest.id)
                const active = pathname === href || pathname.startsWith(href + '/')
                const Icon   = item.icon
                return (
                  <Link key={item.label} href={href}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all
                      ${active
                        ? 'bg-[#7C5CFC]/15 text-[#A78BFA]'
                        : 'text-[#8B90B0] hover:text-[#E8EAFF] hover:bg-white/[0.04]'
                      }`}>
                    <Icon size={14} className="shrink-0" />
                    {item.label}
                    {active && <ChevronRight size={12} className="ml-auto text-[#7C5CFC]/60" />}
                  </Link>
                )
              })}

              {/* All restaurants link */}
              <div className="pt-3">
                <Link href="/restaurants"
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] text-[#4B4F65] hover:text-[#8B90B0] transition-all">
                  ← All restaurants
                </Link>
              </div>
            </>
          ) : (
            <>
              {session.role === 'superadmin' && (
                <>
                  <p className="text-[#4B4F65] text-[9px] font-black uppercase tracking-[0.15em] px-3 pb-1 pt-1">
                    Company
                  </p>
                  {[
                    { label: 'Intelligence', href: '/company', icon: BarChart2 },
                    { label: 'Restaurants',  href: '/restaurants', icon: UtensilsCrossed },
                  ].map(item => {
                    const active = pathname === item.href || (item.href !== '/company' && pathname.startsWith(item.href))
                    const Icon   = item.icon
                    return (
                      <Link key={item.href} href={item.href}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all
                          ${active
                            ? 'bg-[#7C5CFC]/15 text-[#A78BFA]'
                            : 'text-[#8B90B0] hover:text-[#E8EAFF] hover:bg-white/[0.04]'
                          }`}>
                        <Icon size={14} className="shrink-0" />
                        {item.label}
                        {active && <ChevronRight size={12} className="ml-auto text-[#7C5CFC]/60" />}
                      </Link>
                    )
                  })}
                </>
              )}

              {session.role !== 'superadmin' && (
                <>
                  <p className="text-[#4B4F65] text-[9px] font-black uppercase tracking-[0.15em] px-3 pb-1 pt-1">
                    My Restaurants
                  </p>
                  {visibleRests.map(r => (
                    <Link key={r.id} href={`/restaurants/${r.id}/menu`}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-[#8B90B0] hover:text-[#E8EAFF] hover:bg-white/[0.04] font-semibold transition-all">
                      <UtensilsCrossed size={14} className="shrink-0" />
                      <span className="truncate">{r.name}</span>
                    </Link>
                  ))}
                </>
              )}
            </>
          )}
        </nav>

        {/* User footer */}
        <div className="px-3 py-3 border-t border-white/[0.05]">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl">
            <div className="w-7 h-7 rounded-lg bg-[#7C5CFC]/20 flex items-center justify-center shrink-0">
              <span className="text-[#A78BFA] text-[10px] font-black">
                {session.email?.[0]?.toUpperCase() ?? '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[#E8EAFF] text-[11px] font-bold truncate">{session.email ?? 'User'}</p>
              <p className="text-[#4B4F65] text-[9px] capitalize">{session.role}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto bg-[#0B0C10]">
        {children}
      </main>
    </div>
  )
}
