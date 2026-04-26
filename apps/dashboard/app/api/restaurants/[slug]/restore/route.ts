import { NextRequest, NextResponse } from 'next/server'
import { readDb, writeDb } from '@/lib/db'

type Params = { params: { slug: string } }

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const db = await readDb()
    const idx = db.restaurants.findIndex(r => r.slug === params.slug || r.id === params.slug)
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (db.restaurants[idx].status !== 'pendingDeletion') {
      return NextResponse.json({ error: 'Restaurant is not scheduled for deletion' }, { status: 400 })
    }

    db.restaurants[idx] = {
      ...db.restaurants[idx],
      status: 'active',
      deleteAt: null,
      updatedAt: new Date().toISOString(),
    }
    await writeDb(db)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
