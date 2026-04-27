import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { readDb, writeDb } from '@/lib/db'

type Params = { params: { slug: string; itemId: string } }

const ItemUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).optional(),
  price: z.number().min(0).max(100_000).optional(),
  emoji: z.string().max(10).optional(),
  categoryId: z.string().optional(),
  modelUrl: z.string().max(500).optional(),
  hasAr: z.boolean().optional(),
  dietaryTags: z.array(z.string().max(50)).max(10).optional(),
  available: z.boolean().optional(),
  imageUrl: z.string().max(500).optional(),
})

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const db = await readDb()
    const item = db.items.find(i => i.id === params.itemId)
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(item)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const body = await req.json().catch(() => null)
    const parsed = ItemUpdateSchema.safeParse(body)

    if (!parsed.success) {
      const message = parsed.error.errors[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: message }, { status: 422 })
    }

    const db = await readDb()
    const idx = db.items.findIndex(i => i.id === params.itemId)
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    db.items[idx] = { ...db.items[idx], ...parsed.data }
    await writeDb(db)
    return NextResponse.json(db.items[idx])
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const db = await readDb()
    const item = db.items.find(i => i.id === params.itemId)
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    db.items = db.items.filter(i => i.id !== params.itemId)
    await writeDb(db)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
