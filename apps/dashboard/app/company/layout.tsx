import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { sessionOptions, type SessionData } from '@/lib/session'
import { readDb } from '@/lib/db'
import AppShell from '@/components/AppShell'
import type { NextRequest } from 'next/server'

export default async function CompanyLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const req  = { headers: { cookie: cookieStore.toString() } } as unknown as NextRequest
  const res  = new Response()
  const session = await getIronSession<SessionData>(req, res, sessionOptions)

  const db = await readDb()

  return (
    <AppShell
      restaurants={db.restaurants}
      session={{ userId: session.userId, role: session.role, restaurantIds: session.restaurantIds, email: session.email }}
    >
      {children}
    </AppShell>
  )
}
