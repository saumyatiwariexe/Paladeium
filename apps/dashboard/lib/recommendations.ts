import type { DishAnalytics } from './analytics'

// ── Types ─────────────────────────────────────────────────────

export type RecommendationType = 'promote' | 'improve' | 'boost' | 'review' | 'remove' | 'ok'

export interface DishRecommendation {
  dishId:   string
  dishName: string
  emoji:    string
  type:     RecommendationType
  priority: 'high' | 'medium' | 'low'
  title:    string
  reason:   string
  action:   string
  impact:   string
  score:    number
}

export interface MenuRecommendations {
  summary: string
  menuScore: number
  recommendations: DishRecommendation[]
  insights: { label: string; value: string; type: 'positive' | 'warning' | 'neutral' }[]
}

// ── Engine ────────────────────────────────────────────────────

export function generateRecommendations(dishes: DishAnalytics[]): MenuRecommendations {
  if (dishes.length === 0) {
    return { summary: 'No menu items found.', menuScore: 0, recommendations: [], insights: [] }
  }

  const totalOrders  = dishes.reduce((s, d) => s + d.orders, 0)
  const totalViews   = dishes.reduce((s, d) => s + d.views, 0)
  const avgConv      = dishes.reduce((s, d) => s + d.conversionRate, 0) / dishes.length
  const avgScore     = dishes.reduce((s, d) => s + d.dishScore, 0)     / dishes.length
  const menuScore    = Math.round(avgScore)

  const recs: DishRecommendation[] = dishes.map(dish => classifyDish(dish, avgConv, totalOrders))
    .sort((a, b) => {
      const p = { high: 0, medium: 1, low: 2 }
      return p[a.priority] - p[b.priority]
    })

  // Portfolio insights
  const insights: MenuRecommendations['insights'] = []

  const arDishes = dishes.filter(d => d.hasAr)
  const arConv   = arDishes.length > 0
    ? arDishes.reduce((s, d) => s + d.conversionRate, 0) / arDishes.length
    : 0
  const nonArConv = dishes.filter(d => !d.hasAr).reduce((s, d) => s + d.conversionRate, 0)
    / Math.max(dishes.filter(d => !d.hasAr).length, 1)

  if (arConv > nonArConv + 5) {
    insights.push({
      label: '3D/AR boost',
      value: `AR dishes convert ${(arConv - nonArConv).toFixed(1)}% more`,
      type:  'positive',
    })
  }

  const highDrop = dishes.filter(d => d.views > 150 && d.conversionRate < 8)
  if (highDrop.length > 0) {
    insights.push({
      label: 'Drop-off alert',
      value: `${highDrop.length} dish${highDrop.length > 1 ? 'es' : ''} with >150 views but <8% conversion`,
      type:  'warning',
    })
  }

  const topDish = dishes[0]
  if (topDish) {
    insights.push({
      label: 'Best performer',
      value: `${topDish.name} — score ${topDish.dishScore}/100`,
      type:  'positive',
    })
  }

  const lowVis = dishes.filter(d => d.views < 30)
  if (lowVis.length > 0) {
    insights.push({
      label: 'Low visibility',
      value: `${lowVis.length} dish${lowVis.length > 1 ? 'es' : ''} with <30 views this period`,
      type:  'warning',
    })
  }

  if (totalViews > 0) {
    insights.push({
      label:  'Menu conversion',
      value:  `${avgConv.toFixed(1)}% of dish views lead to cart`,
      type:   avgConv > 20 ? 'positive' : avgConv > 12 ? 'neutral' : 'warning',
    })
  }

  const summary = menuScore >= 70
    ? 'Your menu is performing well. A few targeted improvements could push it further.'
    : menuScore >= 45
    ? 'Menu has strong performers but several dishes need attention to improve conversions.'
    : 'Menu needs significant optimization. Focus on high-visibility low-conversion dishes first.'

  return { summary, menuScore, recommendations: recs, insights }
}

