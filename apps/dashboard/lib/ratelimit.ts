const WINDOW_SECONDS = 15 * 60 // 15 minutes
const MAX_ATTEMPTS = 5

export async function checkLoginRateLimit(ip: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return { allowed: true }
  }

  const { Redis } = await import('@upstash/redis')
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })

  const key = `ratelimit:login:${ip}`
  const count = await redis.incr(key)
  if (count === 1) await redis.expire(key, WINDOW_SECONDS)

  if (count > MAX_ATTEMPTS) {
    const ttl = await redis.ttl(key)
    return { allowed: false, retryAfter: ttl > 0 ? ttl : WINDOW_SECONDS }
  }

  return { allowed: true }
}
