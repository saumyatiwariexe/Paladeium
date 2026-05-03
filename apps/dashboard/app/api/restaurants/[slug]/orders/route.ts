import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { readDb, writeDb } from '@/lib/db'
import { v4 as uuid } from 'uuid'

type Params = { params: { slug: string } }

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const OrderSchema = z.object({
  customer: z.object({
    name:    z.string().min(1).max(100).trim(),
    phone:   z.string().min(5).max(20).trim(),
    address: z.string().min(1).max(300).trim(),
    gender:  z.enum(['male', 'female', 'other', 'prefer_not']),
    age:     z.number().int().min(1).max(120),
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
