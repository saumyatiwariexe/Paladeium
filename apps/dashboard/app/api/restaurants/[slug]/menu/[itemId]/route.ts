import { NextRequest, NextResponse } from 'next/server'
import { readDb, writeDb } from '@/lib/db'

type Params = { params: { slug: string; itemId: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const db = await readDb()
  const item = db.items.find(i => i.id === params.itemId)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(item)
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const body = await req.json()
  const db = await readDb()
  const idx = db.items.findIndex(i => i.id === params.itemId)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  db.items[idx] = {
    ...db.items[idx],
    ...body,
    id: db.items[idx].id,
    restaurantId: db.items[idx].restaurantId,
  }
  await writeDb(db)
  return NextResponse.json(db.items[idx])
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const db = await readDb()
  const item = db.items.find(i => i.id === params.itemId)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  db.items = db.items.filter(i => i.id !== params.itemId)
  await writeDb(db)
  return NextResponse.json({ ok: true })
}
