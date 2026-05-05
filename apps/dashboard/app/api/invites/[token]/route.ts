import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { z } from 'zod'
import { sessionOptions, type SessionData } from '@/lib/session'
import { readDb, writeDb } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

type Params = { params: { token: string } }

// GET — validate token and return user info (for the accept-invite page)
export async function GET(_req: NextRequest, { params }: Params) {
  const db   = await readDb()
  const user = db.users.find(u => u.inviteToken === params.token)

  if (!user || user.status !== 'invited') {
    return NextResponse.json({ error: 'Invalid or expired invite link' }, { status: 404 })
  }
  if (user.inviteExpiry && new Date(user.inviteExpiry) < new Date()) {
    return NextResponse.json({ error: 'This invite link has expired' }, { status: 410 })
  }

  const restaurants = db.restaurants.filter(r => user.restaurantIds.includes(r.id))

  return NextResponse.json({
    email:       user.email,
    role:        user.role,
    restaurants: restaurants.map(r => ({ id: r.id, name: r.name })),
  })
}

// POST — accept invite: set password, activate account
export async function POST(req: NextRequest, { params }: Params) {
  const body   = await req.json().catch(() => null)
  const parsed = z.object({ password: z.string().min(8).max(128) }).safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 422 })
  }

  const db   = await readDb()
  const user = db.users.find(u => u.inviteToken === params.token)

  if (!user || user.status !== 'invited') {
    return NextResponse.json({ error: 'Invalid or expired invite link' }, { status: 404 })
  }
  if (user.inviteExpiry && new Date(user.inviteExpiry) < new Date()) {
    return NextResponse.json({ error: 'This invite link has expired' }, { status: 410 })
  }

  user.passwordHash  = await hashPassword(parsed.data.password)
  user.status        = 'active'
  user.inviteToken   = null
  user.inviteExpiry  = null
  await writeDb(db)

  // Auto-login
  const response = NextResponse.json({ ok: true, role: user.role })
  const session  = await getIronSession<SessionData>(req, response, sessionOptions)
  session.userId        = user.id
  session.email         = user.email
  session.role          = user.role
  session.restaurantIds = user.restaurantIds
  await session.save()

  return response
}
