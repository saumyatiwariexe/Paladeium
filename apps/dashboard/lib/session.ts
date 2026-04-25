import type { SessionOptions } from 'iron-session'

export interface SessionData {
  isAdmin?: boolean
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? 'dev-only-placeholder-must-be-32-chars!',
  cookieName: 'paladeium-session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
}
