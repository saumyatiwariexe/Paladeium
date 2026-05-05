import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { z } from 'zod'
import { readDb, writeDb } from '@/lib/db'
import { sessionOptions, type SessionData } from '@/lib/session'
import { canPerform } from '@/lib/permissions'
import { v4 as uuid } from 'uuid'

type Params = { params: { slug: string } }

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const OrderSchema = z.object({
  customer: z.object({
    name:    z.string().min(1).max(100).trim(),
    phone:   z.string().min(5).max(20).trim(),
    address: z.string().max(300).trim().optional().default(''),
    gender:  z.enum(['male', 'female', 'other', 'prefer_not']).optional().default('prefer_not'),
    age:     z.number().int().min(0).max(120).optional().default(0),
  }),
  items: z.array(z.object({
    id:    z.string(),
    name:  z.string(),
    price: z.string(),
    qty:   z.number().int().min(1),
  })).min(1),
  total: z.number().min(0),
})

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS })
}

// GET /api/restaurants/[slug]/orders — dashboard: list orders for a restaurant
export async function GET(req: NextRequest, { params }: Params) {
  const res     = NextResponse.next()
  const session = await getIronSession<SessionData>(req, res, sessionOptions)
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await readDb()
  const restaurant =
    db.restaurants.find(r => r.slug === params.slug) ??
    db.restaurants.find(r => r.id   === params.slug)

  if (!restaurant) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canPerform(session, 'read', restaurant.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const since  = req.nextUrl.searchParams.get('since') // ISO — only return newer orders
  const orders = (db.orders ?? [])
    .filter(o => o.restaurantId === restaurant.id)
    .filter(o => since ? o.createdAt > since : true)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return NextResponse.json(orders)
}

// PATCH /api/restaurants/[slug]/orders — update order status { orderId, status }
export async function PATCH(req: NextRequest, { params }: Params) {
  const res     = NextResponse.next()
  const session = await getIronSession<SessionData>(req, res, sessionOptions)
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await readDb()
  const restaurant =
    db.restaurants.find(r => r.slug === params.slug) ??
    db.restaurants.find(r => r.id   === params.slug)

  if (!restaurant) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canPerform(session, 'write', restaurant.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null) as { orderId?: string; status?: string } | null
  if (!body?.orderId || !['confirmed', 'rejected'].includes(body.status ?? '')) {
    return NextResponse.json({ error: 'orderId and valid status required' }, { status: 422 })
  }

  const order = (db.orders ?? []).find(o => o.id === body.orderId && o.restaurantId === restaurant.id)
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  order.status = body.status as 'confirmed' | 'rejected'
  await writeDb(db)

  return NextResponse.json({ ok: true, order })
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const body   = await req.json().catch(() => null)
    const parsed = OrderSchema.safeParse(body)

    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 422, headers: CORS })
    }

    const db = await readDb()
    const restaurant =
      db.restaurants.find(r => r.slug === params.slug) ??
      db.restaurants.find(r => r.id   === params.slug)

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404, headers: CORS })
    }

    if (!restaurant.paymentEnabled) {
      return NextResponse.json({ error: 'Ordering not enabled for this restaurant' }, { status: 403, headers: CORS })
    }

    const order = {
      id:             uuid(),
      restaurantId:   restaurant.id,
      restaurantSlug: restaurant.slug,
      customer:       parsed.data.customer,
      items:          parsed.data.items,
      total:          parsed.data.total,
      status:         'pending' as const,
      createdAt:      new Date().toISOString(),
    }

    if (!db.orders) db.orders = []
    db.orders.push(order)
    await writeDb(db)

    return NextResponse.json(
      { ok: true, orderId: order.id, message: 'Order placed successfully' },
      { status: 201, headers: CORS }
    )
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS })
  }
}
