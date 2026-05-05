import type { SessionOptions } from 'iron-session'
import type { UserRole } from './types'

const FALLBACK_SESSION_SECRET = 'dev-only-placeholder-must-be-32-chars!'

export interface SessionData {
  userId?: string
  email?: string
  role?: UserRole
  restaurantIds?: string[]
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? FALLBACK_SESSION_SECRET,
  cookieName: 'paladeium-session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  },
}

if (process.env.NODE_ENV === 'production' && sessionOptions.password === FALLBACK_SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set in production')
}
