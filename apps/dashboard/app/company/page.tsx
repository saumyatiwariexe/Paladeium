'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import {
  TrendingUp, TrendingDown, Users, ShoppingBag, Zap,
  BarChart2, Clock, ArrowUpRight, ArrowDownRight, RefreshCw,
  Building2, DollarSign, Target, Activity,
} from 'lucide-react'
import type { CompanyAnalytics } from '@/lib/analytics'
import { fmtCurrency, fmtNumber, fmtSeconds } from '@/lib/analytics'

// ── Micro components ──────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
    </div>
  )
}

function KpiCard({
  label, value, sub, subUp, icon: Icon, accent,
}: {
  label: string; value: string; sub?: string; subUp?: boolean
  icon: React.ElementType; accent: string
}) {
  return (
    <div className="bg-[#0F1322] rounded-2xl p-5 border border-white/[0.06] flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent}`}>
          <Icon size={18} className="text-white" />
        </div>
        {sub && (
          <span className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
            subUp
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-red-500/10 text-red-400'
          }`}>
            {subUp ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
            {sub}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-black text-white tracking-tight">{value}</p>
        <p className="text-[12px] text-white/40 font-medium mt-0.5">{label}</p>
      </div>
    </div>
  )
}

// ── SVG Area Chart ────────────────────────────────────────────
function AreaChart({
  data, color = '#8B5CF6',
}: {
  data: { date: string; revenue: number }[]
  color?: string
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  if (!data.length) return null

  const W = 600; const H = 120
  const max = Math.max(...data.map(d => d.revenue), 1)
  const pts = data.map((d, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - (d.revenue / max) * H * 0.85 - 8,
  }))

  const pathD = pts.reduce(
    (acc, p, i) => i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`,
    ''
  )
  const areaD = `${pathD} L ${W} ${H} L 0 ${H} Z`

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`ag-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#ag-${color.replace('#','')})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => i % 5 === 0 && (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} />
      ))}
    </svg>
  )
}

// ── SVG Bar Chart ─────────────────────────────────────────────
function PeakBarChart({ data }: { data: { hour: number; label: string; sessions: number }[] }) {
  const showEvery = [0, 6, 9, 12, 15, 18, 21]
  const max = Math.max(...data.map(d => d.sessions), 1)
  const H = 72
  return (
    <div className="flex items-end gap-[3px] h-[72px]">
      {data.map(d => {
        const h = Math.max(3, (d.sessions / max) * H)
        const isLunch  = d.hour >= 12 && d.hour <= 14
        const isDinner = d.hour >= 18 && d.hour <= 22
        const color    = isLunch ? '#8B5CF6' : isDinner ? '#3B82F6' : '#ffffff18'
        return (
          <div key={d.hour} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div
              className="w-full rounded-sm transition-all duration-300"
              style={{ height: h, background: color }}
            />
            {showEvery.includes(d.hour) && (
              <span className="text-[9px] text-white/20 absolute -bottom-4">{d.label}</span>
            )}
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
              <div className="bg-[#1C1F35] text-white text-[10px] px-2 py-1 rounded whitespace-nowrap border border-white/10">
                {d.label}: {d.sessions}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Score Badge ───────────────────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? 'text-emerald-400' : score >= 45 ? 'text-amber-400' : 'text-red-400'
  const bar   = score >= 70 ? 'bg-emerald-500'   : score >= 45 ? 'bg-amber-500'   : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-[12px] font-black ${color}`}>{score}</span>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────

export default function CompanyPage() {
  const [data, setData]       = useState<CompanyAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState<'revenue' | 'orders'>('revenue')
  const [dishTab, setDishTab] = useState<'viewed' | 'ordered'>('viewed')

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/analytics/company')
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  return (
    <div className="min-h-full p-6 space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold text-violet-400 uppercase tracking-widest mb-1">
            Paladeium
          </p>
          <h1 className="text-[26px] font-black text-white tracking-tight">
            Intelligence Center
          </h1>
          <p className="text-white/40 text-sm mt-1">
            Company-wide performance • Live data
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 text-white/60 text-sm font-medium transition-all disabled:opacity-40"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading || !data ? <Spinner /> : (
        <>
          {/* ── KPI row ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Active Restaurants" icon={Building2}
              value={String(data.overview.activeRestaurants)}
              sub={`+${data.overview.newThisMonth} this month`} subUp
              accent="bg-violet-600"
            />
            <KpiCard
              label="Monthly Revenue (MRR)" icon={DollarSign}
              value={fmtCurrency(data.overview.mrr)}
              sub="per restaurant" subUp
              accent="bg-blue-600"
            />
            <KpiCard
              label="Daily Active Users" icon={Users}
              value={fmtNumber(data.usage.dailyActiveUsers)}
              sub={`${data.usage.conversionRate.toFixed(1)}% conversion`} subUp
              accent="bg-emerald-600"
            />
            <KpiCard
              label="AR Interaction Rate" icon={Zap}
              value={`${data.usage.arInteractionRate.toFixed(1)}%`}
              sub={`avg ${fmtSeconds(data.usage.avgSessionTimeSec)} session`} subUp
              accent="bg-amber-600"
            />
          </div>

          {/* ── Revenue chart + Restaurant leaderboard ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Revenue area chart */}
            <div className="lg:col-span-2 bg-[#0F1322] rounded-2xl p-5 border border-white/[0.06]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-[15px] font-black text-white">Revenue Trend</h2>
                  <p className="text-white/40 text-[12px] mt-0.5">Last 30 days • All restaurants</p>
                </div>
                <div className="flex gap-1 bg-white/[0.05] rounded-lg p-0.5">
                  {(['revenue','orders'] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)}
                      className={`px-3 py-1 rounded-md text-[12px] font-semibold capitalize transition-all ${tab===t ? 'bg-violet-600 text-white' : 'text-white/40 hover:text-white/70'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-2">
                <span className="text-2xl font-black text-white">{fmtCurrency(data.overview.totalRevenue)}</span>
                <span className="text-white/40 text-sm ml-2">total</span>
              </div>
              <AreaChart data={data.revenueTimeline} color="#8B5CF6" />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-white/20">{data.revenueTimeline[0]?.date}</span>
                <span className="text-[10px] text-white/20">{data.revenueTimeline[data.revenueTimeline.length-1]?.date}</span>
              </div>
            </div>

            {/* Restaurant leaderboard */}
            <div className="bg-[#0F1322] rounded-2xl p-5 border border-white/[0.06] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[15px] font-black text-white">Leaderboard</h2>
                <span className="text-[11px] text-violet-400 font-semibold">Top Restaurants</span>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto">
                {data.topRestaurants.map((r, i) => (
                  <div key={r.id} className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0 ${
                      i === 0 ? 'bg-amber-500 text-black' : i === 1 ? 'bg-white/10 text-white/60' : 'bg-white/[0.05] text-white/40'
                    }`}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-white truncate">{r.name}</p>
                      <p className="text-[11px] text-white/35">{fmtCurrency(r.revenue)} · {r.orders} orders</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {r.trend > 0
                        ? <TrendingUp size={12} className="text-emerald-400" />
                        : <TrendingDown size={12} className="text-red-400" />}
                      <ScoreBadge score={r.score} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Usage stats row ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Weekly Active Users', value: fmtNumber(data.usage.weeklyActiveUsers), icon: Users, color: 'text-blue-400' },
              { label: 'Avg Session Time',    value: fmtSeconds(data.usage.avgSessionTimeSec), icon: Clock, color: 'text-violet-400' },
              { label: 'Churn Rate',          value: `${data.overview.churnRate}%`, icon: TrendingDown, color: 'text-red-400' },
              { label: 'ARPU',                value: fmtCurrency(data.overview.arpu), icon: Target, color: 'text-amber-400' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-[#0F1322] rounded-2xl p-4 border border-white/[0.06] flex items-center gap-4">
                <Icon size={20} className={color} />
                <div>
                  <p className="text-lg font-black text-white">{value}</p>
                  <p className="text-[11px] text-white/35">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Dish Intelligence + Peak Hours ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Dish intelligence table */}
            <div className="lg:col-span-2 bg-[#0F1322] rounded-2xl p-5 border border-white/[0.06]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-[15px] font-black text-white">Dish Intelligence</h2>
                  <p className="text-white/40 text-[12px]">Global performance across all restaurants</p>
                </div>
                <div className="flex gap-1 bg-white/[0.05] rounded-lg p-0.5">
                  {(['viewed','ordered'] as const).map(t => (
                    <button key={t} onClick={() => setDishTab(t)}
                      className={`px-3 py-1 rounded-md text-[12px] font-semibold capitalize transition-all ${dishTab===t ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white/70'}`}>
                      {t==='viewed' ? 'Most Viewed' : 'Most Ordered'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      {['Dish','Restaurant','Views','Orders','Conv%'].map(h => (
                        <th key={h} className="text-left py-2 px-2 text-[11px] font-bold text-white/30 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(dishTab === 'viewed' ? data.globalDishes.mostViewed : data.globalDishes.mostOrdered).map((d, i) => (
                      <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="py-2.5 px-2 font-semibold text-white text-[13px]">{d.name}</td>
                        <td className="py-2.5 px-2 text-white/40 text-[12px]">{d.restaurant}</td>
                        <td className="py-2.5 px-2 text-white/70 text-[13px]">{fmtNumber('views' in d ? d.views : 0)}</td>
                        <td className="py-2.5 px-2 text-white/70 text-[13px]">{fmtNumber(d.orders)}</td>
                        <td className="py-2.5 px-2">
                          <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full ${'conv' in d && d.conv > 20 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/[0.06] text-white/50'}`}>
                            {'conv' in d ? `${d.conv.toFixed(1)}%` : '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Peak hours */}
            <div className="bg-[#0F1322] rounded-2xl p-5 border border-white/[0.06] flex flex-col">
              <div className="mb-4">
                <h2 className="text-[15px] font-black text-white">Peak Hours</h2>
                <p className="text-white/40 text-[12px]">Global session distribution</p>
              </div>
              <div className="flex-1 flex flex-col justify-end">
                <PeakBarChart data={data.peakHours} />
                <div className="mt-6 pt-4 border-t border-white/[0.06] flex justify-between text-[11px] text-white/35">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-violet-500 inline-block" /> Lunch</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-500 inline-block" /> Dinner</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Day of week + bottom restaurants ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Day of week */}
            <div className="bg-[#0F1322] rounded-2xl p-5 border border-white/[0.06]">
              <h2 className="text-[15px] font-black text-white mb-1">Day-of-Week Performance</h2>
              <p className="text-white/40 text-[12px] mb-4">Sessions and orders by weekday</p>
              <div className="space-y-2.5">
                {data.dayOfWeek.map(d => {
                  const maxOrd = Math.max(...data.dayOfWeek.map(x => x.orders), 1)
                  const pct    = Math.round((d.orders / maxOrd) * 100)
                  return (
                    <div key={d.day} className="flex items-center gap-3">
                      <span className="w-8 text-[12px] text-white/40 font-medium">{d.day}</span>
                      <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-blue-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[12px] text-white/50 w-10 text-right">{d.orders}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Needs attention */}
            <div className="bg-[#0F1322] rounded-2xl p-5 border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-4">
                <Activity size={15} className="text-red-400" />
                <h2 className="text-[15px] font-black text-white">Needs Attention</h2>
              </div>
              <div className="space-y-2">
                {data.bottomRestaurants.map(r => (
                  <div key={r.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                    <div>
                      <p className="text-[13px] font-bold text-white">{r.name}</p>
                      <p className="text-[11px] text-white/35">{fmtCurrency(r.revenue)} · {r.orders} orders</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <ScoreBadge score={r.score} />
                      <Link
                        href={`/restaurants/${r.id}/analytics`}
                        className="text-[11px] font-semibold text-violet-400 hover:text-violet-300 transition-colors"
                      >
                        View →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-white/25 mt-4">
                These restaurants score below average. Review their menu & engagement metrics.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
