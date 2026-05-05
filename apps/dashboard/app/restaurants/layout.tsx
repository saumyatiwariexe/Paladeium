import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { sessionOptions, type SessionData } from '@/lib/session'
import { readDb } from '@/lib/db'
import AppShell from '@/components/AppShell'
import type { NextRequest } from 'next/server'

export default async function RestaurantsLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  // Build a minimal request-like object for getIronSession
  const req  = { headers: { cookie: cookieStore.toString() } } as unknown as NextRequest
  const res  = new Response()
  const session = await getIronSession<SessionData>(req, res, sessionOptions)

  const db = await readDb()
  const restaurants = session.role === 'superadmin'
    ? db.restaurants
    : db.restaurants.filter(r => session.restaurantIds?.includes(r.id))

  return (
    <AppShell
      restaurants={restaurants}
      session={{ userId: session.userId, role: session.role, restaurantIds: session.restaurantIds, email: session.email }}
    >
      {children}
    </AppShell>
  )
}
