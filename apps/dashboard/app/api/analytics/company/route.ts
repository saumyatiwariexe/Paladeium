import { NextResponse } from 'next/server'
import { readDb } from '@/lib/db'
import { generateCompanyAnalytics } from '@/lib/analytics'
import type { MenuItem } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = await readDb()

    // Build items map: restaurantId → items[]
    const itemsMap: Record<string, MenuItem[]> = {}
    for (const item of db.items) {
      if (!itemsMap[item.restaurantId]) itemsMap[item.restaurantId] = []
      itemsMap[item.restaurantId].push(item)
    }

    const analytics = generateCompanyAnalytics(db.restaurants, itemsMap)

    return NextResponse.json(analytics, {
      headers: { 'Cache-Control': 'private, max-age=60' },
    })
  } catch (err) {
    console.error('[analytics/company]', err)
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 })
  }
}
