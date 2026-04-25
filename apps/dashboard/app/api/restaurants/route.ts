import { NextRequest, NextResponse } from 'next/server'
import { readDb, writeDb } from '@/lib/db'
import { v4 as uuid } from 'uuid'

export async function GET() {
  const db = await readDb()
  return NextResponse.json(db.restaurants)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, slug, description, status } = body

  if (!name?.trim() || !slug?.trim()) {
    return NextResponse.json({ error: 'Name and slug are required' }, { status: 422 })
  }

  const db = await readDb()

  if (db.restaurants.some(r => r.slug === slug)) {
    return NextResponse.json({ error: 'Slug already taken — choose a different one' }, { status: 409 })
  }

  const now = new Date().toISOString()
  const restaurant = {
    id: uuid(),
    name: name.trim(),
    slug: slug.trim(),
    description: description?.trim() ?? '',
    status: status ?? 'active',
    createdAt: now,
    updatedAt: now,
  }

  db.restaurants.push(restaurant)
  await writeDb(db)

  return NextResponse.json(restaurant, { status: 201 })
}
