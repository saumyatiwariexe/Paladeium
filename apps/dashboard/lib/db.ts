import fs from 'fs'
import path from 'path'
import type { Database } from './types'

const DB_PATH = path.join(process.cwd(), 'data', 'db.json')
const EMPTY: Database = { restaurants: [], categories: [], items: [] }

// Vercel KV is used when these env vars are present (injected by Vercel automatically)
function hasKV() {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
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
  if (hasKV()) {
    const { kv } = await import('@vercel/kv')
    const stored = await kv.get<Database>('paladeium_db')
    if (!stored) {
      // First run: seed KV from the bundled db.json
      const seed = readFileDb()
      await kv.set('paladeium_db', seed)
      return seed
    }
    return stored
  }
  return readFileDb()
}

export async function writeDb(db: Database): Promise<void> {
  if (hasKV()) {
    const { kv } = await import('@vercel/kv')
    await kv.set('paladeium_db', db)
    return
  }
  writeFileDb(db)
}
