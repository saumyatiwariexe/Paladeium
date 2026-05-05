import { NextRequest, NextResponse } from 'next/server'
import { unsealData } from 'iron-session'
import type { SessionData } from '@/lib/session'

const SESSION_COOKIE    = 'paladeium-session'
const SESSION_PASSWORD  = process.env.SESSION_SECRET ?? 'dev-only-placeholder-must-be-32-chars!'

// Fully public — no auth needed
const PUBLIC_PREFIXES = ['/login', '/invite/', '/api/auth/', '/api/invites/', '/_next', '/favicon.ico']

function isPublic(pathname: string, method: string): boolean {
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return true

  // AR Lens public APIs
  if (['GET', 'HEAD', 'OPTIONS'].includes(method) &&
      (/^\/api\/restaurants\/[^/]+\/menu$/.test(pathname) ||
       /^\/api\/restaurants\/[^/]+\/models\/.*$/.test(pathname))) return true

  if (method === 'OPTIONS') return true
  if (method === 'POST' && /^\/api\/restaurants\/[^/]+\/orders$/.test(pathname)) return true
  if (method === 'GET'  && /^\/api\/restaurants\/[^/]+\/orders\/[^/]+$/.test(pathname)) return true
  if (method === 'POST' && pathname === '/api/track/event') return true

  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublic(pathname, request.method)) return NextResponse.next()

  const cookieValue = request.cookies.get(SESSION_COOKIE)?.value
  let session: SessionData | null = null

  if (cookieValue) {
    try {
      session = await unsealData<SessionData>(cookieValue, { password: SESSION_PASSWORD })
    } catch { /* expired or tampered */ }
  }

  const authenticated = !!(session?.userId && session?.role)

  if (!authenticated) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Superadmin can access everything
  if (session!.role === 'superadmin') return NextResponse.next()

  // Non-superadmin cannot access company-level routes
  if (pathname.startsWith('/company') || pathname.startsWith('/api/analytics/company')) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const url = request.nextUrl.clone()
    url.pathname = '/restaurants'
    return NextResponse.redirect(url)
  }

  // Restaurant-scoped routes: check the [id] segment
  const restaurantMatch = pathname.match(/^\/(?:restaurants|api\/(?:restaurants|analytics\/restaurant))\/([^/]+)/)
  if (restaurantMatch) {
    const id = restaurantMatch[1]
    const allowed = session!.restaurantIds?.includes(id) ?? false
    if (!allowed) {
      if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      const url = request.nextUrl.clone()
      url.pathname = '/restaurants'
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
