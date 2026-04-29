import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { readDb, writeDb } from '@/lib/db'
import { v4 as uuid } from 'uuid'
import type { LensMenuResponse } from '@/lib/types'

type Params = { params: { slug: string } }

const DimensionsSchema = z.object({
  length: z.number().min(0),
  breadth: z.number().min(0),
  height: z.number().min(0),
  unit: z.enum(['m', 'cm', 'in']),
}).optional()

const MenuItemSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).trim(),
  description: z.string().max(500).optional().default(''),
  price: z.number().min(0).max(100_000),
  emoji: z.string().max(10).optional().default('🍽'),
  categoryId: z.string().optional(),
  newCategoryName: z.string().max(50).optional(),
  newCategoryEmoji: z.string().max(10).optional(),
  modelUrl: z.string().max(500).optional().default(''),
  hasAr: z.boolean().optional().default(false),
  dietaryTags: z.array(z.string().max(50)).max(10).optional().default([]),
  available: z.boolean().optional().default(true),
  imageUrl: z.string().max(500).optional().default(''),
  dimensions: DimensionsSchema,
})

// GET /api/restaurants/[slug]/menu — public, consumed by AR Lens
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
        dimensions: item.dimensions,
      }
    })

    const response: LensMenuResponse = {
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        targetsUrl: restaurant.targetsUrl ?? null,
        currency: 'INR',
      },
      menu,
      categories: categories.map(c => ({ id: c.id, name: c.name, emoji: c.emoji })),
    }

    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    return NextResponse.json(response, { headers })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

// POST /api/restaurants/[slug]/menu — add menu item (auth via middleware)
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const body = await req.json().catch(() => null)
    const parsed = MenuItemSchema.safeParse(body)

    if (!parsed.success) {
      const message = parsed.error.errors[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: message }, { status: 422 })
    }

    const data = parsed.data
    const db = await readDb()

    const restaurant =
      db.restaurants.find(r => r.slug === params.slug) ??
      db.restaurants.find(r => r.id === params.slug)
    if (!restaurant) return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })

    let categoryId = data.categoryId ?? ''
    if (categoryId === '__new__' || (!categoryId && data.newCategoryName)) {
      const existingCats = db.categories.filter(c => c.restaurantId === restaurant.id)
      const newCat = {
        id: uuid(),
        restaurantId: restaurant.id,
        name: data.newCategoryName ?? 'Other',
        emoji: data.newCategoryEmoji ?? '🍽',
        sortOrder: existingCats.length + 1,
      }
      db.categories.push(newCat)
      categoryId = newCat.id
    }

    const item = {
      id: uuid(),
      restaurantId: restaurant.id,
      categoryId,
      name: data.name,
      description: data.description,
      price: data.price,
      emoji: data.emoji,
      imageUrl: data.imageUrl,
      modelUrl: data.modelUrl,
      hasAr: data.hasAr,
      dietaryTags: data.dietaryTags,
      available: data.available,
      dimensions: data.dimensions,
      createdAt: new Date().toISOString(),
    }

    db.items.push(item)
    await writeDb(db)

    return NextResponse.json(item, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
