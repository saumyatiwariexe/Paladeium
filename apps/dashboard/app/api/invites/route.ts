import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { z } from 'zod'
import { v4 as uuid } from 'uuid'
import { sessionOptions, type SessionData } from '@/lib/session'
import { readDb, writeDb } from '@/lib/db'
import { generateInviteToken, inviteExpiry } from '@/lib/auth'
import { sendInviteEmail } from '@/lib/email'
import { canPerform, invitableRoles } from '@/lib/permissions'
import { getBaseUrl } from '@/lib/url'
import type { User } from '@/lib/types'

const InviteSchema = z.object({
  email:        z.string().email().max(254),
  role:         z.enum(['owner', 'manager', 'staff']),
  restaurantId: z.string().optional(), // required for owner/manager/staff
})

export async function POST(req: NextRequest) {
  const res     = NextResponse.next()
  const session = await getIronSession<SessionData>(req, res, sessionOptions)

  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json().catch(() => null)
  const parsed = InviteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid request' }, { status: 422 })
  }

  const { email, role, restaurantId } = parsed.data

  // Check inviter can invite this role
  const allowed = invitableRoles(session.role ?? 'staff').includes(role)
  if (!allowed) return NextResponse.json({ error: 'You cannot invite this role' }, { status: 403 })

  // Check restaurant access when restaurantId provided
  if (restaurantId && !canPerform(session, 'invite', restaurantId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db = await readDb()

  // Don't create duplicate pending invites for same email
  const existing = db.users.find(u => u.email.toLowerCase() === email.toLowerCase())
  if (existing && existing.status === 'active') {
    return NextResponse.json({ error: 'User already exists with that email' }, { status: 409 })
  }

  const restaurant = restaurantId ? db.restaurants.find(r => r.id === restaurantId) : undefined

  const token   = generateInviteToken()
  const expiry  = inviteExpiry(72)

  if (existing && existing.status === 'invited') {
    // Re-send invite: refresh token
    existing.inviteToken  = token
    existing.inviteExpiry = expiry
    if (restaurantId && !existing.restaurantIds.includes(restaurantId)) {
      existing.restaurantIds.push(restaurantId)
    }
    await writeDb(db)
  } else {
    const user: User = {
      id:            uuid(),
      email,
      passwordHash:  null,
      role,
      restaurantIds: restaurantId ? [restaurantId] : [],
      status:        'invited',
      inviteToken:   token,
      inviteExpiry:  expiry,
      createdAt:     new Date().toISOString(),
      createdBy:     session.userId,
    }
    db.users.push(user)
    await writeDb(db)
  }

  const inviteUrl = `${getBaseUrl(req)}/invite/${token}`

  try {
    await sendInviteEmail(email, inviteUrl, role, restaurant?.name)
  } catch (err) {
    console.error('[invite] Email send failed:', err)
    // Don't fail the request — invite was created, email is optional
  }

  return NextResponse.json({ ok: true, inviteUrl }, { status: 201 })
}
