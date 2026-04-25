import { NextRequest, NextResponse } from 'next/server'
import { readDb, writeDb } from '@/lib/db'
import { v4 as uuid } from 'uuid'
import type { LensMenuResponse } from '@/lib/types'

type Params = { params: { slug: string } }

// GET /api/restaurants/[slug]/menu — public, consumed by AR Lens
export async function GET(_req: NextRequest, { params }: Params) {
  const db = await readDb()
  const restaurant =
    db.restaurants.find(r => r.slug === params.slug) ??
    db.restaurants.find(r => r.id === params.slug)

  if (!restaurant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const categories = db.categories
    .filter(c => c.restaurantId === restaurant.id)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const items = db.items.filter(i => i.restaurantId === restaurant.id && i.available)

  const menu = items.map(item => {
    const cat = categories.find(c => c.id === item.categoryId)
    return {
      id: item.id,
      name: item.name,
      desc: item.description,
      price: `₹${item.price}`,
      emoji: item.emoji || '🍽',
      cat: cat?.name.toLowerCase() ?? 'other',
      model: item.modelUrl || null,
      hasAR: item.hasAr,
    }
  })

  const response: LensMenuResponse = {
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      targetsUrl: null,
      currency: 'INR',
    },
    menu,
    categories: categories.map(c => ({ id: c.id, name: c.name, emoji: c.emoji })),
  }

  return NextResponse.json(response)
}

// POST /api/restaurants/[slug]/menu — add menu item
export async function POST(req: NextRequest, { params }: Params) {
  const body = await req.json()
  const db = await readDb()

  const restaurant =
    db.restaurants.find(r => r.slug === params.slug) ??
    db.restaurants.find(r => r.id === params.slug)
  if (!restaurant) return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })

  let categoryId = body.categoryId as string
  if (categoryId === '__new__' || (!categoryId && body.newCategoryName)) {
    const existingCats = db.categories.filter(c => c.restaurantId === restaurant.id)
    const newCat = {
      id: uuid(),
      restaurantId: restaurant.id,
      name: body.newCategoryName ?? 'Other',
      emoji: body.newCategoryEmoji ?? '🍽',
      sortOrder: existingCats.length + 1,
    }
    db.categories.push(newCat)
    categoryId = newCat.id
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 422 })
  }

  const item = {
    id: uuid(),
    restaurantId: restaurant.id,
    categoryId,
    name: body.name.trim(),
    description: body.description?.trim() ?? '',
    price: Number(body.price) || 0,
    emoji: body.emoji?.trim() || '🍽',
    imageUrl: body.imageUrl ?? '',
    modelUrl: body.modelUrl?.trim() ?? '',
    hasAr: Boolean(body.hasAr),
    dietaryTags: Array.isArray(body.dietaryTags) ? body.dietaryTags : [],
    available: body.available !== false,
    createdAt: new Date().toISOString(),
  }

  db.items.push(item)
  await writeDb(db)

  return NextResponse.json(item, { status: 201 })
}
