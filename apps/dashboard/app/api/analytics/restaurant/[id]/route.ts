import { NextRequest, NextResponse } from 'next/server'
import { readDb } from '@/lib/db'
import { generateRestaurantAnalytics } from '@/lib/analytics'
import { generateRecommendations } from '@/lib/recommendations'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const db = await readDb()
    const restaurant =
      db.restaurants.find(r => r.id === params.id) ??
      db.restaurants.find(r => r.slug === params.id)

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
    }

    const items       = db.items.filter(i => i.restaurantId === restaurant.id)
    const analytics   = generateRestaurantAnalytics(restaurant, items)
    const recommendations = generateRecommendations(analytics.dishes)

    return NextResponse.json(
      { ...analytics, recommendations },
      { headers: { 'Cache-Control': 'private, max-age=60' } }
    )
  } catch (err) {
    console.error('[analytics/restaurant]', err)
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 })
  }
}
