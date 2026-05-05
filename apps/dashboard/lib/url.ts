import type { NextRequest } from 'next/server'

/**
 * Returns the canonical base URL for building invite links.
 * Reads NEXT_PUBLIC_APP_URL from env (set in .env.local / hosting provider).
 * Falls back to the incoming request's Host header so it works across
 * all deployment environments without extra configuration.
 */
export function getBaseUrl(req: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  }
  const host  = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? ''
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  return `${proto}://${host}`
}
