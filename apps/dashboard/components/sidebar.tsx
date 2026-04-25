'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const nav = [
  { label: 'Restaurants', href: '/restaurants', icon: '🏪' },
]

export default function Sidebar() {
  const path = usePathname()

  return (
    <aside className="w-60 shrink-0 bg-[#0F0F1A] border-r border-white/5 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/5">
        <div className="text-[#D4A853] font-bold text-lg tracking-widest uppercase">Paladeium</div>
        <div className="text-white/30 text-[11px] mt-0.5 tracking-wide">Admin Dashboard</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5">
        {nav.map(item => {
          const active = path.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'bg-[#D4A853]/10 text-[#D4A853] border border-[#D4A853]/20'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/5 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-white/25 text-xs">v1.0 MVP</span>
      </div>
    </aside>
  )
}
