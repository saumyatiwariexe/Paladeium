'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, TrendingUp, ShoppingBag, DollarSign, Target,
  Users, Zap, BarChart2, Star, RefreshCw, ChevronRight,
} from 'lucide-react'
import type { RestaurantAnalytics } from '@/lib/analytics'
import type { MenuRecommendations } from '@/lib/recommendations'
import { fmtCurrency, fmtNumber, fmtSeconds } from '@/lib/analytics'

// ── Tiny components ───────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[400px]">
      <div className="w-10 h-10 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
    </div>
  )
}

function StatCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string; value: string; sub?: string
  icon: React.ElementType; color: string
}) {
  return (
    <div className="bg-[#0F1322] rounded-2xl p-5 border border-white/[0.06]">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-4 ${color}`}>
        <Icon size={16} className="text-white" />
      </div>
      <p className="text-[22px] font-black text-white tracking-tight">{value}</p>
      <p className="text-[11px] text-white/40 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-violet-400 font-semibold mt-1">{sub}</p>}
    </div>
  )
}

function MiniAreaChart({
  data, color = '#8B5CF6', field,
}: {
  data: { date: string; orders: number; revenue: number }[]
  color?: string
  field: 'orders' | 'revenue'
}) {
  if (!data.length) return null
  const W = 600; const H = 100
  const vals = data.map(d => d[field])
  const max  = Math.max(...vals, 1)
  const pts  = vals.map((v, i) => ({
    x: (i / (vals.length - 1)) * W,
    y: H - (v / max) * H * 0.85 - 4,
  }))
  const pathD = pts.reduce((a, p, i) => i === 0 ? `M ${p.x} ${p.y}` : `${a} L ${p.x} ${p.y}`, '')
  const areaD = `${pathD} L ${W} ${H} L 0 ${H} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 100 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`mag-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#mag-${color.replace('#','')})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function HourBar({ data }: { data: { hour: number; label: string; sessions: number }[] }) {
  const max = Math.max(...data.map(d => d.sessions), 1)
  const show = [0, 6, 9, 12, 15, 18, 21]
  return (
    <div className="flex items-end gap-[2px] h-[56px] mt-2 relative">
      {data.map(d => {
        const h     = Math.max(2, (d.sessions / max) * 56)
        const color = d.hour >= 12 && d.hour <= 14 ? '#8B5CF6'
                    : d.hour >= 18 && d.hour <= 22 ? '#3B82F6' : '#ffffff12'
        return (
          <div key={d.hour} className="flex-1 flex flex-col items-center group relative">
            <div className="w-full rounded-[2px]" style={{ height: h, background: color }} />
            {show.includes(d.hour) && (
              <span className="text-[8px] text-white/20 absolute -bottom-4">{d.label}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Recommendation type → badge style
const REC_STYLES = {
  promote: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  boost:   'bg-blue-500/15 text-blue-400 border-blue-500/20',
  improve: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  review:  'bg-orange-500/15 text-orange-400 border-orange-500/20',
  remove:  'bg-red-500/15 text-red-400 border-red-500/20',
  ok:      'bg-white/[0.05] text-white/40 border-white/10',
}

function DishScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-emerald-500' : score >= 45 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-[12px] font-black ${score >= 70 ? 'text-emerald-400' : score >= 45 ? 'text-amber-400' : 'text-red-400'}`}>
        {score}
      </span>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────

type PageData = RestaurantAnalytics & { recommendations: MenuRecommendations }

export default function RestaurantAnalyticsPage() {
  const { id }            = useParams<{ id: string }>()
  const [data, setData]   = useState<PageData | null>(null)
  const [loading, setL]   = useState(true)
  const [chartTab, setCT] = useState<'orders' | 'revenue'>('orders')
  const [recFilter, setRF]= useState<'all' | 'high'>('all')

  async function load() {
    setL(true)
    try {
      const res = await fetch(`/api/analytics/restaurant/${id}`)
      if (res.ok) setData(await res.json())
    } finally { setL(false) }
  }
  useEffect(() => { if (id) load() }, [id])

  if (loading || !data) return <div className="p-6"><Spinner /></div>

  const recs = data.recommendations.recommendations.filter(
    r => recFilter === 'all' || r.priority === 'high'
  )

  return (
    <div className="p-6 space-y-6 min-h-full">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link
            href={`/restaurants/${id}/menu`}
            className="mt-1 w-9 h-9 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center hover:bg-white/[0.08] transition-colors"
          >
            <ArrowLeft size={16} className="text-white/60" />
          </Link>
          <div>
            <p className="text-[11px] font-bold text-violet-400 uppercase tracking-widest mb-1">
              Analytics
            </p>
            <h1 className="text-[24px] font-black text-white tracking-tight">
              {data.restaurantName}
            </h1>
            <p className="text-white/40 text-sm mt-0.5">
              {data.totalOrders} orders · {fmtCurrency(data.revenue)} revenue · last 30 days
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 text-white/60 text-sm font-medium transition-all"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Orders"     value={fmtNumber(data.totalOrders)}       icon={ShoppingBag} color="bg-violet-600" />
        <StatCard label="Revenue"          value={fmtCurrency(data.revenue)}          icon={DollarSign}  color="bg-blue-600" />
        <StatCard label="Avg Order Value"  value={fmtCurrency(data.avgOrderValue)}    icon={Target}      color="bg-emerald-600" />
        <StatCard label="Conversion Rate"  value={`${data.conversionRate.toFixed(1)}%`} sub={`${data.sessions} sessions`} icon={TrendingUp} color="bg-amber-600" />
      </div>

      {/* ── Secondary stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Repeat Customers', value: `${data.repeatCustomerRate.toFixed(0)}%`,  icon: Users,    color: 'text-blue-400' },
          { label: 'AR Interaction',   value: `${data.arInteractionRate.toFixed(0)}%`,   icon: Zap,      color: 'text-violet-400' },
          { label: 'Total Sessions',   value: fmtNumber(data.sessions),                  icon: BarChart2, color: 'text-emerald-400' },
          { label: 'Restaurant Score', value: `${data.restaurantScore}/100`,             icon: Star,     color: 'text-amber-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[#0F1322] rounded-2xl p-4 border border-white/[0.06] flex items-center gap-3">
            <Icon size={18} className={color} />
            <div>
              <p className="text-[16px] font-black text-white">{value}</p>
              <p className="text-[11px] text-white/35">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Chart row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Area chart */}
        <div className="lg:col-span-2 bg-[#0F1322] rounded-2xl p-5 border border-white/[0.06]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[15px] font-black text-white">Performance Trend</h2>
              <p className="text-white/40 text-[12px]">Daily breakdown · 30 days</p>
            </div>
            <div className="flex gap-1 bg-white/[0.05] rounded-lg p-0.5">
              {(['orders','revenue'] as const).map(t => (
                <button key={t} onClick={() => setCT(t)}
                  className={`px-3 py-1 rounded-md text-[12px] font-semibold capitalize transition-all ${chartTab===t ? 'bg-violet-600 text-white' : 'text-white/40 hover:text-white/70'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <MiniAreaChart data={data.ordersTimeline} color="#8B5CF6" field={chartTab} />
        </div>

        {/* Peak hours */}
        <div className="bg-[#0F1322] rounded-2xl p-5 border border-white/[0.06]">
          <h2 className="text-[15px] font-black text-white mb-1">Peak Hours</h2>
          <p className="text-white/40 text-[12px] mb-3">When customers visit most</p>
          <HourBar data={data.peakHours} />
          <div className="mt-8 space-y-1.5">
            {data.peakHours
              .sort((a, b) => b.sessions - a.sessions)
              .slice(0, 3)
              .map(h => (
                <div key={h.hour} className="flex items-center justify-between text-[12px]">
                  <span className="text-white/60 font-medium">{h.label}</span>
                  <span className="text-white font-bold">{h.sessions} sessions</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* ── Menu intelligence table ── */}
      <div className="bg-[#0F1322] rounded-2xl p-5 border border-white/[0.06]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[15px] font-black text-white">Menu Intelligence</h2>
            <p className="text-white/40 text-[12px]">Per-dish performance with AI scores</p>
          </div>
          <span className="text-[11px] text-violet-400 font-semibold">{data.dishes.length} dishes</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['#','Dish','Views','AR Views','Orders','Revenue','Conv%','Score'].map(h => (
                  <th key={h} className="text-left py-2 px-2.5 text-[11px] font-bold text-white/30 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.dishes.map((d, i) => (
                <tr key={d.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-2.5 text-white/30 text-[12px] font-medium">{i + 1}</td>
                  <td className="py-3 px-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{d.emoji}</span>
                      <div>
                        <p className="text-[13px] font-bold text-white leading-tight">{d.name}</p>
                        <p className="text-[11px] text-white/30">{fmtCurrency(d.price)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-2.5 text-white/60 text-[13px]">{fmtNumber(d.views)}</td>
                  <td className="py-3 px-2.5">
                    {d.hasAr
                      ? <span className="text-violet-400 text-[13px] font-semibold">{fmtNumber(d.arInteractions)}</span>
                      : <span className="text-white/20 text-[12px]">—</span>}
                  </td>
                  <td className="py-3 px-2.5 text-white/70 text-[13px] font-semibold">{d.orders}</td>
                  <td className="py-3 px-2.5 text-white/70 text-[13px]">{fmtCurrency(d.revenue)}</td>
                  <td className="py-3 px-2.5">
                    <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full ${d.conversionRate > 25 ? 'bg-emerald-500/15 text-emerald-400' : d.conversionRate > 12 ? 'bg-amber-500/15 text-amber-400' : 'bg-red-500/15 text-red-400'}`}>
                      {d.conversionRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-2.5"><DishScoreBar score={d.dishScore} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Recommendations ── */}
      <div className="bg-[#0F1322] rounded-2xl p-5 border border-white/[0.06]">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-[15px] font-black text-white flex items-center gap-2">
              <Zap size={15} className="text-amber-400" />
              AI Recommendations
            </h2>
            <p className="text-white/40 text-[12px] mt-0.5">{data.recommendations.summary}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] text-white/40">Menu Score:</span>
              <DishScoreBar score={data.recommendations.menuScore} />
            </div>
            <div className="flex gap-1 bg-white/[0.05] rounded-lg p-0.5">
              {(['all','high'] as const).map(f => (
                <button key={f} onClick={() => setRF(f)}
                  className={`px-3 py-1 rounded-md text-[12px] font-semibold capitalize transition-all ${recFilter===f ? 'bg-violet-600 text-white' : 'text-white/40 hover:text-white/70'}`}>
                  {f === 'all' ? 'All' : 'High Priority'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Insights row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
          {data.recommendations.insights.map((ins, i) => (
            <div key={i} className={`rounded-xl px-3 py-2.5 border ${
              ins.type === 'positive' ? 'bg-emerald-500/[0.07] border-emerald-500/20' :
              ins.type === 'warning'  ? 'bg-amber-500/[0.07]  border-amber-500/20'  :
                                        'bg-white/[0.03]       border-white/[0.07]'
            }`}>
              <p className={`text-[11px] font-black uppercase tracking-wider mb-1 ${
                ins.type === 'positive' ? 'text-emerald-400' : ins.type === 'warning' ? 'text-amber-400' : 'text-white/40'
              }`}>{ins.label}</p>
              <p className="text-[12px] text-white/70 font-medium leading-snug">{ins.value}</p>
            </div>
          ))}
        </div>

        {/* Recommendations list */}
        <div className="space-y-3">
          {recs.map(rec => (
            <div key={rec.dishId} className={`rounded-xl p-4 border ${REC_STYLES[rec.type]} flex gap-4 items-start`}>
              <span className="text-2xl shrink-0">{rec.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-[13px] font-black text-white">{rec.title}</p>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${REC_STYLES[rec.type]}`}>
                    {rec.type}
                  </span>
                  {rec.priority === 'high' && (
                    <span className="text-[10px] font-black text-red-400 uppercase">Urgent</span>
                  )}
                </div>
                <p className="text-[12px] text-white/50 leading-relaxed mb-2">{rec.reason}</p>
                <div className="flex items-start gap-4 flex-wrap">
                  <div>
                    <p className="text-[10px] text-white/30 uppercase tracking-wider font-bold mb-0.5">Action</p>
                    <p className="text-[12px] text-white/70 font-medium">{rec.action}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/30 uppercase tracking-wider font-bold mb-0.5">Impact</p>
                    <p className="text-[12px] text-emerald-400 font-semibold">{rec.impact}</p>
                  </div>
                </div>
              </div>
              <div className="shrink-0"><DishScoreBar score={rec.score} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
