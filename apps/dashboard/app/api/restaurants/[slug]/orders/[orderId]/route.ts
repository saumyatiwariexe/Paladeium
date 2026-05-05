import { NextRequest, NextResponse } from 'next/server'
import { readDb } from '@/lib/db'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

type Params = { params: { slug: string; orderId: string } }

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS })
}

// Public endpoint — orderId is a UUID (unguessable), so no auth needed.
// Used by the lens to poll order confirmation status.
export async function GET(_req: NextRequest, { params }: Params) {
  const db = await readDb()
  const restaurant =
    db.restaurants.find(r => r.slug === params.slug) ??
    db.restaurants.find(r => r.id   === params.slug)

  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404, headers: CORS })
  }

  const order = (db.orders ?? []).find(
    o => o.id === params.orderId && o.restaurantId === restaurant.id
  )

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404, headers: CORS })
  }

  return NextResponse.json(
    { id: order.id, status: order.status, total: order.total, items: order.items },
    { headers: CORS }
  )
}
