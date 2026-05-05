import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions, type SessionData } from '@/lib/session'

export async function GET(req: NextRequest) {
  const res     = NextResponse.next()
  const session = await getIronSession<SessionData>(req, res, sessionOptions)
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json({
    userId:        session.userId,
    email:         session.email,
    role:          session.role,
    restaurantIds: session.restaurantIds,
  })
}
