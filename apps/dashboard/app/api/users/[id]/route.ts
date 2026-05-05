import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions, type SessionData } from '@/lib/session'
import { readDb, writeDb } from '@/lib/db'
import { canPerform } from '@/lib/permissions'

type Params = { params: { id: string } }

// DELETE /api/users/[id] — remove user from a restaurant (or entirely for superadmin)
export async function DELETE(req: NextRequest, { params }: Params) {
  const res     = NextResponse.next()
  const session = await getIronSession<SessionData>(req, res, sessionOptions)
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const restaurantId = req.nextUrl.searchParams.get('restaurantId') ?? undefined

  if (restaurantId && !canPerform(session, 'manage_team', restaurantId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db   = await readDb()
  const user = db.users.find(u => u.id === params.id)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Can't remove yourself
  if (user.id === session.userId) {
    return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })
  }

  // Can't remove a superadmin unless you are one
  if (user.role === 'superadmin' && session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (restaurantId) {
    // Just revoke access to this restaurant
    user.restaurantIds = user.restaurantIds.filter(id => id !== restaurantId)
    // If no restaurants left and not superadmin, deactivate
    if (user.restaurantIds.length === 0 && user.role !== 'superadmin') {
      db.users = db.users.filter(u => u.id !== params.id)
    }
  } else if (session.role === 'superadmin') {
    // Full removal
    db.users = db.users.filter(u => u.id !== params.id)
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await writeDb(db)
  return NextResponse.json({ ok: true })
}
