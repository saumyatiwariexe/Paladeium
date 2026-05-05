import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { z } from 'zod'
import { v4 as uuid } from 'uuid'
import { sessionOptions, type SessionData } from '@/lib/session'
import { readDb, writeDb } from '@/lib/db'
import { generateInviteToken, inviteExpiry } from '@/lib/auth'
import { sendInviteEmail } from '@/lib/email'
import type { User } from '@/lib/types'

const RestaurantSchema = z.object({
  name:        z.string().min(1).max(100).trim(),
  slug:        z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only').trim(),
  description: z.string().max(500).optional().default(''),
  status:      z.enum(['active', 'inactive', 'pending']).optional().default('active'),
  ownerEmail:  z.string().email().max(254).optional(), // triggers owner invite
})

export async function GET(req: NextRequest) {
  try {
    const res     = NextResponse.next()
    const session = await getIronSession<SessionData>(req, res, sessionOptions)
    const db      = await readDb()

    if (session.role === 'superadmin') {
      return NextResponse.json(db.restaurants)
    }
    // Non-superadmin: return only their restaurants
    const visible = db.restaurants.filter(r => session.restaurantIds?.includes(r.id))
    return NextResponse.json(visible)
  } catch {
    return NextResponse.json({ error: 'Failed to load restaurants' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const res     = NextResponse.next()
    const session = await getIronSession<SessionData>(req, res, sessionOptions)

    if (session.role !== 'superadmin') {
      return NextResponse.json({ error: 'Only super-admins can create restaurants' }, { status: 403 })
    }

    const body   = await req.json().catch(() => null)
    const parsed = RestaurantSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid request' }, { status: 422 })
    }

    const { name, slug, description, status, ownerEmail } = parsed.data
    const db = await readDb()

    if (db.restaurants.some(r => r.slug === slug)) {
      return NextResponse.json({ error: 'Slug already taken — choose a different one' }, { status: 409 })
    }

    const now        = new Date().toISOString()
    const restaurant = { id: uuid(), name, slug, description, status, targetsUrl: null, createdAt: now, updatedAt: now }
    db.restaurants.push(restaurant)

    let inviteUrl: string | undefined

    if (ownerEmail) {
      const existing = db.users.find(u => u.email.toLowerCase() === ownerEmail.toLowerCase())
      const token    = generateInviteToken()
      const expiry   = inviteExpiry(72)

      if (existing && existing.status === 'invited') {
        existing.role = 'owner'
        if (!existing.restaurantIds.includes(restaurant.id)) existing.restaurantIds.push(restaurant.id)
        existing.inviteToken  = token
        existing.inviteExpiry = expiry
      } else if (!existing) {
        const owner: User = {
          id: uuid(), email: ownerEmail, passwordHash: null, role: 'owner',
          restaurantIds: [restaurant.id], status: 'invited',
          inviteToken: token, inviteExpiry: expiry,
          createdAt: now, createdBy: session.userId ?? null,
        }
        db.users.push(owner)
      }

      await writeDb(db)

      const baseUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      inviteUrl     = `${baseUrl}/invite/${token}`

      try { await sendInviteEmail(ownerEmail, inviteUrl, 'owner', name) }
      catch (err) { console.error('[restaurants] invite email failed:', err) }
    } else {
      await writeDb(db)
    }

    return NextResponse.json({ ...restaurant, inviteUrl }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
