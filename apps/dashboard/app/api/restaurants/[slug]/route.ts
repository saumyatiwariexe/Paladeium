import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { readDb, writeDb } from '@/lib/db'

type Params = { params: { slug: string } }

const RestaurantUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['active', 'inactive', 'pending']).optional(),
  targetsUrl: z.string().url().nullable().optional(),
}).strict()

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const db = await readDb()
    const restaurant =
      db.restaurants.find(r => r.slug === params.slug) ??
      db.restaurants.find(r => r.id === params.slug)

    if (!restaurant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const categories = db.categories
      .filter(c => c.restaurantId === restaurant.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)

    return NextResponse.json({ restaurant, categories })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const body = await req.json().catch(() => null)
    const parsed = RestaurantUpdateSchema.safeParse(body)

    if (!parsed.success) {
      const message = parsed.error.errors[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: message }, { status: 422 })
    }

    const db = await readDb()
    const idx = db.restaurants.findIndex(r => r.slug === params.slug || r.id === params.slug)
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    db.restaurants[idx] = {
      ...db.restaurants[idx],
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    }
    await writeDb(db)
    return NextResponse.json(db.restaurants[idx])
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const db = await readDb()
    const restaurant = db.restaurants.find(r => r.slug === params.slug || r.id === params.slug)
    if (!restaurant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    db.restaurants = db.restaurants.filter(r => r.id !== restaurant.id)
    db.categories  = db.categories.filter(c => c.restaurantId !== restaurant.id)
    db.items       = db.items.filter(i => i.restaurantId !== restaurant.id)
    await writeDb(db)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
