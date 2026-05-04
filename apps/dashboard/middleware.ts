import { NextRequest, NextResponse } from 'next/server'
import { unsealData } from 'iron-session'
import type { SessionData } from '@/lib/session'

const SESSION_COOKIE = 'paladeium-session'
const SESSION_PASSWORD = process.env.SESSION_SECRET ?? 'dev-only-placeholder-must-be-32-chars!'

const PUBLIC_PREFIXES = ['/login', '/api/auth/', '/_next', '/favicon.ico']

function isPublic(pathname: string, method: string): boolean {
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return true
  
  if (
    (
      ['GET', 'HEAD', 'OPTIONS'].includes(method) &&
      (
        /^\/api\/restaurants\/[^/]+\/menu$/.test(pathname) ||
        /^\/api\/restaurants\/[^/]+\/models\/.*$/.test(pathname)
      )
    ) ||
    (
      method === 'POST' &&
      /^\/api\/restaurants\/[^/]+\/orders$/.test(pathname)
    )
  ) return true

  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublic(pathname, request.method)) return NextResponse.next()

  const cookieValue = request.cookies.get(SESSION_COOKIE)?.value
  let isAdmin = false

  if (cookieValue) {
    try {
      const session = await unsealData<SessionData>(cookieValue, { password: SESSION_PASSWORD })
      isAdmin = session.isAdmin === true
    } catch {
      // Expired or tampered cookie
    }
  }

  if (!isAdmin) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
