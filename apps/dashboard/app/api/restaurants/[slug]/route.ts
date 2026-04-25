import { NextRequest, NextResponse } from 'next/server'
import { readDb, writeDb } from '@/lib/db'

type Params = { params: { slug: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const db = await readDb()
  const restaurant =
    db.restaurants.find(r => r.slug === params.slug) ??
    db.restaurants.find(r => r.id === params.slug)

  if (!restaurant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const categories = db.categories
    .filter(c => c.restaurantId === restaurant.id)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  return NextResponse.json({ restaurant, categories })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const body = await req.json()
  const db = await readDb()
  const idx = db.restaurants.findIndex(r => r.slug === params.slug || r.id === params.slug)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  db.restaurants[idx] = {
    ...db.restaurants[idx],
    ...body,
    id: db.restaurants[idx].id,
    slug: db.restaurants[idx].slug,
    updatedAt: new Date().toISOString(),
  }
  await writeDb(db)
  return NextResponse.json(db.restaurants[idx])
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const db = await readDb()
  const restaurant = db.restaurants.find(r => r.slug === params.slug || r.id === params.slug)
  if (!restaurant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  db.restaurants = db.restaurants.filter(r => r.id !== restaurant.id)
  db.categories  = db.categories.filter(c => c.restaurantId !== restaurant.id)
  db.items       = db.items.filter(i => i.restaurantId !== restaurant.id)
  await writeDb(db)
  return NextResponse.json({ ok: true })
}
