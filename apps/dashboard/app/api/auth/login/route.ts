import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { z } from 'zod'
import { sessionOptions, type SessionData } from '@/lib/session'
import { checkLoginRateLimit } from '@/lib/ratelimit'
import { verifyPassword } from '@/lib/auth'
import { readDb } from '@/lib/db'

const LoginSchema = z.object({
  email:    z.string().email().max(254),
  password: z.string().min(1).max(128),
})

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'

  const { allowed, retryAfter } = await checkLoginRateLimit(ip)
  if (!allowed) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${Math.ceil((retryAfter ?? 900) / 60)} minutes.` },
      { status: 429, headers: { 'Retry-After': String(retryAfter ?? 900) } },
    )
  }

  const body   = await req.json().catch(() => null)
  const parsed = LoginSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const { email, password } = parsed.data
  const db   = await readDb()
  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase())

  if (!user || user.status !== 'active' || !user.passwordHash) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const ok = await verifyPassword(password, user.passwordHash)
  if (!ok) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })

  const response = NextResponse.json({ ok: true, role: user.role })
  const session  = await getIronSession<SessionData>(req, response, sessionOptions)
  session.userId        = user.id
  session.email         = user.email
  session.role          = user.role
  session.restaurantIds = user.restaurantIds
  await session.save()

  return response
}
