import fs from 'fs'
import path from 'path'
import type { Database } from './types'

const DB_PATH = path.join(process.cwd(), 'data', 'db.json')
const EMPTY: Database = { restaurants: [], categories: [], items: [] }

// Upstash Redis is used in production when these env vars are set
function hasRedis() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

function readFileDb(): Database {
  try {
    if (!fs.existsSync(DB_PATH)) return structuredClone(EMPTY)
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')) as Database
  } catch {
    return structuredClone(EMPTY)
  }
}

function writeFileDb(db: Database): void {
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8')
}

export async function readDb(): Promise<Database> {
  if (hasRedis()) {
    const { Redis } = await import('@upstash/redis')
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
    const stored = await redis.get<Database>('paladeium_db')
    if (!stored) {
      // First run: seed Redis from the bundled db.json
      const seed = readFileDb()
      await redis.set('paladeium_db', seed)
      return seed
    }
    return stored
  }
  return readFileDb()
}

export async function writeDb(db: Database): Promise<void> {
  if (hasRedis()) {
    const { Redis } = await import('@upstash/redis')
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
    await redis.set('paladeium_db', db)
    return
  }
  writeFileDb(db)
}
