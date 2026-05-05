import type { MenuItem, Restaurant } from './types'

// ── Seeded PRNG (consistent per restaurant) ───────────────────
function seededRng(seed: number) {
  let s = Math.abs(seed) % 2147483647 || 1
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 }
}
function hashStr(str: string): number {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i)
  return Math.abs(h)
}

// ── Types ─────────────────────────────────────────────────────

export interface DishAnalytics {
  id: string; name: string; price: number; emoji: string; hasAr: boolean
  views: number; orders: number; arInteractions: number
  revenue: number; conversionRate: number; arEngagementRate: number
  dishScore: number; rank: number
}

export interface RestaurantAnalytics {
  restaurantId: string; restaurantName: string
  totalOrders: number; revenue: number; avgOrderValue: number
  sessions: number; conversionRate: number; repeatCustomerRate: number
  arInteractionRate: number; restaurantScore: number
  ordersTimeline: { date: string; orders: number; revenue: number }[]
  peakHours: { hour: number; label: string; sessions: number }[]
  dishes: DishAnalytics[]
}

export interface CompanyAnalytics {
  overview: {
    totalRestaurants: number; activeRestaurants: number
    newThisMonth: number; churnRate: number
    mrr: number; arpu: number; totalRevenue: number
  }
  usage: {
    dailyActiveUsers: number; weeklyActiveUsers: number
    avgSessionTimeSec: number; conversionRate: number; arInteractionRate: number
  }
  revenueTimeline: { date: string; revenue: number; restaurants: number }[]
  topRestaurants: { id: string; name: string; revenue: number; orders: number; score: number; trend: number }[]
  bottomRestaurants: { id: string; name: string; revenue: number; orders: number; score: number }[]
  globalDishes: {
    mostViewed: { name: string; restaurant: string; views: number; orders: number; conv: number }[]
    mostOrdered: { name: string; restaurant: string; orders: number; revenue: number }[]
  }
  peakHours: { hour: number; label: string; sessions: number }[]
  dayOfWeek: { day: string; sessions: number; orders: number }[]
}

// ── Mock generator ────────────────────────────────────────────

