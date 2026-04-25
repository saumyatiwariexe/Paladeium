import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { readDb, writeDb } from '@/lib/db'
import { v4 as uuid } from 'uuid'

const RestaurantSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only')
    .trim(),
  description: z.string().max(500).optional().default(''),
  status: z.enum(['active', 'inactive']).optional().default('active'),
})

export async function GET() {
  const db = await readDb()
  return NextResponse.json(db.restaurants)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = RestaurantSchema.safeParse(body)

  if (!parsed.success) {
    const message = parsed.error.errors[0]?.message ?? 'Invalid request'
    return NextResponse.json({ error: message }, { status: 422 })
  }

  const { name, slug, description, status } = parsed.data
  const db = await readDb()

  if (db.restaurants.some(r => r.slug === slug)) {
    return NextResponse.json({ error: 'Slug already taken — choose a different one' }, { status: 409 })
  }

  const now = new Date().toISOString()
  const restaurant = {
    id: uuid(),
    name,
    slug,
    description,
    status,
    createdAt: now,
    updatedAt: now,
  }

  db.restaurants.push(restaurant)
  await writeDb(db)

  return NextResponse.json(restaurant, { status: 201 })
}
