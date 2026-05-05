import { timingSafeEqual } from 'crypto'

// ── Password hashing via PBKDF2 (Web Crypto, no extra deps) ──────────────────

export async function hashPassword(password: string): Promise<string> {
  const enc  = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key  = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    key, 256,
  )
  return `${Buffer.from(salt).toString('hex')}:${Buffer.from(bits).toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  // Legacy plain-text env hash (bootstrapped superadmin)
  if (stored.startsWith('env:')) {
    const plain = stored.slice(4)
    const a = Buffer.from(password)
    const b = Buffer.from(plain)
    const len = Math.max(a.length, b.length)
    return timingSafeEqual(
      Buffer.concat([a, Buffer.alloc(len - a.length)]),
      Buffer.concat([b, Buffer.alloc(len - b.length)]),
    ) && a.length === b.length
  }

  const [saltHex, storedHash] = stored.split(':')
  if (!saltHex || !storedHash) return false
  const salt = Buffer.from(saltHex, 'hex')
  const enc  = new TextEncoder()
  const key  = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    key, 256,
  )
  const newHash = Buffer.from(bits).toString('hex')
  return timingSafeEqual(Buffer.from(newHash, 'hex'), Buffer.from(storedHash, 'hex'))
}

// ── Invite token ──────────────────────────────────────────────────────────────

export function generateInviteToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')
}

export function inviteExpiry(hoursFromNow = 72): string {
  return new Date(Date.now() + hoursFromNow * 3_600_000).toISOString()
}