export function generateRestaurantAnalytics(
  restaurant: Restaurant,
  items: MenuItem[]
): RestaurantAnalytics {
  const rng = seededRng(hashStr(restaurant.id))

  const totalOrders    = Math.floor(rng() * 600 + 80)
  const avgOrderValue  = Math.floor(rng() * 350 + 180)
  const revenue        = totalOrders * avgOrderValue
  const sessions       = Math.floor(totalOrders / (0.12 + rng() * 0.28))
  const convRate       = (totalOrders / sessions) * 100
  const repeatRate     = 20 + rng() * 40
  const arRate         = items.some(i => i.hasAr) ? 40 + rng() * 40 : 5 + rng() * 10

  // 30-day timeline
  const ordersTimeline = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (29 - i))
    const multiplier = 0.4 + rng() * 1.2
    const dayOrders  = Math.max(0, Math.floor(totalOrders / 30 * multiplier))
    return {
      date:    d.toISOString().split('T')[0],
      orders:  dayOrders,
      revenue: dayOrders * avgOrderValue,
    }
  })

  // Peak hours (lunch 12-14, dinner 19-21)
  const peakHours = Array.from({ length: 24 }, (_, h) => {
    let w = 0.05
    if (h >= 11 && h <= 14) w = 0.6 + rng() * 0.4
    else if (h >= 18 && h <= 22) w = 0.7 + rng() * 0.3
    else if (h >= 8  && h <= 10) w = 0.2 + rng() * 0.15
    const label = h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`
    return { hour: h, label, sessions: Math.floor(sessions * w / 8) }
  })

  // Per-dish stats
  const maxOrders = totalOrders * 0.6
  const dishes: DishAnalytics[] = items.map((item, idx) => {
    const views     = Math.floor(rng() * 900 + 60)
    const orders    = Math.floor(views * (0.08 + rng() * 0.42))
    const arInt     = item.hasAr ? Math.floor(views * (0.25 + rng() * 0.55)) : 0
    const conv      = views > 0 ? (orders / views) * 100 : 0
    const arEng     = views > 0 && item.hasAr ? (arInt / views) * 100 : 0
    const score     = computeDishScore(orders, views, conv, arEng, maxOrders)
    return {
      id: item.id, name: item.name, price: item.price,
      emoji: item.emoji || '🍽', hasAr: item.hasAr,
      views, orders, arInteractions: arInt,
      revenue: orders * item.price,
      conversionRate:  Math.round(conv  * 10) / 10,
      arEngagementRate: Math.round(arEng * 10) / 10,
      dishScore: score, rank: idx + 1,
    }
  }).sort((a, b) => b.dishScore - a.dishScore)
    .map((d, i) => ({ ...d, rank: i + 1 }))

  const rScore = computeRestaurantScore(revenue, convRate, repeatRate, arRate)

  return {
    restaurantId: restaurant.id, restaurantName: restaurant.name,
    totalOrders, revenue, avgOrderValue, sessions,
    conversionRate:    Math.round(convRate  * 10) / 10,
    repeatCustomerRate: Math.round(repeatRate * 10) / 10,
    arInteractionRate: Math.round(arRate    * 10) / 10,
    restaurantScore:   rScore,
    ordersTimeline, peakHours, dishes,
  }
}

export function generateCompanyAnalytics(
  restaurants: Restaurant[],
  itemsMap: Record<string, MenuItem[]>
): CompanyAnalytics {
  const active  = restaurants.filter(r => r.status === 'active')
  const mrr     = active.length * 3500
  const arpu    = mrr / Math.max(active.length, 1)

  // Aggregate per-restaurant analytics
  const allAnalytics = active.map(r => generateRestaurantAnalytics(r, itemsMap[r.id] || []))

  const totalRevenue  = allAnalytics.reduce((s, a) => s + a.revenue, 0)
  const totalOrders   = allAnalytics.reduce((s, a) => s + a.totalOrders, 0)
  const avgConv       = allAnalytics.reduce((s, a) => s + a.conversionRate, 0) / Math.max(allAnalytics.length, 1)
  const avgAR         = allAnalytics.reduce((s, a) => s + a.arInteractionRate, 0) / Math.max(allAnalytics.length, 1)

  // Revenue timeline (last 30 days, company-wide sum)
  const revenueTimeline = allAnalytics[0]?.ordersTimeline.map((entry, i) => ({
    date:        entry.date,
    revenue:     allAnalytics.reduce((s, a) => s + a.ordersTimeline[i].revenue, 0),
    restaurants: active.length,
  })) ?? []

  // Top / bottom restaurants by score
  const ranked = allAnalytics
    .map((a, i) => ({
      id: active[i].id, name: active[i].name,
      revenue: a.revenue, orders: a.totalOrders,
      score: a.restaurantScore,
      trend: Math.round((-5 + Math.random() * 20) * 10) / 10,
    }))
    .sort((a, b) => b.score - a.score)

  // Global dish aggregates
  const allDishes = allAnalytics.flatMap((a, i) =>
    a.dishes.map(d => ({ ...d, restaurantName: active[i].name }))
  )
  const mostViewed  = [...allDishes].sort((a, b) => b.views - a.views).slice(0, 8).map(d => ({
    name: d.name, restaurant: d.restaurantName,
    views: d.views, orders: d.orders, conv: d.conversionRate,
  }))
  const mostOrdered = [...allDishes].sort((a, b) => b.orders - a.orders).slice(0, 8).map(d => ({
    name: d.name, restaurant: d.restaurantName,
    orders: d.orders, revenue: d.revenue,
  }))

  // Global peak hours (sum across all restaurants)
  const peakHours = Array.from({ length: 24 }, (_, h) => {
    const total = allAnalytics.reduce((s, a) => s + (a.peakHours[h]?.sessions ?? 0), 0)
    const label = h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`
    return { hour: h, label, sessions: total }
  })

  // Day of week
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dayOfWeek = days.map((day, di) => ({
    day,
    sessions: Math.floor(totalOrders / 7 * (di === 0 || di === 6 ? 1.4 : 0.95) * (0.8 + Math.random() * 0.4)),
    orders:   Math.floor(totalOrders / 7 * (di === 0 || di === 6 ? 1.3 : 1.0) * (0.7 + Math.random() * 0.5)),
  }))

  return {
    overview: {
      totalRestaurants: restaurants.length,
      activeRestaurants: active.length,
      newThisMonth: Math.max(1, Math.floor(active.length * 0.1)),
      churnRate: Math.round(Math.random() * 3 * 10) / 10,
      mrr, arpu: Math.round(arpu), totalRevenue,
    },
    usage: {
      dailyActiveUsers:  Math.floor(totalOrders / 30 * 5.5),
      weeklyActiveUsers: Math.floor(totalOrders / 30 * 5.5 * 6),
      avgSessionTimeSec: Math.floor(120 + Math.random() * 180),
      conversionRate:    Math.round(avgConv * 10) / 10,
      arInteractionRate: Math.round(avgAR  * 10) / 10,
    },
    revenueTimeline,
    topRestaurants:    ranked.slice(0, 8),
    bottomRestaurants: [...ranked].reverse().slice(0, 5),
    globalDishes: { mostViewed, mostOrdered },
    peakHours, dayOfWeek,
  }
}

// ── Scoring algorithms ─────────────────────────────────────────

export function computeDishScore(
  orders: number, views: number, conv: number,
  arEng: number, maxOrders = 500
): number {
  const salesScore = Math.min(100, (orders / maxOrders) * 100)
  const convScore  = Math.min(100, conv)
  const engScore   = Math.min(100, arEng)
  const visScore   = Math.min(100, views / 10)
  return Math.round(0.4 * salesScore + 0.3 * convScore + 0.2 * engScore + 0.1 * visScore)
}

export function computeRestaurantScore(
  revenue: number, conv: number, retention: number, arRate: number
): number {
  const maxRev    = 200000
  const revScore  = Math.min(100, (revenue / maxRev) * 100)
  const convScore = Math.min(100, conv * 2)
  const retScore  = Math.min(100, retention)
  const arScore   = Math.min(100, arRate)
  return Math.round(0.3 * revScore + 0.3 * convScore + 0.2 * retScore + 0.2 * arScore)
}

// ── Formatting helpers ─────────────────────────────────────────

export function fmtCurrency(n: number): string {
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`
  if (n >= 1_000)    return `₹${(n / 1_000).toFixed(1)}K`
  return `₹${n.toFixed(0)}`
}

export function fmtNumber(n: number): string {
  if (n >= 1_00_000) return `${(n / 1_00_000).toFixed(1)}L`
  if (n >= 1_000)    return `${(n / 1_000).toFixed(1)}K`
  return String(Math.round(n))
}

export function fmtSeconds(sec: number): string {
  if (sec < 60) return `${sec}s`
  return `${Math.floor(sec / 60)}m ${sec % 60}s`
}
