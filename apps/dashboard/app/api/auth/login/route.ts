import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { timingSafeEqual } from 'crypto'
import { z } from 'zod'
import { sessionOptions, type SessionData } from '@/lib/session'
import { checkLoginRateLimit } from '@/lib/ratelimit'

const LoginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
})

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  // Always run comparison to prevent timing attacks on length difference
  const result = timingSafeEqual(
    Buffer.concat([bufA, Buffer.alloc(Math.max(0, bufB.length - bufA.length))]),
    Buffer.concat([bufB, Buffer.alloc(Math.max(0, bufA.length - bufB.length))]),
  )
  return result && bufA.length === bufB.length
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'

  const { allowed, retryAfter } = await checkLoginRateLimit(ip)
  if (!allowed) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${Math.ceil((retryAfter ?? 900) / 60)} minutes.` },
      { status: 429, headers: { 'Retry-After': String(retryAfter ?? 900) } },
    )
  }

  const body = await req.json().catch(() => null)
  const parsed = LoginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { email, password } = parsed.data
  const validEmail = process.env.DASHBOARD_EMAIL ?? 'admin@paladeium.com'
  const validPassword = process.env.DASHBOARD_PASSWORD ?? 'changeme'

  const emailOk = safeCompare(email, validEmail)
  const passwordOk = safeCompare(password, validPassword)

  if (!emailOk || !passwordOk) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  const session = await getIronSession<SessionData>(req, response, sessionOptions)
  session.isAdmin = true
  await session.save()

  return response
}
