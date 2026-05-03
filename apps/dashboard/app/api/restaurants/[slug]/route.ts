import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { readDb, writeDb } from '@/lib/db'

type Params = { params: { slug: string } }

const RestaurantUpdateSchema = z.object({
  name:                   z.string().min(1).max(100).trim().optional(),
  description:            z.string().max(500).optional(),
  status:                 z.enum(['active', 'inactive', 'pending', 'pendingDeletion']).optional(),
  targetsUrl:             z.string().url().nullable().optional(),
  markerDetectionEnabled: z.boolean().optional(),
  arOverlayEnabled:       z.boolean().optional(),
  uiType:                 z.enum(['ar', 'dynamic']).optional(),
  paymentEnabled:         z.boolean().optional(),
  deleteAt:               z.string().nullable().optional(),
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

// Soft-delete: schedules permanent removal after 15 days
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const db = await readDb()
    const idx = db.restaurants.findIndex(r => r.slug === params.slug || r.id === params.slug)
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const deleteAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
    db.restaurants[idx] = {
      ...db.restaurants[idx],
      status: 'pendingDeletion',
      deleteAt,
      updatedAt: new Date().toISOString(),
    }
    await writeDb(db)
    return NextResponse.json({ ok: true, deleteAt })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