function classifyDish(
  dish: DishAnalytics,
  avgConv: number,
  totalOrders: number
): DishRecommendation {
  const base = {
    dishId:   dish.id,
    dishName: dish.name,
    emoji:    dish.emoji,
    score:    dish.dishScore,
  }

  // STAR: high score + above-avg conversion
  if (dish.dishScore >= 70 && dish.conversionRate >= avgConv + 5) {
    return {
      ...base, type: 'promote', priority: 'high',
      title:  '⭐ Feature this dish',
      reason: `${dish.conversionRate.toFixed(1)}% conversion — ${dish.orders} orders. Your best performer.`,
      action: 'Pin to top of menu. Highlight in marketing. Consider pricing up 5–10%.',
      impact: `+₹${Math.round(dish.revenue * 0.15).toLocaleString('en-IN')} potential revenue`,
    }
  }

  // HIGH VIEWS, LOW CONVERSION — pricing or description issue
  if (dish.views > 120 && dish.conversionRate < 10) {
    return {
      ...base, type: 'improve', priority: 'high',
      title:  '⚠️ High views, low orders',
      reason: `${dish.views} views but only ${dish.conversionRate.toFixed(1)}% conversion. Customers are looking but not buying.`,
      action: 'Review price vs competitors. Improve dish description & photo. Add a value combo.',
      impact: 'Closing gap to 20% conv = estimated +' + Math.round(dish.views * 0.1) + ' orders',
    }
  }

  // LOW VISIBILITY — needs boosting
  if (dish.views < 40 && dish.orders > 0) {
    return {
      ...base, type: 'boost', priority: 'medium',
      title:  '📣 Needs visibility',
      reason: `Only ${dish.views} views despite ${dish.orders} orders (good conversion when seen).`,
      action: 'Move higher in menu. Add to featured section. Consider a discount to drive discovery.',
      impact: `${dish.views} → 200 views could yield +${Math.round(200 * dish.conversionRate / 100)} orders`,
    }
  }

  // NO ORDERS, SOME VIEWS — potential issue
  if (dish.orders === 0 && dish.views > 30) {
    return {
      ...base, type: 'review', priority: 'high',
      title:  '🔍 Zero orders despite views',
      reason: `${dish.views} people viewed this dish but nobody ordered. Price or availability may be blocking purchases.`,
      action: 'Check availability, price, and description. Consider a temporary discount.',
      impact: 'Even 5% conversion = ' + Math.round(dish.views * 0.05) + ' new orders',
    }
  }

  // AR DISH WITH LOW AR ENGAGEMENT
  if (dish.hasAr && dish.arEngagementRate < 15 && dish.views > 50) {
    return {
      ...base, type: 'improve', priority: 'medium',
      title:  '📦 3D model underused',
      reason: `Only ${dish.arEngagementRate.toFixed(0)}% of viewers try the AR view. AR dishes typically convert 30% better when used.`,
      action: 'Add a "Tap to see in 3D" prompt. Improve model quality. Check model load time.',
      impact: 'AR conversion uplift could add ' + Math.round(dish.views * 0.05) + ' orders',
    }
  }

  // VERY LOW SCORE — consider removing
  if (dish.dishScore < 15 && dish.views > 50 && dish.orders === 0) {
    return {
      ...base, type: 'remove', priority: 'medium',
      title:  '🗑 Consider removing',
      reason: `Score ${dish.dishScore}/100. Low views, zero orders. Not contributing to menu performance.`,
      action: 'Remove or replace with a new item. Use the slot for a stronger offering.',
      impact: 'Leaner menu improves average menu conversion rate',
    }
  }

  // PERFORMING WELL
  return {
    ...base, type: 'ok', priority: 'low',
    title:  '✅ Performing well',
    reason: `Score ${dish.dishScore}/100. ${dish.orders} orders at ${dish.conversionRate.toFixed(1)}% conversion.`,
    action: 'Maintain current positioning. Monitor for seasonal shifts.',
    impact: 'Stable contributor to menu revenue',
  }
}
