'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  Store, LogOut, BarChart2, Building2, type LucideIcon,
} from 'lucide-react'

const NAV: { label: string; href: string; icon: LucideIcon; section?: string }[] = [
  { label: 'Intelligence Center', href: '/company',      icon: Building2,  section: 'Company' },
  { label: 'Restaurants',         href: '/restaurants',  icon: Store },
]

export default function Sidebar() {
  const path     = usePathname()
  const router   = useRouter()
  const [out, setOut] = useState(false)

  async function handleLogout() {
    setOut(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  let lastSection = ''

  return (
    <aside className="w-60 shrink-0 bg-[#0A0B15] border-r border-white/[0.05] flex flex-col">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-white/[0.05]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center">
            <BarChart2 size={13} className="text-white" />
          </div>
          <div>
            <p className="text-white font-black text-[14px] tracking-tight">Paladeium</p>
            <p className="text-white/30 text-[10px] font-medium tracking-wide">Admin</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV.map(item => {
          const active  = path === item.href || (item.href !== '/company' && path.startsWith(item.href))
          const Icon    = item.icon
          const section = item.section

          const sectionEl = section && section !== lastSection ? (
            <p key={`s-${section}`} className="text-[9px] font-black text-white/20 uppercase tracking-[0.15em] px-3 pt-3 pb-1">
              {section}
            </p>
          ) : null
          if (section) lastSection = section

          return (
            <div key={item.href}>
              {sectionEl}
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  active
                    ? 'bg-violet-600/15 text-violet-300 border border-violet-600/25'
                    : 'text-white/45 hover:text-white/75 hover:bg-white/[0.04]'
                }`}
              >
                <Icon size={15} className="shrink-0" />
                <span className="text-[13px]">{item.label}</span>
                {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400" />}
              </Link>
            </div>
          )
        })}

        {/* Analytics shortcut injected for restaurant routes */}
        {path.match(/^\/restaurants\/([^/]+)/) && (() => {
          const match = path.match(/^\/restaurants\/([^/]+)/)
          const rid   = match?.[1]
          if (!rid || rid === 'new') return null
          const isAnalytics = path.includes('/analytics')
          return (
            <div className="mt-2 pt-2 border-t border-white/[0.05]">
              <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.15em] px-3 pb-1">
                This restaurant
              </p>
              <Link
                href={`/restaurants/${rid}/analytics`}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${
                  isAnalytics
                    ? 'bg-violet-600/15 text-violet-300 border border-violet-600/25'
                    : 'text-white/45 hover:text-white/75 hover:bg-white/[0.04]'
                }`}
              >
                <BarChart2 size={15} className="shrink-0" />
                Analytics
                {isAnalytics && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400" />}
              </Link>
            </div>
          )
        })()}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-white/[0.05] space-y-2">
        <div className="flex items-center gap-2 px-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-white/20 text-[10px] font-medium">All systems operational</span>
        </div>
        <button
          onClick={handleLogout}
          disabled={out}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[12px] text-white/35 hover:text-white/65 hover:bg-white/[0.04] transition-all disabled:opacity-40"
        >
          <LogOut size={13} className="shrink-0" />
          <span>{out ? 'Signing out…' : 'Sign out'}</span>
        </button>
      </div>
    </aside>
  )
}
