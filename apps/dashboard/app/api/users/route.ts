import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions, type SessionData } from '@/lib/session'
import { readDb } from '@/lib/db'
import { canPerform } from '@/lib/permissions'

// GET /api/users?restaurantId=xxx — list users for a restaurant (or all for superadmin)
export async function GET(req: NextRequest) {
  const res     = NextResponse.next()
  const session = await getIronSession<SessionData>(req, res, sessionOptions)
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const restaurantId = req.nextUrl.searchParams.get('restaurantId') ?? undefined

  if (restaurantId && !canPerform(session, 'manage_team', restaurantId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db    = await readDb()
  let   users = db.users

  if (restaurantId) {
    users = users.filter(u => u.role === 'superadmin' || u.restaurantIds.includes(restaurantId))
  } else if (session.role !== 'superadmin') {
    // Non-superadmins can only see users in their restaurants
    users = users.filter(u =>
      u.restaurantIds.some(id => session.restaurantIds?.includes(id))
    )
  }

  // Strip sensitive fields
  return NextResponse.json(users.map(u => ({
    id:            u.id,
    email:         u.email,
    role:          u.role,
    restaurantIds: u.restaurantIds,
    status:        u.status,
    createdAt:     u.createdAt,
  })))
}
