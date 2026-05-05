import fs from 'fs'
import path from 'path'
import type { Database, Restaurant, MenuCategory, MenuItem, Order, User } from './types'

const RESTAURANTS_DIR = path.join(process.cwd(), 'restaurants')
const USERS_FILE      = path.join(process.cwd(), 'users.json')

const EMPTY: Database = { restaurants: [], categories: [], items: [], orders: [], users: [] }

function hasRedis() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

// ── Directory helpers ────────────────────────────────────────

export function getRestaurantDir(slug: string): string {
  return path.join(RESTAURANTS_DIR, slug)
}

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true })
}

function readJsonSync<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
  } catch {
    return fallback
  }
}

function writeJsonSync(filePath: string, data: unknown) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

// ── Superadmin bootstrap ─────────────────────────────────────
// On first run with an empty users list, seed a superadmin from env vars.
// Password is stored as plain "env:" prefix so login route handles it
// without needing to hash at write time (hashing is async).

function bootstrapSuperadmin(users: User[]): User[] {
  if (users.length > 0) return users
  const email = process.env.DASHBOARD_EMAIL ?? 'admin@paladeium.com'
  const superadmin: User = {
    id: 'superadmin-bootstrap',
    email,
    passwordHash: `env:${process.env.DASHBOARD_PASSWORD ?? 'changeme'}`,
    role: 'superadmin',
    restaurantIds: [],
    status: 'active',
    inviteToken: null,
    inviteExpiry: null,
    createdAt: new Date().toISOString(),
    createdBy: null,
  }
  return [superadmin]
}

// ── File-based DB ─────────────────────────────────────────────

function scaffoldRestaurantDirs(slug: string) {
  const dir = getRestaurantDir(slug)
  ensureDir(dir)
  ensureDir(path.join(dir, 'models'))
  ensureDir(path.join(dir, 'images'))
  ensureDir(path.join(dir, 'targets'))
}

function readFileDb(): Database {
  const rawUsers  = readJsonSync<User[]>(USERS_FILE, [])
  const users     = bootstrapSuperadmin(rawUsers)

  if (!fs.existsSync(RESTAURANTS_DIR)) return { ...structuredClone(EMPTY), users }

  let slugs: string[] = []
  try {
    slugs = fs.readdirSync(RESTAURANTS_DIR).filter(entry =>
      fs.statSync(path.join(RESTAURANTS_DIR, entry)).isDirectory()
    )
  } catch {
    return { ...structuredClone(EMPTY), users }
  }

  const restaurants: Restaurant[]  = []
  const categories: MenuCategory[] = []
  const items: MenuItem[]          = []
  const orders: Order[]            = []

  for (const slug of slugs) {
    const dir  = getRestaurantDir(slug)
    const rest = readJsonSync<Restaurant | null>(path.join(dir, 'config.json'), null)
    if (!rest) continue
    restaurants.push(rest)
    categories.push(...readJsonSync<MenuCategory[]>(path.join(dir, 'categories.json'), []))
    items.push(...readJsonSync<MenuItem[]>(path.join(dir, 'items.json'), []))
    orders.push(...readJsonSync<Order[]>(path.join(dir, 'orders.json'), []))
  }

  return { restaurants, categories, items, orders, users }
}

function writeFileDb(db: Database): void {
  ensureDir(RESTAURANTS_DIR)

  // Users stored in a single global file
  writeJsonSync(USERS_FILE, db.users ?? [])

  for (const restaurant of db.restaurants) {
    scaffoldRestaurantDirs(restaurant.slug)
    const dir = getRestaurantDir(restaurant.slug)
    writeJsonSync(path.join(dir, 'config.json'),     restaurant)
    writeJsonSync(path.join(dir, 'categories.json'), db.categories.filter(c => c.restaurantId === restaurant.id))
    writeJsonSync(path.join(dir, 'items.json'),      db.items.filter(i => i.restaurantId === restaurant.id))
    writeJsonSync(path.join(dir, 'orders.json'),     (db.orders ?? []).filter(o => o.restaurantId === restaurant.id))
  }
}

// ── Public API ────────────────────────────────────────────────

export async function readDb(): Promise<Database> {
  if (hasRedis()) {
    const { Redis } = await import('@upstash/redis')
    const redis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
    const stored = await redis.get<Database>('paladeium_db')
    if (!stored) {
      const seed = readFileDb()
      await redis.set('paladeium_db', seed)
      return seed
    }
    // Migrate: ensure users array exists in older Redis snapshots
    if (!stored.users) stored.users = bootstrapSuperadmin([])
    return stored
  }
  return readFileDb()
}

export async function writeDb(db: Database): Promise<void> {
  if (hasRedis()) {
    const { Redis } = await import('@upstash/redis')
    const redis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
    await redis.set('paladeium_db', db)
    return
  }
  writeFileDb(db)
}

export async function purgeExpiredDeletions(): Promise<void> {
  const db  = await readDb()
  const now = new Date()
  const toDelete = db.restaurants.filter(
    r => r.status === 'pendingDeletion' && r.deleteAt && new Date(r.deleteAt) <= now
  )
  if (toDelete.length === 0) return
  const ids = new Set(toDelete.map(r => r.id))
  db.restaurants = db.restaurants.filter(r => !ids.has(r.id))
  db.categories  = db.categories.filter(c => !ids.has(c.restaurantId))
  db.items       = db.items.filter(i => !ids.has(i.restaurantId))
  await writeDb(db)
}